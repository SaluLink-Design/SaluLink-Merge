'use client';

import { ArrowLeft, FileText, ClipboardList, Download, Archive, Stethoscope, Activity, Pill, FileSymlink } from 'lucide-react';
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
  onSelectClaimType?: (claimType: ClaimType) => void;
}

const doctorClaimTypeOptions: {
  value: ClaimType;
  label: string;
  description: string;
  icon: React.ReactNode;
  borderHover: string;
  textColor: string;
}[] = [
  {
    value: 'diagnostic',
    label: 'Diagnostic Claim',
    description: 'Full clinical workflow — note, condition, ICD, diagnostics, medication.',
    icon: <Stethoscope className="w-5 h-5" />,
    borderHover: 'hover:border-blue-400',
    textColor: 'text-blue-600',
  },
  {
    value: 'ongoing-management',
    label: 'Ongoing Management',
    description: 'Monitoring and treatment protocols for an existing condition.',
    icon: <Activity className="w-5 h-5" />,
    borderHover: 'hover:border-emerald-400',
    textColor: 'text-emerald-600',
  },
  {
    value: 'medication-report',
    label: 'Medication Report',
    description: 'Follow-up notes and prescriptions for a chronic patient.',
    icon: <Pill className="w-5 h-5" />,
    borderHover: 'hover:border-violet-400',
    textColor: 'text-violet-600',
  },
  {
    value: 'referral',
    label: 'Referral',
    description: 'Specialist referral letter for this patient.',
    icon: <FileSymlink className="w-5 h-5" />,
    borderHover: 'hover:border-orange-400',
    textColor: 'text-orange-600',
  },
];

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
  onSelectClaimType,
}: CaseOptionsViewProps) => {
  const isNew = caseData.status === 'new';
  const isCompleted = caseData.status === 'completed';
  const canExport = isCompleted || (Boolean(caseData.condition) && Boolean(caseData.icdCode));
  const needsClaimType = !readOnly && !caseData.claimType;
  const ct = caseData.claimType ? claimTypeBadge[caseData.claimType] : null;

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors" title="Back">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-semibold text-slate-900">
                {readOnly ? 'Patient Record' : 'Claim Detail'}
              </h1>
              {ct ? (
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${ct.className}`}>
                  {ct.label}
                </span>
              ) : readOnly ? (
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                  Awaiting doctor
                </span>
              ) : null}
            </div>
            <p className="text-sm text-slate-500">
              Created {format(new Date(caseData.createdAt), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>

        {/* Patient Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
          <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-4">Patient Information</h2>
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
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Condition */}
        {caseData.condition && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6">
            <h2 className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-4">Condition</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500">Condition</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{caseData.condition}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">ICD-10 Code</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{caseData.icdCode}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Description</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{caseData.icdDescription}</p>
              </div>
            </div>
          </div>
        )}

        {/* Ongoing Treatments */}
        {caseData.ongoingTreatments.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
            <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-4">
              Ongoing Treatments ({caseData.ongoingTreatments.length})
            </h2>
            <ul className="space-y-2">
              {caseData.ongoingTreatments.map((t, i) => (
                <li key={i} className="text-sm text-slate-800">
                  <span className="font-medium">{t.description}</span>
                  {t.code ? ` — ${t.code}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Medications */}
        {caseData.medications.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
            <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-4">
              Medications ({caseData.medications.length})
            </h2>
            <ul className="space-y-2">
              {caseData.medications.map((m, i) => (
                <li key={i} className="text-sm text-slate-800">
                  <span className="font-medium">{m.medicineNameAndStrength}</span>
                  {m.activeIngredient ? ` (${m.activeIngredient})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Medication Reports */}
        {(caseData.medicationReports?.length ?? 0) > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
            <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-4">
              Medication Reports ({caseData.medicationReports!.length})
            </h2>
            <div className="space-y-3">
              {caseData.medicationReports!.map((r, i) => (
                <div key={r.id ?? i} className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">
                    Report {i + 1}
                  </p>
                  {r.followUpNotes && (
                    <p className="text-sm text-slate-800">{r.followUpNotes}</p>
                  )}
                  {r.newMedications.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      +{r.newMedications.length} new medication(s)
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Doctor claim type selector */}
        {needsClaimType && onSelectClaimType && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Select Claim Type</h2>
            <p className="text-sm text-slate-500 mb-4">
              Patient details were captured by the assistant. Choose the claim type before starting the workflow.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {doctorClaimTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSelectClaimType(opt.value)}
                  className={`flex flex-col gap-2 rounded-xl border-2 border-slate-200 p-4 text-left transition-all bg-white ${opt.borderHover}`}
                >
                  <span className={`flex items-center gap-2 font-semibold text-sm ${opt.textColor}`}>
                    {opt.icon}
                    {opt.label}
                  </span>
                  <span className="text-xs leading-relaxed text-slate-500">{opt.description}</span>
                </button>
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
                    className="w-full px-6 py-4 bg-slate-100 border border-slate-200 text-slate-900 rounded-2xl hover:bg-slate-200 transition font-medium flex items-center justify-center gap-2 text-base"
                  >
                    <Download className="w-5 h-5" />
                    Export as PDF
                  </button>
                  <button
                    type="button"
                    onClick={onExportZip}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-violet-600 text-white rounded-2xl hover:from-blue-600 hover:to-violet-700 transition font-semibold flex items-center justify-center gap-2 text-base shadow-md"
                  >
                    <Archive className="w-5 h-5" />
                    Export with Attachments (ZIP)
                  </button>
                </>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {needsClaimType || !caseData.claimType
                    ? 'Patient details saved. The doctor will choose the claim type and complete the case before exports are available.'
                    : 'Exports are available after the doctor has saved and completed the claim.'}
                </div>
              )}
            </>
          ) : (
            <>
              {isNew && !needsClaimType ? (
                <button
                  onClick={onStartClinicalNote}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-violet-600 text-white rounded-2xl hover:from-blue-600 hover:to-violet-700 transition font-semibold flex items-center justify-center gap-2 text-base shadow-md"
                >
                  <FileText className="w-5 h-5" />
                  Start Workflow
                </button>
              ) : !isCompleted && !needsClaimType ? (
                <button
                  onClick={onContinueWorkflow}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-violet-600 text-white rounded-2xl hover:from-blue-600 hover:to-violet-700 transition font-semibold flex items-center justify-center gap-2 text-base shadow-md"
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
                    className="w-full px-6 py-4 bg-slate-100 border border-slate-200 text-slate-900 rounded-2xl hover:bg-slate-200 transition font-medium flex items-center justify-center gap-2 text-base"
                  >
                    <Download className="w-5 h-5" />
                    Export as PDF
                  </button>
                  <button
                    type="button"
                    onClick={onExportZip}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-violet-600 text-white rounded-2xl hover:from-blue-600 hover:to-violet-700 transition font-semibold flex items-center justify-center gap-2 text-base shadow-md"
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
