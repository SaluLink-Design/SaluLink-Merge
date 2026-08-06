'use client';

import { useState } from 'react';
import { Activity, ArrowLeft, CheckCircle, Plus } from 'lucide-react';
import {
  BenefitState,
  ClinicalAppeal,
  ClinicalReviewStatus,
  FollowUpVisitActions,
  MedicalPlan,
  MedicationMode,
  MedicationRenewNotes,
  PatientCase,
  ProgressReview,
  SelectedMedication,
  TreatmentItem,
  PractitionerRole,
  InvestigationOrder,
} from '@/types';
import MedicationReport, { MedicationReportFormData } from './MedicationReport';
import MedicationReportSummaryCard from './MedicationReportSummaryCard';
import Referral, { ReferralFormData } from './Referral';
import OngoingManagement from './OngoingManagement';
import { suggestNeurologistSpecialty } from '@/lib/sharedCare';
import {
  composeReferralNotesWithFindings,
  formatMedicationReportFindings,
} from '@/lib/medicationReportSummary';
import type { InvestigationReferralInput } from '@/lib/investigationCoordination';
import type { SpecialistVisitUsageSummary } from '@/lib/specialistVisitUsage';

export interface FollowUpCompletionPayload {
  includeMedicationReport: boolean;
  includeReferral: boolean;
  medicationReport?: MedicationReportFormData;
  referral?: ReferralFormData;
  medicationMode?: MedicationMode | null;
  medicationRenewNotes?: MedicationRenewNotes;
}

interface FollowUpDocumentationProps {
  patientCase: PatientCase;
  visitActions: FollowUpVisitActions;
  medicationMode: MedicationMode | null;
  medicationRenewNotes: MedicationRenewNotes;
  onMedicationRenewNotesChange: (notes: Partial<MedicationRenewNotes>) => void;
  onClinicalReviewChange?: (
    status: ClinicalReviewStatus | null,
    basis?: string
  ) => void;
  /** Lets the doctor continue from a medication report into monitoring in the same visit. */
  onVisitActionsChange?: (updates: Partial<FollowUpVisitActions>) => void;
  progressReview: ProgressReview;
  ongoingTreatments: TreatmentItem[];
  currentMedications: SelectedMedication[];
  medicationNote: string;
  condition: string;
  selectedPlan: MedicalPlan;
  benefitState?: BenefitState | null;
  diagnosticClinicalNote: string;
  assessmentNote?: string;
  initialFollowUpNotes?: string;
  monitoringSkipped?: boolean;
  specialistFlow?: boolean;
  specialistVisitUsage?: SpecialistVisitUsageSummary | null;
  onAddTreatment: (treatment: TreatmentItem) => void;
  onUpdateTreatment: (index: number, treatment: Partial<TreatmentItem>) => void;
  onRemoveTreatment: (index: number) => void;
  onExportSingleTreatment: (index: number) => void;
  onSubmitClinicalAppeal: (appeal: Omit<ClinicalAppeal, 'createdAt'>) => void;
  patientId: string;
  patientCases: PatientCase[];
  currentCaseId: string | null;
  practitionerRole?: PractitionerRole;
  investigationOrders?: InvestigationOrder[];
  onOrderInvestigation?: (code: string, label: string) => void;
  onReferInvestigation?: (code: string, label: string) => void;
  onMockReceiveResults?: (orderId: string) => void;
  onCancelInvestigation?: (orderId: string) => void;
  onRequestReferralFromBasket?: () => void;
  onConfirmReferral?: (code: string, label: string, referral: InvestigationReferralInput) => void;
  isReferring?: boolean;
  onBack: () => void;
  onComplete: (payload: FollowUpCompletionPayload) => void;
}

