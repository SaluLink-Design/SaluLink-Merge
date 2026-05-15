'use client';

import { useState } from 'react';
import { X, Download, FileText, Pill, ClipboardList, User } from 'lucide-react';
import {
  generatePatientExportZip,
  downloadZipFile,
  type PatientExportData,
  type PatientExportSelection,
} from '@/lib/patientExport';

interface PatientExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PatientExportData;
}

export default function PatientExportModal({ isOpen, onClose, data }: PatientExportModalProps) {
  const [selection, setSelection] = useState<PatientExportSelection>({
    includeClinicalNote: true,
    includePatientInfo: true,
    includeRegistrationNote: true,
    selectedConditions: data.conditions.map(c => c.id),
    selectedMedications: data.medications.map(m => m.id),
  });
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleConditionToggle = (id: string) => {
    setSelection(prev => ({
      ...prev,
      selectedConditions: prev.selectedConditions.includes(id)
        ? prev.selectedConditions.filter(cid => cid !== id)
        : [...prev.selectedConditions, id],
    }));
  };

  const handleMedicationToggle = (id: string) => {
    setSelection(prev => ({
      ...prev,
      selectedMedications: prev.selectedMedications.includes(id)
        ? prev.selectedMedications.filter(mid => mid !== id)
        : [...prev.selectedMedications, id],
    }));
  };

  const handleSelectAllConditions = () => {
    setSelection(prev => ({
      ...prev,
      selectedConditions: prev.selectedConditions.length === data.conditions.length
        ? []
        : data.conditions.map(c => c.id),
    }));
  };

  const handleSelectAllMedications = () => {
    setSelection(prev => ({
      ...prev,
      selectedMedications: prev.selectedMedications.length === data.medications.length
        ? []
        : data.medications.map(m => m.id),
    }));
  };

  const handleGenerateExport = async () => {
    if (
      !selection.includeClinicalNote &&
      !selection.includePatientInfo &&
      !selection.includeRegistrationNote &&
      selection.selectedConditions.length === 0 &&
      selection.selectedMedications.length === 0
    ) {
      alert('Please select at least one item to export');
      return;
    }

    setIsGenerating(true);

    try {
      const zipBlob = await generatePatientExportZip(data, selection);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `Patient_Claim_${data.patientName.replace(/\s+/g, '_')}_${timestamp}.zip`;
      downloadZipFile(zipBlob, filename);
      onClose();
    } catch (error) {
      console.error('Error generating export:', error);
      alert('Failed to generate export. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Send to Patient</h2>
              <p className="text-sm text-gray-600">Select information for claim submission</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">Patient Information</h3>
                <p className="text-sm text-blue-700 mt-1">
                  {data.patientName} (ID: {data.patientId})
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-gray-600" />
                <h3 className="font-medium text-gray-900">General Information</h3>
              </div>
              <div className="space-y-2 ml-7">
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={selection.includePatientInfo}
                    onChange={(e) =>
                      setSelection(prev => ({ ...prev, includePatientInfo: e.target.checked }))
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Patient Information Summary</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={selection.includeClinicalNote}
                    onChange={(e) =>
                      setSelection(prev => ({ ...prev, includeClinicalNote: e.target.checked }))
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Clinical Note</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={selection.includeRegistrationNote}
                    onChange={(e) =>
                      setSelection(prev => ({ ...prev, includeRegistrationNote: e.target.checked }))
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Chronic Registration Note</span>
                </label>
              </div>
            </div>

            {data.conditions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-gray-600" />
                    <h3 className="font-medium text-gray-900">
                      Conditions & ICD Codes ({data.conditions.length})
                    </h3>
                  </div>
                  <button
                    onClick={handleSelectAllConditions}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {selection.selectedConditions.length === data.conditions.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>
                <div className="space-y-2 ml-7">
                  {data.conditions.map((condition) => (
                    <label
                      key={condition.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selection.selectedConditions.includes(condition.id)}
                        onChange={() => handleConditionToggle(condition.id)}
                        className="w-4 h-4 text-blue-600 rounded mt-0.5"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{condition.name}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {condition.icdCode} - {condition.icdDescription}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {data.medications.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Pill className="w-5 h-5 text-gray-600" />
                    <h3 className="font-medium text-gray-900">
                      Medications ({data.medications.length})
                    </h3>
                  </div>
                  <button
                    onClick={handleSelectAllMedications}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {selection.selectedMedications.length === data.medications.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>
                <div className="space-y-2 ml-7">
                  {data.medications.map((medication) => (
                    <label
                      key={medication.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selection.selectedMedications.includes(medication.id)}
                        onChange={() => handleMedicationToggle(medication.id)}
                        className="w-4 h-4 text-blue-600 rounded mt-0.5"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{medication.name}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          NAPPI: {medication.nappiCode} | Dosage: {medication.dosage || 'As prescribed'} | Qty: {medication.quantity}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Creates a single comprehensive claim package (PDF + TXT)
              containing all your selected information in one organized document for easy
              submission to medical aid providers.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            {selection.selectedConditions.length + selection.selectedMedications.length +
              (selection.includeClinicalNote ? 1 : 0) +
              (selection.includePatientInfo ? 1 : 0) +
              (selection.includeRegistrationNote ? 1 : 0)}{' '}
            items selected
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerateExport}
              disabled={isGenerating}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Package
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
