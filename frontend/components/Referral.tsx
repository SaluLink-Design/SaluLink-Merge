'use client';

import { useState } from 'react';
import { UserPlus, AlertCircle, FileText, Upload } from 'lucide-react';
import { PatientCase } from '@/types';

interface ReferralProps {
  patientCase: PatientCase;
  onSavePdfOnly: (urgency: 'routine' | 'urgent' | 'emergency', referralNote: string, specialistType: string) => void;
  onSaveWithAttachments: (urgency: 'routine' | 'urgent' | 'emergency', referralNote: string, specialistType: string) => void;
}

const Referral = ({ patientCase, onSavePdfOnly, onSaveWithAttachments }: ReferralProps) => {
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine');
  const [referralNote, setReferralNote] = useState('');
  const [specialistType, setSpecialistType] = useState('');

  const urgencyOptions = [
    { value: 'routine', label: 'Routine', color: 'bg-green-100 text-green-700 border-green-300' },
    { value: 'urgent', label: 'Urgent', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    { value: 'emergency', label: 'Emergency', color: 'bg-red-100 text-red-700 border-red-300' },
  ];
  
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <UserPlus className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Create Referral</h2>
          <p className="text-sm text-gray-500">Refer patient to specialist</p>
        </div>
      </div>
      
      {/* Complete Case Summary */}
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
        <h3 className="font-semibold text-lg">Complete Patient Case Summary</h3>

        {/* Patient Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Patient:</p>
            <p className="font-medium">{patientCase.patientName}</p>
          </div>
          <div>
            <p className="text-gray-600">Patient ID:</p>
            <p className="font-medium">{patientCase.patientId}</p>
          </div>
        </div>

        {/* Condition */}
        <div className="text-sm">
          <p className="text-gray-600">Condition:</p>
          <p className="font-medium">{patientCase.condition}</p>
          <p className="text-xs text-gray-500 mt-1">
            ICD-10: {patientCase.icdCode} - {patientCase.icdDescription}
          </p>
        </div>

        {/* Clinical Note */}
        <div className="text-sm">
          <p className="text-gray-600 mb-1">Clinical Note:</p>
          <div className="p-3 bg-white border border-gray-200 rounded">
            <p className="text-gray-900 whitespace-pre-wrap">{patientCase.clinicalNote}</p>
          </div>
        </div>

        {/* Diagnostic Tests */}
        {patientCase.diagnosticTreatments.length > 0 && (
          <div className="text-sm">
            <p className="text-gray-600 mb-2">Diagnostic Tests Completed:</p>
            <div className="space-y-1">
              {patientCase.diagnosticTreatments.map((test, i) => (
                <div key={i} className="p-2 bg-white border border-gray-200 rounded text-xs">
                  <p className="font-medium">{test.description}</p>
                  <p className="text-gray-500">Code: {test.code}</p>
                  {test.documentation.notes && (
                    <p className="text-gray-600 mt-1">{test.documentation.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ongoing Management */}
        {patientCase.ongoingTreatments.length > 0 && (
          <div className="text-sm">
            <p className="text-gray-600 mb-2">Ongoing Management:</p>
            <div className="space-y-1">
              {patientCase.ongoingTreatments.map((treatment, i) => (
                <div key={i} className="p-2 bg-white border border-gray-200 rounded text-xs">
                  <p className="font-medium">{treatment.description}</p>
                  <p className="text-gray-500">Code: {treatment.code} | Completed: {treatment.timesCompleted}x per year</p>
                  {treatment.documentation.notes && (
                    <p className="text-gray-600 mt-1">{treatment.documentation.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Medications */}
        {patientCase.medications.length > 0 && (
          <div className="text-sm">
            <p className="text-gray-600 mb-2">Current Medications:</p>
            <div className="space-y-1">
              {patientCase.medications.map((med, i) => (
                <div key={i} className="p-2 bg-white border border-gray-200 rounded text-xs">
                  <p className="font-medium">{med.medicineNameAndStrength}</p>
                  <p className="text-gray-500">{med.activeIngredient}</p>
                  <p className="text-blue-600 font-medium">CDA: {med.cdaAmount}</p>
                </div>
              ))}
            </div>
            {patientCase.medicationNote && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                <p className="font-medium text-blue-900">Registration Note:</p>
                <p className="text-blue-700">{patientCase.medicationNote}</p>
              </div>
            )}
          </div>
        )}

        {/* Medication Reports History */}
        {patientCase.medicationReports && patientCase.medicationReports.length > 0 && (
          <div className="text-sm">
            <p className="text-gray-600 mb-2">Medication Updates History:</p>
            <div className="space-y-2">
              {patientCase.medicationReports.map((report, i) => (
                <div key={i} className="p-3 bg-purple-50 border border-purple-200 rounded">
                  <p className="font-medium text-purple-900 text-xs mb-1">
                    Report #{i + 1} - {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                  {report.followUpNotes && (
                    <p className="text-xs text-gray-700 mb-2">Follow-up: {report.followUpNotes}</p>
                  )}
                  {report.newMedications.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-purple-900 mb-1">New Medications Added:</p>
                      {report.newMedications.map((med, j) => (
                        <div key={j} className="ml-2 text-xs text-gray-700">
                          • {med.medicineNameAndStrength} ({med.activeIngredient})
                        </div>
                      ))}
                      {report.motivationLetter && (
                        <p className="mt-1 text-xs text-gray-600 italic">Reason: {report.motivationLetter}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Specialist Type */}
      <div className="mb-4">
        <label className="label">Specialist Type</label>
        <input
          type="text"
          className="input-field"
          placeholder="e.g., Cardiologist, Pulmonologist, Nephrologist..."
          value={specialistType}
          onChange={(e) => setSpecialistType(e.target.value)}
        />
      </div>
      
      {/* Urgency */}
      <div className="mb-4">
        <label className="label">Urgency Level</label>
        <div className="flex gap-3">
          {urgencyOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setUrgency(option.value as any)}
              className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                urgency === option.value
                  ? option.color
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Referral Note */}
      <div className="mb-6">
        <label className="label">Referral Motivation</label>
        <textarea
          className="textarea-field"
          rows={6}
          placeholder="Explain the reason for referral, clinical findings, and any specific concerns..."
          value={referralNote}
          onChange={(e) => setReferralNote(e.target.value)}
        />
      </div>
      
      {/* Warning */}
      {!referralNote.trim() && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-700">
            Please provide a detailed referral motivation to ensure proper specialist consultation.
          </p>
        </div>
      )}
      
      {/* Save Buttons */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => onSavePdfOnly(urgency, referralNote, specialistType)}
          disabled={!referralNote.trim() || !specialistType.trim()}
          className="btn-secondary flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Export PDF Only
        </button>
        <button
          onClick={() => onSaveWithAttachments(urgency, referralNote, specialistType)}
          disabled={!referralNote.trim() || !specialistType.trim()}
          className="btn-primary flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Export with Attachments (ZIP)
        </button>
      </div>
    </div>
  );
};

export default Referral;

