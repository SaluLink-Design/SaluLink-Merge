'use client';

import { useState } from 'react';
import { FileText, Loader2, Sparkles, Paperclip, CheckCircle2, AlertCircle } from 'lucide-react';
import { TreatmentItem, BenefitState } from '@/types';
import EvidenceCompletenessPanel from '@/components/EvidenceCompletenessPanel';
import { classifyDiagnosticTest, isTestDocumented } from '@/lib/diagnosticEvidence';

interface DiagnosticEvidenceReviewProps {
  conditionName: string;
  icdCode: string;
  clinicalNote: string;
  diagnosticTreatments: TreatmentItem[];
  diagnosisDate: string;
  benefitState: BenefitState;
  medicationsFormularyAligned?: boolean;
  onDiagnosisDateChange: (date: string) => void;
}

const DiagnosticEvidenceReview = ({
  conditionName,
  icdCode,
  clinicalNote,
  diagnosticTreatments,
  diagnosisDate,
  benefitState,
  medicationsFormularyAligned = true,
  onDiagnosisDateChange,
}: DiagnosticEvidenceReviewProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [findingsSummary, setFindingsSummary] = useState<string | null>(null);
  const [findingsError, setFindingsError] = useState<string | null>(null);

  const handleAnalyzeFindings = async () => {
    setIsAnalyzing(true);
    setFindingsError(null);
    try {
      const testSummaries = diagnosticTreatments
        .map(
          (t) =>
            `## ${t.description} (${t.code})\n${t.documentation.notes || '(no written findings)'}\nAttachments: ${t.documentation.images.length}`
        )
        .join('\n\n');

      const response = await fetch('/api/analyze-findings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinical_note: clinicalNote,
          condition: conditionName,
          icd_code: icdCode,
          test_findings: testSummaries,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis failed');

      setFindingsSummary(
        data.summary ||
          data.analysis ||
          'Authi reviewed the documented findings. Confirm ICD and PMB eligibility before CIB submission.'
      );
    } catch (err) {
      setFindingsError(err instanceof Error ? err.message : 'Failed to analyze findings');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="brand-icon">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Diagnostic Evidence Review</h2>
            <p className="text-sm text-slate-500">
              Review all tests, findings, and attachments before prescribing and CIB registration
            </p>
          </div>
        </div>

        {diagnosticTreatments.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            No diagnostic tests selected. Go back to the diagnostic basket step.
          </p>
        ) : (
          <div className="space-y-3">
            {diagnosticTreatments.map((t, i) => {
              const documented = isTestDocumented(t);
              const type = classifyDiagnosticTest(t.description);
              return (
                <div
                  key={`${t.code}-${i}`}
                  className={`rounded-xl border p-4 ${
                    documented ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{t.description}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">Code: {t.code}</p>
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                        {type}
                      </span>
                    </div>
                    {documented ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    )}
                  </div>
                  {t.documentation.notes && (
                    <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap border-t border-slate-200/80 pt-3">
                      {t.documentation.notes}
                    </p>
                  )}
                  {t.documentation.images.length > 0 && (
                    <p className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                      <Paperclip className="w-3.5 h-3.5" />
                      {t.documentation.images.length} attachment(s)
                    </p>
                  )}
                  {!documented && (
                    <p className="text-xs text-amber-700 mt-2">Add findings or upload results in the diagnostic basket step.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <EvidenceCompletenessPanel
        conditionName={conditionName}
        icdCode={icdCode}
        clinicalNote={clinicalNote}
        benefitState={benefitState}
        diagnosticTreatments={diagnosticTreatments}
        diagnosisDate={diagnosisDate}
        onDiagnosisDateChange={onDiagnosisDateChange}
        medicationsFormularyAligned={medicationsFormularyAligned}
      />

      <div className="card border-2 border-violet-100">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-violet-600" />
          <h3 className="font-semibold text-slate-900">Authi — findings analysis</h3>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Synthesise documented test results against the suspected chronic condition and PMB entry criteria.
        </p>
        <button
          type="button"
          onClick={handleAnalyzeFindings}
          disabled={isAnalyzing || diagnosticTreatments.length === 0}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isAnalyzing ? 'Analysing findings…' : 'Analyse findings with Authi'}
        </button>
        {findingsError && (
          <p className="text-sm text-red-600 mt-3">{findingsError}</p>
        )}
        {findingsSummary && (
          <div className="mt-4 rounded-xl bg-violet-50 border border-violet-200 p-4 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
            {findingsSummary}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiagnosticEvidenceReview;
