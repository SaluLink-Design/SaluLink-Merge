'use client';

import { Activity, Pill, Stethoscope } from 'lucide-react';
import {
  FollowUpVisitActions as VisitActions,
  MedicationMode,
  SelectedMedication,
  BenefitState,
  MedicationRenewNotes,
  ClinicalReviewStatus,
} from '@/types';
import MedicationReport, {
  MedicationReportFormData,
  GpMedicationDecision,
} from './MedicationReport';
import type { SpecialistVisitUsageSummary } from '@/lib/specialistVisitUsage';

interface FollowUpVisitActionsProps {
  value: VisitActions;
  medicationMode: MedicationMode | null;
  onChange: (updates: Partial<VisitActions>) => void;
  onMedicationModeChange: (mode: MedicationMode | null) => void;
  /** Specialist annual review — full medication change allowed */
  specialistFlow?: boolean;
  clinicalReviewDeteriorating?: boolean;
  clinicalReview?: ClinicalReviewStatus | null;
  clinicalReviewBasis?: string;
  /** Needed to render the inline medication report when the GP selects that action */
  currentMedications?: SelectedMedication[];
  medicationNote?: string;
  condition?: string;
  selectedPlan?: any;
  benefitState?: BenefitState | null;
  initialRenewNotes?: MedicationRenewNotes;
  onInlineRenewDataChange?: (data: MedicationReportFormData) => void;
  /** Locked GP decision from parent (renew confirmed or escalate) */
  gpMedicationDecision?: GpMedicationDecision | null;
  /** Fired when GP chooses renew or refer-for-change inside the medication report */
  onGpMedicationDecision?: (decision: GpMedicationDecision | null) => void;
  /** Annual specialist-visit usage for this condition — shown as a soft referral-time signal, GP only */
  specialistVisitUsage?: SpecialistVisitUsageSummary | null;
}

const workActions: {
  key: 'medication' | 'monitoring' | 'referral';
  label: string;
  description: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'medication',
    label: 'Medication report',
    description:
      'Document adherence and side effects, then renew the current plan or refer for a medication change.',
    hint: 'Renew script — or escalate when therapy change is needed',
    icon: <Pill className="w-5 h-5" />,
  },
  {
    key: 'monitoring',
    label: 'Monitoring tests',
    description: 'Document monitoring from the scheme basket (refer out or pathology as indicated).',
    hint: 'EEG, drug levels, labs — coordination hints shown per item',
    icon: <Activity className="w-5 h-5" />,
  },
  {
    key: 'referral',
    label: 'Escalate to neurologist',
    description: 'Breakthrough symptoms, treatment failure, or major plan change needed.',
    hint: 'Opens referral — GP does not unilaterally redesign epilepsy therapy',
    icon: <Stethoscope className="w-5 h-5" />,
  },
];

