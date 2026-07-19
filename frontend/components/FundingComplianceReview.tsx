'use client';

import { ShieldCheck, Paperclip, CheckCircle2, AlertCircle, Pill } from 'lucide-react';
import { TreatmentItem, BenefitState, SelectedMedication } from '@/types';
import EvidenceCompletenessPanel from '@/components/EvidenceCompletenessPanel';
import {
  canProceedFromEvidenceReview,
  classifyDiagnosticTest,
  EVIDENCE_REVIEW_MIN_SCORE,
  getTreatmentDocumentationStatus,
} from '@/lib/diagnosticEvidence';

interface FundingComplianceReviewProps {
  conditionName: string;
  icdCode: string;
  clinicalNote: string;
  diagnosticTreatments: TreatmentItem[];
  medications: SelectedMedication[];
  diagnosisDate: string;
  benefitState: BenefitState;
  medicationsFormularyAligned?: boolean;
  onDiagnosisDateChange: (date: string) => void;
  variant?: 'funding' | 'diagnostic_evidence';
}

const FundingComplianceReview = ({
  conditionName,
  icdCode,
  clinicalNote,
  diagnosticTreatments,
  medications,
  diagnosisDate,
  benefitState,
  medicationsFormularyAligned = true,
  onDiagnosisDateChange,
  variant = 'funding',
}: FundingComplianceReviewProps) => {
  const gate = canProceedFromEvidenceReview({
    treatments: diagnosticTreatments,
    conditionName,
    icdCode,
    clinicalNote,
    diagnosisDate,
    benefitState,
    medicationsFormularyAligned,
  });

  const documentedCount = diagnosticTreatments.filter(
    (t) => getTreatmentDocumentationStatus(t).documented
  ).length;
  const filesOnlyCount = diagnosticTreatments.filter((t) => {
    const s = getTreatmentDocumentationStatus(t);
    return s.documented && s.hasFiles && !s.hasNotes;
  }).length;

  const heading =
    variant === 'diagnostic_evidence'
      ? {
          title: 'Diagnostic Evidence Review',
          subtitle:
            'Review all tests, findings, and attachments before prescribing and CIB registration.',
        }
      : {
          title: 'Funding & compliance review',
          subtitle:
            'Authi checks that this case is clinically sound and documented in a way your scheme can fund',
        };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="brand-icon">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{heading.title}</h2>
            <p className="text-sm text-slate-500">{heading.subtitle}</p>
          </div>
        </div>

        {variant === 'funding' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Diagnosis</p>
                <p className="font-semibold text-slate-900 mt-1">{conditionName}</p>
                <p className="text-sm font-mono text-violet-600">{icdCode || '—'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Diagnostic evidence</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {documentedCount} / {diagnosticTreatments.length} documented
                </p>
                {filesOnlyCount > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {filesOnlyCount} via uploads only
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Medications</p>
                <p className="font-semibold text-slate-900 mt-1">{medications.length} selected</p>
              </div>
            </div>

            {medications.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5" />
                  Treatment pathway
                </p>
                <ul className="space-y-1.5">
                  {medications.map((m) => (
                    <li
                      key={m.medicineNameAndStrength}
                      className="text-sm text-slate-800 rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      {m.medicineNameAndStrength}
                      {m.formularyStatus && (
                        <span className="text-xs text-slate-500 ml-2">· {m.formularyStatus}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {diagnosticTreatments.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            No diagnostic tests on file. Go back to the diagnostic basket step.
          </p>
        ) : (
          <div className="space-y-3">
            {diagnosticTreatments.map((t, i) => {
              const doc = getTreatmentDocumentationStatus(t);
              const type = classifyDiagnosticTest(t.description);
              return (
                <div
                  key={`${t.code}-${i}`}
                  className={`rounded-xl border p-4 ${
                    doc.documented ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{t.description}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">Code: {t.code}</p>
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                        {type}
                      </span>
                      {doc.documented && (
                        <p className="text-xs text-emerald-700 mt-1.5 font-medium">{doc.detailLabel}</p>
                      )}
                    </div>
                    {doc.documented ? (
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
                  {doc.fileCount > 0 && (
                    <p className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                      <Paperclip className="w-3.5 h-3.5" />
                      {doc.fileCount} supporting file{doc.fileCount !== 1 ? 's' : ''} attached
                    </p>
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

      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          gate.ok
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
      >
        {gate.ok ? (
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {variant === 'diagnostic_evidence'
              ? 'Evidence pack looks complete — ready for medication and CIB registration.'
              : 'Case is funding-ready — continue to CIB registration.'}
          </p>
        ) : (
          <p>
            <span className="font-medium">Before CIB submission:</span>{' '}
            {gate.reason ??
              `Complete funding & compliance checks (minimum ${EVIDENCE_REVIEW_MIN_SCORE}% evidence score and date of diagnosis).`}
          </p>
        )}
      </div>
    </div>
  );
};

export default FundingComplianceReview;
