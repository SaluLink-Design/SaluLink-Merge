'use client';

import { CheckCircle2, ArrowRight } from 'lucide-react';
import type { ChronicConditionCase } from '@/types';

interface RegistrationCompleteStepProps {
  condition: string;
  icdCode: string;
  diagnosisDate?: string;
  chronicCase?: ChronicConditionCase;
  onViewPatientProfile: () => void;
  onBackToDashboard: () => void;
}

const RegistrationCompleteStep = ({
  condition,
  icdCode,
  diagnosisDate,
  chronicCase,
  onViewPatientProfile,
  onBackToDashboard,
}: RegistrationCompleteStepProps) => (
  <div className="card text-center max-w-2xl mx-auto">
    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
      <CheckCircle2 className="w-9 h-9 text-emerald-600" />
    </div>
    <h2 className="text-2xl font-semibold text-slate-900 mb-2">Registration Complete</h2>
    <p className="text-slate-600 mb-6">
      Chronic registration for <strong>{condition}</strong> has been submitted and is pending CIB review.
      The care pathway is now unlocked on the patient profile.
    </p>
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left mb-6 space-y-2 text-sm">
      <p>
        <span className="text-slate-500">Condition:</span>{' '}
        <span className="font-medium text-slate-900">{condition}</span>
      </p>
      <p>
        <span className="text-slate-500">ICD-10:</span>{' '}
        <span className="font-mono font-medium text-indigo-600">{icdCode}</span>
      </p>
      {diagnosisDate && (
        <p>
          <span className="text-slate-500">Diagnosis date:</span>{' '}
          <span className="font-medium text-slate-900">{diagnosisDate}</span>
        </p>
      )}
      {chronicCase?.registrationStatus && (
        <p>
          <span className="text-slate-500">Status:</span>{' '}
          <span className="font-medium text-emerald-700 capitalize">
            {chronicCase.registrationStatus.replace('_', ' ')}
          </span>
        </p>
      )}
    </div>
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <button type="button" onClick={onViewPatientProfile} className="btn-primary inline-flex items-center gap-2">
        View care pathway
        <ArrowRight className="w-4 h-4" />
      </button>
      <button type="button" onClick={onBackToDashboard} className="btn-secondary">
        Back to dashboard
      </button>
    </div>
  </div>
);

export default RegistrationCompleteStep;
