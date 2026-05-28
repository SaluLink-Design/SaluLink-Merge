'use client';

import { useState } from 'react';
import { X, FileText, Send } from 'lucide-react';
import { CibRecord, MedicalPlan, TreatmentItem } from '@/types';
import { buildDefaultCibRecord } from '@/lib/benefitState';
import EvidenceCompletenessPanel from '@/components/EvidenceCompletenessPanel';

interface CibApplicationAssistantProps {
  conditionName: string;
  icdCode: string;
  patientName: string;
  patientId: string;
  medicalAidNumber?: string;
  plan: MedicalPlan;
  clinicalNote: string;
  diagnosisDate?: string;
  submittedMedicine?: string;
  diagnosticTreatments?: TreatmentItem[];
  onClose: () => void;
  onCibRecordCreated: (record: CibRecord) => void;
}

const CibApplicationAssistant = ({
  conditionName,
  icdCode,
  patientName,
  patientId,
  medicalAidNumber,
  plan,
  clinicalNote,
  diagnosisDate: initialDiagnosisDate = '',
  submittedMedicine: initialMedicine = '',
  diagnosticTreatments = [],
  onClose,
  onCibRecordCreated,
}: CibApplicationAssistantProps) => {
  const [diagnosisDate, setDiagnosisDate] = useState(initialDiagnosisDate);
  const [submittedMedicine, setSubmittedMedicine] = useState(initialMedicine);
  const [motivationNote, setMotivationNote] = useState('');

  const hasDiagnosisDate = Boolean(diagnosisDate);

  const handleSubmit = () => {
    if (!diagnosisDate) {
      alert('Please enter the date of diagnosis before submitting the CIB application.');
      return;
    }
    if (!icdCode?.trim()) {
      alert('ICD-10 code is required for CIB submission.');
      return;
    }

    const record: CibRecord = {
      ...buildDefaultCibRecord(conditionName, icdCode, diagnosisDate, submittedMedicine || undefined),
      fundingLagNote: motivationNote.trim()
        ? motivationNote.trim()
        : 'Medicines prescribed before approval may be retrospectively linked once CIB is approved — retain prescription and diagnosis dates.',
    };

    onCibRecordCreated(record);
  };

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl authi-gradient flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Chronic Illness Benefit Application</h2>
            <p className="text-sm text-slate-500">
              {conditionName} · {patientName} ({patientId})
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-5 text-sm text-slate-700 space-y-1">
        <p>
          <span className="text-slate-500">Medical aid:</span>{' '}
          {medicalAidNumber || '—'}
        </p>
        <p>
          <span className="text-slate-500">Plan:</span> {plan}
        </p>
        <p>
          <span className="text-slate-500">ICD-10:</span>{' '}
          <span className="font-mono font-medium">{icdCode || 'Not set'}</span>
        </p>
      </div>

      <p className="text-xs text-slate-600 mb-4 leading-relaxed">
        The Chronic Illness Benefit covers <strong>disease-modifying therapy</strong> for listed PMB
        conditions after approval. Attach test results, clinical reports, and complete disease-specific
        sections as required on the Discovery CIB form.
      </p>

      <EvidenceCompletenessPanel
        conditionName={conditionName}
        icdCode={icdCode}
        clinicalNote={clinicalNote}
        benefitState="unregistered"
        diagnosticTreatments={diagnosticTreatments}
        diagnosisDate={diagnosisDate}
        onDiagnosisDateChange={setDiagnosisDate}
      />

      <div className="mt-5 space-y-4">
        <div>
          <label className="label">Primary medicine for CIB registration (optional)</label>
          <input
            type="text"
            className="input-field w-full"
            placeholder="e.g. Metformin 500mg — disease-modifying therapy"
            value={submittedMedicine}
            onChange={(e) => setSubmittedMedicine(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Clinical motivation (optional)</label>
          <textarea
            className="textarea-field"
            rows={4}
            placeholder="Summarise diagnostic evidence, PMB criteria met, and why chronic benefit should be activated..."
            value={motivationNote}
            onChange={(e) => setMotivationNote(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 justify-end">
        <button type="button" onClick={onClose} className="btn-secondary px-5 py-2.5">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5"
        >
          <Send className="w-4 h-4" />
          Mark as submitted (Pending review)
        </button>
      </div>
    </div>
  );
};

export default CibApplicationAssistant;
