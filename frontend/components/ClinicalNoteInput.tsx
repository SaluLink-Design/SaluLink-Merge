'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface ClinicalNoteInputProps {
  value: string;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  onChooseManually?: () => void;
  isAnalyzing: boolean;
  variant?: 'diagnostic' | 'follow-up';
}

const ClinicalNoteInput = ({
  value,
  onChange,
  onAnalyze,
  onChooseManually,
  isAnalyzing,
  variant = 'diagnostic',
}: ClinicalNoteInputProps) => {
  const isFollowUp = variant === 'follow-up';

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-900">
          {isFollowUp ? 'Patient Follow-Up Visit' : 'Clinical Note'}
        </h2>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <span className="text-slate-500">Powered by </span>
          <span className="brand-link-gradient-text">Authi</span>
        </div>
      </div>
      
      <p className="text-slate-600 mb-4">
        {isFollowUp
          ? 'Document this chronic follow-up visit. Authi will use this note with your progress review for clinical assessment.'
          : 'Enter or paste clinical notes for the record. Use Authi to suggest conditions, or choose directly from the chronic disease catalogue if you already know the diagnosis.'}
      </p>
      
      <textarea
        className="textarea-field min-h-[300px]"
        placeholder={
          isFollowUp
            ? "Enter follow-up clinical notes…\n\nExample: Patient returns for 3-month diabetes review. Reports improved energy. HbA1c results discussed. Blood pressure stable on current regimen…"
            : "Enter clinical notes here...\n\nExample: Patient presents with persistent wheezing, shortness of breath, and chest tightness. History of allergic rhinitis. Symptoms worsen with exercise and cold air exposure..."
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isAnalyzing}
      />
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6">
        <button
          type="button"
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors text-left"
          onClick={() => onChange('')}
          disabled={!value.trim() || isAnalyzing}
        >
          Clear
        </button>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {!isFollowUp && onChooseManually && (
            <button
              type="button"
              className="btn-secondary flex items-center justify-center gap-2"
              onClick={onChooseManually}
              disabled={isAnalyzing}
            >
              Choose condition manually
            </button>
          )}
          {!isFollowUp && (
            <button
              type="button"
              className="btn-primary flex items-center justify-center gap-2"
              onClick={onAnalyze}
              disabled={!value.trim() || isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Analyze with Authi</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClinicalNoteInput;

