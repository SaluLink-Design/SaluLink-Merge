'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, FileText, ClipboardList, Download, Archive, Stethoscope, Activity, Pill, FileSymlink } from 'lucide-react';
import { PatientCase, ClaimType, CibRecord } from '@/types';
import { format } from 'date-fns';
import { claimTypeRecommendation, benefitStateLabel } from '@/lib/benefitState';
import BenefitStateBadge from '@/components/BenefitStateBadge';
import { normalizePatientCase } from '@/lib/normalizePatientCase';

interface CaseOptionsViewProps {
  caseData: PatientCase;
  onStartClinicalNote: () => void;
  onContinueWorkflow: () => void;
  onClose: () => void;
  readOnly?: boolean;
  onExportPdf?: () => void;
  onExportZip?: () => void;
  onSelectClaimType?: (claimType: ClaimType) => void;
  patientCibRecords?: CibRecord[];
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
  patientCibRecords = [],
}: CaseOptionsViewProps) => {
  const caseRecord = normalizePatientCase(caseData);
  const conditionCib = caseRecord.condition
    ? patientCibRecords.find((r) => r.conditionName === caseRecord.condition) ??
      caseRecord.cibRecords?.find((r) => r.conditionName === caseRecord.condition)
    : undefined;
  const benefitState = conditionCib?.benefitState;
  const claimRec = caseRecord.claimType
    ? claimTypeRecommendation(benefitState, caseRecord.claimType)
    : claimTypeRecommendation(benefitState, 'diagnostic');

  const isNew = caseRecord.status === 'new';
  const isCompleted = caseRecord.status === 'completed';
  const canExport = isCompleted || (Boolean(caseRecord.condition) && Boolean(caseRecord.icdCode));
  const isUnregisteredNew =
    caseRecord.cibEnrollmentStatus === 'unregistered' && isNew;
  const needsClaimType = !readOnly && !caseRecord.claimType && !isUnregisteredNew;
  const claimTypeLabel = caseRecord.claimType ? claimTypeLabels[caseRecord.claimType] : null;

  const availableClaimTypes = isUnregisteredNew
    ? doctorClaimTypeOptions.filter((o) => o.value === 'diagnostic')
    : doctorClaimTypeOptions;

  const showPendingConditionCib =
    caseRecord.claimType === 'diagnostic' && conditionCib?.benefitState === 'pending_cib_review';

  const cibEnrollmentLabel =
    caseRecord.cibEnrollmentStatus === 'registered' ? 'Registered' : 'Not registered';

  const handleStartUnregisteredDiagnostic = () => {
    onSelectClaimType?.('diagnostic');
    onStartClinicalNote();
  };

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
              Created {format(new Date(caseRecord.createdAt), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>

        {/* Patient Info */}
        <SectionCard title="Patient Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ['Patient Name', caseRecord.patientName],
              ['Patient ID', caseRecord.patientId],
              ['CIB Status', cibEnrollmentLabel],
              ['Medical Aid Number', caseRecord.medicalAidNumber || 'N/A'],
              ['Medical Plan', caseRecord.plan || 'Not selected'],
              ['Email', caseRecord.patientEmail || 'N/A'],
              ['Phone', caseRecord.patientPhone || 'N/A'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Condition */}
        {caseRecord.condition && (
          <SectionCard title="Condition">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500">Condition</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{caseRecord.condition}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">ICD-10 Code</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{caseRecord.icdCode}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Description</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{caseRecord.icdDescription}</p>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Ongoing Treatments */}
        {caseRecord.ongoingTreatments.length > 0 && (
          <SectionCard title={`Ongoing Treatments (${caseRecord.ongoingTreatments.length})`}>
            <ul className="space-y-2">
              {caseRecord.ongoingTreatments.map((t, i) => (
                <li key={i} className="text-sm text-slate-800">
                  <span className="font-medium">{t.description}</span>
                  {t.code ? ` — ${t.code}` : ''}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Medications */}
        {caseRecord.medications.length > 0 && (
          <SectionCard title={`Medications (${caseRecord.medications.length})`}>
            <ul className="space-y-2">
              {caseRecord.medications.map((m, i) => (
                <li key={i} className="text-sm text-slate-800">
                  <span className="font-medium">{m.medicineNameAndStrength}</span>
                  {m.activeIngredient ? ` (${m.activeIngredient})` : ''}
                  <span
                    className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.formularyStatus === 'unlisted'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {m.formularyStatus === 'unlisted' ? 'Cap-limited' : 'Fully covered'}
                  </span>
                  {m.copayRisk && (
                    <span className="ml-2 text-xs text-amber-700">Co-pay risk</span>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Medication Reports */}
        {(caseRecord.medicationReports?.length ?? 0) > 0 && (
          <SectionCard title={`Medication Reports (${caseRecord.medicationReports!.length})`}>
            <div className="space-y-3">
              {caseRecord.medicationReports!.map((r, i) => (
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

        {showPendingConditionCib && conditionCib && (
          <SectionCard title="Condition CIB status">
            <BenefitStateBadge cibRecords={[conditionCib]} expanded />
          </SectionCard>
        )}

        {/* Unregistered new case — diagnostic only */}
        {isUnregisteredNew && !readOnly && !caseRecord.claimType && (
          <button
            type="button"
            onClick={handleStartUnregisteredDiagnostic}
            className="authi-btn-primary w-full px-6 py-4 rounded-2xl text-base flex items-center justify-center gap-2"
          >
            <Stethoscope className="w-5 h-5" />
            Start diagnostic workflow
          </button>
        )}

        {/* Doctor claim type selector (registered patients) */}
        {needsClaimType && onSelectClaimType && (
          <div className="authi-section-card">
            <h2 className="text-sm font-semibold authi-gradient-text mb-1">Select Claim Type</h2>
            <p className="text-sm text-slate-500 mb-4">
              Patient is registered on CIB. Choose a diagnostic claim for a new condition, or ongoing
              management, medication report, or referral.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableClaimTypes.map((opt) => {
                const isRecommended = opt.value === claimRec.recommended;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSelectClaimType(opt.value)}
                    className={`authi-action-card text-left ${isRecommended ? 'ring-2 ring-[#6366f1]/40' : ''}`}
                  >
                    <span className="flex items-center gap-2 font-semibold text-sm flex-wrap">
                      <span className="text-[#6366f1]">{opt.icon}</span>
                      <span className="authi-gradient-text">{opt.label}</span>
                      {isRecommended && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                          Recommended
                        </span>
                      )}
                    </span>
                    <span className="text-xs leading-relaxed text-slate-500">{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {caseRecord.claimType && !claimRec.aligned && benefitState && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {claimRec.hint}
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
                  {needsClaimType || !caseRecord.claimType
                    ? 'Patient details saved. The doctor will choose the claim type and complete the case before exports are available.'
                    : 'Exports are available after the doctor has saved and completed the claim.'}
                </div>
              )}
            </>
          ) : (
            <>
              {(isNew && !needsClaimType && !isUnregisteredNew) || (isUnregisteredNew && caseRecord.claimType === 'diagnostic') ? (
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
