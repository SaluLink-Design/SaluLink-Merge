'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, ClipboardList, Download, Archive, Send, Stethoscope, Activity, BadgeCheck, Clock } from 'lucide-react';
import { PatientCase, ClaimType, CibRecord } from '@/types';
import { format } from 'date-fns';
import {
  claimTypeRecommendation,
  benefitStateLabel,
  getPatientCibStatusLabel,
  resolveEffectiveBenefitState,
} from '@/lib/benefitState';
import BenefitStateBadge from '@/components/BenefitStateBadge';
import { normalizePatientCase } from '@/lib/normalizePatientCase';
import { useStore } from '@/lib/store';

interface CaseOptionsViewProps {
  caseData: PatientCase;
  onStartClinicalNote: () => void;
  onContinueWorkflow: () => void;
  onClose: () => void;
  readOnly?: boolean;
  onExportPdf?: () => void;
  onExportZip?: () => void;
  onSendToPatient?: () => void;
  onSelectClaimType?: (claimType: ClaimType) => void;
  patientCibRecords?: CibRecord[];
  /** Set when a specialist has completed CIB registration for this case via a referral handoff. */
  registrationHandoffNotice?: {
    icdCode: string;
    diagnosisDate: string | null;
    completedAt: string;
  } | null;
  /** True when this case has been referred to a specialist and CIB registration is pending their action. */
  hasOutboundReferral?: boolean;
  /** Read-only medical summary — no workflow or claim-type action buttons. */
  medicalOnly?: boolean;
}

const claimTypeLabels: Record<ClaimType, string> = {
  diagnostic: 'Diagnostic Claim',
  'ongoing-management': 'Patient Follow-Up Visit',
  'specialist-review': 'Annual / Specialist Review',
  'medication-report': 'Medication Report',
  referral: 'Referral',
};

/** Phase 1: follow-up visit or diagnostic only for registered patients */
const doctorClaimTypeOptions: {
  value: ClaimType;
  label: string;
  description: string;
  icon: React.ReactNode;
  primary?: boolean;
}[] = [
  {
    value: 'ongoing-management',
    label: 'Patient Follow-Up Visit',
    description:
      'GP shared care — medication report, monitoring, or escalate to neurologist for major changes.',
    icon: <Activity className="w-5 h-5" />,
    primary: true,
  },
  {
    value: 'diagnostic',
    label: 'Diagnostic Claim',
    description:
      'New or changed condition — full diagnostic workflow for CIB registration.',
    icon: <Stethoscope className="w-5 h-5" />,
  },
];

const doctorClaimBadgeClass: Record<ClaimType, string> = {
  diagnostic: 'badge-blue',
  'ongoing-management': 'badge-green',
  'specialist-review': 'badge-purple',
  'medication-report': 'badge-purple',
  referral: 'badge-orange',
};

const ClaimTypeBadge = ({ claimType, label }: { claimType: ClaimType; label: string }) => (
  <span className={doctorClaimBadgeClass[claimType]}>{label}</span>
);

