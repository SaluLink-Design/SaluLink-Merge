'use client';

import { CheckCircle2, Stethoscope, Paperclip } from 'lucide-react';
import { TreatmentItem } from '@/types';
import IcdCodeSelection from '@/components/IcdCodeSelection';
import { classifyDiagnosticTest, getTreatmentDocumentationStatus } from '@/lib/diagnosticEvidence';

interface DiagnosisConfirmationProps {
  condition: string;
  selectedIcdCode: string | null;
  diagnosticTreatments: TreatmentItem[];
  onSelectIcd: (icdCode: string, description: string) => void;
}

const DiagnosisConfirmation = ({
  condition,
  selectedIcdCode,
  diagnosticTreatments,
  onSelectIcd,
}: DiagnosisConfirmationProps) => {
  const documentedCount = diagnosticTreatments.filter(
    (t) => getTreatmentDocumentationStatus(t).documented
  ).length;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="brand-icon">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Confirm diagnosis</h2>
            <p className="text-sm text-slate-500">
              Review collected evidence, then confirm the chronic condition and ICD-10 code for scheme funding
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-3 mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Suspected condition</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{condition}</p>
          <p className="text-sm text-slate-600 mt-1">
            {documentedCount} of {diagnosticTreatments.length} diagnostic test
            {diagnosticTreatments.length !== 1 ? 's' : ''} documented
          </p>
        </div>

        {diagnosticTreatments.length > 0 && (
          <div className="space-y-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence collected</p>
            {diagnosticTreatments.map((t, i) => {
              const doc = getTreatmentDocumentationStatus(t);
              const type = classifyDiagnosticTest(t.description);
              return (
                <div
                  key={`${t.code}-${i}`}
                  className={`rounded-lg border px-3 py-2.5 text-sm ${
                    doc.documented ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{t.description}</p>
                      {t.documentation.notes && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{t.documentation.notes}</p>
                      )}
                      {doc.fileCount > 0 && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          {doc.fileCount} file{doc.fileCount !== 1 ? 's' : ''} attached
                        </p>
                      )}
                    </div>
                    {doc.documented ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 capitalize">
                    {type}
                    {doc.documented ? ` · ${doc.detailLabel}` : ' · needs findings or uploads'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <IcdCodeSelection
        condition={condition}
        selectedIcdCode={selectedIcdCode}
        onSelect={onSelectIcd}
      />
    </div>
  );
};

export default DiagnosisConfirmation;
