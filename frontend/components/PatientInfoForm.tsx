'use client';

import { useState } from 'react';
import { ArrowLeft, Save, Stethoscope, Activity } from 'lucide-react';
import { MedicalPlan, ClaimType, MedicalScheme, CibEnrollmentStatus } from '@/types';

interface PatientInfoFormProps {
  onSave: (patientInfo: PatientInfo) => void;
  onCancel: () => void;
  isLoading?: boolean;
  prefillData?: Partial<PatientInfo>;
  /** When false (assistant intake), only patient details are collected; doctor sets claim type later. */
  showClaimType?: boolean;
}

export interface PatientInfo {
  patientName: string;
  patientId: string;
  medicalAidNumber: string;
  patientEmail: string;
  patientPhone: string;
  plan: MedicalPlan;
  medicalScheme: MedicalScheme;
  cibEnrollmentStatus: CibEnrollmentStatus;
  claimType?: ClaimType;
}

const registeredClaimTypeOptions: { value: ClaimType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'ongoing-management',
    label: 'Patient Follow-Up Visit',
    description: 'Routine chronic review for a registered patient.',
    icon: <Activity className="w-5 h-5" />,
  },
  {
    value: 'diagnostic',
    label: 'Diagnostic Claim',
    description: 'New or changed condition requiring full diagnostic workflow.',
    icon: <Stethoscope className="w-5 h-5" />,
  },
];

