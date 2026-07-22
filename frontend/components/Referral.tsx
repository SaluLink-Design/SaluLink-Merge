'use client';

import { useState, useEffect } from 'react';
import { UserPlus, AlertCircle, FileText, Upload } from 'lucide-react';
import {
  ClinicalReviewStatus,
  MedicationRenewNotes,
  PatientCase,
  ProgressReview,
} from '@/types';
import { formatProgressReviewSummary } from '@/lib/followUpContext';
import type { SpecialistVisitUsageSummary } from '@/lib/specialistVisitUsage';

export interface ReferralFormData {
  urgency: 'routine' | 'urgent' | 'emergency';
  referralNote: string;
  specialistType: string;
}

interface ReferralProps {
  patientCase: PatientCase;
  embedMode?: boolean;
  /** Original diagnostic note from patient's registration visit */
  diagnosticClinicalNote?: string;
  /** This visit's structured progress review */
  progressReview?: ProgressReview;
  /** Medication report findings from this visit (shown in clinical context, not in the letter field) */
  medicationRenewNotes?: MedicationRenewNotes;
  clinicalReview?: ClinicalReviewStatus | null;
  /** When true, skip med list here — already shown in MedicationReportSummaryCard above */
  hideDuplicateMedicationList?: boolean;
  initialReferralNote?: string;
  initialSpecialistType?: string;
  referralMotivationPlaceholder?: string;
  /** Annual specialist-visit usage — soft signal at referral time */
  specialistVisitUsage?: SpecialistVisitUsageSummary | null;
  onDataChange?: (data: ReferralFormData) => void;
  onSavePdfOnly: (
    urgency: 'routine' | 'urgent' | 'emergency',
    referralNote: string,
    specialistType: string
  ) => void;
  onSaveWithAttachments: (
    urgency: 'routine' | 'urgent' | 'emergency',
    referralNote: string,
    specialistType: string
  ) => void;
}

