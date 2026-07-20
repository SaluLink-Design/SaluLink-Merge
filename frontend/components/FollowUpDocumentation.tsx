'use client';

import { useState } from 'react';
import { Activity, ArrowLeft, CheckCircle } from 'lucide-react';
import {
  BenefitState,
  ClinicalAppeal,
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
import Referral, { ReferralFormData } from './Referral';
import OngoingManagement from './OngoingManagement';
import { suggestNeurologistSpecialty } from '@/lib/sharedCare';
import type { InvestigationReferralInput } from '@/lib/investigationCoordination';

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
  onSetMonitoringSkipped?: (skipped: boolean, reason?: string) => void;
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
  onSetMonitoringSkipped,
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
  const escalateNoteSeed =
    showMedicationEscalate
      ? `GP requests neurologist review for treatment change.\n\nCondition control: ${patientCase.clinicalReview ?? 'not recorded'}.\n\n${patientCase.clinicalNote?.trim() ?? ''}`.trim()
      : '';

  const [medReportData, setMedReportData] = useState<MedicationReportFormData | null>(null);
  const [referralData, setReferralData] = useState<ReferralFormData | null>(null);
  const [escalateReason, setEscalateReason] = useState('');

  const getResolvedReferral = () => {
    if (!showReferral) return undefined;
    const noteParts = [
      referralData?.referralNote?.trim() || escalateNoteSeed,
      showMedicationEscalate && escalateReason.trim()
        ? `Clinical escalation reason:\n${escalateReason.trim()}`
        : '',
    ].filter(Boolean);
    return {
      urgency: referralData?.urgency ?? 'routine',
      specialistType: referralData?.specialistType?.trim() || defaultSpecialist,
      referralNote: noteParts.join('\n\n'),
    };
  };

  const buildPayload = (): FollowUpCompletionPayload => ({
    includeMedicationReport: Boolean(showMedicationRenew || showMedicationChange),
    includeReferral: showReferral,
    medicationReport:
      showMedicationRenew || showMedicationChange ? medReportData ?? undefined : undefined,
    referral: getResolvedReferral(),
    medicationMode,
    medicationRenewNotes:
      showMedicationRenew || showMedicationChange ? medicationRenewNotes : undefined,
  });

  const validate = (): boolean => {
    if (showMonitoring && ongoingTreatments.length === 0 && !monitoringSkipped) {
      alert(
        'Select at least one monitoring item for this visit, or mark that no monitoring is needed.'
      );
      return false;
    }
    if (showMedicationRenew) {
      if (!medReportData?.renewConfirmed) {
        alert('Confirm renewal of the current medication plan.');
        return false;
      }
      if (currentMedications.length === 0) {
        alert('No medications on file to renew — check the patient portfolio or escalate to neurologist.');
        return false;
      }
    }
    if (showMedicationChange) {
      const decision = medReportData?.treatmentPlanDecision;
      if (!decision) {
        alert(
          'Document side effects/adherence, then choose continue unchanged, adjust dose, or change medication.'
        );
        return false;
      }
      if (decision === 'change') {
        if (!medReportData?.motivationLetter?.trim()) {
          alert('Document clinical motivation for the treatment plan update.');
          return false;
        }
        if (!medReportData.newMedications || medReportData.newMedications.length === 0) {
          alert('Select the updated medication for this specialist review.');
          return false;
        }
      }
      if (decision === 'adjust') {
        if (currentMedications.length === 0) {
          alert('No medications on file to adjust — check Patient Records or change therapy.');
          return false;
        }
        if (!medReportData?.motivationLetter?.trim()) {
          alert('Briefly document the clinical reason for the dose adjustment.');
          return false;
        }
        if (!medReportData.newMedications || medReportData.newMedications.length === 0) {
          alert('Update strength, dosage, or instructions before continuing.');
          return false;
        }
      }
      if (decision === 'continue' && currentMedications.length === 0) {
        alert(
          'No medications on file to continue — check Patient Records or prescribe a new regimen.'
        );
        return false;
      }
    }
    if (showMedicationEscalate && !escalateReason.trim()) {
      alert('Briefly document why treatment change is needed before escalating.');
      return false;
    }
    if (showReferral) {
      const resolved = getResolvedReferral();
      if (!resolved?.specialistType?.trim() || !resolved.referralNote?.trim()) {
        alert('Complete the neurologist referral form.');
        return false;
      }
    }
    return true;
  };

  const handleComplete = () => {
    if (!validate()) return;
    onComplete(buildPayload());
  };

  const noopSave = () => {};

  const treatmentPlanLabel = (() => {
    if (!showMedicationChange) return null;
    if (medReportData?.treatmentPlanDecision === 'continue') return 'Plan continued unchanged';
    if (medReportData?.treatmentPlanDecision === 'adjust') return 'Dose / instructions adjusted';
    if (medReportData?.treatmentPlanDecision === 'change') return 'Treatment plan updated';
    return 'Review & update treatment plan';
  })();

  const selectedLabels = [
    showMedicationRenew && 'Script renewed',
    treatmentPlanLabel,
    showMedicationEscalate && 'Escalate for treatment change',
    showMonitoring && 'Order + document monitoring',
    showReferral && !showMedicationEscalate && 'Escalate to neurologist',
    continueOnly && 'Continue plan only',
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Complete visit actions</h2>
        <p className="text-sm text-slate-500 mb-6">
          Finish the documentation for actions you selected. Review the full visit summary next.
        </p>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6 text-sm space-y-1">
          <p>
            <span className="font-medium text-slate-700">Patient:</span>{' '}
            {patientCase.patientName} — {patientCase.condition}
          </p>
          <p>
            <span className="font-medium text-slate-700">Actions:</span> {selectedLabels.join(', ')}
          </p>
          {patientCase.clinicalReview && (
            <p>
              <span className="font-medium text-slate-700">Condition control:</span>{' '}
              <span className="capitalize">{patientCase.clinicalReview}</span>
            </p>
          )}
        </div>

        {continueOnly && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <Activity className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Continue current plan</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Visit note and condition control will be saved with the summary.
              </p>
            </div>
          </div>
        )}
      </div>

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
          onSetMonitoringSkipped={onSetMonitoringSkipped}
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
          onRequestReferralFromBasket={onRequestReferralFromBasket}
          onConfirmReferral={onConfirmReferral}
          isReferring={isReferring}
        />
      )}

      {showMedicationEscalate && (
        <div className="card">
          <h3 className="text-sm font-bold uppercase tracking-wide text-amber-800 mb-3">
            Escalate for treatment change
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Document why the current plan is insufficient. Complete the neurologist referral below —
            do not change formulary as GP.
          </p>
          <label className="label">Clinical reason for escalation</label>
          <textarea
            className="textarea-field mb-4"
            rows={3}
            placeholder="e.g. breakthrough seizures, intolerable side effects, failed control on current dose…"
            value={escalateReason}
            onChange={(e) => setEscalateReason(e.target.value)}
          />
        </div>
      )}

      {(showMedicationRenew || showMedicationChange) && (
        <div className="card">
          <h3 className="text-sm font-bold uppercase tracking-wide text-violet-800 mb-4">
            {showMedicationChange ? 'Review & update treatment plan' : 'Repeat / renew script'}
          </h3>
          <MedicationReport
            embedMode
            followUpMode
            reportMode={showMedicationChange ? 'change' : 'renew'}
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
            }}
            onSaveOnly={noopSave}
            onSavePdfOnly={noopSave}
            onSaveWithAttachments={noopSave}
          />
        </div>
      )}

      {showReferral && (
        <div className="card">
          <Referral
            embedMode
            patientCase={patientCase}
            diagnosticClinicalNote={diagnosticClinicalNote}
            progressReview={progressReview}
            initialReferralNote={escalateNoteSeed || undefined}
            initialSpecialistType={defaultSpecialist}
            onDataChange={setReferralData}
            onSavePdfOnly={noopSave}
            onSaveWithAttachments={noopSave}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3 justify-between">
        <button type="button" onClick={onBack} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          type="button"
          onClick={handleComplete}
          className="btn-primary flex items-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          Continue to Visit Summary
        </button>
      </div>
    </div>
  );
};

export default FollowUpDocumentation;
