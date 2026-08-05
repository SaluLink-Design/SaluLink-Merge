'use client';

import { format } from 'date-fns';
import {
  Activity,
  CheckCircle,
  FileBarChart,
  FileText,
  Pill,
  Stethoscope,
  ClipboardList,
} from 'lucide-react';
import {
  BenefitState,
  ClinicalReviewStatus,
  FollowUpVisitActions,
  PatientCase,
  ProgressReview,
  SelectedMedication,
  TreatmentDecision,
  TreatmentItem,
  InvestigationOrder,
} from '@/types';
import { benefitStateLabel, fundingSourceLabel } from '@/lib/benefitState';
import { formatProgressReviewSummary } from '@/lib/followUpContext';
import { getSharedCareSummaryLabels } from '@/lib/sharedCare';
import FundingSourceBadge from '@/components/FundingSourceBadge';
import type { MedicationMode } from '@/types';

interface MedicationFeedbackSummary {
  sideEffects?: string;
  adherence?: string;
  motivationLetter?: string;
}

interface FollowUpClaimSummaryProps {
  patientCase: PatientCase;
  progressReview: ProgressReview;
  clinicalReview: ClinicalReviewStatus | null;
  visitActions: FollowUpVisitActions;
  medicationMode?: MedicationMode | null;
  treatmentDecision: TreatmentDecision;
  ongoingTreatments: TreatmentItem[];
  investigationOrders?: InvestigationOrder[];
  medications: SelectedMedication[];
  previousMedications?: SelectedMedication[];
  newMedications?: SelectedMedication[];
  /** Adherence / side-effects / motivation text captured on the medication report this visit */
  medicationFeedback?: MedicationFeedbackSummary | null;
  benefitState?: BenefitState | null;
  onConfirm: () => void;
  onBack: () => void;
}

const decisionLabel: Record<TreatmentDecision['decision'], string> = {
  continue: 'Continue current treatment',
  adjust: 'Adjust dose / instructions',
  change: 'Change medication',
  refer: 'Refer to specialist',
};

const visitActionLabels = (
  actions: FollowUpVisitActions,
  medicationMode?: MedicationMode | null,
  treatmentDecision?: TreatmentDecision | null
): string[] => getSharedCareSummaryLabels(actions, medicationMode, treatmentDecision).visitActions;

const MedicationSummaryList = ({
  meds,
  variant,
}: {
  meds: SelectedMedication[];
  variant: 'previous' | 'new' | 'current';
}) => (
  <ul className="space-y-2">
    {meds.map((med, i) => (
      <li
        key={i}
        className={`text-sm border rounded-lg p-3 ${
          variant === 'previous'
            ? 'border-slate-200 bg-slate-50'
            : variant === 'new'
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-slate-200 bg-white'
        }`}
      >
        <p className="font-medium text-slate-900">
          {med.brandName || med.medicineNameAndStrength}
          {med.selectedStrength ? ` · ${med.selectedStrength}` : ''}
        </p>
        <p className="text-xs text-slate-500">{med.activeIngredient}</p>
        {med.fundingSource && (
          <div className="mt-1 flex items-center gap-2">
            <FundingSourceBadge source={med.fundingSource} compact />
            <span className="text-xs text-slate-500">{fundingSourceLabel[med.fundingSource]}</span>
          </div>
        )}
      </li>
    ))}
  </ul>
);

