'use client';

import { BenefitState, TreatmentItem } from '@/types';
import { AlertCircle, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { computeEvidenceCompleteness } from '@/lib/benefitState';
import { classifyDiagnosticTest, isTestDocumented } from '@/lib/diagnosticEvidence';

interface EvidenceCompletenessPanelProps {
  conditionName: string;
  icdCode: string;
  clinicalNote: string;
  benefitState: BenefitState;
  diagnosticTreatments: TreatmentItem[];
  diagnosisDate?: string;
  onDiagnosisDateChange?: (date: string) => void;
  medicationsFormularyAligned?: boolean;
  readOnlyChecklist?: boolean;
}

const EvidenceCompletenessPanel = ({
  conditionName,
  icdCode,
  clinicalNote,
  benefitState,
  diagnosticTreatments,
  diagnosisDate = '',
  onDiagnosisDateChange,
  medicationsFormularyAligned = true,
  readOnlyChecklist = true,
}: EvidenceCompletenessPanelProps) => {
  const evidence = computeEvidenceCompleteness({
    conditionName,
    icdCode,
    clinicalNote,
    benefitState,
    diagnosisDate,
    diagnosticTreatments,
    medicationsFormularyAligned,
  });

  const scoreColor =
    evidence.score >= 85
      ? 'text-emerald-700'
      : evidence.score >= 60
        ? 'text-amber-700'
        : 'text-red-700';

  const barColor =
    evidence.score >= 85
      ? 'bg-emerald-500'
      : evidence.score >= 60
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl authi-gradient flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">CIB evidence pack</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-bold ${scoreColor}`}>{evidence.score}%</p>
          <p className="text-xs text-amber-700">ready</p>
        </div>
      </div>

      <div className="h-2 w-full bg-amber-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${evidence.score}%` }}
        />
      </div>

      {readOnlyChecklist && diagnosticTreatments.length > 0 && (
        <ul className="space-y-2 text-sm">
          {diagnosticTreatments.map((t, i) => {
            const doc = isTestDocumented(t);
            const type = classifyDiagnosticTest(t.description);
            return (
              <li
                key={`${t.code}-${i}`}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                  doc ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-amber-200'
                }`}
              >
                <span className="text-slate-800 font-medium truncate">{t.description}</span>
                <span className="text-xs shrink-0 text-slate-500">
                  {type} · {doc ? 'documented' : 'needs findings'}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-xl border border-amber-200 bg-white p-4 space-y-2">
        <label className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
          Date of diagnosis (required for retrospective benefit connection)
        </label>
        <input
          type="date"
          value={diagnosisDate}
          onChange={(e) => onDiagnosisDateChange?.(e.target.value)}
          className="input-field w-full max-w-xs"
        />
      </div>

      {evidence.missingItems.length > 0 ? (
        <div className="rounded-xl border border-amber-300/60 bg-white px-4 py-3">
          <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5 mb-2">
            <AlertCircle className="w-4 h-4" />
            Still needed for a strong CIB submission
          </p>
          <ul className="space-y-1">
            {evidence.missingItems.map((item) => (
              <li key={item} className="text-xs text-amber-800 flex items-start gap-1.5">
                <span className="text-amber-500 mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-emerald-800 flex items-center gap-1.5 font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Evidence pack looks complete — ready for CIB registration.
        </p>
      )}
    </div>
  );
};

export default EvidenceCompletenessPanel;