const PatientInfoForm = ({
  onSave,
  onCancel,
  isLoading = false,
  prefillData,
  showClaimType = true,
}: PatientInfoFormProps) => {
  const planOptions: MedicalPlan[] = ['Core', 'Priority', 'Saver', 'Executive', 'Comprehensive'];

  const [formData, setFormData] = useState<PatientInfo>({
    patientName: prefillData?.patientName ?? '',
    patientId: prefillData?.patientId ?? '',
    medicalAidNumber: prefillData?.medicalAidNumber ?? '',
    patientEmail: prefillData?.patientEmail ?? '',
    patientPhone: prefillData?.patientPhone ?? '',
    plan: prefillData?.plan ?? 'Core',
    medicalScheme: prefillData?.medicalScheme ?? 'discovery',
    cibEnrollmentStatus: prefillData?.cibEnrollmentStatus ?? 'unregistered',
    claimType: prefillData?.claimType,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof PatientInfo, string>>>({});

  const isUnregistered = formData.cibEnrollmentStatus === 'unregistered';
  const showClaimTypePicker = showClaimType && !isUnregistered;

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof PatientInfo, string>> = {};

    if (!formData.patientName.trim()) newErrors.patientName = 'Patient name is required';
    if (!formData.patientId.trim()) newErrors.patientId = 'Patient ID is required';
    if (!formData.medicalAidNumber.trim()) newErrors.medicalAidNumber = 'Medical aid number is required';
    if (!formData.patientEmail.trim()) newErrors.patientEmail = 'Email is required';
    if (formData.patientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.patientEmail)) {
      newErrors.patientEmail = 'Invalid email format';
    }
    if (!formData.patientPhone.trim()) newErrors.patientPhone = 'Phone number is required';
    if (!formData.plan) newErrors.plan = 'Medical plan is required';
    if (!formData.medicalScheme) newErrors.medicalScheme = 'Medical scheme is required';
    if (!formData.cibEnrollmentStatus) newErrors.cibEnrollmentStatus = 'Chronic benefit status is required';
    if (formData.medicalScheme === 'gems') {
      newErrors.medicalScheme = 'GEMS support is coming soon — select Discovery Health for now';
    }
    if (showClaimTypePicker && !formData.claimType) newErrors.claimType = 'Claim type is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof PatientInfo, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'cibEnrollmentStatus' && value === 'unregistered') {
        next.claimType = undefined;
      }
      return next;
    });
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const payload: PatientInfo = {
        ...formData,
        claimType: isUnregistered ? undefined : formData.claimType,
      };
      onSave(payload);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              {showClaimType ? 'New Case — Patient Information' : 'New Patient Intake'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Capture scheme and chronic benefit status — this sets the clinical workflow from day one.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="authi-surface-card rounded-2xl p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-3">Medical scheme *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleChange('medicalScheme', 'discovery')}
                  disabled={isLoading}
                  className={
                    formData.medicalScheme === 'discovery'
                      ? 'authi-action-card border-[#6366f1]/60 authi-tint ring-2 ring-[#6366f1]/25 text-left'
                      : 'authi-action-card text-left'
                  }
                >
                  <span className="font-semibold text-slate-900">Discovery Health</span>
                  <span className="text-xs text-slate-500 block mt-1">Active — tailored baskets, formulary & PMB rules</span>
                </button>
                <button
                  type="button"
                  disabled
                  className="authi-action-card text-left opacity-60 cursor-not-allowed relative"
                >
                  <span className="font-semibold text-slate-700">GEMS</span>
                  <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium">
                    Coming soon
                  </span>
                  <span className="text-xs text-slate-500 block mt-1">Scheme data not yet available</span>
                </button>
              </div>
              {errors.medicalScheme && (
                <p className="text-red-500 text-sm mt-1">{errors.medicalScheme}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-3">Chronic Illness Benefit (CIB) status *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleChange('cibEnrollmentStatus', 'unregistered')}
                  disabled={isLoading}
                  className={
                    formData.cibEnrollmentStatus === 'unregistered'
                      ? 'authi-action-card border-amber-300 bg-amber-50/80 ring-2 ring-amber-200 text-left'
                      : 'authi-action-card text-left'
                  }
                >
                  <span className="font-semibold text-amber-900">Not registered on CIB</span>
                  <span className="text-xs text-amber-800 block mt-1">
                    Diagnostic workflow — gather evidence, then submit CIB application
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('cibEnrollmentStatus', 'registered')}
                  disabled={isLoading}
                  className={
                    formData.cibEnrollmentStatus === 'registered'
                      ? 'authi-action-card border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-200 text-left'
                      : 'authi-action-card text-left'
                  }
                >
                  <span className="font-semibold text-emerald-900">Registered on CIB</span>
                  <span className="text-xs text-emerald-800 block mt-1">
                    Chronic management — ongoing care, medication reports, referrals
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="patientName" className="block text-sm font-medium text-slate-700 mb-2">
                Patient Name *
              </label>
              <input
                type="text"
                id="patientName"
                value={formData.patientName}
                onChange={(e) => handleChange('patientName', e.target.value)}
                className={`authi-input px-4 py-2.5 ${errors.patientName ? 'border-red-400' : ''}`}
                placeholder="e.g., John Smith"
                disabled={isLoading}
              />
              {errors.patientName && <p className="text-red-500 text-sm mt-1">{errors.patientName}</p>}
            </div>

            <div>
              <label htmlFor="patientId" className="block text-sm font-medium text-slate-700 mb-2">
                Patient ID Number *
              </label>
              <input
                type="text"
                id="patientId"
                value={formData.patientId}
                onChange={(e) => handleChange('patientId', e.target.value)}
                className={`authi-input px-4 py-2.5 ${errors.patientId ? 'border-red-400' : ''}`}
                placeholder="e.g., P12345"
                disabled={isLoading}
              />
              {errors.patientId && <p className="text-red-500 text-sm mt-1">{errors.patientId}</p>}
            </div>

            <div>
              <label htmlFor="medicalAidNumber" className="block text-sm font-medium text-slate-700 mb-2">
                Medical Aid Number *
              </label>
              <input
                type="text"
                id="medicalAidNumber"
                value={formData.medicalAidNumber}
                onChange={(e) => handleChange('medicalAidNumber', e.target.value)}
                className={`authi-input px-4 py-2.5 ${errors.medicalAidNumber ? 'border-red-400' : ''}`}
                placeholder="e.g., MA123456"
                disabled={isLoading}
              />
              {errors.medicalAidNumber && (
                <p className="text-red-500 text-sm mt-1">{errors.medicalAidNumber}</p>
              )}
            </div>

            <div>
              <label htmlFor="patientEmail" className="block text-sm font-medium text-slate-700 mb-2">
                Patient Email *
              </label>
              <input
                type="email"
                id="patientEmail"
                value={formData.patientEmail}
                onChange={(e) => handleChange('patientEmail', e.target.value)}
                className={`authi-input px-4 py-2.5 ${errors.patientEmail ? 'border-red-400' : ''}`}
                placeholder="e.g., john@example.com"
                disabled={isLoading}
              />
              {errors.patientEmail && <p className="text-red-500 text-sm mt-1">{errors.patientEmail}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Medical Aid Plan *</label>
              <div className="flex flex-wrap gap-2">
                {planOptions.map((plan) => (
                  <button
                    type="button"
                    key={plan}
                    onClick={() => handleChange('plan', plan)}
                    className={formData.plan === plan ? 'authi-plan-chip-selected' : 'authi-plan-chip'}
                    disabled={isLoading}
                  >
                    {plan}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="patientPhone" className="block text-sm font-medium text-slate-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                id="patientPhone"
                value={formData.patientPhone}
                onChange={(e) => handleChange('patientPhone', e.target.value)}
                className={`authi-input px-4 py-2.5 ${errors.patientPhone ? 'border-red-400' : ''}`}
                placeholder="e.g., +27 XX XXX XXXX"
                disabled={isLoading}
              />
              {errors.patientPhone && <p className="text-red-500 text-sm mt-1">{errors.patientPhone}</p>}
            </div>

            {isUnregistered && (
              <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                <Stethoscope className="w-5 h-5 shrink-0 mt-0.5" />
                <p>
                  Unregistered patients will enter the <strong>diagnostic evidence workflow</strong> only.
                  The doctor will complete tests, review findings, prescribe if needed, then submit the CIB application.
                </p>
              </div>
            )}

            {showClaimTypePicker && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-3">Claim Type *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {registeredClaimTypeOptions.map((opt) => {
                    const selected = formData.claimType === opt.value;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => handleChange('claimType', opt.value)}
                        disabled={isLoading}
                        className={
                          selected
                            ? 'authi-action-card border-[#6366f1]/60 authi-tint ring-2 ring-[#6366f1]/25'
                            : 'authi-action-card'
                        }
                      >
                        <span className="flex items-center gap-2 font-semibold text-sm">
                          <span className="text-[#6366f1]">{opt.icon}</span>
                          <span className={selected ? 'text-slate-900' : 'text-slate-700'}>
                            {opt.label}
                          </span>
                        </span>
                        <span className="text-xs leading-relaxed text-slate-500">{opt.description}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.claimType && <p className="text-red-500 text-sm mt-1">{errors.claimType}</p>}
              </div>
            )}
          </div>

          <div className="flex gap-4 mt-8 pt-6 border-t border-slate-200">
            <button type="button" onClick={onCancel} className="authi-btn-secondary flex-1 px-4 py-3 text-sm" disabled={isLoading}>
              Cancel
            </button>
            <button
              type="submit"
              className="authi-btn-primary flex-1 px-4 py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={isLoading}
            >
              <Save className="w-4 h-4" />
              {showClaimType ? 'Save & Continue' : 'Save patient details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientInfoForm;