const FollowUpClaimSummary = ({
  patientCase,
  progressReview,
  clinicalReview,
  visitActions,
  medicationMode,
  treatmentDecision,
  ongoingTreatments,
  investigationOrders = [],
  medications,
  previousMedications = [],
  newMedications = [],
  medicationFeedback,
  benefitState,
  onConfirm,
  onBack,
}: FollowUpClaimSummaryProps) => {
  const progressSummary = formatProgressReviewSummary(progressReview);
  const hasMedicationFeedback = Boolean(
    medicationFeedback?.sideEffects?.trim() ||
      medicationFeedback?.adherence?.trim() ||
      medicationFeedback?.motivationLetter?.trim()
  );
  const actionLabels = visitActionLabels(visitActions, medicationMode, treatmentDecision);
  const hasMedicationChange =
    newMedications.length > 0 &&
    medicationMode !== 'renew' &&
    (treatmentDecision.decision === 'change' || treatmentDecision.decision === 'adjust') &&
    !visitActions.continueOnly;
  const isDoseAdjustment = treatmentDecision.decision === 'adjust';
  const baselineMeds = previousMedications.length > 0 ? previousMedications : medications;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center brand-gradient shadow-md">
            <FileBarChart className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Follow-Up Visit Summary</h2>
            <p className="text-sm text-slate-500">Review the visit before saving to your workspace</p>
          </div>
        </div>

        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-emerald-800">Chronic follow-up visit ready to save</p>
              <p className="text-sm text-emerald-700 mt-1">
                Confirm to save to your workspace. You or your assistant can export or send documents
                to the patient next.
              </p>
              {benefitState && (
                <p className="text-xs mt-2 font-medium text-slate-600">
                  Benefit state: {benefitStateLabel[benefitState]}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-slate-900">Patient</h3>
            </div>
            <p className="text-slate-900 font-medium">{patientCase.patientName}</p>
            <p className="text-sm text-slate-600 mt-1">{patientCase.patientId}</p>
            {patientCase.medicalAidNumber && (
              <p className="text-xs text-slate-500 mt-1">Aid: {patientCase.medicalAidNumber}</p>
            )}
            <p className="text-sm text-slate-600 mt-2">Plan: {patientCase.plan}</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Stethoscope className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-slate-900">Condition</h3>
            </div>
            <p className="text-slate-900 font-medium">{patientCase.condition}</p>
            <p className="text-blue-600 font-mono font-semibold mt-1">{patientCase.icdCode}</p>
            <p className="text-sm text-slate-500">{patientCase.icdDescription}</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-slate-900">Follow-Up Clinical Note</h3>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{patientCase.clinicalNote}</p>
          </div>

          {progressSummary && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-2">Progress Review</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{progressSummary}</p>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-slate-900">Monitoring</h3>
            </div>
            {investigationOrders.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Investigation orders
                </p>
                <ul className="space-y-1.5">
                  {investigationOrders.map((order) => (
                    <li
                      key={order.id}
                      className="text-sm flex justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white"
                    >
                      <span className="text-slate-800">{order.label}</span>
                      <span className="text-xs font-medium shrink-0 capitalize text-slate-500">
                        {order.coordinationType === 'referral' ? 'Referred' : 'Ordered'} ·{' '}
                        {order.status === 'results_received' ? 'Results received' : 'Awaiting results'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ongoingTreatments.length > 0 ? (
              <ul className="space-y-2">
                {ongoingTreatments.map((t, i) => (
                  <li key={`${t.code}-${i}`} className="text-sm border border-slate-200 rounded-lg p-3 bg-white">
                    <p className="font-medium text-slate-900">{t.description}</p>
                    <p className="text-xs text-slate-500 font-mono">Code: {t.code}</p>
                    {t.documentation?.notes && (
                      <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
                        {t.documentation.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No monitoring items recorded</p>
            )}
          </div>

          {hasMedicationFeedback && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Pill className="w-5 h-5 text-slate-400" />
                <h3 className="font-semibold text-slate-900">Medication feedback</h3>
              </div>
              <div className="space-y-3">
                {medicationFeedback?.adherence?.trim() && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Adherence
                    </p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {medicationFeedback.adherence.trim()}
                    </p>
                  </div>
                )}
                {medicationFeedback?.sideEffects?.trim() && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Side effects / tolerability
                    </p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {medicationFeedback.sideEffects.trim()}
                    </p>
                  </div>
                )}
                {medicationFeedback?.motivationLetter?.trim() && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Clinical motivation
                    </p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {medicationFeedback.motivationLetter.trim()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {clinicalReview && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-1">Clinical assessment</h3>
              <p className="text-sm capitalize text-slate-700">{clinicalReview}</p>
              {patientCase.clinicalReviewBasis?.trim() && (
                <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap">
                  {patientCase.clinicalReviewBasis.trim()}
                </p>
              )}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 mb-1">Visit actions</h3>
            {actionLabels.length > 0 ? (
              <ul className="text-sm text-slate-700 space-y-1">
                {actionLabels.map((label) => (
                  <li key={label}>• {label}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-700">{decisionLabel[treatmentDecision.decision]}</p>
            )}
          </div>

          {hasMedicationChange ? (
            <>
              {baselineMeds.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Pill className="w-5 h-5 text-slate-400" />
                    <h3 className="font-semibold text-slate-900">
                      Previous Medication{baselineMeds.length > 1 ? 's' : ''} ({baselineMeds.length})
                    </h3>
                  </div>
                  <MedicationSummaryList meds={baselineMeds} variant="previous" />
                </div>
              )}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Pill className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-slate-900">
                    {isDoseAdjustment ? 'Updated Medication' : 'New Medication Prescribed'}
                    {newMedications.length > 1 ? 's' : ''} ({newMedications.length})
                  </h3>
                </div>
                <MedicationSummaryList meds={newMedications} variant="new" />
              </div>
            </>
          ) : (
            medications.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Pill className="w-5 h-5 text-slate-400" />
                  <h3 className="font-semibold text-slate-900">
                    Current Medications ({medications.length})
                  </h3>
                </div>
                <MedicationSummaryList meds={medications} variant="current" />
              </div>
            )
          )}

          <p className="text-xs text-slate-400 text-center">
            Visit date: {format(new Date(), 'dd MMM yyyy')}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 justify-between border-t border-slate-200 pt-6 mt-6">
          <button type="button" onClick={onBack} className="btn-secondary">
            Back
          </button>
          <button type="button" onClick={onConfirm} className="btn-primary flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Confirm and Save Visit
          </button>
        </div>
      </div>
    </div>
  );
};

export default FollowUpClaimSummary;
