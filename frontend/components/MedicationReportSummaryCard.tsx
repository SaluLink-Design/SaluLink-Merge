'use client';

import { Pill } from 'lucide-react';
import type { ClinicalReviewStatus, MedicationRenewNotes, SelectedMedication } from '@/types';

interface MedicationReportSummaryCardProps {
  patientName: string;
  condition: string;
  clinicalReview?: ClinicalReviewStatus | null;
  clinicalReviewBasis?: string;
  medicationRenewNotes: MedicationRenewNotes;
  medications: SelectedMedication[];
  intent?: 'refer_change' | 'renew';
}

const MedicationReportSummaryCard = ({
  patientName,
  condition,
  clinicalReview,
  clinicalReviewBasis,
  medicationRenewNotes,
  medications,
  intent = 'refer_change',
}: MedicationReportSummaryCardProps) => {
  const hasAdherence = Boolean(medicationRenewNotes.adherence.trim());
  const hasSideEffects = Boolean(medicationRenewNotes.sideEffects.trim());

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-1">
        <Pill className="w-5 h-5 text-violet-600" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-violet-800">
          Medication report summary
        </h3>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Findings from this visit — included for the specialist with your referral. Type your message
        to the specialist in the referral form below.
      </p>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Patient</p>
            <p className="font-medium text-slate-900 mt-0.5">
              {patientName} — {condition}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Intent</p>
            <p className="font-medium text-slate-900 mt-0.5">
              {intent === 'refer_change'
                ? 'Refer for medication review'
                : 'Renew current medication plan'}
            </p>
          </div>
          {clinicalReview && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Clinical assessment
              </p>
              <p className="font-medium text-slate-900 mt-0.5 capitalize">{clinicalReview}</p>
              {clinicalReviewBasis?.trim() && (
                <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
                  {clinicalReviewBasis.trim()}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Current medications
          </p>
          {medications.length === 0 ? (
            <p className="text-slate-500">No medications on file.</p>
          ) : (
            <ul className="space-y-2">
              {medications.map((med, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <p className="font-medium text-slate-900">
                    {med.medicineNameAndStrength || med.brandName || 'Medication'}
                  </p>
                  {med.activeIngredient && (
                    <p className="text-xs text-slate-500">{med.activeIngredient}</p>
                  )}
                  {med.dosage && (
                    <p className="text-xs text-slate-500 mt-0.5">Dosage: {med.dosage}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Medication adherence
            </p>
            <p className="text-slate-800 mt-1 whitespace-pre-wrap">
              {hasAdherence ? medicationRenewNotes.adherence.trim() : 'Not documented'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Side effects / tolerability
            </p>
            <p className="text-slate-800 mt-1 whitespace-pre-wrap">
              {hasSideEffects ? medicationRenewNotes.sideEffects.trim() : 'Not documented'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicationReportSummaryCard;
