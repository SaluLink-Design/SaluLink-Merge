'use client';

import { useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2 } from 'lucide-react';
import type { MedicalPlan, SelectedMedication } from '@/types';
import { submitSpecialistRegistration, type InboundReferralSummary } from '@/lib/caseService';
import IcdCodeSelection from '@/components/IcdCodeSelection';
import MedicationSelection from '@/components/MedicationSelection';

interface SpecialistRegistrationPanelProps {
  referral: InboundReferralSummary;
  onCompleted: () => void;
  /** When true, renders as inline section inside a parent card */
  embedded?: boolean;
}

const SpecialistRegistrationPanel = ({
  referral,
  onCompleted,
  embedded = false,
}: SpecialistRegistrationPanelProps) => {
  const [icdCode, setIcdCode] = useState(referral.icdCode || null);
  const [icdDescription, setIcdDescription] = useState(referral.icdDescription || '');
  const [diagnosisDate, setDiagnosisDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [medications, setMedications] = useState<SelectedMedication[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(icdCode) && Boolean(diagnosisDate) && medications.length > 0;

  const handleAddMedication = (medication: SelectedMedication) => {
    setMedications((prev) => [...prev, medication]);
  };

  const handleRemoveMedication = (index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!canSubmit || !icdCode) return;
    setIsSubmitting(true);
    setError(null);

    const result = await submitSpecialistRegistration({
      caseId: referral.caseId,
      referralId: referral.referralId,
      conditionName: referral.conditionName,
      icdCode,
      icdDescription,
      diagnosisDate,
      medications,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error ?? 'Failed to submit registration. Please try again.');
      return;
    }

    onCompleted();
  };

  return (
    <div
      className={
        embedded
          ? 'pt-4 mt-4 border-t border-slate-200 space-y-5'
          : 'rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5'
      }
    >
      <div>
        <p className="text-xs uppercase tracking-widest text-violet-600 font-semibold">
          Specialist-led CIB registration
        </p>
        <h3 className="text-base font-semibold text-slate-900 mt-1">
          Complete registration for {referral.conditionName || 'this condition'}
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          You accepted chronic management for this patient. Confirm the ICD-10 code, diagnosis date, and
          medication to submit the CIB application directly against this case.
        </p>
      </div>

      <IcdCodeSelection
        condition={referral.conditionName}
        selectedIcdCode={icdCode}
        onSelect={(code, description) => {
          setIcdCode(code);
          setIcdDescription(description);
        }}
      />

      <div>
        <label htmlFor="specialist-diagnosis-date" className="label">
          Diagnosis date
        </label>
        <input
          id="specialist-diagnosis-date"
          type="date"
          className="input-field"
          value={diagnosisDate}
          onChange={(e) => setDiagnosisDate(e.target.value)}
        />
      </div>

      <MedicationSelection
        condition={referral.conditionName}
        selectedPlan={(referral.plan || 'Core') as MedicalPlan}
        benefitState="unregistered"
        medications={medications}
        onAddMedication={handleAddMedication}
        onRemoveMedication={handleRemoveMedication}
      />

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canSubmit || isSubmitting}
          onClick={handleSubmit}
          className="btn-primary px-6 py-2 disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ClipboardList className="w-4 h-4" />
          )}
          {isSubmitting ? 'Submitting…' : 'Submit CIB registration'}
        </button>
      </div>

      {!canSubmit && (
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Confirm an ICD-10 code and add at least one medication to submit.
        </p>
      )}
    </div>
  );
};

export default SpecialistRegistrationPanel;
