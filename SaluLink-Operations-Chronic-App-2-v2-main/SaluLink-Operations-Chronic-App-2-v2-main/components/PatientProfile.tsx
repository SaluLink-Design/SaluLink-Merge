'use client';

import { useState } from 'react';
import { ArrowLeft, Eye, User, Activity, Pill, FileSymlink, ChevronDown, ChevronUp, Stethoscope } from 'lucide-react';
import { PatientCase, ClaimType } from '@/types';
import { format } from 'date-fns';

interface PatientProfileProps {
  patientId: string;
  cases: PatientCase[];
  onViewClaim: (caseId: string) => void;
  onNewCaseAction: (patientId: string, claimType: ClaimType) => void;
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

const caseActionOptions: { claimType: ClaimType; label: string; description: string; icon: React.ReactNode; borderColor: string; textColor: string }[] = [
  {
    claimType: 'diagnostic',
    label: 'Diagnostic Claim',
    description: 'Identify a new or changed condition — e.g. a patient with hypertension presenting with new asthmatic symptoms.',
    icon: <Stethoscope className="w-5 h-5" />,
    borderColor: 'border-blue-200 hover:border-blue-400',
    textColor: 'text-blue-600',
  },
  {
    claimType: 'ongoing-management',
    label: 'Ongoing Management',
    description: 'Record monitoring visits and treatment protocols for this patient.',
    icon: <Activity className="w-5 h-5" />,
    borderColor: 'border-emerald-200 hover:border-emerald-400',
    textColor: 'text-emerald-600',
  },
  {
    claimType: 'medication-report',
    label: 'Medication Report',
    description: 'Follow-up notes and new prescriptions for a chronic patient.',
    icon: <Pill className="w-5 h-5" />,
    borderColor: 'border-violet-200 hover:border-violet-400',
    textColor: 'text-violet-600',
  },
  {
    claimType: 'referral',
    label: 'Referral',
    description: 'Generate a specialist referral letter for this patient.',
    icon: <FileSymlink className="w-5 h-5" />,
    borderColor: 'border-orange-200 hover:border-orange-400',
    textColor: 'text-orange-600',
  },
];

const PatientProfile = ({ patientId, cases, onViewClaim, onNewCaseAction, onBack, userRole }: PatientProfileProps) => {
  const [showCaseActions, setShowCaseActions] = useState(false);

  const sortedCases = [...cases].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const patient = sortedCases[0];

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
            <h1 className="text-2xl font-semibold text-slate-900">{patient?.patientName ?? patientId}</h1>
          </div>
          {userRole === 'doctor' && (
            <button
              onClick={() => setShowCaseActions((v) => !v)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-violet-600 text-white text-sm font-semibold rounded-xl hover:from-blue-600 hover:to-violet-700 transition shadow-md"
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

        {/* Inline case action panel */}
        {showCaseActions && userRole === 'doctor' && (
          <div className="border-t border-slate-200 bg-slate-50">
            <div className="max-w-5xl mx-auto px-6 py-5">
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-4">
                Select a case action for {patient?.patientName}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {caseActionOptions.map((opt) => (
                  <button
                    key={opt.claimType}
                    type="button"
                    onClick={() => {
                      setShowCaseActions(false);
                      onNewCaseAction(patientId, opt.claimType);
                    }}
                    className={`flex flex-col gap-2 rounded-2xl border-2 p-4 text-left transition-colors bg-white ${opt.borderColor}`}
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
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Patient Info Card */}
        {patient && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
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
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
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
                      className="ml-4 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Claim
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
