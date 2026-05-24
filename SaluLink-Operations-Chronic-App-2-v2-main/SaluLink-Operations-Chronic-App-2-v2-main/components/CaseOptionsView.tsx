'use client';

import type { ReactNode } from 'react';
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

const claimTypeLabels: Record<ClaimType, string> = {
  diagnostic: 'Diagnostic Claim',
  'ongoing-management': 'Ongoing Management',
  'medication-report': 'Medication Report',
  referral: 'Referral',
};

const doctorClaimTypeOptions: {
  value: ClaimType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'diagnostic',
    label: 'Diagnostic Claim',
    description: 'Full clinical workflow — note, condition, ICD, diagnostics, medication.',
    icon: <Stethoscope className="w-5 h-5" />,
  },
  {
    value: 'ongoing-management',
    label: 'Ongoing Management',
    description: 'Monitoring and treatment protocols for an existing condition.',
    icon: <Activity className="w-5 h-5" />,
  },
  {
    value: 'medication-report',
    label: 'Medication Report',
    description: 'Follow-up notes and prescriptions for a chronic patient.',
    icon: <Pill className="w-5 h-5" />,
  },
  {
    value: 'referral',
    label: 'Referral',
    description: 'Specialist referral letter for this patient.',
    icon: <FileSymlink className="w-5 h-5" />,
  },
];

const ClaimTypeBadge = ({ label }: { label: string }) => (
  <span className="authi-badge-pill px-3 py-1">
    <span>{label}</span>
  </span>
);

const SectionCard = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="authi-section-card">
    <h2 className="text-xs font-semibold authi-gradient-text uppercase tracking-wide mb-4">{title}</h2>
    {children}
  </div>
);

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
  const claimTypeLabel = caseData.claimType ? claimTypeLabels[caseData.claimType] : null;

  const exportPdfButton = (
    <button
      type="button"
      onClick={onExportPdf}
      className="authi-btn-secondary w-full px-6 py-4 text-base flex items-center justify-center gap-2"
    >
      <Download className="w-5 h-5" />
      Export as PDF
    </button>
  );

  const exportZipButton = (
    <button
      type="button"
      onClick={onExportZip}
      className="authi-btn-primary w-full px-6 py-4 rounded-2xl text-base flex items-center justify-center gap-2"
    >
      <Archive className="w-5 h-5" />
      Export with Attachments (ZIP)
    </button>
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.2em] authi-gradient-text font-semibold mb-1">
              {readOnly ? 'Patient record' : 'Claim detail'}
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-3xl font-semibold text-slate-900">
                {readOnly ? 'Patient Record' : 'Claim Detail'}
              </h1>
              {claimTypeLabel ? (
                <ClaimTypeBadge label={claimTypeLabel} />
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold authi-tint border border-[rgba(99,102,241,0.25)] text-slate-500">
                  Awaiting doctor
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              Created {format(new Date(caseData.createdAt), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>

        {/* Patient Info */}
        <SectionCard title="Patient Information">
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
        </SectionCard>

        {/* Condition */}
        {caseData.condition && (
          <SectionCard title="Condition">
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
          </SectionCard>
        )}

        {/* Ongoing Treatments */}
        {caseData.ongoingTreatments.length > 0 && (
          <SectionCard title={`Ongoing Treatments (${caseData.ongoingTreatments.length})`}>
            <ul className="space-y-2">
              {caseData.ongoingTreatments.map((t, i) => (
                <li key={i} className="text-sm text-slate-800">
                  <span className="font-medium">{t.description}</span>
                  {t.code ? ` — ${t.code}` : ''}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Medications */}
        {caseData.medications.length > 0 && (
          <SectionCard title={`Medications (${caseData.medications.length})`}>
            <ul className="space-y-2">
              {caseData.medications.map((m, i) => (
                <li key={i} className="text-sm text-slate-800">
                  <span className="font-medium">{m.medicineNameAndStrength}</span>
                  {m.activeIngredient ? ` (${m.activeIngredient})` : ''}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Medication Reports */}
        {(caseData.medicationReports?.length ?? 0) > 0 && (
          <SectionCard title={`Medication Reports (${caseData.medicationReports!.length})`}>
            <div className="space-y-3">
              {caseData.medicationReports!.map((r, i) => (
                <div key={r.id ?? i} className="authi-sub-card">
                  <p className="text-xs font-semibold authi-gradient-text uppercase tracking-wide mb-1">
                    Report {i + 1}
                  </p>
                  {r.followUpNotes && <p className="text-sm text-slate-800">{r.followUpNotes}</p>}
                  {r.newMedications.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      +{r.newMedications.length} new medication(s)
                    </p>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Doctor claim type selector */}
        {needsClaimType && onSelectClaimType && (
          <div className="authi-section-card">
            <h2 className="text-sm font-semibold authi-gradient-text mb-1">Select Claim Type</h2>
            <p className="text-sm text-slate-500 mb-4">
              Patient details were captured by the assistant. Choose the claim type before starting the workflow.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {doctorClaimTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSelectClaimType(opt.value)}
                  className="authi-action-card"
                >
                  <span className="flex items-center gap-2 font-semibold text-sm">
                    <span className="text-[#6366f1]">{opt.icon}</span>
                    <span className="authi-gradient-text">{opt.label}</span>
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
                  {exportPdfButton}
                  {exportZipButton}
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
                  className="authi-btn-primary w-full px-6 py-4 rounded-2xl text-base flex items-center justify-center gap-2"
                >
                  <FileText className="w-5 h-5" />
                  Start Workflow
                </button>
              ) : !isCompleted && !needsClaimType ? (
                <button
                  onClick={onContinueWorkflow}
                  className="authi-btn-primary w-full px-6 py-4 rounded-2xl text-base flex items-center justify-center gap-2"
                >
                  <ClipboardList className="w-5 h-5" />
                  Continue Workflow
                </button>
              ) : null}

              {canExport && (
                <>
                  {exportPdfButton}
                  {exportZipButton}
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
