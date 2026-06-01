'use client';

import { useState } from 'react';
import { ArrowLeft, Eye, User, Activity, Pill, FileSymlink, ChevronDown, ChevronUp, Stethoscope, FileText } from 'lucide-react';
import { PatientCase, ClaimType } from '@/types';
import { getPatientEnrollmentStatus } from '@/lib/benefitState';
import { format } from 'date-fns';

interface PatientProfileProps {
  profileId: string;
  cases: PatientCase[];
  allCases?: PatientCase[];
  onViewClaim: (caseId: string) => void;
  onNewCaseAction: (profileId: string, claimType: ClaimType) => void;
  onViewPatientRecord: (profileId: string) => void;
  onBack: () => void;
  userRole?: string | null;
}

const claimTypeBadge: Record<ClaimType, { label: string; className: string }> = {
  'diagnostic': { label: 'Diagnostic', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  'ongoing-management': { label: 'Ongoing Mgmt', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  'medication-report': { label: 'Medication', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
  'referral': { label: 'Referral', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
};

const statusBadge: Record<string, { label: string; className: string }> = {
  'new': { label: 'New', className: 'bg-blue-100 text-blue-700' },
  'draft': { label: 'Draft', className: 'bg-yellow-100 text-yellow-700' },
  'diagnostic': { label: 'In Review', className: 'bg-orange-100 text-orange-700' },
  'ongoing': { label: 'In Progress', className: 'bg-emerald-100 text-emerald-700' },
  'completed': { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
};

const AUTHI_ICON_STROKE = 'url(#authi-stroke-gradient)';

const caseActionOptions: { claimType: ClaimType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    claimType: 'diagnostic',
    label: 'Diagnostic Claim',
    description: 'Identify a new or changed condition — e.g. a patient with hypertension presenting with new asthmatic symptoms.',
    icon: <Stethoscope className="w-5 h-5" stroke={AUTHI_ICON_STROKE} />,
  },
  {
    claimType: 'ongoing-management',
    label: 'Ongoing Management',
    description: 'Record monitoring visits and treatment protocols for this patient.',
    icon: <Activity className="w-5 h-5" stroke={AUTHI_ICON_STROKE} />,
  },
  {
    claimType: 'medication-report',
    label: 'Medication Report',
    description: 'Follow-up notes and new prescriptions for a chronic patient.',
    icon: <Pill className="w-5 h-5" stroke={AUTHI_ICON_STROKE} />,
  },
  {
    claimType: 'referral',
    label: 'Referral',
    description: 'Generate a specialist referral letter for this patient.',
    icon: <FileSymlink className="w-5 h-5" stroke={AUTHI_ICON_STROKE} />,
  },
];

const PatientProfile = ({
  profileId,
  cases,
  onViewClaim,
  onNewCaseAction,
  onViewPatientRecord,
  onBack,
  userRole,
}: PatientProfileProps) => {
  const [showCaseActions, setShowCaseActions] = useState(false);
  const isDoctor = userRole === 'doctor';
  const isAssistant = userRole === 'assistant';

  const portfolioCardClass = 'bg-white rounded-2xl border border-slate-200 shadow-sm';

  const sortedCases = [...cases].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const patient = sortedCases[0];
  const medicalPatientId = patient?.patientId ?? '';
  const enrollmentStatus = getPatientEnrollmentStatus(cases, medicalPatientId);
  const filteredCaseActions =
    enrollmentStatus === 'unregistered'
      ? caseActionOptions.filter((o) => o.claimType === 'diagnostic')
      : caseActionOptions;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest text-slate-400">Patient Portfolio</p>
            <h1 className="text-2xl font-semibold text-slate-900">{patient?.patientName ?? 'Patient'}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isAssistant && (
              <button
                type="button"
                onClick={() => onViewPatientRecord(profileId)}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 bg-white text-slate-800 text-sm font-semibold rounded-xl hover:border-[#6366f1]/40 hover:bg-slate-50 transition"
              >
                <FileText className="w-4 h-4 text-[#6366f1]" />
                View patient record
              </button>
            )}
            {isDoctor && (
              <button
                type="button"
                onClick={() => setShowCaseActions((v) => !v)}
                className="flex items-center gap-2 px-5 py-2.5 authi-gradient text-white text-sm font-semibold rounded-xl hover:opacity-90 transition shadow-md shadow-[#6366f1]/20"
              >
                + New Case Action
                {showCaseActions ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Inline case action panel */}
        {showCaseActions && isDoctor && (
          <div className="border-t border-slate-200 bg-slate-50">
            <div className="max-w-5xl mx-auto px-6 py-5">
              <p className="text-xs uppercase tracking-widest text-slate-900 font-semibold mb-4">
                Select a case action for {patient?.patientName}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredCaseActions.map((opt) => (
                  <button
                    key={opt.claimType}
                    type="button"
                    onClick={() => {
                      setShowCaseActions(false);
                      onNewCaseAction(profileId, opt.claimType);
                    }}
                    className="authi-action-card-gradient-border"
                  >
                    <span className="flex items-center gap-2 font-semibold text-sm">
                      <span className="authi-icon-gradient">{opt.icon}</span>
                      <span className="authi-gradient-text">{opt.label}</span>
                    </span>
                    <span className="text-xs leading-relaxed text-slate-500">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Patient Info Card */}
        {patient && (
          <div className={`${portfolioCardClass} p-6 mb-6`}>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <User className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{patient.patientName}</h2>
                <p className="text-sm text-slate-500">
                  ID: <span className="font-mono text-slate-700">{patient.patientId}</span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                ['Medical Aid', patient.medicalAidNumber || '—'],
                ['Scheme', patient.medicalScheme === 'gems' ? 'GEMS' : 'Discovery Health'],
                ['CIB Status', patient.cibEnrollmentStatus === 'registered' ? 'Registered' : 'Not registered'],
                ['Plan', patient.plan],
                ['Email', patient.patientEmail || '—'],
                ['Phone', patient.patientPhone || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-slate-400 text-xs uppercase tracking-wide">{label}</p>
                  <p className="text-slate-900 mt-1 font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Claims List */}
        <div className={`${portfolioCardClass} overflow-hidden`}>
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Claims ({sortedCases.length})</h3>
          </div>

          {sortedCases.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {sortedCases.map((claim) => {
                const ct = claim.claimType
                  ? claimTypeBadge[claim.claimType]
                  : { label: 'Intake', className: 'bg-slate-100 text-slate-500 border border-slate-200' };
                const st = statusBadge[claim.status] ?? {
                  label: claim.status,
                  className: 'bg-slate-100 text-slate-500',
                };
                return (
                  <div
                    key={claim.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ct.className}`}>
                          {ct.label}
                        </span>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${st.className}`}>
                          {st.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {claim.condition || 'No condition recorded'}
                        {claim.icdCode ? ` — ${claim.icdCode}` : ''}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {format(new Date(claim.createdAt), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <button
                      onClick={() => onViewClaim(claim.id)}
                      className="ml-4 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Eye className="w-4 h-4 shrink-0" />
                      {claim.status === 'completed' ? 'View Claim' : 'View Case'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-slate-400">No claims yet for this patient.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientProfile;
