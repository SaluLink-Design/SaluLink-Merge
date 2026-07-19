'use client';

import { CheckCircle2 } from 'lucide-react';
import type { CareAction, PractitionerRole } from '@/types';
import {
  actionStatusClass,
  getActionStatusLabel,
  getPrimaryCtaLabel,
  isAutoRequirementMet,
  isInvestigationAction,
  isRequirementSatisfied,
  ownerLabel,
  TERMINAL_STATUSES,
  type WorkflowContext,
} from '@/lib/careActions';
import type { ActionTemplate } from '@/lib/cibRegistrationRules';
import { canUploadEvidence } from '@/lib/investigationOrders';
import {
  getInvestigationCtaLabel,
  shouldGpReferForInvestigation,
  type InvestigationReferralInput,
} from '@/lib/investigationCoordination';
import CibInvestigationReferralForm from '@/components/CibInvestigationReferralForm';

interface CareActionCardProps {
  action?: CareAction;
  template: ActionTemplate;
  workflowContext?: WorkflowContext;
  requiredFor?: string;
  variant?: 'focus' | 'default';
  satisfied?: boolean;
  practitionerRole?: PractitionerRole;
  condition?: string;
  caseId?: string;
  referralFormOpen?: boolean;
  onAdvance: (actionId: string) => void;
  onOrderInvestigation?: (actionId: string) => void;
  onReferInvestigation?: (actionId: string) => void;
  onConfirmReferral?: (referral: InvestigationReferralInput) => void;
  onCancelReferral?: () => void;
  isReferring?: boolean;
  onStart?: () => void;
  startLabel?: string;
}

const CareActionCard = ({
  action,
  template,
  workflowContext,
  requiredFor = 'CIB Registration',
  variant = 'default',
  satisfied: satisfiedProp,
  practitionerRole = 'gp',
  condition,
  caseId,
  referralFormOpen = false,
  onAdvance,
  onOrderInvestigation,
  onReferInvestigation,
  onConfirmReferral,
  onCancelReferral,
  isReferring = false,
  onStart,
  startLabel = 'Start Activity',
}: CareActionCardProps) => {
  const autoMet = workflowContext ? isAutoRequirementMet(template, workflowContext) : false;
  const satisfied =
    satisfiedProp ??
    (workflowContext && action
      ? isRequirementSatisfied(template, action ? [action] : [], workflowContext)
      : action
        ? TERMINAL_STATUSES.includes(action.status)
        : false);

  const title =
    action?.status === 'not_started' ? template.actionTitle : (action?.title ?? template.actionTitle);
  const purpose = action?.purpose ?? template.purpose;
  const assignedTo = action?.likelyProviders[0] ?? template.likelyProviders[0] ?? ownerLabel[template.defaultOwner];
  const status = action
    ? getActionStatusLabel(action)
    : template.requirementType === 'investigation' || template.requirementType === 'lab_result'
      ? 'Not Ordered'
      : 'Not Started';
  const statusKey = action?.status ?? 'not_started';

  let ctaLabel = action ? getPrimaryCtaLabel(action) : startLabel;
  if (action && isInvestigationAction(action) && action.status === 'not_started') {
    const investigationCta = getInvestigationCtaLabel(template, practitionerRole, action);
    if (investigationCta) ctaLabel = investigationCta;
  }

  const isReferralCta =
    Boolean(action) &&
    isInvestigationAction(action!) &&
    action!.status === 'not_started' &&
    shouldGpReferForInvestigation(template, practitionerRole);

  const showCta =
    action &&
    ctaLabel &&
    !satisfied &&
    !autoMet &&
    !referralFormOpen &&
    !(action.owner === 'external' && action.status === 'awaiting_completion');

  const showStartCta = !action && onStart && !satisfied;

  const showUpload =
    action &&
    isInvestigationAction(action) &&
    canUploadEvidence(practitionerRole, action) &&
    (action.status === 'awaiting_completion' || action.status === 'requested');

  const cardClass =
    variant === 'focus'
      ? 'rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white p-6 shadow-sm'
      : satisfied
        ? 'rounded-xl border border-emerald-200 bg-emerald-50/40 p-4'
        : 'rounded-xl border border-slate-200 bg-white p-4';

  const handleCta = () => {
    if (!action) return;
    if (isInvestigationAction(action) && action.status === 'not_started') {
      if (isReferralCta && onReferInvestigation) {
        onReferInvestigation(action.id);
        return;
      }
      if (onOrderInvestigation) {
        onOrderInvestigation(action.id);
        return;
      }
    }
    onAdvance(action.id);
  };

  return (
    <div className={cardClass}>
      {variant === 'focus' && (
        <p className="text-xs uppercase tracking-widest text-indigo-600 font-semibold mb-3">
          Next step
        </p>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4
            className={`font-semibold text-slate-900 ${
              variant === 'focus' ? 'text-xl' : 'text-base'
            }`}
          >
            {title}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            Required: {template.requirementLabel}
            {template.code ? ` (code ${template.code})` : ''}
          </p>
        </div>
        {satisfied ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        ) : (
          <span
            className={`text-xs px-2.5 py-1 rounded-full border font-medium shrink-0 ${actionStatusClass[statusKey]}`}
          >
            {autoMet ? 'Complete' : status}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <p>
          <span className="font-medium text-slate-700">Purpose:</span> {purpose}
        </p>
        <p>
          <span className="font-medium text-slate-700">Assigned to:</span> {assignedTo}
        </p>
        {template.gpPathway === 'referral' && practitionerRole === 'gp' && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
            <strong>Care ownership:</strong> GP retains management by default. Specialist confirms handover
            after assessment, or returns report for GP-led CIB submission.
          </div>
        )}
        {template.interpreter && (
          <p className="text-xs text-slate-500">
            Interpretation: {template.interpreter.replace(/_/g, ' ')}
          </p>
        )}
        <p>
          <span className="font-medium text-slate-700">Required for:</span> {requiredFor}
        </p>
        {action?.evidence?.completedAt && (
          <p className="text-emerald-700 text-xs mt-2">
            Evidence received{' '}
            {new Date(action.evidence.completedAt).toLocaleDateString('en-ZA', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        )}
      </div>

      {autoMet && satisfied && (
        <p className="text-xs text-emerald-700 mt-3">Satisfied from this encounter</p>
      )}

      {showCta && (
        <button
          type="button"
          onClick={handleCta}
          className={`mt-4 inline-flex items-center justify-center font-semibold text-white authi-gradient hover:opacity-90 transition ${
            variant === 'focus' ? 'w-full sm:w-auto px-6 py-3 rounded-xl text-sm' : 'px-4 py-2 rounded-lg text-xs'
          }`}
        >
          {ctaLabel}
        </button>
      )}

      {showStartCta && (
        <button
          type="button"
          onClick={onStart}
          className="mt-4 inline-flex items-center justify-center font-semibold text-white authi-gradient hover:opacity-90 transition px-4 py-2 rounded-lg text-xs"
        >
          {startLabel}
        </button>
      )}

      {showUpload && (
        <p className="mt-3 text-xs text-slate-500">
          Upload results as the assigned provider.
        </p>
      )}

      {referralFormOpen && condition && onConfirmReferral && onCancelReferral && (
        <CibInvestigationReferralForm
          embedded
          condition={condition}
          template={template}
          caseId={caseId}
          onCancel={onCancelReferral}
          onConfirm={onConfirmReferral}
          isSubmitting={isReferring}
        />
      )}
    </div>
  );
};

export default CareActionCard;
