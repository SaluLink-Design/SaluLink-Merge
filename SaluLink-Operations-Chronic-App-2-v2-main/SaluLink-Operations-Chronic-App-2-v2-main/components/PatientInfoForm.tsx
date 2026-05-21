'use client';

import { useState } from 'react';
import { ArrowLeft, Save, Stethoscope, Activity, Pill } from 'lucide-react';
import { MedicalPlan, ClaimType } from '@/types';

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
  claimType?: ClaimType;
}

const claimTypeOptions: { value: ClaimType; label: string; description: string; icon: React.ReactNode; color: string }[] = [
  {
    value: 'diagnostic',
    label: 'Diagnostic Claim',
    description: 'Full 6-step clinical workflow — clinical note, condition, ICD code, diagnostics, medication.',
    icon: <Stethoscope className="w-5 h-5" />,
    color: 'blue',
  },
  {
    value: 'ongoing-management',
    label: 'Ongoing Management',
    description: 'Monitoring and treatment protocols for an existing condition.',
    icon: <Activity className="w-5 h-5" />,
    color: 'emerald',
  },
  {
    value: 'medication-report',
    label: 'Medication Report',
    description: 'Follow-up notes and new prescriptions for a registered chronic patient.',
    icon: <Pill className="w-5 h-5" />,
    color: 'violet',
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
    claimType: prefillData?.claimType,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof PatientInfo, string>>>({});

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
    if (showClaimType && !formData.claimType) newErrors.claimType = 'Claim type is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof PatientInfo, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 overflow-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-800 rounded-xl transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="text-3xl font-semibold text-white">
              {showClaimType ? 'New Case — Patient Information' : 'New Patient Intake'}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {showClaimType
                ? 'Enter patient details and select the claim type'
                : 'Enter patient details for the doctor to complete the claim'}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-white/10 rounded-2xl p-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Patient Name */}
            <div>
              <label htmlFor="patientName" className="block text-sm font-medium text-slate-300 mb-2">
                Patient Name *
              </label>
              <input
                type="text"
                id="patientName"
                value={formData.patientName}
                onChange={(e) => handleChange('patientName', e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl bg-slate-800 text-slate-100 placeholder-slate-500 border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.patientName ? 'border-red-500' : 'border-white/10'
                }`}
                placeholder="e.g., John Smith"
                disabled={isLoading}
              />
              {errors.patientName && <p className="text-red-400 text-sm mt-1">{errors.patientName}</p>}
            </div>

            {/* Patient ID */}
            <div>
              <label htmlFor="patientId" className="block text-sm font-medium text-slate-300 mb-2">
                Patient ID Number *
              </label>
              <input
                type="text"
                id="patientId"
                value={formData.patientId}
                onChange={(e) => handleChange('patientId', e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl bg-slate-800 text-slate-100 placeholder-slate-500 border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.patientId ? 'border-red-500' : 'border-white/10'
                }`}
                placeholder="e.g., P12345"
                disabled={isLoading}
              />
              {errors.patientId && <p className="text-red-400 text-sm mt-1">{errors.patientId}</p>}
            </div>

            {/* Medical Aid Number */}
            <div>
              <label htmlFor="medicalAidNumber" className="block text-sm font-medium text-slate-300 mb-2">
                Medical Aid Number *
              </label>
              <input
                type="text"
                id="medicalAidNumber"
                value={formData.medicalAidNumber}
                onChange={(e) => handleChange('medicalAidNumber', e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl bg-slate-800 text-slate-100 placeholder-slate-500 border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.medicalAidNumber ? 'border-red-500' : 'border-white/10'
                }`}
                placeholder="e.g., MA123456"
                disabled={isLoading}
              />
              {errors.medicalAidNumber && <p className="text-red-400 text-sm mt-1">{errors.medicalAidNumber}</p>}
            </div>

            {/* Patient Email */}
            <div>
              <label htmlFor="patientEmail" className="block text-sm font-medium text-slate-300 mb-2">
                Patient Email *
              </label>
              <input
                type="email"
                id="patientEmail"
                value={formData.patientEmail}
                onChange={(e) => handleChange('patientEmail', e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl bg-slate-800 text-slate-100 placeholder-slate-500 border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.patientEmail ? 'border-red-500' : 'border-white/10'
                }`}
                placeholder="e.g., john@example.com"
                disabled={isLoading}
              />
              {errors.patientEmail && <p className="text-red-400 text-sm mt-1">{errors.patientEmail}</p>}
            </div>

            {/* Plan Selection */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">Medical Aid Plan *</label>
              <div className="flex flex-wrap gap-2">
                {planOptions.map((plan) => (
                  <button
                    type="button"
                    key={plan}
                    onClick={() => handleChange('plan', plan)}
                    className={`px-4 py-2 rounded-xl border font-medium transition-all ${
                      formData.plan === plan
                        ? 'border-blue-500 bg-blue-900/40 text-blue-300'
                        : 'border-white/10 bg-slate-800 text-slate-300 hover:border-blue-500/50'
                    }`}
                    disabled={isLoading}
                  >
                    {plan}
                  </button>
                ))}
              </div>
              {errors.plan && <p className="text-red-400 text-sm mt-1">{errors.plan}</p>}
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="patientPhone" className="block text-sm font-medium text-slate-300 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                id="patientPhone"
                value={formData.patientPhone}
                onChange={(e) => handleChange('patientPhone', e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl bg-slate-800 text-slate-100 placeholder-slate-500 border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.patientPhone ? 'border-red-500' : 'border-white/10'
                }`}
                placeholder="e.g., +1 (555) 123-4567"
                disabled={isLoading}
              />
              {errors.patientPhone && <p className="text-red-400 text-sm mt-1">{errors.patientPhone}</p>}
            </div>

            {showClaimType && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-3">Claim Type *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {claimTypeOptions.map((opt) => {
                    const selected = formData.claimType === opt.value;
                    const colorMap: Record<string, string> = {
                      blue: selected
                        ? 'border-blue-500 bg-blue-900/40 text-blue-300'
                        : 'border-white/10 bg-slate-800 text-slate-300 hover:border-blue-500/60',
                      emerald: selected
                        ? 'border-emerald-500 bg-emerald-900/40 text-emerald-300'
                        : 'border-white/10 bg-slate-800 text-slate-300 hover:border-emerald-500/60',
                      violet: selected
                        ? 'border-violet-500 bg-violet-900/40 text-violet-300'
                        : 'border-white/10 bg-slate-800 text-slate-300 hover:border-violet-500/60',
                    };
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => handleChange('claimType', opt.value)}
                        disabled={isLoading}
                        className={`flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all ${colorMap[opt.color]}`}
                      >
                        <span className="flex items-center gap-2 font-semibold text-sm">
                          {opt.icon}
                          {opt.label}
                        </span>
                        <span className="text-xs leading-relaxed opacity-70">{opt.description}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.claimType && <p className="text-red-400 text-sm mt-1">{errors.claimType}</p>}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-4 mt-8 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 text-slate-300 bg-slate-800 border border-white/10 rounded-xl hover:bg-slate-700 transition-all font-medium"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-violet-600 text-white rounded-xl hover:from-blue-600 hover:to-violet-700 transition-all font-semibold flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
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
