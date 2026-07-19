'use client';

import { useEffect, useState } from 'react';
import { Activity, Loader2, Sparkles, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { ClinicalReviewStatus } from '@/types';

interface ClinicalReviewStepProps {
  assessmentNote: string;
  condition: string;
  basketItemsUsed: number;
  basketTotalAllowed: number;
  value: ClinicalReviewStatus | null;
  onChange: (status: ClinicalReviewStatus) => void;
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
    description: 'Symptoms or control are getting better compared to last review.',
    icon: <TrendingUp className="w-4 h-4" />,
  },
  {
    value: 'stable',
    label: 'Stable',
    description: 'Condition is adequately controlled on the current plan.',
    icon: <Minus className="w-4 h-4" />,
  },
  {
    value: 'deteriorating',
    label: 'Deteriorating',
    description: 'Control is worsening — treatment change or escalation may be needed.',
    icon: <TrendingDown className="w-4 h-4" />,
  },
];

const mapSignalToSuggestion = (signal: string): ClinicalReviewStatus | null => {
  if (signal === 'controlled') return 'stable';
  if (signal === 'deteriorating' || signal === 'escalation_needed') return 'deteriorating';
  return null;
};

const ClinicalReviewStep = ({
  assessmentNote,
  condition,
  basketItemsUsed,
  basketTotalAllowed,
  value,
  onChange,
}: ClinicalReviewStepProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [authiSuggestion, setAuthiSuggestion] = useState<ClinicalReviewStatus | null>(null);
  const [authiExplanation, setAuthiExplanation] = useState('');

  useEffect(() => {
    if (!condition.trim()) return;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/ongoing-assessment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clinical_note: assessmentNote,
            condition_name: condition,
            icd_code: '',
            basket_items_used: basketItemsUsed,
            basket_total_allowed: Math.max(basketTotalAllowed, 1),
            current_medications: [],
            benefit_state: 'approved_chronic',
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const suggested = mapSignalToSuggestion(data.stability_signal?.signal ?? '');
          setAuthiSuggestion(suggested);
          setAuthiExplanation(data.stability_signal?.explanation ?? '');
          if (!value && suggested) onChange(suggested);
        }
      } catch {
        setAuthiExplanation('Authi assessment unavailable — select the clinical trajectory manually.');
      } finally {
        setIsLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [assessmentNote, condition, basketItemsUsed, basketTotalAllowed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="brand-icon">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Clinical Review</h2>
          <p className="text-sm text-slate-500">
            Is the patient&apos;s condition improving, stable, or deteriorating?
          </p>
        </div>
      </div>

      {(isLoading || authiExplanation) && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 mb-6 flex items-start gap-2.5">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0 mt-0.5" />
          ) : (
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            <p className="font-semibold text-indigo-900">
              {isLoading
                ? 'Authi is reviewing the visit…'
                : authiSuggestion
                ? `Authi suggests: ${authiSuggestion}`
                : 'Authi could not determine trajectory — please select manually'}
            </p>
            {!isLoading && authiExplanation && (
              <p className="text-indigo-800/80 mt-1 text-xs leading-relaxed">{authiExplanation}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value;
          const suggested = authiSuggestion === opt.value;
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
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                    selected ? 'text-indigo-900' : 'text-slate-900'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </span>
                {suggested && !selected && (
                  <span className="text-[10px] uppercase tracking-wide text-indigo-600 font-semibold">
                    Suggested
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{opt.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ClinicalReviewStep;
