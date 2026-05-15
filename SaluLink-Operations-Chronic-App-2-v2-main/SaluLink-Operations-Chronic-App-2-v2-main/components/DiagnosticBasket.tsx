'use client';

import { useState, useEffect } from 'react';
import { FileText, Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { TreatmentBasketItem, TreatmentItem } from '@/types';
import { DataService } from '@/lib/dataService';
import FileUploadWithRename from './FileUploadWithRename';

interface DiagnosticBasketProps {
  condition: string;
  treatments: TreatmentItem[];
  onAddTreatment: (treatment: TreatmentItem) => void;
  onUpdateTreatment: (index: number, treatment: Partial<TreatmentItem>) => void;
  onRemoveTreatment: (index: number) => void;
}

const DiagnosticBasket = ({
  condition,
  treatments,
  onAddTreatment,
  onUpdateTreatment,
  onRemoveTreatment,
}: DiagnosticBasketProps) => {
  const [diagnosticItems, setDiagnosticItems] = useState<TreatmentBasketItem[]>([]);
  const [expandedDiagnostic, setExpandedDiagnostic] = useState<string | null>(null);

  useEffect(() => {
    setDiagnosticItems(DataService.getDiagnosticBasketForCondition(condition));
  }, [condition]);

  const getDiagnosticIndex = (item: TreatmentBasketItem) =>
    treatments.findIndex(t => t.description === item.diagnosticBasket.description);

  const isDiagnosticSelected = (item: TreatmentBasketItem) =>
    getDiagnosticIndex(item) !== -1;

  const getDiagnosticTreatment = (item: TreatmentBasketItem) =>
    treatments.find(t => t.description === item.diagnosticBasket.description);

  const handleClickDiagnostic = (item: TreatmentBasketItem) => {
    const isSelected = isDiagnosticSelected(item);
    if (isSelected) {
      setExpandedDiagnostic(prev =>
        prev === item.diagnosticBasket.description ? null : item.diagnosticBasket.description
      );
    } else {
      onAddTreatment({
        description: item.diagnosticBasket.description,
        code: item.diagnosticBasket.code,
        maxCovered: parseInt(item.diagnosticBasket.covered) || 1,
        timesCompleted: 1,
        documentation: { notes: '', images: [] },
      });
      setExpandedDiagnostic(item.diagnosticBasket.description);
    }
  };

  const handleRemoveDiagnostic = (e: React.MouseEvent, item: TreatmentBasketItem) => {
    e.stopPropagation();
    const idx = getDiagnosticIndex(item);
    if (idx !== -1) onRemoveTreatment(idx);
    if (expandedDiagnostic === item.diagnosticBasket.description) setExpandedDiagnostic(null);
  };

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-accent-100 rounded-lg flex items-center justify-center">
          <FileText className="w-6 h-6 text-accent-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Diagnostic Basket</h2>
          <p className="text-sm text-gray-500">Select and document required diagnostic tests</p>
        </div>
        {treatments.length > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-accent-700 bg-accent-100 px-2.5 py-0.5 rounded-full">
            <Check className="w-3.5 h-3.5" />
            {treatments.length} selected
          </span>
        )}
      </div>

      {diagnosticItems.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          No diagnostic tests available for this condition.
        </p>
      ) : (
        <div className="space-y-3">
          {diagnosticItems.map((item, idx) => {
            const isSelected = isDiagnosticSelected(item);
            const treatment = getDiagnosticTreatment(item);
            const treatmentIndex = getDiagnosticIndex(item);
            const isExpanded =
              expandedDiagnostic === item.diagnosticBasket.description && isSelected;

            return (
              <div
                key={idx}
                className={`rounded-xl border-2 transition-all duration-200 ${
                  isSelected
                    ? 'border-accent-400 bg-accent-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-accent-300 hover:shadow-sm'
                }`}
              >
                {/* Card Header */}
                <button
                  type="button"
                  className="w-full text-left px-4 py-3.5"
                  onClick={() => handleClickDiagnostic(item)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-semibold text-gray-900 leading-snug">
                          {item.diagnosticBasket.description}
                        </h4>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-100 text-accent-700 text-xs rounded font-medium">
                            <Check className="w-3 h-3" /> Selected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>
                          Code:{' '}
                          <span className="font-mono text-gray-700">{item.diagnosticBasket.code}</span>
                        </span>
                        <span>
                          Max:{' '}
                          <span className="font-semibold text-gray-700">
                            {item.diagnosticBasket.covered}
                          </span>{' '}
                          covered
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isSelected ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleRemoveDiagnostic(e, item)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remove"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="w-6 h-6 bg-accent-600 rounded-full flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </>
                      ) : (
                        <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Collapsed summary */}
                {isSelected && !isExpanded && treatment && (
                  <button
                    type="button"
                    className="w-full px-4 pb-3 text-left border-t border-accent-200"
                    onClick={() => setExpandedDiagnostic(item.diagnosticBasket.description)}
                  >
                    <p className="pt-2.5 text-sm text-gray-500 italic">
                      {treatment.documentation.notes
                        ? treatment.documentation.notes.length > 70
                          ? treatment.documentation.notes.substring(0, 70) + '…'
                          : treatment.documentation.notes
                        : 'Tap to add findings & documents'}
                    </p>
                  </button>
                )}

                {/* Expanded Documentation Form */}
                {isSelected && isExpanded && treatment && (
                  <div
                    className="px-4 pb-5 border-t border-accent-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="pt-4 space-y-5">
                      {/* Times Completed */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Times Completed
                        </label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateTreatment(treatmentIndex, {
                                timesCompleted: Math.max(1, treatment.timesCompleted - 1),
                              })
                            }
                            disabled={treatment.timesCompleted <= 1}
                            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-gray-700 disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-lg font-semibold text-gray-900">
                            {treatment.timesCompleted}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateTreatment(treatmentIndex, {
                                timesCompleted: Math.min(
                                  treatment.maxCovered,
                                  treatment.timesCompleted + 1
                                ),
                              })
                            }
                            disabled={treatment.timesCompleted >= treatment.maxCovered}
                            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-gray-700 disabled:opacity-40"
                          >
                            +
                          </button>
                          <span className="text-sm text-gray-500">
                            of{' '}
                            <span className="font-semibold text-gray-700">{treatment.maxCovered}</span>{' '}
                            covered
                            {treatment.timesCompleted === treatment.maxCovered && (
                              <span className="ml-2 text-xs bg-accent-100 text-accent-700 px-2 py-0.5 rounded">
                                Max reached
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Findings */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Findings &amp; Results
                        </label>
                        <textarea
                          rows={4}
                          placeholder="Enter findings, results and clinical notes…"
                          value={treatment.documentation.notes}
                          onChange={(e) =>
                            onUpdateTreatment(treatmentIndex, {
                              documentation: {
                                ...treatment.documentation,
                                notes: e.target.value,
                              },
                            })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-transparent resize-none bg-white"
                        />
                      </div>

                      {/* File Upload */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Upload Documents
                        </label>
                        <FileUploadWithRename
                          images={treatment.documentation.images}
                          onImagesChange={(images) =>
                            onUpdateTreatment(treatmentIndex, {
                              documentation: { ...treatment.documentation, images },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DiagnosticBasket;
