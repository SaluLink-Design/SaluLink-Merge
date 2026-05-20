'use client';

import { ArrowLeft, FileText, ClipboardList, Pill, Stethoscope, Plus } from 'lucide-react';
import { PatientCase } from '@/types';
import { format } from 'date-fns';

interface CaseOptionsViewProps {
  caseData: PatientCase;
  onStartClinicalNote: () => void;
  onContinueWorkflow: () => void;
  onClose: () => void;
}

const CaseOptionsView = ({
  caseData,
  onStartClinicalNote,
  onContinueWorkflow,
  onClose,
}: CaseOptionsViewProps) => {
  const isNewCase = caseData.status === 'new';

  const getNextStep = () => {
    if (isNewCase) {
      return 'Clinical Note (Step 1-6)';
    }
    if (!caseData.clinicalNote) {
      return 'Clinical Note';
    }
    if (!caseData.condition) {
      return 'Condition Selection';
    }
    if (caseData.diagnosticTreatments.length === 0) {
      return 'Diagnostic Basket';
    }
    if (caseData.medications.length === 0) {
      return 'Medication Selection';
    }
    return 'Complete';
  };

  const getContinueLabel = () => {
    const nextStep = getNextStep();
    if (nextStep === 'Complete' || caseData.status === 'completed') {
      return 'Continue Workflow';
    }
    return `Continue Workflow: ${nextStep}`;
  };

  const getProgressPercentage = () => {
    let completed = 0;
    let total = 6;

    if (caseData.clinicalNote) completed++;
    if (caseData.condition) completed++;
    if (caseData.diagnosticTreatments.length > 0) completed++;
    if (caseData.medications.length > 0) completed++;
    if (caseData.medicationNote) completed++;
    if (caseData.status === 'completed') completed++;

    return Math.round((completed / total) * 100);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Case Details</h1>
            <p className="text-sm text-gray-500 mt-1">
              Created {format(new Date(caseData.createdAt), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>

        {/* Patient Information Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Patient Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Patient Name</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{caseData.patientName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Patient ID</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{caseData.patientId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Medical Aid Number</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{caseData.medicalAidNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Medical Plan</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{caseData.plan || 'Not selected'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{caseData.patientEmail || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{caseData.patientPhone || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-8 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Workflow Progress</h2>
            <span className="text-2xl font-bold text-blue-600">{getProgressPercentage()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            ></div>
          </div>

          {/* Workflow Steps */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                  caseData.clinicalNote ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                {caseData.clinicalNote ? '✓' : '1'}
              </div>
              <p className="text-gray-700">
                <span className="font-medium">Clinical Note</span>
                {caseData.clinicalNote && ' (Completed)'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                  caseData.condition ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                {caseData.condition ? '✓' : '2'}
              </div>
              <p className="text-gray-700">
                <span className="font-medium">Condition Selection</span>
                {caseData.condition && ` (${caseData.condition})`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                  caseData.diagnosticTreatments.length > 0 ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                {caseData.diagnosticTreatments.length > 0 ? '✓' : '3'}
              </div>
              <p className="text-gray-700">
                <span className="font-medium">Diagnostic Basket</span>
                {caseData.diagnosticTreatments.length > 0 &&
                  ` (${caseData.diagnosticTreatments.length} items)`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                  caseData.medications.length > 0 ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                {caseData.medications.length > 0 ? '✓' : '4'}
              </div>
              <p className="text-gray-700">
                <span className="font-medium">Medication Selection</span>
                {caseData.medications.length > 0 && ` (${caseData.medications.length} medications)`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                  caseData.medicationNote ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                {caseData.medicationNote ? '✓' : '5'}
              </div>
              <p className="text-gray-700">
                <span className="font-medium">Medication Notes</span>
                {caseData.medicationNote && ' (Completed)'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                  caseData.status === 'completed' ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                {caseData.status === 'completed' ? '✓' : '6'}
              </div>
              <p className="text-gray-700">
                <span className="font-medium">Finalize & Save</span>
                {caseData.status === 'completed' && ' (Completed)'}
              </p>
            </div>
          </div>
        </div>

        {/* Current Condition Display (if set) */}
        {caseData.condition && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Condition</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600">Condition</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">{caseData.condition}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">ICD-10 Code</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">{caseData.icdCode}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Description</p>
                <p className="text-lg font-semibold text-gray-900 mt-1 truncate">
                  {caseData.icdDescription}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-4">
          {isNewCase && (
            <button
              onClick={onStartClinicalNote}
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 text-lg"
            >
              <FileText className="w-5 h-5" />
              Start Clinical Note (Steps 1-6)
            </button>
          )}

          {!isNewCase && (
            <button
              onClick={onContinueWorkflow}
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 text-lg"
            >
              <ClipboardList className="w-5 h-5" />
              {getContinueLabel()}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseOptionsView;
