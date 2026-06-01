'use client';

import { useState } from 'react';
import {
  FileText,
  Send,
  Stethoscope,
  Pill,
  ClipboardCheck,
  Loader2,
} from 'lucide-react';
import {
  SelectedMedication,
  TreatmentItem,
  MedicalScheme,
  BenefitState,
} from '@/types';
import EvidenceCompletenessPanel from '@/components/EvidenceCompletenessPanel';
import FundingSourceBadge from '@/components/FundingSourceBadge';
import { fundingSourceLabel } from '@/lib/benefitState';

interface CibRegistrationStepProps {
  patientName: string;
  patientId: string;
  medicalAidNumber?: string;
  medicalScheme: MedicalScheme;
  selectedCondition: string;
  selectedIcdCode: string;
  selectedIcdDescription: string;
  clinicalNote: string;
  diagnosticTreatments: TreatmentItem[];
  medications: SelectedMedication[];
  medicationNote: string;
  diagnosisDate: string;
  selectedPlan: string;
  benefitState: BenefitState;
  onBack: () => void;
  onSubmit: (motivationNote: string) => Promise<void>;
  isSubmitting?: boolean;
}

const schemeLabel: Record<MedicalScheme, string> = {
  discovery: 'Discovery Health',
  gems: 'GEMS',
};

const CibRegistrationStep = ({
  patientName,
  patientId,
  medicalAidNumber,
  medicalScheme,
  selectedCondition,
  selectedIcdCode,
  selectedIcdDescription,
  clinicalNote,
  diagnosticTreatments,
  medications,
  medicationNote,
  diagnosisDate,
  selectedPlan,
  benefitState,
  onBack,
  onSubmit,
  isSubmitting = false,
}: CibRegistrationStepProps) => {
  const [motivationNote, setMotivationNote] = useState(medicationNote || '');

  const handleSubmit = () => {
    if (!diagnosisDate) {
      alert('Diagnosis date is required for CIB registration.');
      return;
    }
    void onSubmit(motivationNote);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl authi-gradient flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">CIB Registration</h2>
            <p className="text-sm text-slate-500">
              Confirm diagnosis, evidence, and medicines — then submit to Discovery&apos;s chronic programme
            </p>
          </div>
        </div>

        <div className="brand-info-box border-2 mb-6">
          <p className="text-sm text-violet-800">
            This replaces the generic claim save for unregistered patients. Submitting registers the
            condition as <strong>pending CIB review</strong> with the evidence gathered in this encounter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Patient</p>
            <p className="font-semibold text-slate-900">{patientName}</p>
            <p className="text-sm text-slate-600">{patientId}</p>
            <p className="text-xs text-slate-500 mt-2">Aid: {medicalAidNumber || '—'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Scheme & plan</p>
            <p className="font-semibold text-slate-900">{schemeLabel[medicalScheme]}</p>
            <p className="text-sm text-slate-600">{selectedPlan} plan</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Confirmed diagnosis</h3>
          </div>
          <p className="font-medium text-slate-800">{selectedCondition}</p>
          <p className="text-blue-600 font-mono font-semibold mt-1">{selectedIcdCode}</p>
          <p className="text-sm text-slate-500">{selectedIcdDescription}</p>
          {diagnosisDate && (
            <p className="text-xs text-slate-600 mt-2">Diagnosis date: {diagnosisDate}</p>
          )}
        </div>

        <EvidenceCompletenessPanel
          conditionName={selectedCondition}
          icdCode={selectedIcdCode}
          clinicalNote={clinicalNote}
          benefitState={benefitState}
          diagnosticTreatments={diagnosticTreatments}
          diagnosisDate={diagnosisDate}
          medicationsFormularyAligned={medications.every((m) => m.formularyStatus === 'listed')}
        />

        {medications.length > 0 && (
          <div className="rounded-xl border border-slate-200 p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Pill className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-slate-900">Medicines for CIB ({medications.length})</h3>
            </div>
            <ul className="space-y-2">
              {medications.map((med, i) => (
                <li key={i} className="text-sm border border-slate-100 rounded-lg p-3 bg-white">
                  <p className="font-medium text-slate-900">{med.medicineNameAndStrength}</p>
                  <p className="text-xs text-slate-500">{med.activeIngredient}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {med.fundingSource && (
                      <FundingSourceBadge source={med.fundingSource} compact />
                    )}
                    <span className="text-xs text-slate-600">
                      {med.fundingSource ? fundingSourceLabel[med.fundingSource] : med.coverageNote}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4">
          <label className="label flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Clinical motivation for CIB
          </label>
          <textarea
            className="textarea-field"
            rows={5}
            placeholder="Summarise how diagnostic evidence confirms the chronic condition, PMB eligibility, and why disease-modifying therapy is appropriate..."
            value={motivationNote}
            onChange={(e) => setMotivationNote(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-between gap-4">
        <button type="button" onClick={onBack} className="btn-secondary px-6 py-3" disabled={isSubmitting}>
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary inline-flex items-center gap-2 px-8 py-3"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
          {isSubmitting ? 'Submitting…' : 'Submit CIB registration'}
        </button>
      </div>
    </div>
  );
};

export default CibRegistrationStep;
