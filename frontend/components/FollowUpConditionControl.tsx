'use client';

import { Minus, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { ClinicalReviewStatus } from '@/types';

interface FollowUpConditionControlProps {
  value: ClinicalReviewStatus | null;
  onChange: (status: ClinicalReviewStatus) => void;
  onSuggestEscalate?: () => void;
}

const OPTIONS: {
  value: ClinicalReviewStatus;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'improving',
    label: 'Improving',
    description: 'Symptoms or control are getting better.',
    icon: <TrendingUp className="w-4 h-4" />,
  },
  {
    value: 'stable',
    label: 'Stable',
    description: 'Adequately controlled on the current plan.',
    icon: <Minus className="w-4 h-4" />,
  },
  {
    value: 'deteriorating',
    label: 'Deteriorating',
    description: 'Control is worsening — consider escalation.',
    icon: <TrendingDown className="w-4 h-4" />,
  },
];

const FollowUpConditionControl = ({
  value,
  onChange,
  onSuggestEscalate,
}: FollowUpConditionControlProps) => (
  <div className="card">
    <h3 className="text-lg font-semibold text-slate-900 mb-1">Condition control</h3>
    <p className="text-sm text-slate-500 mb-4">
      How is the patient&apos;s condition doing compared with the last review?
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-left rounded-xl border p-4 transition-all ${
              selected
                ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                selected ? 'text-indigo-900' : 'text-slate-900'
              }`}
            >
              {opt.icon}
              {opt.label}
            </span>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{opt.description}</p>
          </button>
        );
      })}
    </div>

    {value === 'deteriorating' && (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-amber-900">Consider escalating to neurologist</p>
          <p className="text-amber-800/90 mt-0.5 text-xs leading-relaxed">
            Do not change the epilepsy regimen unilaterally. On the next step, choose Escalate for
            treatment change or Escalate to neurologist.
          </p>
          {onSuggestEscalate && (
            <button
              type="button"
              onClick={onSuggestEscalate}
              className="mt-2 text-xs font-semibold text-amber-900 underline underline-offset-2"
            >
              Jump to visit actions
            </button>
          )}
        </div>
      </div>
    )}
  </div>
);

export default FollowUpConditionControl;
