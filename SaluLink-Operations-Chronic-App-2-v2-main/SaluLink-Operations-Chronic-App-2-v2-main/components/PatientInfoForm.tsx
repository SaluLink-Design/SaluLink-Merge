'use client';

import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { MedicalPlan } from '@/types';

interface PatientInfoFormProps {
  onSave: (patientInfo: PatientInfo) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface PatientInfo {
  patientName: string;
  patientId: string;
  medicalAidNumber: string;
  patientEmail: string;
  patientPhone: string;
  plan: MedicalPlan;
}

const PatientInfoForm = ({ onSave, onCancel, isLoading = false }: PatientInfoFormProps) => {
  const planOptions: MedicalPlan[] = ['Core', 'Priority', 'Saver', 'Executive', 'Comprehensive'];

  const [formData, setFormData] = useState<PatientInfo>({
    patientName: '',
    patientId: '',
    medicalAidNumber: '',
    patientEmail: '',
    patientPhone: '',
    plan: 'Core',
  });

  const [errors, setErrors] = useState<Partial<PatientInfo>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<PatientInfo> = {};

    if (!formData.patientName.trim()) newErrors.patientName = 'Patient name is required';
    if (!formData.patientId.trim()) newErrors.patientId = 'Patient ID is required';
    if (!formData.medicalAidNumber.trim()) newErrors.medicalAidNumber = 'Medical aid number is required';
    if (!formData.patientEmail.trim()) newErrors.patientEmail = 'Email is required';
    if (formData.patientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.patientEmail)) {
      newErrors.patientEmail = 'Invalid email format';
    }
    if (!formData.patientPhone.trim()) newErrors.patientPhone = 'Phone number is required';
    if (!formData.plan) newErrors.plan = 'Medical plan is required';

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
    <div className="fixed inset-0 bg-white z-50 overflow-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">New Case - Patient Information</h1>
            <p className="text-sm text-gray-500 mt-1">Enter patient details to create a new case</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Patient Name */}
            <div>
              <label htmlFor="patientName" className="block text-sm font-medium text-gray-700 mb-2">
                Patient Name *
              </label>
              <input
                type="text"
                id="patientName"
                value={formData.patientName}
                onChange={(e) => handleChange('patientName', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.patientName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., John Smith"
                disabled={isLoading}
              />
              {errors.patientName && <p className="text-red-500 text-sm mt-1">{errors.patientName}</p>}
            </div>

            {/* Patient ID */}
            <div>
              <label htmlFor="patientId" className="block text-sm font-medium text-gray-700 mb-2">
                Patient ID Number *
              </label>
              <input
                type="text"
                id="patientId"
                value={formData.patientId}
                onChange={(e) => handleChange('patientId', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.patientId ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., P12345"
                disabled={isLoading}
              />
              {errors.patientId && <p className="text-red-500 text-sm mt-1">{errors.patientId}</p>}
            </div>

            {/* Medical Aid Number */}
            <div>
              <label htmlFor="medicalAidNumber" className="block text-sm font-medium text-gray-700 mb-2">
                Medical Aid Number *
              </label>
              <input
                type="text"
                id="medicalAidNumber"
                value={formData.medicalAidNumber}
                onChange={(e) => handleChange('medicalAidNumber', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.medicalAidNumber ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., MA123456"
                disabled={isLoading}
              />
              {errors.medicalAidNumber && <p className="text-red-500 text-sm mt-1">{errors.medicalAidNumber}</p>}
            </div>

            {/* Patient Email */}
            <div>
              <label htmlFor="patientEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Patient Email *
              </label>
              <input
                type="email"
                id="patientEmail"
                value={formData.patientEmail}
                onChange={(e) => handleChange('patientEmail', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.patientEmail ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., john@example.com"
                disabled={isLoading}
              />
              {errors.patientEmail && <p className="text-red-500 text-sm mt-1">{errors.patientEmail}</p>}
            </div>

            {/* Plan Selection */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Medical Aid Plan *</label>
              <div className="flex flex-wrap gap-2">
                {planOptions.map((plan) => (
                  <button
                    type="button"
                    key={plan}
                    onClick={() => handleChange('plan', plan)}
                    className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
                      formData.plan === plan
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
                    }`}
                    disabled={isLoading}
                  >
                    {plan}
                  </button>
                ))}
              </div>
              {errors.plan && <p className="text-red-500 text-sm mt-1">{errors.plan}</p>}
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="patientPhone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                id="patientPhone"
                value={formData.patientPhone}
                onChange={(e) => handleChange('patientPhone', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.patientPhone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., +1 (555) 123-4567"
                disabled={isLoading}
              />
              {errors.patientPhone && <p className="text-red-500 text-sm mt-1">{errors.patientPhone}</p>}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={isLoading}
            >
              <Save className="w-4 h-4" />
              Save & Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientInfoForm;