const FollowUpVisitActions = ({
  value,
  medicationMode,
  onChange,
  onMedicationModeChange,
  specialistFlow = false,
  clinicalReviewDeteriorating = false,
  clinicalReview = null,
  clinicalReviewBasis = '',
  currentMedications = [],
  medicationNote = '',
  condition = '',
  selectedPlan,
  benefitState,
  initialRenewNotes,
  onInlineRenewDataChange,
  gpMedicationDecision = null,
  onGpMedicationDecision,
  specialistVisitUsage,
}: FollowUpVisitActionsProps) => {
  const toggleWork = (key: 'medication' | 'monitoring' | 'referral') => {
    const turningOff = value[key];
    if (key === 'referral') {
      // Escalation stays exclusive — GP does not run a referral alongside meds/monitoring.
      onChange({
        medication: false,
        monitoring: false,
        referral: !turningOff,
        continueOnly: false,
      });
      onMedicationModeChange(null);
      onGpMedicationDecision?.(null);
      return;
    }
    if (key === 'medication') {
      // Medication and Monitoring can both be documented in the same visit.
      onChange({ medication: !turningOff, continueOnly: false });
      onMedicationModeChange(turningOff ? null : 'renew');
      onGpMedicationDecision?.(null);
      return;
    }
    onChange({ monitoring: !turningOff, continueOnly: false });
  };

  const handleGpDecision = (decision: GpMedicationDecision | null) => {
    if (decision === 'renew') {
      onMedicationModeChange('renew');
      if (value.referral && medicationMode === 'escalate_change') {
        onChange({ referral: false });
      }
    } else if (decision === 'refer_change') {
      onMedicationModeChange('escalate_change');
    } else {
      onMedicationModeChange('renew');
      if (value.referral && medicationMode === 'escalate_change') {
        onChange({ referral: false });
      }
    }
    onGpMedicationDecision?.(decision);
  };

  const lockedGpDecision: GpMedicationDecision | null =
    gpMedicationDecision ??
    (medicationMode === 'escalate_change' ? 'refer_change' : null);

  const medLabel = specialistFlow ? 'Review & update treatment plan' : 'Medication report';
  const actions = specialistFlow
    ? workActions.map((a) =>
        a.key === 'medication'
          ? {
              ...a,
              label: medLabel,
              description:
                'Review current meds and side effects, then continue unchanged, adjust dose, or change therapy.',
              hint: 'Specialist anchor — dose adjustment and formulary change allowed',
            }
          : a.key === 'monitoring'
            ? {
                ...a,
                description: 'Manage each investigation from order through results and reporting.',
              }
          : a.key === 'referral'
            ? { ...a, label: 'Refer to colleague', description: 'Refer for additional specialist input.' }
            : a
      )
    : workActions;

  return (
    <div className="card">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">What does this visit need?</h2>
        <p className="text-sm text-slate-500 mt-1">
          {specialistFlow
            ? 'Select the actions needed for this specialist review visit — medication and monitoring can be documented together.'
            : 'Renew the medication report and/or order monitoring in the same visit, or escalate when needed.'}
        </p>
        {clinicalReviewDeteriorating && !specialistFlow && (
          <p className="text-xs text-amber-700 mt-2 font-medium">
            Condition marked deteriorating — strongly consider Refer for medication review or Escalate to neurologist.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {actions.map((opt) => {
          const selected = value[opt.key] && !value.continueOnly;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggleWork(opt.key)}
              className={`text-left rounded-xl border p-4 transition-all ${
                selected
                  ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div
                className={`inline-flex items-center gap-2 text-sm font-semibold mb-2 ${
                  selected ? 'text-indigo-900' : 'text-slate-900'
                }`}
              >
                {opt.icon}
                {opt.label}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{opt.description}</p>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{opt.hint}</p>
              {opt.key === 'referral' && !specialistFlow && specialistVisitUsage?.maxCovered != null && (
                <p className="text-[11px] text-amber-700 mt-2 leading-relaxed font-medium">
                  {specialistVisitUsage.usedHistorical} of {specialistVisitUsage.maxCovered} specialist
                  visits used this year
                  {specialistVisitUsage.isExhausted
                    ? ' — this referral would be over the covered limit.'
                    : specialistVisitUsage.remaining === 1
                      ? ' — this referral would be the last covered visit.'
                      : '.'}
                  {' '}
                  <span className="text-slate-400 font-normal">(Visits tracked in SaluLink)</span>
                </p>
              )}
            </button>
          );
        })}
      </div>

      {value.medication && !value.continueOnly && !specialistFlow && (
        <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
          <p className="text-sm font-semibold text-violet-900 mb-1">
            {medicationMode === 'escalate_change'
              ? 'Medication report — refer for change'
              : 'Medication report'}
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Review current meds and side effects, assess control, then renew the plan or refer for a
            medication change.
          </p>
          <div className="rounded-xl border border-violet-200 bg-white p-4">
            <MedicationReport
              embedMode
              followUpMode
              reportMode="renew"
              initialGpDecision={lockedGpDecision}
              initialClinicalReview={clinicalReview}
              initialClinicalReviewBasis={clinicalReviewBasis}
              specialistFlow={false}
              currentMedications={currentMedications}
              medicationNote={medicationNote}
              condition={condition}
              selectedPlan={selectedPlan}
              benefitState={benefitState}
              initialRenewNotes={initialRenewNotes}
              onDataChange={onInlineRenewDataChange}
              onGpDecision={handleGpDecision}
              onSaveOnly={() => {}}
              onSavePdfOnly={() => {}}
              onSaveWithAttachments={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUpVisitActions;
