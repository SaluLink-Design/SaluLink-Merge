'use client';

import { useMemo } from 'react';
import type { TreatmentItem } from '@/types';
import { getInvestigationBasketItems, createTreatmentItemFromBasket } from '@/lib/careActions';
import { getTreatmentDocumentationStatus } from '@/lib/diagnosticEvidence';
import FileUploadWithRename from '@/components/FileUploadWithRename';

interface InvestigationEvidenceInlineProps {
  condition: string;
  treatmentCode?: string;
  treatments: TreatmentItem[];
  onAddTreatment: (treatment: TreatmentItem) => void;
  onUpdateTreatment: (index: number, treatment: Partial<TreatmentItem>) => void;
  onSync?: () => void;
}

const InvestigationEvidenceInline = ({
  condition,
  treatmentCode,
  treatments,
  onAddTreatment,
  onUpdateTreatment,
  onSync,
}: InvestigationEvidenceInlineProps) => {
  const basketItems = useMemo(
    () => getInvestigationBasketItems(condition, treatmentCode),
    [condition, treatmentCode]
  );

  if (basketItems.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Add written findings or upload the investigation report when results are available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Attach investigation evidence
      </p>
      {basketItems.map((item, idx) => {
        const treatmentIndex = treatments.findIndex(
          (t) =>
            t.code === item.diagnosticBasket.code ||
            t.description === item.diagnosticBasket.description
        );
        const treatment = treatmentIndex >= 0 ? treatments[treatmentIndex] : undefined;
        const docStatus = treatment ? getTreatmentDocumentationStatus(treatment) : null;

        return (
          <div key={`${item.diagnosticBasket.code}-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">{item.diagnosticBasket.description}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Code {item.diagnosticBasket.code} · Max {item.diagnosticBasket.covered} covered
            </p>

            {!treatment ? (
              <button
                type="button"
                onClick={() => onAddTreatment(createTreatmentItemFromBasket(item))}
                className="mt-3 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
              >
                Select this investigation to document results
              </button>
            ) : (
              <div className="mt-3 space-y-3">
                {docStatus?.documented && (
                  <p className="text-xs text-emerald-700 font-medium">{docStatus.detailLabel}</p>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Findings &amp; results
                  </label>
                  <textarea
                    rows={3}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white"
                    placeholder="Enter findings, results and clinical notes…"
                    value={treatment.documentation.notes}
                    onChange={(e) => {
                      onUpdateTreatment(treatmentIndex, {
                        documentation: {
                          ...treatment.documentation,
                          notes: e.target.value,
                        },
                      });
                      onSync?.();
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Upload report
                  </label>
                  <FileUploadWithRename
                    images={treatment.documentation.images}
                    onImagesChange={(images) => {
                      onUpdateTreatment(treatmentIndex, {
                        documentation: { ...treatment.documentation, images },
                      });
                      onSync?.();
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default InvestigationEvidenceInline;
