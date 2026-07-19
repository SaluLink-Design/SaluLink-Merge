'use client';

import { GitBranch } from 'lucide-react';
import { TreatmentDecisionType } from '@/types';

interface TreatmentDecisionStepProps {
  decision: TreatmentDecisionType | null;
  onDecisionChange: (decision: TreatmentDecisionType) => void;
}

const options: {
  value: TreatmentDecisionType;
  label: string;
  description: string;
}[] = [
  {
    value: 'continue',
    label: 'Continue current treatment',
    description: 'Condition is controlled — maintain current medication and monitoring plan.',
  },
  {
    value: 'change',
    label: 'Change medication',
    description: 'Adjust dose, switch to an alternative, or add therapy — document the new plan next.',
  },
  {
    value: 'refer',
    label: 'Refer to specialist',
    description: 'Escalate to specialist review — referral letter is generated in the next step.',
  },
];

const TreatmentDecisionStep = ({
  decision,
  onDecisionChange,
}: TreatmentDecisionStepProps) => (
  <div className="card">
    <div className="flex items-center gap-3 mb-6">
      <div className="brand-icon">
        <GitBranch className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Treatment Decision</h2>
        <p className="text-sm text-slate-500">
          Based on progress review, monitoring results, and clinical assessment — what is the plan?
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {options.map((opt) => {
        const selected = decision === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onDecisionChange(opt.value)}
            className={`text-left rounded-xl border p-4 transition-all ${
              selected
                ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <p className={`text-sm font-semibold ${selected ? 'text-indigo-900' : 'text-slate-900'}`}>
              {opt.label}
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{opt.description}</p>
          </button>
        );
      })}
    </div>

    <p className="text-xs text-slate-500 mt-4 leading-relaxed">
      For routine script renewals without a full visit, use{' '}
      <span className="font-medium text-slate-700">Medication Report</span> from the patient profile
      instead of Change medication here.
    </p>
  </div>
);

export default TreatmentDecisionStep;
