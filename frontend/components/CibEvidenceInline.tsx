'use client';

import { useMemo } from 'react';
import type { CibEvidenceItem } from '@/types';
import { getTreatmentDocumentationStatus } from '@/lib/diagnosticEvidence';
import FileUploadWithRename from '@/components/FileUploadWithRename';

interface CibEvidenceInlineProps {
  evidenceItem: CibEvidenceItem;
  evidenceIndex: number;
  mode: 'readonly' | 'interpretation' | 'upload';
  interpretationNotes?: string;
  onUpdateEvidence: (index: number, patch: Partial<CibEvidenceItem>) => void;
  onInterpretationChange?: (notes: string) => void;
}

const CibEvidenceInline = ({
  evidenceItem,
  evidenceIndex,
  mode,
  interpretationNotes = '',
  onUpdateEvidence,
  onInterpretationChange,
}: CibEvidenceInlineProps) => {
  const docStatus = useMemo(
    () => getTreatmentDocumentationStatus(evidenceItem as import('@/types').TreatmentItem),
    [evidenceItem]
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-900">{evidenceItem.description}</p>
      <p className="text-xs text-slate-500 mt-0.5">Code {evidenceItem.code}</p>

      {mode === 'readonly' && (
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          {docStatus.documented && (
            <p className="text-xs text-emerald-700 font-medium">{docStatus.detailLabel}</p>
          )}
          {evidenceItem.documentation.notes && (
            <p className="text-xs bg-white rounded-lg border border-slate-200 p-3 whitespace-pre-wrap">
              {evidenceItem.documentation.notes}
            </p>
          )}
        </div>
      )}

      {mode === 'upload' && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Findings &amp; results</label>
            <textarea
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white"
              placeholder="Enter findings, results and clinical notes…"
              value={evidenceItem.documentation.notes}
              onChange={(e) =>
                onUpdateEvidence(evidenceIndex, {
                  documentation: {
                    ...evidenceItem.documentation,
                    notes: e.target.value,
                  },
                })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Upload report</label>
            <FileUploadWithRename
              images={evidenceItem.documentation.images}
              onImagesChange={(images) =>
                onUpdateEvidence(evidenceIndex, {
                  documentation: { ...evidenceItem.documentation, images },
                })
              }
            />
          </div>
        </div>
      )}

      {mode === 'interpretation' && (
        <div className="mt-3">
          {evidenceItem.documentation.notes && (
            <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-500 mb-1">Provider report</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {evidenceItem.documentation.notes}
              </p>
            </div>
          )}
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Your clinical interpretation
          </label>
          <textarea
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white"
            placeholder="Summarise findings and how they support the chronic diagnosis…"
            value={interpretationNotes}
            onChange={(e) => onInterpretationChange?.(e.target.value)}
          />
        </div>
      )}
    </div>
  );
};

export default CibEvidenceInline;