const SectionCard = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="authi-surface-card p-8 mb-6">
    <h2 className="text-sm font-bold uppercase tracking-[0.24em] authi-gradient-text mb-5">
      {title}
    </h2>
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
  onSendToPatient,
  onSelectClaimType,
  patientCibRecords = [],
  registrationHandoffNotice = null,
  hasOutboundReferral = false,
  medicalOnly = false,
}: CaseOptionsViewProps) => {
  const caseRecord = normalizePatientCase(caseData);
  const allCases = useStore((s) => s.cases);
  const chronicCases = useStore((s) => s.chronicCases);
  const conditionCib = caseRecord.condition
    ? patientCibRecords.find((r) => r.conditionName === caseRecord.condition) ??
      caseRecord.cibRecords?.find((r) => r.conditionName === caseRecord.condition)
    : undefined;
  const enrollment = caseRecord.cibEnrollmentStatus ?? 'unregistered';
  const benefitState = resolveEffectiveBenefitState(enrollment, conditionCib?.benefitState);
  const claimRec = caseRecord.claimType
    ? claimTypeRecommendation(conditionCib?.benefitState, caseRecord.claimType, enrollment)
    : claimTypeRecommendation(conditionCib?.benefitState, 'diagnostic', enrollment);

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

  const cibEnrollmentLabel = getPatientCibStatusLabel(
    allCases,
    caseRecord.patientId,
    chronicCases
  );

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

  const sendToPatientButton =
    onSendToPatient && caseRecord.patientEmail ? (
      <button
        type="button"
        onClick={onSendToPatient}
        className="w-full px-6 py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 transition"
      >
        <Send className="w-5 h-5" />
        Send to Patient
      </button>
    ) : null;

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
              {readOnly ? 'Patient record' : medicalOnly ? 'Medical record' : 'Claim detail'}
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-3xl font-semibold text-slate-900">
                {readOnly ? 'Patient Record' : medicalOnly ? 'Claim Summary' : 'Claim Detail'}
              </h1>
              {claimTypeLabel && caseRecord.claimType ? (
                <ClaimTypeBadge claimType={caseRecord.claimType} label={claimTypeLabel} />
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

        {hasOutboundReferral && !registrationHandoffNotice && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 mb-6 flex items-start gap-3">
            <Clock className="w-5 h-5 text-violet-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-violet-900">
                Awaiting specialist — referral in progress
              </p>
              <p className="text-sm text-violet-700 mt-0.5">
                This case has been referred to a specialist for investigation and CIB registration. No
                further action is needed from you until the specialist completes their assessment. You
                will see a confirmation here once they submit.
              </p>
              <Link
                href="/referrals"
                className="inline-block mt-2 text-xs font-semibold text-violet-700 underline underline-offset-2 hover:text-violet-900 transition-colors"
              >
                View outbound referral status →
              </Link>
            </div>
          </div>
        )}

        {registrationHandoffNotice && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 mb-6 flex items-start gap-3">
            <BadgeCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Specialist completed CIB registration
                {registrationHandoffNotice.icdCode ? ` — ICD ${registrationHandoffNotice.icdCode}` : ''}
              </p>
              <p className="text-sm text-emerald-700 mt-0.5">
                Confirmed{registrationHandoffNotice.diagnosisDate
                  ? ` diagnosis date ${format(new Date(registrationHandoffNotice.diagnosisDate), 'MMM dd, yyyy')}`
                  : ''}{' '}
                on {format(new Date(registrationHandoffNotice.completedAt), 'MMM dd, yyyy')}. This patient is
                now marked CIB-registered — your next claim for this condition should typically be an ongoing
                management follow-up or medication report, not another diagnostic registration.
              </p>
            </div>
          </div>
        )}

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

        {caseRecord.clinicalNote?.trim() && (
          <SectionCard title="Clinical Note">
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {caseRecord.clinicalNote}
            </p>
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
          <SectionCard title={`Active Medications (${caseRecord.medications.length})`}>
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
                <div key={r.id ?? i} className="authi-sub-card space-y-3">
                  <p className="text-xs font-semibold authi-gradient-text uppercase tracking-wide">
                    Report {i + 1}
                  </p>
                  {r.followUpNotes && <p className="text-sm text-slate-800">{r.followUpNotes}</p>}
                  {r.originalMedications.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Previous medication(s)</p>
                      <ul className="space-y-1">
                        {r.originalMedications.map((m, j) => (
                          <li key={j} className="text-sm text-slate-700">
                            {m.medicineNameAndStrength}
                            {m.activeIngredient ? ` (${m.activeIngredient})` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.newMedications.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-emerald-700 mb-1">New medication prescribed</p>
                      <ul className="space-y-1">
                        {r.newMedications.map((m, j) => (
                          <li key={j} className="text-sm text-slate-800">
                            {m.medicineNameAndStrength}
                            {m.activeIngredient ? ` (${m.activeIngredient})` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.motivationLetter && (
                    <p className="text-xs text-slate-600 whitespace-pre-wrap">
                      <span className="font-medium">Motivation: </span>
                      {r.motivationLetter}
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
        {!medicalOnly && isUnregisteredNew && !readOnly && !caseRecord.claimType && !hasOutboundReferral && (
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
        {!medicalOnly && needsClaimType && onSelectClaimType && (
          <div className="authi-surface-card p-8 mb-6">
            <h2 className="text-sm font-bold uppercase tracking-[0.24em] authi-gradient-text mb-2">
              Select Claim Type
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Patient is registered on CIB. Start a follow-up visit for routine chronic care, or a
              diagnostic claim for a new or changed condition.
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

        {caseRecord.claimType &&
          !claimRec.aligned &&
          benefitState &&
          !readOnly &&
          !medicalOnly &&
          !isCompleted &&
          (isNew || needsClaimType) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {claimRec.hint}
          </div>
        )}

        {/* Actions */}
        {!medicalOnly && (
        <div className="space-y-3">
          {readOnly ? (
            <>
              {canExport ? (
                <>
                  {exportPdfButton}
                  {exportZipButton}
                  {sendToPatientButton}
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
              {!hasOutboundReferral && (
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
                </>
              )}

              {canExport && (
                <>
                  {exportPdfButton}
                  {exportZipButton}
                  {sendToPatientButton}
                </>
              )}
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default CaseOptionsView;