const FollowUpDocumentation = ({
  patientCase,
  visitActions,
  medicationMode,
  medicationRenewNotes,
  onMedicationRenewNotesChange,
  onClinicalReviewChange,
  onVisitActionsChange,
  progressReview,
  ongoingTreatments,
  currentMedications,
  medicationNote,
  condition,
  selectedPlan,
  benefitState,
  diagnosticClinicalNote,
  assessmentNote,
  initialFollowUpNotes = '',
  monitoringSkipped = false,
  specialistFlow = false,
  specialistVisitUsage = null,
  onAddTreatment,
  onUpdateTreatment,
  onRemoveTreatment,
  onExportSingleTreatment,
  onSubmitClinicalAppeal,
  patientId,
  patientCases,
  currentCaseId,
  practitionerRole = 'gp',
  investigationOrders = [],
  onOrderInvestigation,
  onReferInvestigation,
  onMockReceiveResults,
  onCancelInvestigation,
  onRequestReferralFromBasket,
  onConfirmReferral,
  isReferring = false,
  onBack,
  onComplete,
}: FollowUpDocumentationProps) => {
  const showMedicationRenew =
    visitActions.medication && !specialistFlow && medicationMode === 'renew';
  const showMedicationEscalate =
    visitActions.medication && !specialistFlow && medicationMode === 'escalate_change';
  const showMedicationChange = visitActions.medication && specialistFlow;
  const showReferral =
    visitActions.referral || showMedicationEscalate;
  const showMonitoring = visitActions.monitoring;
  const continueOnly = visitActions.continueOnly;

  const defaultSpecialist = suggestNeurologistSpecialty(
    condition,
    patientCase.icdCode
  );

  const medicationFindings = showMedicationEscalate
    ? formatMedicationReportFindings({
        clinicalReview: patientCase.clinicalReview,
        clinicalReviewBasis: patientCase.clinicalReviewBasis,
        medicationRenewNotes,
        medications: currentMedications,
        clinicalNote: patientCase.clinicalNote,
        intent: 'refer_change',
      })
    : '';

  const [medReportData, setMedReportData] = useState<MedicationReportFormData | null>(null);
  const [referralData, setReferralData] = useState<ReferralFormData | null>(null);

  const getResolvedReferral = () => {
    if (!showReferral) return undefined;
    const gpMessage = referralData?.referralNote?.trim() ?? '';
    return {
      urgency: referralData?.urgency ?? 'routine',
      specialistType: referralData?.specialistType?.trim() || defaultSpecialist,
      referralNote: showMedicationEscalate
        ? composeReferralNotesWithFindings(gpMessage, medicationFindings)
        : gpMessage,
    };
  };

  const buildPayload = (): FollowUpCompletionPayload => ({
    includeMedicationReport: Boolean(
      showMedicationRenew || showMedicationChange || showMedicationEscalate
    ),
    includeReferral: showReferral,
    medicationReport:
      showMedicationRenew || showMedicationChange
        ? medReportData ?? undefined
        : showMedicationEscalate
          ? {
              followUpNotes: medicationFindings,
              sideEffects: medicationRenewNotes.sideEffects,
              adherence: medicationRenewNotes.adherence,
              renewConfirmed: false,
              gpMedicationDecision: 'refer_change',
              newMedications:
                currentMedications.length > 0 ? currentMedications : undefined,
              mode: 'renew',
            }
          : undefined,
    referral: getResolvedReferral(),
    medicationMode,
    medicationRenewNotes:
      showMedicationRenew || showMedicationChange || showMedicationEscalate
        ? medicationRenewNotes
        : undefined,
  });

  /** Medication-specific gating — used both for final completion and to gate
   *  moving from the medication phase to the monitoring phase. */
  const getMedicationBlockingReason = (): string | null => {
    if (showMedicationRenew) {
      if (!medReportData?.renewConfirmed && medReportData?.gpMedicationDecision !== 'renew') {
        return 'Confirm renewal of the current medication plan.';
      }
      if (currentMedications.length === 0) {
        return 'No medications on file to renew — check the patient portfolio or refer for medication review.';
      }
    }
    if (showMedicationChange || showMedicationRenew) {
      if (!(medReportData?.clinicalReview || patientCase.clinicalReview)) {
        return 'Record a clinical assessment from the medication feedback before continuing.';
      }
    }
    if (showMedicationChange) {
      const decision = medReportData?.treatmentPlanDecision;
      if (!decision) {
        return 'Document side effects/adherence, then choose continue unchanged, adjust dose, or change medication.';
      }
      if (decision === 'change') {
        if (!medReportData?.motivationLetter?.trim()) {
          return 'Document clinical motivation for the treatment plan update.';
        }
        if (!medReportData.newMedications || medReportData.newMedications.length === 0) {
          return 'Select the updated medication for this specialist review.';
        }
      }
      if (decision === 'adjust') {
        if (currentMedications.length === 0) {
          return 'No medications on file to adjust — check Patient Records or change therapy.';
        }
        if (!medReportData?.motivationLetter?.trim()) {
          return 'Briefly document the clinical reason for the dose adjustment.';
        }
        if (!medReportData.newMedications || medReportData.newMedications.length === 0) {
          return 'Update strength, dosage, or instructions before continuing.';
        }
      }
      if (decision === 'continue' && currentMedications.length === 0) {
        return 'No medications on file to continue — check Patient Records or prescribe a new regimen.';
      }
    }
    if (showMedicationEscalate) {
      if (!medicationRenewNotes.adherence.trim() && !medicationRenewNotes.sideEffects.trim()) {
        return 'Document adherence and/or side effects on the medication report before referring for a medication change.';
      }
    }
    return null;
  };

  const getReferralBlockingReason = (): string | null => {
    if (showReferral) {
      const gpMessage = referralData?.referralNote?.trim() ?? '';
      const specialistType =
        referralData?.specialistType?.trim() || defaultSpecialist;
      if (!specialistType.trim() || !gpMessage) {
        return 'Type your referral message to the specialist before continuing.';
      }
    }
    return null;
  };

  const getBlockingReason = (): string | null =>
    getMedicationBlockingReason() ?? getReferralBlockingReason();

  const canContinue = getBlockingReason() === null;

  const handleComplete = () => {
    const reason = getBlockingReason();
    if (reason) {
      alert(reason);
      return;
    }
    onComplete(buildPayload());
  };

  const noopSave = () => {};

  const needsMedicationReport =
    showMedicationRenew || showMedicationChange || showMedicationEscalate;

  const hasMedicationJob = needsMedicationReport;
  const hasMonitoringJob = showMonitoring;
  const hasBothJobs = hasMedicationJob && hasMonitoringJob;

  const [phase, setPhase] = useState<'medication' | 'monitoring'>(
    hasMedicationJob ? 'medication' : 'monitoring'
  );

  const medicationReady = getMedicationBlockingReason() === null;

  const handleGoToMonitoring = () => {
    if (!visitActions.monitoring) {
      onVisitActionsChange?.({ monitoring: true });
    }
    setPhase('monitoring');
  };

  return (
    <div className="space-y-6">
      {continueOnly && (
        <div className="card">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <Activity className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Continue current plan</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Visit note and condition control will be saved with the summary.
              </p>
            </div>
          </div>
        </div>
      )}

      {hasBothJobs && (
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
          <button
            type="button"
            onClick={() => setPhase('medication')}
            className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
              phase === 'medication'
                ? 'bg-white text-indigo-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Medication report
          </button>
          <button
            type="button"
            onClick={() => setPhase('monitoring')}
            className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
              phase === 'monitoring'
                ? 'bg-white text-indigo-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Ongoing management
          </button>
        </div>
      )}

      <div className={phase === 'medication' ? 'space-y-6' : 'hidden'}>
        {showMedicationEscalate && (
          <MedicationReportSummaryCard
            patientName={patientCase.patientName}
            condition={patientCase.condition}
            clinicalReview={patientCase.clinicalReview}
            clinicalReviewBasis={patientCase.clinicalReviewBasis}
            medicationRenewNotes={medicationRenewNotes}
            medications={currentMedications}
            intent="refer_change"
          />
        )}

        {(showMedicationRenew || showMedicationChange) && (
          <div className="card">
            <h3 className="text-sm font-bold uppercase tracking-wide text-violet-800 mb-4">
              {showMedicationChange ? 'Review & update treatment plan' : 'Medication report'}
            </h3>
            <MedicationReport
              embedMode
              followUpMode
              reportMode={showMedicationChange ? 'change' : 'renew'}
              initialGpDecision={showMedicationRenew ? 'renew' : null}
              initialClinicalReview={patientCase.clinicalReview ?? null}
              initialClinicalReviewBasis={patientCase.clinicalReviewBasis ?? ''}
              specialistFlow={specialistFlow || showMedicationChange}
              currentMedications={currentMedications}
              medicationNote={medicationNote}
              condition={condition}
              selectedPlan={selectedPlan}
              benefitState={benefitState}
              initialFollowUpNotes={initialFollowUpNotes}
              initialRenewNotes={medicationRenewNotes}
              onDataChange={(data) => {
                setMedReportData(data);
                if (data.sideEffects !== undefined || data.adherence !== undefined) {
                  onMedicationRenewNotesChange({
                    sideEffects: data.sideEffects ?? medicationRenewNotes.sideEffects,
                    adherence: data.adherence ?? medicationRenewNotes.adherence,
                  });
                }
                if (data.clinicalReview !== undefined || data.clinicalReviewBasis !== undefined) {
                  onClinicalReviewChange?.(
                    data.clinicalReview ?? patientCase.clinicalReview ?? null,
                    data.clinicalReviewBasis ?? patientCase.clinicalReviewBasis
                  );
                }
              }}
              onSaveOnly={noopSave}
              onSavePdfOnly={noopSave}
              onSaveWithAttachments={noopSave}
            />
          </div>
        )}

        {hasMedicationJob && !showReferral && !continueOnly && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGoToMonitoring}
              disabled={!medicationReady}
              title={!medicationReady ? 'Finish the medication report first' : undefined}
              className="text-sm font-medium px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-50"
            >
              <Plus className="w-4 h-4" />
              {hasMonitoringJob ? 'Continue to ongoing management' : 'Do ongoing management next'}
            </button>
          </div>
        )}
      </div>

      <div className={phase === 'monitoring' ? 'space-y-6' : 'hidden'}>
        {showMonitoring && (
          <OngoingManagement
            section="basket"
            hideSaveActions
            condition={condition}
            patientId={patientId}
            patientCases={patientCases}
            currentCaseId={currentCaseId}
            treatments={ongoingTreatments}
            currentMedications={currentMedications}
            clinicalNote={patientCase.clinicalNote}
            assessmentNote={assessmentNote}
            monitoringSkipped={monitoringSkipped}
            onAddTreatment={onAddTreatment}
            onUpdateTreatment={onUpdateTreatment}
            onRemoveTreatment={onRemoveTreatment}
            onExportSingleTreatment={onExportSingleTreatment}
            onSubmitClinicalAppeal={onSubmitClinicalAppeal}
            onSaveOnly={noopSave}
            onSavePdfOnly={noopSave}
            onSaveWithAttachments={noopSave}
            practitionerRole={practitionerRole}
            investigationOrders={investigationOrders}
            onOrderInvestigation={onOrderInvestigation}
            onReferInvestigation={onReferInvestigation}
            onMockReceiveResults={onMockReceiveResults}
            onCancelInvestigation={onCancelInvestigation}
            onRequestReferralFromBasket={onRequestReferralFromBasket}
            onConfirmReferral={onConfirmReferral}
            isReferring={isReferring}
            clinicalReview={patientCase.clinicalReview ?? null}
            clinicalReviewBasis={patientCase.clinicalReviewBasis ?? ''}
            onClinicalReviewChange={onClinicalReviewChange}
            specialistFlow={specialistFlow}
          />
        )}
      </div>

      {showReferral && (
        <div className="card">
          <Referral
            embedMode
            patientCase={patientCase}
            diagnosticClinicalNote={diagnosticClinicalNote}
            progressReview={progressReview}
            medicationRenewNotes={
              showMedicationEscalate ? medicationRenewNotes : undefined
            }
            clinicalReview={
              showMedicationEscalate ? patientCase.clinicalReview : undefined
            }
            hideDuplicateMedicationList={showMedicationEscalate}
            initialReferralNote=""
            initialSpecialistType={defaultSpecialist}
            specialistVisitUsage={specialistVisitUsage}
            referralMotivationPlaceholder={
              showMedicationEscalate
                ? 'Write your message to the neurologist — why you need a medication review and what you want them to assess…'
                : undefined
            }
            onDataChange={setReferralData}
            onSavePdfOnly={noopSave}
            onSaveWithAttachments={noopSave}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3 justify-between items-center">
        <button type="button" onClick={onBack} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        {canContinue ? (
          <button
            type="button"
            onClick={handleComplete}
            className="btn-primary flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Continue to Visit Summary
          </button>
        ) : (
          <p className="text-sm text-slate-500 text-right max-w-xs">
            {needsMedicationReport
              ? 'Complete the medication report to continue.'
              : getBlockingReason()}
          </p>
        )}
      </div>
    </div>
  );
};

export default FollowUpDocumentation;
