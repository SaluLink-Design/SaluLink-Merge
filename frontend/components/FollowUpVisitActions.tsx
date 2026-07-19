'use client';

import { Activity, CheckCircle2, Pill, Stethoscope } from 'lucide-react';
import { FollowUpVisitActions as VisitActions, MedicationMode } from '@/types';

interface FollowUpVisitActionsProps {
  value: VisitActions;
  medicationMode: MedicationMode | null;
  onChange: (updates: Partial<VisitActions>) => void;
  onMedicationModeChange: (mode: MedicationMode | null) => void;
  /** Specialist annual review — full medication change allowed */
  specialistFlow?: boolean;
  clinicalReviewDeteriorating?: boolean;
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
    label: 'Repeat / renew script',
    description: 'Monthly repeat prescription on the current neurologist-approved plan.',
    hint: 'Side effects and adherence are captured here — not a regimen change',
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
}: FollowUpVisitActionsProps) => {
  const toggleWork = (key: 'medication' | 'monitoring' | 'referral') => {
    onChange({ [key]: !value[key], continueOnly: false });
  };

  const selectContinueOnly = () => {
    onChange({ continueOnly: !value.continueOnly });
    if (!value.continueOnly) onMedicationModeChange(null);
  };

  const medLabel = specialistFlow ? 'Update treatment plan' : 'Repeat / renew script';
  const actions = specialistFlow
    ? workActions.map((a) =>
        a.key === 'medication'
          ? {
              ...a,
              label: medLabel,
              description: 'Adjust dose, switch therapy, or update the scheme treatment plan.',
              hint: 'Specialist anchor — full formulary change allowed',
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
            ? 'Select actions for this specialist review visit.'
            : 'Select day-to-day GP actions. Major treatment changes go to the neurologist — not a silent formulary swap.'}
        </p>
        {clinicalReviewDeteriorating && !specialistFlow && (
          <p className="text-xs text-amber-700 mt-2 font-medium">
            Condition marked deteriorating — strongly consider Escalate to neurologist.
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
            </button>
          );
        })}
      </div>

      {value.medication && !value.continueOnly && !specialistFlow && (
        <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
          <p className="text-sm font-semibold text-violet-900 mb-3">Script path this visit</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onMedicationModeChange('renew')}
              className={`text-left rounded-lg border px-3 py-2.5 text-sm transition ${
                medicationMode === 'renew'
                  ? 'border-violet-400 bg-white ring-2 ring-violet-200 font-medium text-violet-900'
                  : 'border-violet-200 bg-white/80 text-slate-700 hover:bg-white'
              }`}
            >
              Renew current script
              <span className="block text-xs font-normal text-slate-500 mt-0.5">
                Same meds — document side effects if any
              </span>
            </button>
            <button
              type="button"
              onClick={() => onMedicationModeChange('escalate_change')}
              className={`text-left rounded-lg border px-3 py-2.5 text-sm transition ${
                medicationMode === 'escalate_change'
                  ? 'border-amber-400 bg-white ring-2 ring-amber-200 font-medium text-amber-900'
                  : 'border-amber-200 bg-white/80 text-slate-700 hover:bg-white'
              }`}
            >
              Escalate for treatment change
              <span className="block text-xs font-normal text-slate-500 mt-0.5">
                Refer to neurologist — no GP formulary swap
              </span>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={selectContinueOnly}
        className={`w-full text-left rounded-xl border p-4 transition-all ${
          value.continueOnly
            ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <div
          className={`inline-flex items-center gap-2 text-sm font-semibold ${
            value.continueOnly ? 'text-emerald-900' : 'text-slate-900'
          }`}
        >
          <CheckCircle2 className="w-5 h-5" />
          Continue current plan only
        </div>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Condition is controlled — no script, monitoring, or escalation this visit.
        </p>
      </button>
    </div>
  );
};

export default FollowUpVisitActions;
