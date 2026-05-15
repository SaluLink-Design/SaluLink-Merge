'use client';

import { FileText, AlertCircle } from 'lucide-react';
import { SelectedMedication } from '@/types';

interface ChronicRegistrationNoteProps {
  medications: SelectedMedication[];
  medicationNote: string;
  onSetMedicationNote: (note: string) => void;
  onUpdateMedicationNote: (index: number, note: string) => void;
}

const ChronicRegistrationNote = ({
  medications,
  medicationNote,
  onSetMedicationNote,
  onUpdateMedicationNote,
}: ChronicRegistrationNoteProps) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Chronic Medication Registration Note</h2>
            <p className="text-sm text-gray-500">
              Provide the clinical rationale for the prescribed medications
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">Registration Note Guidelines</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Explain the clinical rationale for each medication</li>
                <li>• Include relevant patient history and symptoms</li>
                <li>• Reference clinical guidelines where applicable</li>
                <li>• Justify the choice of specific medications and dosages</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Medications Summary */}
      <div className="card">
        <h3 className="font-semibold text-lg mb-4">Medications to Register ({medications.length})</h3>
        <div className="space-y-3">
          {medications.map((med, index) => (
            <div key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="font-medium text-gray-900 text-sm">{med.medicineNameAndStrength}</p>
              <p className="text-xs text-gray-600">{med.activeIngredient}</p>
              <p className="text-xs text-primary-600 font-medium">CDA: {med.cdaAmount}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Registration Notes */}
      {medications.length === 1 ? (
        /* Single Medication - One Note Field */
        <div className="card">
          <label className="label">Chronic Medication Registration Note</label>
          <p className="text-sm text-gray-600 mb-3">
            Provide the clinical rationale for prescribing <strong>{medications[0].medicineNameAndStrength}</strong>
          </p>
          <textarea
            className="textarea-field"
            rows={8}
            placeholder="Enter the chronic medication registration note explaining the prescription rationale, patient condition, clinical justification, and expected treatment outcomes..."
            value={medicationNote}
            onChange={(e) => onSetMedicationNote(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">
            This note will be included in the chronic medication registration claim.
          </p>
        </div>
      ) : (
        /* Multiple Medications - Individual + Overall Notes */
        <>
          <div className="card">
            <h3 className="font-semibold text-lg mb-4">Individual Medication Notes</h3>
            <p className="text-sm text-gray-600 mb-4">
              Provide specific registration notes for each medication
            </p>
            <div className="space-y-4">
              {medications.map((med, index) => (
                <div key={index}>
                  <label className="label text-sm">
                    {index + 1}. {med.medicineNameAndStrength}
                  </label>
                  <textarea
                    className="textarea-field text-sm"
                    rows={4}
                    placeholder={`Enter the chronic registration note for ${med.medicineNameAndStrength}...`}
                    value={med.note || ''}
                    onChange={(e) => onUpdateMedicationNote(index, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <label className="label">Overall Registration Note (Optional)</label>
            <p className="text-sm text-gray-600 mb-3">
              Add any overall clinical context or rationale that applies to all medications
            </p>
            <textarea
              className="textarea-field"
              rows={5}
              placeholder="Enter any overall clinical notes that apply to all medications, such as patient's overall condition, treatment plan, or additional context..."
              value={medicationNote}
              onChange={(e) => onSetMedicationNote(e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default ChronicRegistrationNote;
