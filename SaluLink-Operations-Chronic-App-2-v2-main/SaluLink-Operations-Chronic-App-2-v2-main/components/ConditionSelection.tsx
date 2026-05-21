'use client';

import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { MatchedCondition } from '@/types';
import BrandMatchBar from './BrandMatchBar';

interface ConditionSelectionProps {
  matchedConditions: MatchedCondition[];
  onSelect: (condition: string, icdCode: string, description: string) => void;
  selectedCondition: string | null;
}

const ConditionSelection = ({ matchedConditions, onSelect, selectedCondition }: ConditionSelectionProps) => {
  const [showAll, setShowAll] = useState(false);

  const displayedConditions = showAll ? matchedConditions : matchedConditions.slice(0, 5);

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="brand-icon">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Conditions identified in Authi</h2>
          <p className="text-sm text-slate-800">
            Select the chronic condition that best matches the clinical note
          </p>
        </div>
      </div>

      {matchedConditions.length === 0 ? (
        <div className="text-center py-12 bg-gradient-to-br from-slate-50 to-violet-50/30 rounded-xl border border-slate-200">
          <Sparkles className="w-12 h-12 text-violet-300 mx-auto mb-4" />
          <p className="text-slate-600">No conditions matched. Try analyzing a different clinical note.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {displayedConditions.map((condition, index) => {
              const isSelected = selectedCondition === condition.condition;
              const confidence = Math.round(condition.similarityScore * 100);

              return (
                <button
                  key={`${condition.condition}-${condition.icdCode}-${index}`}
                  type="button"
                  onClick={() => onSelect(condition.condition, condition.icdCode, condition.icdDescription)}
                  className={`w-full text-left p-4 transition-all ${
                    isSelected ? 'brand-card-selected' : 'brand-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-lg text-slate-900">{condition.condition}</h3>
                        {isSelected && (
                          <span className="brand-badge-selected">Selected</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-800 mb-0.5">
                        <span className="font-mono font-medium text-violet-600">{condition.icdCode}</span>
                        <span className="text-slate-600 mx-2">·</span>
                        {condition.icdDescription}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {isSelected ? (
                        <div className="brand-check">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 border-2 border-slate-300 rounded-full" />
                      )}
                      <BrandMatchBar percent={confidence} showLabel />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {matchedConditions.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="mt-4 w-full py-2.5 text-sm font-semibold brand-gradient-text hover:opacity-80 transition-opacity"
            >
              {showAll ? 'Show less' : `Show ${matchedConditions.length - 5} more conditions`}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default ConditionSelection;
