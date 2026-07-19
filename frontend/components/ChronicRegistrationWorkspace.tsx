'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Send,
  Stethoscope,
  Pill,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import {
  SelectedMedication,
  MedicalScheme,
  BenefitState,
  ChronicConditionCase,
  PractitionerRole,
  RegistrationPhase,
  TreatmentItem,
} from '@/types';
import EvidenceCompletenessPanel from '@/components/EvidenceCompletenessPanel';
import CibApplicationOverview from '@/components/CibApplicationOverview';
import CareCoordinationPanel from '@/components/CareCoordinationPanel';
import CareActionCard from '@/components/CareActionCard';
import RegistrationProgressBar from '@/components/RegistrationProgressBar';
import IcdCodeSelection from '@/components/IcdCodeSelection';
import MedicationSelection from '@/components/MedicationSelection';
import FundingSourceBadge from '@/components/FundingSourceBadge';
import MockProviderResultsPanel from '@/components/MockProviderResultsPanel';
import CibEvidenceInline from '@/components/CibEvidenceInline';
import SpecialistOutcomePanel, { type SpecialistOutcomeResult } from '@/components/SpecialistOutcomePanel';
import { fundingSourceLabel } from '@/lib/benefitState';
import {
  allExternalEvidenceOrdered,
  compileActionTemplate,
  computeRegistrationProgress,
  canSubmitCibRegistration,
  findActionForRequirement,
  getNextRegistrationAction,
  getRequirementsForPath,
  isExternalEvidenceTemplate,
  isRegistrationCoordinationTemplate,
  isRequirementSatisfied,
  syncActionsFromCibEvidence,
  type WorkflowContext,
} from '@/lib/careActions';
import { getConditionRules, loadCibRegistrationRules, resolveApprovalPathForPractitioner } from '@/lib/cibRegistrationRules';
import { getOrderForAction, allOrdersResultsReceived } from '@/lib/investigationOrders';
import { parseMedicineLabel } from '@/lib/medicineStrength';
import type { InvestigationReferralInput } from '@/lib/investigationCoordination';
import type { ActionTemplate } from '@/lib/cibRegistrationRules';

interface ChronicRegistrationWorkspaceProps {
  profileId: string;
  patientName: string;
  patientId: string;
  medicalAidNumber?: string;
  medicalScheme: MedicalScheme;
  selectedCondition: string;
  selectedIcdCode: string | null;
  selectedIcdDescription: string | null;
  clinicalNote: string;
  diagnosticTreatments?: TreatmentItem[];
  medications: SelectedMedication[];
  diagnosisDate: string;
  selectedPlan: string;
  benefitState: BenefitState;
  chronicCase?: ChronicConditionCase;
  approvalPathId?: string;
  caseId?: string;
  practitionerRole?: PractitionerRole;
  onSelectIcd: (icdCode: string, description: string) => void;
  onDiagnosisDateChange?: (date: string) => void;
  onAdvanceCareAction: (actionId: string) => void;
  onOrderInvestigation: (actionId: string) => void;
  onReferInvestigation: (
    actionId: string,
    referral: InvestigationReferralInput
  ) => void;
  /** Close the GP's CIB workflow after the referral-sent notice is dismissed. */
  onReferralSent?: (referral: InvestigationReferralInput) => void;
  onMockReceiveResults: (orderId: string) => void;
  onSetRegistrationPhase: (phase: RegistrationPhase) => void;
  onSetInterpretation: (actionId: string, notes: string) => void;
  onAddMedication: (medication: SelectedMedication) => void;
  onRemoveMedication: (index: number) => void;
  onUpdateMedicationSection12: (
    index: number,
    fields: Partial<
      Pick<
        SelectedMedication,
        'dosage' | 'durationUsed' | 'dateFirstDiagnosed' | 'selectedStrength' | 'medicineNameAndStrength'
      >
    >
  ) => void;
  onEnsureApprovalPath?: () => void;
  /** Backfill registration care actions when CIB rules expand (e.g. neurologist EEG added) */
  onSyncRegistrationActions?: () => void;
  /** Materialize actions immediately from rules already loaded by this screen. */
  onPrepareRegistrationActions?: (templates: ActionTemplate[]) => void;
  /** Called when specialist records their post-EEG ownership decision */
  onSpecialistOutcome?: (result: SpecialistOutcomeResult) => void;
  onBack: () => void;
  onSubmit: (motivationNote: string) => Promise<void>;
  isSubmitting?: boolean;
}

