'use client';

import { AlertTriangle, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ClinicalReviewStatus } from '@/types';

interface ClinicalAssessmentCaptureProps {
  value: ClinicalReviewStatus | null;
  onChange: (status: ClinicalReviewStatus) => void;
  basis?: string;
  onBasisChange?: (basis: string) => void;
  /** GP soft escalate copy vs specialist plan-review copy */
  specialistFlow?: boolean;
  /** Context label above the control */
  hint?: string;
  compact?: boolean;
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
    description: 'Fewer events or clearer response.',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
  {
    value: 'stable',
    label: 'Stable',
    description: 'Adequately controlled.',
    icon: <Minus className="w-3.5 h-3.5" />,
  },
  {
    value: 'deteriorating',
    label: 'Deteriorating',
    description: 'Worse control or safety concern.',
    icon: <TrendingDown className="w-3.5 h-3.5" />,
  },
];

const ClinicalAssessmentCapture = ({
  value,
  onChange,
  basis = '',
  onBasisChange,
  specialistFlow = false,
  hint = 'Based on what you just documented — not a separate assessment step.',
  compact = true,
}: ClinicalAssessmentCaptureProps) => (
  <div
    className={`rounded-xl border border-slate-200 space-y-3 ${
      compact ? 'bg-slate-50 p-3' : 'bg-slate-50 p-4'
    }`}
  >
    <div>
      <p className="text-sm font-semibold text-slate-900">Clinical assessment</p>
      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{hint}</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-left rounded-lg border px-3 py-2.5 transition-all ${
              selected
                ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200'
                : 'border-slate-200 bg-white hover:border-slate-300'
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
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{opt.description}</p>
          </button>
        );
      })}
    </div>
    {value && onBasisChange && (
      <div>
        <label className="label">What are you basing this on? (optional)</label>
        <textarea
          className="textarea-field"
          rows={2}
          placeholder="e.g. no seizures since last review, mild drowsiness, levels within range…"
          value={basis}
          onChange={(e) => onBasisChange(e.target.value)}
        />
      </div>
    )}
    {value === 'deteriorating' && !specialistFlow && (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-900 leading-relaxed">
          Prefer <span className="font-semibold">Refer for medication review</span> or escalate rather
          than changing therapy unilaterally.
        </p>
      </div>
    )}
    {value === 'deteriorating' && specialistFlow && (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-900 leading-relaxed">
          Plan review likely needed — adjust dose, change therapy, or order further monitoring as
          indicated.
        </p>
      </div>
    )}
  </div>
);

export default ClinicalAssessmentCapture;
