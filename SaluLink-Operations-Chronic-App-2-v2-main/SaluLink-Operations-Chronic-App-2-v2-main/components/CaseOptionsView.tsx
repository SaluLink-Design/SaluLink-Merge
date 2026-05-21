'use client';

import { ArrowLeft, FileText, ClipboardList, Download, Archive } from 'lucide-react';
import { PatientCase, ClaimType } from '@/types';
import { format } from 'date-fns';

interface CaseOptionsViewProps {
  caseData: PatientCase;
  onStartClinicalNote: () => void;
  onContinueWorkflow: () => void;
  onClose: () => void;
  readOnly?: boolean;
  onExportPdf?: () => void;
  onExportZip?: () => void;
}

const claimTypeBadge: Record<ClaimType, { label: string; className: string }> = {
  'diagnostic': { label: 'Diagnostic Claim', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  'ongoing-management': { label: 'Ongoing Management', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  'medication-report': { label: 'Medication Report', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
  'referral': { label: 'Referral', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
};

const CaseOptionsView = ({
  caseData,
  onStartClinicalNote,
  onContinueWorkflow,
  onClose,
  readOnly = false,
  onExportPdf,
  onExportZip,
}: CaseOptionsViewProps) => {
  const isNew = caseData.status === 'new';
  const isCompleted = caseData.status === 'completed';
  const canExport = isCompleted || (Boolean(caseData.condition) && Boolean(caseData.icdCode));
  const ct = claimTypeBadge[caseData.claimType ?? 'diagnostic'];

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-gray-900">Claim Detail</h1>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${ct.className}`}>
                {ct.label}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Created {format(new Date(caseData.createdAt), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>

        {/* Patient Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Patient Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ['Patient Name', caseData.patientName],
              ['Patient ID', caseData.patientId],
              ['Medical Aid Number', caseData.medicalAidNumber || 'N/A'],
              ['Medical Plan', caseData.plan || 'Not selected'],
              ['Email', caseData.patientEmail || 'N/A'],
              ['Phone', caseData.patientPhone || 'N/A'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Condition */}
        {caseData.condition && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Condition</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Condition</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{caseData.condition}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ICD-10 Code</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{caseData.icdCode}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{caseData.icdDescription}</p>
              </div>
            </div>
          </div>
        )}

        {/* Ongoing Treatments */}
        {caseData.ongoingTreatments.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Ongoing Treatments ({caseData.ongoingTreatments.length})
            </h2>
            <ul className="space-y-2">
              {caseData.ongoingTreatments.map((t, i) => (
                <li key={i} className="text-sm text-gray-800">
                  <span className="font-medium">{t.description}</span>
                  {t.code ? ` — ${t.code}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Medications */}
        {caseData.medications.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Medications ({caseData.medications.length})
            </h2>
            <ul className="space-y-2">
              {caseData.medications.map((m, i) => (
                <li key={i} className="text-sm text-gray-800">
                  <span className="font-medium">{m.medicineNameAndStrength}</span>
                  {m.activeIngredient ? ` (${m.activeIngredient})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Medication Reports */}
        {(caseData.medicationReports?.length ?? 0) > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Medication Reports ({caseData.medicationReports!.length})
            </h2>
            <div className="space-y-3">
              {caseData.medicationReports!.map((r, i) => (
                <div key={r.id ?? i} className="bg-violet-50 border border-violet-100 rounded-lg p-4">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">
                    Report {i + 1}
                  </p>
                  {r.followUpNotes && (
                    <p className="text-sm text-gray-800">{r.followUpNotes}</p>
                  )}
                  {r.newMedications.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      +{r.newMedications.length} new medication(s)
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {readOnly ? (
            <>
              {canExport ? (
                <>
                  <button
                    type="button"
                    onClick={onExportPdf}
                    className="w-full px-6 py-4 bg-primary-400 text-brand-black rounded-lg hover:bg-primary-500 hover:text-white transition-colors font-medium flex items-center justify-center gap-2 text-lg"
                  >
                    <Download className="w-5 h-5" />
                    Export as PDF
                  </button>
                  <button
                    type="button"
                    onClick={onExportZip}
                    className="w-full px-6 py-4 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition-colors font-medium flex items-center justify-center gap-2 text-lg"
                  >
                    <Archive className="w-5 h-5" />
                    Export with Attachments (ZIP)
                  </button>
                </>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Exports are available after the doctor has saved and completed the claim.
                </div>
              )}
            </>
          ) : (
            <>
              {isNew ? (
                <button
                  onClick={onStartClinicalNote}
                  className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 text-lg"
                >
                  <FileText className="w-5 h-5" />
                  Start Workflow
                </button>
              ) : !isCompleted ? (
                <button
                  onClick={onContinueWorkflow}
                  className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 text-lg"
                >
                  <ClipboardList className="w-5 h-5" />
                  Continue Workflow
                </button>
              ) : null}

              {canExport && (
                <>
                  <button
                    type="button"
                    onClick={onExportPdf}
                    className="w-full px-6 py-4 bg-primary-400 text-brand-black rounded-lg hover:bg-primary-500 hover:text-white transition-colors font-medium flex items-center justify-center gap-2 text-lg"
                  >
                    <Download className="w-5 h-5" />
                    Export as PDF
                  </button>
                  <button
                    type="button"
                    onClick={onExportZip}
                    className="w-full px-6 py-4 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition-colors font-medium flex items-center justify-center gap-2 text-lg"
                  >
                    <Archive className="w-5 h-5" />
                    Export with Attachments (ZIP)
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseOptionsView;