const schemeLabel: Record<MedicalScheme, string> = {
  discovery: 'Discovery Health',
  gems: 'GEMS',
};

const PHASE_STEPS: { id: RegistrationPhase; label: string }[] = [
  { id: 'application_overview', label: 'Overview' },
  { id: 'requirements', label: 'Evidence' },
  { id: 'awaiting_results', label: 'Awaiting results' },
  { id: 'interpretation', label: 'Interpretation' },
  { id: 'icd_code', label: 'ICD Code' },
  { id: 'medication', label: 'Medication' },
  { id: 'ready_to_submit', label: 'Review & submit' },
];

const normalizeRegistrationPhase = (phase: RegistrationPhase): RegistrationPhase => {
  if (phase === 'clinical_pack') return 'icd_code';
  if (phase === 'not_started') return 'application_overview';
  return phase;
};

const ChronicRegistrationWorkspace = ({
  patientName,
  patientId,
  medicalAidNumber,
  medicalScheme,
  selectedCondition,
  selectedIcdCode,
  selectedIcdDescription,
  clinicalNote,
  diagnosticTreatments = [],
  medications,
  diagnosisDate,
  selectedPlan,
  benefitState,
  chronicCase,
  approvalPathId,
  caseId,
  practitionerRole = 'gp',
  onSelectIcd,
  onDiagnosisDateChange,
  onAdvanceCareAction,
  onOrderInvestigation,
  onReferInvestigation,
  onReferralSent,
  onMockReceiveResults,
  onSetRegistrationPhase,
  onSetInterpretation,
  onAddMedication,
  onRemoveMedication,
  onUpdateMedicationSection12,
  onEnsureApprovalPath,
  onSyncRegistrationActions,
  onPrepareRegistrationActions,
  onSpecialistOutcome,
  onBack,
  onSubmit,
  isSubmitting = false,
}: ChronicRegistrationWorkspaceProps) => {
  const [rulesReady, setRulesReady] = useState(false);
  const [hasRules, setHasRules] = useState(false);
  const [templates, setTemplates] = useState<ActionTemplate[]>([]);
  const [effectiveApprovalPathId, setEffectiveApprovalPathId] = useState<string | null>(null);
  const [pathwayLabel, setPathwayLabel] = useState<string | null>(null);
  const [pendingReferActionId, setPendingReferActionId] = useState<string | null>(null);
  const [isReferring, setIsReferring] = useState(false);
  const [specialistOutcome, setSpecialistOutcome] = useState<SpecialistOutcomeResult | null>(null);
  const [optimisticPhase, setOptimisticPhase] = useState<RegistrationPhase | null>(null);

  const onEnsureApprovalPathRef = useRef(onEnsureApprovalPath);
  onEnsureApprovalPathRef.current = onEnsureApprovalPath;
  const onSyncRegistrationActionsRef = useRef(onSyncRegistrationActions);
  onSyncRegistrationActionsRef.current = onSyncRegistrationActions;
  const onPrepareRegistrationActionsRef = useRef(onPrepareRegistrationActions);
  onPrepareRegistrationActionsRef.current = onPrepareRegistrationActions;

  useEffect(() => {
    if (!rulesReady || !effectiveApprovalPathId || templates.length === 0) return;
    onSyncRegistrationActionsRef.current?.();
  }, [rulesReady, effectiveApprovalPathId, selectedCondition, templates.length]);

  useEffect(() => {
    setRulesReady(false);
    loadCibRegistrationRules()
      .then((rules) => {
        const conditionRules = getConditionRules(rules, selectedCondition);
        setHasRules(Boolean(conditionRules));
        if (!conditionRules) {
          setTemplates([]);
          setEffectiveApprovalPathId(null);
          setPathwayLabel(null);
          setRulesReady(true);
          return;
        }

        // Resolve path synchronously so the overview checklist is never blank while
        // approvalPathId is still being persisted on the chronic case record.
        const approvalPathIsValid = conditionRules.approvalPaths.some(
          (path) => path.id === approvalPathId
        );
        const effectivePathId = approvalPathIsValid
          ? approvalPathId!
          : resolveApprovalPathForPractitioner(practitionerRole, conditionRules);

        const compiledTemplates = getRequirementsForPath(conditionRules, effectivePathId).map(
          compileActionTemplate
        );
        setEffectiveApprovalPathId(effectivePathId);
        setTemplates(compiledTemplates);
        onPrepareRegistrationActionsRef.current?.(compiledTemplates);
        const path = conditionRules.approvalPaths.find((p) => p.id === effectivePathId);
        setPathwayLabel(path?.label ?? null);

        if (!approvalPathIsValid) {
          onEnsureApprovalPathRef.current?.();
        }
        setRulesReady(true);
      })
      .catch(() => {
        setHasRules(false);
        setTemplates([]);
        setEffectiveApprovalPathId(null);
        setPathwayLabel(null);
        setRulesReady(true);
      });
  }, [selectedCondition, approvalPathId, practitionerRole]);

  const workflowContext: WorkflowContext = useMemo(
    () => ({
      icdCode: selectedIcdCode ?? undefined,
      diagnosisDate,
      clinicalNote,
      cibEvidence: chronicCase?.cibEvidence,
    }),
    [selectedIcdCode, diagnosisDate, clinicalNote, chronicCase?.cibEvidence]
  );

  const registrationActions = useMemo(() => {
    if (!chronicCase) return [];
    const synced = syncActionsFromCibEvidence(chronicCase);
    return synced.filter((a) => a.phase === 'registration');
  }, [chronicCase]);

  const progress = useMemo(() => {
    if (!templates.length) {
      return { total: 0, completed: 0, percent: 0, items: [] };
    }
    return computeRegistrationProgress(templates, registrationActions, workflowContext);
  }, [templates, registrationActions, workflowContext]);

  const persistedRegistrationPhase: RegistrationPhase = normalizeRegistrationPhase(
    chronicCase?.registrationPhase ?? 'application_overview'
  );
  const registrationPhase = optimisticPhase ?? persistedRegistrationPhase;

  useEffect(() => {
    setOptimisticPhase(null);
  }, [chronicCase?.registrationPhase]);

  useEffect(() => {
    if (chronicCase && (chronicCase.registrationPhase ?? 'not_started') === 'not_started') {
      onSetRegistrationPhase('application_overview');
    }
  }, [chronicCase, onSetRegistrationPhase]);

  const nextFocus = useMemo(
    () => getNextRegistrationAction(templates, registrationActions, workflowContext),
    [templates, registrationActions, workflowContext]
  );

  const submitGate = canSubmitCibRegistration(progress);
  const orders = chronicCase?.investigationOrders ?? [];
  const externalTemplates = templates.filter(isExternalEvidenceTemplate);

  const reviewDiagnosticTreatments = useMemo((): TreatmentItem[] => {
    if (diagnosticTreatments.length > 0) return diagnosticTreatments;
    return (chronicCase?.cibEvidence ?? []).map((e) => ({
      description: e.description,
      code: e.code,
      maxCovered: 1,
      timesCompleted: e.documentation?.notes?.trim() ? 1 : 0,
      documentation: e.documentation ?? { notes: '', images: [] },
    }));
  }, [diagnosticTreatments, chronicCase?.cibEvidence]);

  const focusSatisfied =
    nextFocus &&
    isRequirementSatisfied(nextFocus.template, registrationActions, workflowContext);

  const handleSubmit = () => {
    if (!selectedIcdCode) {
      alert('Confirm an ICD-10 code before submitting.');
      return;
    }
    if (!diagnosisDate) {
      alert('Diagnosis date is required for CIB registration.');
      return;
    }
    if (hasRules && !submitGate.ok) {
      alert(submitGate.reason);
      return;
    }
    void onSubmit('');
  };

  const goToPhase = (phase: RegistrationPhase) => {
    // Update the screen immediately; persistence follows synchronously through
    // the parent store callback. This prevents a delayed setup render from
    // making Start application appear dead.
    setOptimisticPhase(phase);
    onSetRegistrationPhase(phase);
    if (phase === 'requirements') {
      // Immediate local materialization; the async sync remains a compatibility
      // backfill and never blocks navigation.
      onPrepareRegistrationActionsRef.current?.(templates);
      onSyncRegistrationActionsRef.current?.();
    }
  };

  const handleOpenReferral = (actionId: string) => setPendingReferActionId(actionId);

  const handleCancelReferral = () => setPendingReferActionId(null);

  const handleConfirmReferral = async (referral: InvestigationReferralInput) => {
    if (!pendingReferActionId) return;
    setIsReferring(true);
    try {
      onReferInvestigation(pendingReferActionId, referral);
      setPendingReferActionId(null);
    } finally {
      setIsReferring(false);
    }
    onReferralSent?.(referral);
  };

  const canContinueFromRequirements = allExternalEvidenceOrdered(templates, registrationActions);
  const canContinueFromAwaiting = orders.length > 0 && allOrdersResultsReceived(orders);
  const canContinueFromInterpretation = externalTemplates.every((t) => {
    const action = findActionForRequirement(registrationActions, t.requirementKey);
    return action?.evidence?.interpretationNotes?.trim();
  });
  const canContinueFromIcdCode = Boolean(selectedIcdCode) && Boolean(diagnosisDate);
  const canContinueFromMedication =
    medications.length > 0 &&
    medications.every((med) => {
      if (!med.catalogueLabel) return true;
      const strengths = parseMedicineLabel(med.catalogueLabel).strengths;
      if (strengths.length <= 1) return true;
      return Boolean(med.selectedStrength);
    });
  const coordinationTemplates = templates.filter(isRegistrationCoordinationTemplate);

  const renderPhaseNav = () => (
    <div className="flex flex-wrap gap-2 mb-6">
      {PHASE_STEPS.map((step, i) => {
        const active = registrationPhase === step.id;
        const done =
          PHASE_STEPS.findIndex((s) => s.id === registrationPhase) > i;
        return (
          <div
            key={step.id}
            className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border ${
              active
                ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                : done
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 text-slate-500'
            }`}
          >
            <span>{i + 1}.</span> {step.label}
          </div>
        );
      })}
    </div>
  );

  const renderApplicationOverview = () => (
    <CibApplicationOverview
      condition={selectedCondition}
      pathwayLabel={pathwayLabel ?? undefined}
      progress={progress}
      templates={templates}
      actions={registrationActions}
      workflowContext={workflowContext}
      onStart={() => goToPhase('requirements')}
    />
  );

  const renderRequirements = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900">Evidence coordination</h3>
        <p className="text-sm text-slate-500 mt-1">
          Order investigations, coordinate providers, and work through each evidence requirement.
        </p>
      </div>

      {templates.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No evidence requirements were found for this pathway. Return to the overview and retry,
          or check the condition&apos;s CIB rules.
        </div>
      )}

      {templates.length > 0 && registrationActions.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Preparing evidence requirements…
        </div>
      )}

      {templates.length > 0 &&
        registrationActions.length > 0 &&
        coordinationTemplates.length === 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            This pathway has no investigations or external evidence to coordinate. You can continue.
          </div>
        )}

      {nextFocus?.action && (
        <CareActionCard
          variant="focus"
          template={nextFocus.template}
          action={nextFocus.action}
          workflowContext={workflowContext}
          satisfied={Boolean(focusSatisfied)}
          practitionerRole={practitionerRole}
          condition={selectedCondition}
          caseId={caseId}
          referralFormOpen={pendingReferActionId === nextFocus.action.id}
          onAdvance={onAdvanceCareAction}
          onOrderInvestigation={onOrderInvestigation}
          onReferInvestigation={handleOpenReferral}
          onConfirmReferral={handleConfirmReferral}
          onCancelReferral={handleCancelReferral}
          isReferring={isReferring}
        />
      )}

      <CareCoordinationPanel
        condition={selectedCondition}
        chronicCase={chronicCase}
        approvalPathId={effectiveApprovalPathId ?? approvalPathId}
        workflowContext={workflowContext}
        practitionerRole={practitionerRole}
        caseId={caseId}
        activeReferralActionId={pendingReferActionId}
        onAdvanceAction={onAdvanceCareAction}
        onOrderInvestigation={onOrderInvestigation}
        onReferInvestigation={handleOpenReferral}
        onConfirmReferral={handleConfirmReferral}
        onCancelReferral={handleCancelReferral}
        isReferring={isReferring}
        focusActionKey={nextFocus?.template.requirementKey ?? null}
        templateFilter="coordination"
      />

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => goToPhase('application_overview')}
          className="btn-secondary inline-flex items-center gap-2 px-4 py-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          type="button"
          disabled={!canContinueFromRequirements}
          onClick={() => goToPhase('awaiting_results')}
          className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const referralOrders = orders.filter((o) => o.coordinationType === 'referral');
  const pendingOwnershipReferralOrder = referralOrders.find(
    (o) => o.status === 'results_received'
  );
  const needsOwnershipDecision =
    Boolean(pendingOwnershipReferralOrder) && specialistOutcome === null;
  const canContinueFromAwaitingWithOwnership =
    canContinueFromAwaiting && (!needsOwnershipDecision || specialistOutcome !== null);

  const handleSpecialistOutcomeConfirmed = (result: SpecialistOutcomeResult) => {
    setSpecialistOutcome(result);
    onSpecialistOutcome?.(result);
  };

  const referralSpecialistType = referralOrders[0]?.referralSpecialty;
  const hasActiveReferral = referralOrders.some((o) => o.status !== 'results_received');

  const renderAwaitingResults = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900">Awaiting specialist results</h3>
        <p className="text-sm text-slate-500 mt-1">
          {hasActiveReferral && referralSpecialistType
            ? `This case has been referred to ${referralSpecialistType}. Awaiting investigation results and specialist registration — no further action required from you at this stage.`
            : 'Investigations have been ordered. Results will be uploaded by the assigned provider.'}
        </p>
      </div>

      {hasActiveReferral && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 text-sm text-violet-800">
          <p className="font-semibold mb-0.5">
            {referralSpecialistType
              ? `Referral sent to ${referralSpecialistType}`
              : 'Referral sent to specialist'}
          </p>
          <p className="text-xs leading-relaxed">
            The specialist will record their findings, select the ICD-10 code, prescribe medication, and
            submit the CIB registration. You will see a confirmation on this case once they have completed
            registration.
          </p>
          <a
            href="/referrals"
            className="inline-block mt-2 text-xs font-semibold underline underline-offset-2 hover:text-violet-900 transition-colors"
          >
            View outbound referral status →
          </a>
        </div>
      )}

      <ul className="space-y-3">
        {orders.map((order) => {
          const showOwnershipDecision =
            order.coordinationType === 'referral' &&
            order.status === 'results_received' &&
            needsOwnershipDecision &&
            pendingOwnershipReferralOrder?.id === order.id;

          return (
            <li
              key={order.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{order.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {order.coordinationType === 'referral' ? (
                      <>
                        Referred to {order.referralSpecialty ?? 'specialist'}
                        {order.referredAt &&
                          ` · ${new Date(order.referredAt).toLocaleDateString('en-ZA')}`}
                        {' · '}
                        Awaiting {order.assigneeRole.replace(/_/g, ' ')}
                      </>
                    ) : (
                      <>
                        Assigned to {order.assigneeRole.replace(/_/g, ' ')} · Ordered{' '}
                        {new Date(order.orderedAt).toLocaleDateString('en-ZA')}
                      </>
                    )}
                  </p>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium shrink-0 ${
                    order.status === 'results_received'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : order.coordinationType === 'referral'
                        ? 'bg-violet-50 text-violet-800 border-violet-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {order.status === 'results_received'
                    ? 'Results received'
                    : order.coordinationType === 'referral'
                      ? 'Referred — awaiting results'
                      : 'Awaiting results'}
                </span>
              </div>

              {showOwnershipDecision && (
                <SpecialistOutcomePanel
                  embedded
                  referralId={order.referralId}
                  specialistType={order.referralSpecialty ?? 'Specialist'}
                  condition={selectedCondition}
                  onDecisionConfirmed={handleSpecialistOutcomeConfirmed}
                />
              )}
            </li>
          );
        })}
      </ul>

      <MockProviderResultsPanel orders={orders} onSimulateResults={onMockReceiveResults} />

      {specialistOutcome && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            specialistOutcome.careOwnership === 'specialist_accepted'
              ? 'border-violet-200 bg-violet-50 text-violet-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <p className="font-semibold mb-1">
            {specialistOutcome.careOwnership === 'specialist_accepted'
              ? 'Specialist accepted chronic management'
              : 'Returned to GP — specialist report attached'}
          </p>
          <p className="text-xs">{specialistOutcome.specialistOutcomeNote}</p>
        </div>
      )}

      <div className="flex justify-between">
        <button type="button" onClick={() => goToPhase('requirements')} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        {!hasActiveReferral && (
          <button
            type="button"
            disabled={!canContinueFromAwaitingWithOwnership}
            onClick={() => goToPhase('interpretation')}
            className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 disabled:opacity-50"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  const renderInterpretation = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900">Interpret results</h3>
        <p className="text-sm text-slate-500 mt-1">
          Review provider reports and document your clinical interpretation for CIB registration.
        </p>
      </div>

      {externalTemplates.map((template) => {
        const action = findActionForRequirement(registrationActions, template.requirementKey);
        const order = action ? getOrderForAction(orders, action.id) : undefined;
        const evidenceIdx = (chronicCase?.cibEvidence ?? []).findIndex(
          (e) => e.code === template.code
        );
        const evidenceItem =
          evidenceIdx >= 0 ? chronicCase!.cibEvidence![evidenceIdx] : undefined;
        if (!action || !evidenceItem) return null;

        return (
          <div key={template.requirementKey} className="space-y-2">
            <CibEvidenceInline
              evidenceItem={evidenceItem}
              evidenceIndex={evidenceIdx}
              mode="interpretation"
              interpretationNotes={action.evidence?.interpretationNotes ?? ''}
              onUpdateEvidence={() => {}}
              onInterpretationChange={(notes) => onSetInterpretation(action.id, notes)}
            />
            {order?.status === 'results_received' && (
              <p className="text-xs text-emerald-700">Provider results received</p>
            )}
          </div>
        );
      })}

      <div className="flex justify-between">
        <button type="button" onClick={() => goToPhase('awaiting_results')} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          type="button"
          disabled={!canContinueFromInterpretation}
          onClick={() => goToPhase('icd_code')}
          className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 disabled:opacity-50"
        >
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderIcdCodeStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900">ICD Code</h3>
        <p className="text-sm text-slate-500 mt-1">
          Confirm the ICD-10 code and date first diagnosed for scheme submission.
        </p>
      </div>

      <IcdCodeSelection
        condition={selectedCondition}
        selectedIcdCode={selectedIcdCode}
        onSelect={onSelectIcd}
      />
      {selectedIcdDescription && <p className="text-sm text-slate-600">{selectedIcdDescription}</p>}

      <div>
        <label htmlFor="diagnosis-date" className="label">Date first diagnosed</label>
        <input
          id="diagnosis-date"
          type="date"
          className="input-field max-w-xs"
          value={diagnosisDate}
          onChange={(e) => onDiagnosisDateChange?.(e.target.value)}
        />
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={() => goToPhase('interpretation')} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          type="button"
          disabled={!canContinueFromIcdCode}
          onClick={() => goToPhase('medication')}
          className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 disabled:opacity-50"
        >
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderMedicationStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900">Medication</h3>
        <p className="text-sm text-slate-500 mt-1">
          Select Section 12 medicines and capture dosage details.
        </p>
      </div>

      <MedicationSelection
        condition={selectedCondition}
        selectedPlan={selectedPlan as import('@/types').MedicalPlan}
        benefitState={benefitState}
        medications={medications}
        onAddMedication={onAddMedication}
        onRemoveMedication={onRemoveMedication}
        showSection12Fields
        onUpdateSection12={onUpdateMedicationSection12}
      />

      <div className="flex justify-between">
        <button type="button" onClick={() => goToPhase('icd_code')} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          type="button"
          disabled={!canContinueFromMedication}
          onClick={() => goToPhase('ready_to_submit')}
          className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 disabled:opacity-50"
        >
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );


  const renderReviewSubmit = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900">Review &amp; submit</h3>
        <p className="text-sm text-slate-500 mt-1">
          Confirm diagnosis, evidence, and medicines — then submit to Discovery&apos;s chronic programme
        </p>
      </div>

      <div className="brand-info-box border-2">
        <p className="text-sm text-violet-800">
          This replaces the generic claim save for unregistered patients. Submitting registers the
          condition as <strong>pending CIB review</strong> with the evidence gathered in this encounter.
        </p>
      </div>

      {specialistOutcome && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            specialistOutcome.careOwnership === 'specialist_accepted'
              ? 'border-violet-200 bg-violet-50 text-violet-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <p className="font-semibold mb-1">
            {specialistOutcome.careOwnership === 'specialist_accepted'
              ? 'CIB submission: specialist-led pathway'
              : 'CIB submission: GP-led pathway (specialist report attached)'}
          </p>
          <p className="text-xs">{specialistOutcome.specialistOutcomeNote}</p>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Stethoscope className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Confirmed diagnosis</h3>
        </div>
        <p className="font-medium text-slate-800">{selectedCondition}</p>
        <p className="text-blue-600 font-mono font-semibold mt-1">{selectedIcdCode || '—'}</p>
        {selectedIcdDescription && (
          <p className="text-sm text-slate-500">{selectedIcdDescription}</p>
        )}
        {diagnosisDate && (
          <p className="text-xs text-slate-600 mt-2">Diagnosis date: {diagnosisDate}</p>
        )}
      </div>

      <EvidenceCompletenessPanel
        conditionName={selectedCondition}
        icdCode={selectedIcdCode ?? ''}
        clinicalNote={clinicalNote}
        benefitState={benefitState}
        diagnosticTreatments={reviewDiagnosticTreatments}
        diagnosisDate={diagnosisDate}
        onDiagnosisDateChange={onDiagnosisDateChange}
        medicationsFormularyAligned={medications.every((m) => m.formularyStatus === 'listed')}
      />

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Clinical note</h3>
        </div>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">
          {clinicalNote?.trim() || '—'}
        </p>
      </div>

      {medications.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Pill className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Medicines for CIB ({medications.length})</h3>
          </div>
          <ul className="space-y-2">
            {medications.map((med, i) => (
              <li key={i} className="text-sm border border-slate-100 rounded-lg p-3 bg-white">
                <p className="font-medium text-slate-900">{med.medicineNameAndStrength}</p>
                <p className="text-xs text-slate-500">{med.activeIngredient}</p>
                {(med.dosage || med.durationUsed) && (
                  <p className="text-xs text-slate-600 mt-1">
                    {med.dosage && `Dosage: ${med.dosage}`}
                    {med.durationUsed && ` · Duration: ${med.durationUsed}`}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {med.fundingSource && (
                    <FundingSourceBadge source={med.fundingSource} compact />
                  )}
                  <span className="text-xs text-slate-600">
                    {med.fundingSource ? fundingSourceLabel[med.fundingSource] : med.coverageNote}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-between">
        <button type="button" onClick={() => goToPhase('medication')} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        {hasRules && !submitGate.ok && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            {submitGate.reason}
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || (hasRules && !submitGate.ok)}
          className="btn-primary inline-flex items-center gap-2 px-8 py-3 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {isSubmitting ? 'Submitting…' : 'Submit CIB registration'}
        </button>
      </div>
    </div>
  );

  const renderPhaseContent = () => {
    switch (registrationPhase) {
      case 'application_overview':
      case 'not_started':
        return renderApplicationOverview();
      case 'requirements':
        return renderRequirements();
      case 'awaiting_results':
        return renderAwaitingResults();
      case 'interpretation':
        return renderInterpretation();
      case 'icd_code':
      case 'clinical_pack':
        return renderIcdCodeStep();
      case 'medication':
        return renderMedicationStep();
      case 'ready_to_submit':
        return renderReviewSubmit();
      default:
        return renderApplicationOverview();
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl authi-gradient flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Chronic Registration Workspace</h2>
            <p className="text-sm text-slate-500">
              {selectedCondition} — step by step through evidence, interpretation, and submission
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 mb-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Patient</p>
            <p className="font-semibold text-slate-900">{patientName}</p>
            <p className="text-sm text-slate-600">{patientId}</p>
            <p className="text-xs text-slate-500 mt-2">Aid: {medicalAidNumber || '—'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Scheme & plan</p>
            <p className="font-semibold text-slate-900">{schemeLabel[medicalScheme]}</p>
            <p className="text-sm text-slate-600">{selectedPlan} plan</p>
          </div>
        </div>

        {hasRules && progress.total > 0 && (
          <RegistrationProgressBar
            percent={progress.percent}
            completed={progress.completed}
            total={progress.total}
          />
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {renderPhaseNav()}
        {!rulesReady ? (
          <div className="flex items-center gap-3 text-slate-500 py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading registration rules…
          </div>
        ) : (
          renderPhaseContent()
        )}
      </div>

      <div className="flex justify-start">
        <button type="button" onClick={onBack} className="btn-secondary px-6 py-3" disabled={isSubmitting}>
          Back to condition
        </button>
      </div>
    </div>
  );
};

export default ChronicRegistrationWorkspace;
