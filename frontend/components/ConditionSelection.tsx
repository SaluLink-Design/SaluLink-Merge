'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, List, Loader2, Search, Sparkles } from 'lucide-react';
import { MatchedCondition } from '@/types';
import { DataService } from '@/lib/dataService';
import BrandMatchBar from './BrandMatchBar';

type SelectionTab = 'authi' | 'manual';

interface ConditionSelectionProps {
  matchedConditions: MatchedCondition[];
  onSelect: (condition: string) => void;
  selectedCondition: string | null;
  /** Unregistered diagnostic path — condition is suspected until evidence confirms */
  suspectedMode?: boolean;
  /** Open on manual catalogue when doctor skipped Authi analyze */
  defaultTab?: SelectionTab;
  /** Hide ICD on this step — confirmed later at diagnosis */
  deferIcdSelection?: boolean;
  isAnalyzingSuggestions?: boolean;
  hasClinicalNote?: boolean;
  /**
   * Restricts the catalogue/Authi lists to this set of condition names, e.g.
   * a neurologist's own workspace only offering Epilepsy. `null`/`undefined`
   * means no restriction — show everything (the default for GP and any role
   * without a specialty mapping).
   */
  allowedConditions?: string[] | null;
}

const ConditionSelection = ({
  matchedConditions,
  onSelect,
  selectedCondition,
  suspectedMode = false,
  defaultTab = 'authi',
  deferIcdSelection = false,
  isAnalyzingSuggestions = false,
  hasClinicalNote = false,
  allowedConditions = null,
}: ConditionSelectionProps) => {
  const [activeTab, setActiveTab] = useState<SelectionTab>(defaultTab);
  const [showAll, setShowAll] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [catalogueNames, setCatalogueNames] = useState<string[]>([]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    setCatalogueNames(DataService.getUniqueChronicConditionNames());
  }, []);

  const allowedSet = useMemo(
    () => (allowedConditions && allowedConditions.length > 0 ? new Set(allowedConditions) : null),
    [allowedConditions]
  );

  // Never let a restriction produce a dead end — fall back to the full list
  // if filtering would leave nothing to pick from.
  const scopedMatchedConditions = useMemo(() => {
    if (!allowedSet) return matchedConditions;
    const filtered = matchedConditions.filter((c) => allowedSet.has(c.condition));
    return filtered.length > 0 ? filtered : matchedConditions;
  }, [matchedConditions, allowedSet]);

  const scopedCatalogueNames = useMemo(() => {
    if (!allowedSet) return catalogueNames;
    const filtered = catalogueNames.filter((name) => allowedSet.has(name));
    return filtered.length > 0 ? filtered : catalogueNames;
  }, [catalogueNames, allowedSet]);

  const displayedConditions = showAll ? scopedMatchedConditions : scopedMatchedConditions.slice(0, 5);

  const filteredCatalogue = useMemo(() => {
    const query = manualSearch.trim().toLowerCase();
    if (!query) return scopedCatalogueNames;
    return scopedCatalogueNames.filter((name) => name.toLowerCase().includes(query));
  }, [scopedCatalogueNames, manualSearch]);

  const authiSuggestionCount = scopedMatchedConditions.length;

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="brand-icon">
          {activeTab === 'authi' ? (
            <Sparkles className="w-5 h-5" />
          ) : (
            <List className="w-5 h-5" />
          )}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {suspectedMode ? 'Suspected chronic condition' : 'Chronic condition'}
          </h2>
          <p className="text-sm text-slate-800">
            {deferIcdSelection
              ? 'Select the condition to investigate — ICD-10 is confirmed after diagnostics'
              : suspectedMode
                ? 'Choose from Authi suggestions or pick from the scheme chronic disease catalogue'
                : 'Select from Authi suggestions or choose manually from the chronic disease list'}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab('authi')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'authi'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Suggested by Authi
          {authiSuggestionCount > 0 && (
            <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
              {authiSuggestionCount}
            </span>
          )}
          {isAnalyzingSuggestions && authiSuggestionCount === 0 && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'manual'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <List className="w-4 h-4" />
          Choose manually
        </button>
      </div>

      {activeTab === 'authi' ? (
        isAnalyzingSuggestions && authiSuggestionCount === 0 ? (
          <div className="text-center py-12 bg-gradient-to-br from-slate-50 to-violet-50/30 rounded-xl border border-slate-200">
            <Loader2 className="w-10 h-10 text-violet-500 mx-auto mb-4 animate-spin" />
            <p className="text-slate-700 font-medium">Authi is analysing your clinical note…</p>
            <p className="text-sm text-slate-500 mt-2">
              Suggestions will appear here. You can pick from the catalogue meanwhile.
            </p>
          </div>
        ) : authiSuggestionCount === 0 ? (
          <div className="text-center py-12 bg-gradient-to-br from-slate-50 to-violet-50/30 rounded-xl border border-slate-200">
            <Sparkles className="w-12 h-12 text-violet-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-2">
              {hasClinicalNote
                ? 'No Authi suggestions matched this note.'
                : 'Add a clinical note for Authi suggestions.'}
            </p>
            <p className="text-sm text-slate-500">
              Use{' '}
              <button
                type="button"
                onClick={() => setActiveTab('manual')}
                className="font-semibold brand-gradient-text hover:opacity-80"
              >
                Choose manually
              </button>{' '}
              from the chronic disease catalogue.
            </p>
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
                    onClick={() => onSelect(condition.condition)}
                    className={`w-full text-left p-4 transition-all ${
                      isSelected ? 'brand-card-selected' : 'brand-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-semibold text-lg text-slate-900">
                            {condition.condition}
                          </h3>
                          {isSelected && (
                            <span className="brand-badge-selected">Selected</span>
                          )}
                        </div>
                        {!deferIcdSelection && (
                          <p className="text-sm text-slate-800 mb-0.5">
                            <span className="font-mono font-medium text-violet-600">
                              {condition.icdCode}
                            </span>
                            <span className="text-slate-600 mx-2">·</span>
                            {condition.icdDescription}
                          </p>
                        )}
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

            {scopedMatchedConditions.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="mt-4 w-full py-2.5 text-sm font-semibold brand-gradient-text hover:opacity-80 transition-opacity"
              >
                {showAll ? 'Show less' : `Show ${scopedMatchedConditions.length - 5} more conditions`}
              </button>
            )}
          </>
        )
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="search"
              value={manualSearch}
              onChange={(e) => setManualSearch(e.target.value)}
              placeholder="Search chronic conditions..."
              className="input-field pl-10"
              autoComplete="off"
            />
          </div>

          {filteredCatalogue.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-slate-600">No conditions match your search.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {filteredCatalogue.map((conditionName) => {
                const isSelected = selectedCondition === conditionName;

                return (
                  <button
                    key={conditionName}
                    type="button"
                    onClick={() => onSelect(conditionName)}
                    className={`w-full text-left p-4 transition-all ${
                      isSelected ? 'brand-card-selected' : 'brand-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-semibold text-base text-slate-900">
                            {conditionName}
                          </h3>
                          {isSelected && (
                            <span className="brand-badge-selected">Selected</span>
                          )}
                        </div>
                        {deferIcdSelection && (
                          <p className="text-xs text-slate-500">
                            ICD-10 confirmed at the diagnosis step
                          </p>
                        )}
                      </div>
                      {isSelected ? (
                        <div className="brand-check flex-shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 border-2 border-slate-300 rounded-full flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500">
            Conditions must be selected from the scheme chronic disease catalogue. Free-text
            conditions are not supported.
          </p>
        </>
      )}
    </div>
  );
};

export default ConditionSelection;
