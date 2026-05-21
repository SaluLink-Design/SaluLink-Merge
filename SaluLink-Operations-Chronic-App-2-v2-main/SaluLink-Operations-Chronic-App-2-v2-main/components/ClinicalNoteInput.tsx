'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface ClinicalNoteInputProps {
  value: string;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

const ClinicalNoteInput = ({ value, onChange, onAnalyze, isAnalyzing }: ClinicalNoteInputProps) => {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-900">Clinical Note</h2>
        <div className="flex items-center gap-2 text-sm text-violet-600 font-medium">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <span>Powered by Authi</span>
        </div>
      </div>
      
      <p className="text-slate-600 mb-4">
        Enter or paste the specialist's clinical notes below. The AI will analyze the text to identify potential chronic conditions.
      </p>
      
      <textarea
        className="textarea-field min-h-[300px]"
        placeholder="Enter clinical notes here...&#10;&#10;Example: Patient presents with persistent wheezing, shortness of breath, and chest tightness. History of allergic rhinitis. Symptoms worsen with exercise and cold air exposure..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isAnalyzing}
      />
      
      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          onClick={() => onChange('')}
          disabled={!value.trim() || isAnalyzing}
        >
          Clear
        </button>
        
        <button
          className="btn-primary flex items-center gap-2"
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
              <span>Analyze</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ClinicalNoteInput;

