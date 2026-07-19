'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ChronicConditionCase, PractitionerRole } from '@/types';
import CareActionCard from '@/components/CareActionCard';
import type { InvestigationReferralInput } from '@/lib/investigationCoordination';
import {
  compileActionTemplate,
  getRequirementsForPath,
  loadCibRegistrationRules,
  getConditionRules,
  resolveApprovalPathForPractitioner,
  type ActionTemplate,
} from '@/lib/cibRegistrationRules';
import {
  findActionForRequirement,
  isExternalEvidenceTemplate,
  isInvestigationAction,
  isRegistrationCoordinationTemplate,
  isRequirementSatisfied,
  isWizardRequirementTemplate,
  type WorkflowContext,
} from '@/lib/careActions';

interface CareCoordinationPanelProps {
  condition: string;
  chronicCase: ChronicConditionCase | undefined;
  approvalPathId?: string;
  workflowContext: WorkflowContext;
  practitionerRole?: PractitionerRole;
  caseId?: string;
  activeReferralActionId?: string | null;
  onAdvanceAction: (actionId: string) => void;
  onOrderInvestigation?: (actionId: string) => void;
  onReferInvestigation?: (actionId: string) => void;
  onConfirmReferral?: (referral: InvestigationReferralInput) => void;
  onCancelReferral?: () => void;
  isReferring?: boolean;
  showPathSelector?: boolean;
  focusActionKey?: string | null;
  templateFilter?: 'external_only' | 'all_wizard' | 'coordination';
}

const CareCoordinationPanel = ({
  condition,
  chronicCase,
  approvalPathId,
  workflowContext,
  practitionerRole = 'gp',
  caseId,
  activeReferralActionId = null,
  onAdvanceAction,
  onOrderInvestigation,
  onReferInvestigation,
  onConfirmReferral,
  onCancelReferral,
  isReferring = false,
  showPathSelector = false,
  focusActionKey = null,
  templateFilter = 'external_only',
}: CareCoordinationPanelProps) => {
  const [loading, setLoading] = useState(true);
  const [conditionRules, setConditionRules] = useState<
    ReturnType<typeof getConditionRules> extends infer T ? T : never
  >(undefined);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadCibRegistrationRules()
      .then((rules) => {
        if (cancelled) return;
        setConditionRules(getConditionRules(rules, condition));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [condition]);

  const templates = useMemo((): ActionTemplate[] => {
    if (!conditionRules) return [];
    const pathIsValid = conditionRules.approvalPaths.some((path) => path.id === approvalPathId);
    const effectivePathId = pathIsValid
      ? approvalPathId!
      : resolveApprovalPathForPractitioner(practitionerRole, conditionRules);
    return getRequirementsForPath(conditionRules, effectivePathId).map(compileActionTemplate);
  }, [conditionRules, approvalPathId, practitionerRole]);

  const actions = chronicCase?.careActions.filter((a) => a.phase === 'registration') ?? [];

  const handleAdvance = (actionId: string) => {
    const action = actions.find((a) => a.id === actionId);
    if (action && isInvestigationAction(action) && action.status === 'not_started' && onOrderInvestigation) {
      onOrderInvestigation(actionId);
      return;
    }
    onAdvanceAction(actionId);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 p-6 flex items-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading CIB requirements…
      </div>
    );
  }

  if (!conditionRules) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        No structured CIB registration rules for <strong>{condition}</strong> yet.
      </div>
    );
  }

  const activePath =
    conditionRules.approvalPaths.find((p) => p.id === approvalPathId) ??
    conditionRules.approvalPaths.find(
      (p) => p.id === resolveApprovalPathForPractitioner(practitionerRole, conditionRules)
    );

  const listTemplates = templates.filter((t) => {
    if (templateFilter === 'coordination' && !isRegistrationCoordinationTemplate(t)) return false;
    if (templateFilter === 'external_only' && !isExternalEvidenceTemplate(t)) return false;
    if (templateFilter === 'all_wizard' && !isWizardRequirementTemplate(t)) return false;
    if (focusActionKey && t.requirementKey === focusActionKey) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {!showPathSelector && activePath && (
        <p className="text-xs text-slate-500">
          Pathway: <span className="font-medium text-slate-700">{activePath.label}</span>
        </p>
      )}

      <div className="space-y-3">
        {listTemplates.map((template) => {
          const action = findActionForRequirement(actions, template.requirementKey);
          const satisfied = isRequirementSatisfied(template, actions, workflowContext);
          if (!action) return null;

          return (
            <CareActionCard
              key={template.requirementKey}
              template={template}
              action={action}
              workflowContext={workflowContext}
              satisfied={satisfied}
              practitionerRole={practitionerRole}
              condition={condition}
              caseId={caseId}
              referralFormOpen={activeReferralActionId === action.id}
              onAdvance={handleAdvance}
              onOrderInvestigation={onOrderInvestigation}
              onReferInvestigation={onReferInvestigation}
              onConfirmReferral={onConfirmReferral}
              onCancelReferral={onCancelReferral}
              isReferring={isReferring}
            />
          );
        })}
      </div>
    </div>
  );
};

export default CareCoordinationPanel;