const Referral = ({
  patientCase,
  embedMode = false,
  diagnosticClinicalNote = '',
  progressReview,
  medicationRenewNotes,
  clinicalReview,
  hideDuplicateMedicationList = false,
  initialReferralNote = '',
  initialSpecialistType = '',
  referralMotivationPlaceholder,
  specialistVisitUsage,
  onDataChange,
  onSavePdfOnly,
  onSaveWithAttachments,
}: ReferralProps) => {
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine');
  const [referralNote, setReferralNote] = useState(initialReferralNote);
  const [specialistType, setSpecialistType] = useState(initialSpecialistType);

  useEffect(() => {
    setReferralNote(initialReferralNote);
  }, [initialReferralNote]);

  useEffect(() => {
    if (initialSpecialistType) setSpecialistType(initialSpecialistType);
  }, [initialSpecialistType]);

  useEffect(() => {
    if (embedMode && onDataChange) {
      onDataChange({ urgency, referralNote, specialistType });
    }
  }, [urgency, referralNote, specialistType, embedMode, onDataChange]);

  const urgencyOptions = [
    { value: 'routine', label: 'Routine', color: 'bg-green-100 text-green-700 border-green-300' },
    { value: 'urgent', label: 'Urgent', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    { value: 'emergency', label: 'Emergency', color: 'bg-red-100 text-red-700 border-red-300' },
  ];

  const progressSummary = progressReview ? formatProgressReviewSummary(progressReview) : '';
  const hasMedicationFindings =
    Boolean(medicationRenewNotes?.adherence.trim()) ||
    Boolean(medicationRenewNotes?.sideEffects.trim()) ||
    Boolean(clinicalReview);

  return (
    <div className={embedMode ? '' : 'card'}>
      {!embedMode && (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create Referral</h2>
            <p className="text-sm text-gray-500">Refer patient to specialist</p>
          </div>
        </div>
      )}

      {embedMode && (
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Specialist Referral</h3>
      )}

      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
        <h3 className="font-semibold text-lg">Clinical context for referral</h3>

        {specialistVisitUsage?.maxCovered != null && (
          <div
            className={`rounded-lg border px-3 py-2.5 text-sm ${
              specialistVisitUsage.isExhausted
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-amber-100 bg-amber-50/60 text-amber-800'
            }`}
          >
            <p className="font-medium">
              {specialistVisitUsage.usedHistorical} of {specialistVisitUsage.maxCovered} specialist
              visits used this year
              {specialistVisitUsage.isExhausted
                ? ' — this referral would be over the covered limit.'
                : specialistVisitUsage.remaining === 1
                  ? ' — this referral would be the last covered visit.'
                  : '.'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">(Visits tracked in SaluLink)</p>
          </div>
        )}

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

        <div className="text-sm">
          <p className="text-gray-600">Condition:</p>
          <p className="font-medium">{patientCase.condition}</p>
          <p className="text-xs text-gray-500 mt-1">
            ICD-10: {patientCase.icdCode} - {patientCase.icdDescription}
          </p>
        </div>

        {hasMedicationFindings && (
          <div className="text-sm rounded-lg border border-violet-200 bg-violet-50/60 p-3 space-y-2">
            <p className="font-medium text-violet-900">Medication report findings (this visit)</p>
            {clinicalReview && (
              <p className="text-slate-700">
                <span className="text-slate-500">Clinical assessment:</span>{' '}
                <span className="capitalize font-medium">{clinicalReview}</span>
              </p>
            )}
            {medicationRenewNotes?.adherence.trim() && (
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold">
                  Adherence
                </p>
                <p className="text-slate-800 whitespace-pre-wrap">
                  {medicationRenewNotes.adherence.trim()}
                </p>
              </div>
            )}
            {medicationRenewNotes?.sideEffects.trim() && (
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold">
                  Side effects / tolerability
                </p>
                <p className="text-slate-800 whitespace-pre-wrap">
                  {medicationRenewNotes.sideEffects.trim()}
                </p>
              </div>
            )}
          </div>
        )}

        {diagnosticClinicalNote && (
          <div className="text-sm">
            <p className="text-gray-600 mb-1 font-medium">Original diagnostic note</p>
            <div className="p-3 bg-white border border-gray-200 rounded">
              <p className="text-gray-900 whitespace-pre-wrap text-xs">{diagnosticClinicalNote}</p>
            </div>
          </div>
        )}

        {patientCase.clinicalNote?.trim() && (
          <div className="text-sm">
            <p className="text-gray-600 mb-1 font-medium">This follow-up visit note</p>
            <div className="p-3 bg-white border border-gray-200 rounded">
              <p className="text-gray-900 whitespace-pre-wrap text-xs">{patientCase.clinicalNote}</p>
            </div>
          </div>
        )}

        {progressSummary && (
          <div className="text-sm">
            <p className="text-gray-600 mb-1 font-medium">Progress review (this visit)</p>
            <div className="p-3 bg-white border border-gray-200 rounded">
              <p className="text-gray-900 whitespace-pre-wrap text-xs">{progressSummary}</p>
            </div>
          </div>
        )}

        {!diagnosticClinicalNote && !patientCase.clinicalNote?.trim() && !progressSummary && (
          <div className="text-sm">
            <p className="text-gray-600 mb-1">Clinical Note:</p>
            <div className="p-3 bg-white border border-gray-200 rounded">
              <p className="text-gray-500 text-xs">No clinical notes recorded.</p>
            </div>
          </div>
        )}

        {patientCase.diagnosticTreatments?.length > 0 && (
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

        {patientCase.ongoingTreatments?.length > 0 && (
          <div className="text-sm">
            <p className="text-gray-600 mb-2 font-medium">Monitoring &amp; test results (this visit):</p>
            <div className="space-y-1">
              {patientCase.ongoingTreatments.map((treatment, i) => (
                <div key={i} className="p-2 bg-white border border-gray-200 rounded text-xs">
                  <p className="font-medium">{treatment.description}</p>
                  <p className="text-gray-500">
                    Code: {treatment.code} | Completed: {treatment.timesCompleted}x per year
                  </p>
                  {treatment.documentation.notes && (
                    <p className="text-gray-600 mt-1">{treatment.documentation.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!hideDuplicateMedicationList && (patientCase.medications?.length ?? 0) > 0 && (
          <div className="text-sm">
            <p className="text-gray-600 mb-2">Current Medications:</p>
            <div className="space-y-1">
              {patientCase.medications!.map((med, i) => (
                <div key={i} className="p-2 bg-white border border-gray-200 rounded text-xs">
                  <p className="font-medium">{med.medicineNameAndStrength}</p>
                  <p className="text-gray-500">{med.activeIngredient}</p>
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
                        <p className="mt-1 text-xs text-gray-600 italic">
                          Reason: {report.motivationLetter}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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

      <div className="mb-4">
        <label className="label">Urgency Level</label>
        <div className="flex gap-3">
          {urgencyOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setUrgency(option.value as 'routine' | 'urgent' | 'emergency')}
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

      <div className="mb-6">
        <label className="label">Referral Motivation</label>
        <p className="text-xs text-slate-500 mb-2">
          Your message to the specialist. Medication report findings are attached separately above —
          do not re-type them here.
        </p>
        <textarea
          className="textarea-field"
          rows={6}
          placeholder={
            referralMotivationPlaceholder ||
            'Explain the reason for referral, clinical findings, and any specific concerns...'
          }
          value={referralNote}
          onChange={(e) => setReferralNote(e.target.value)}
        />
      </div>

      {!referralNote.trim() && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-700">
            Please provide a referral message so the specialist knows what you need from this review.
          </p>
        </div>
      )}

      {!embedMode && (
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => onSavePdfOnly(urgency, referralNote, specialistType)}
            disabled={!referralNote.trim() || !specialistType.trim()}
            className="btn-secondary flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Export PDF Only
          </button>
          <button
            type="button"
            onClick={() => onSaveWithAttachments(urgency, referralNote, specialistType)}
            disabled={!referralNote.trim() || !specialistType.trim()}
            className="btn-primary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Export with Attachments (ZIP)
          </button>
        </div>
      )}
    </div>
  );
};

export default Referral;
