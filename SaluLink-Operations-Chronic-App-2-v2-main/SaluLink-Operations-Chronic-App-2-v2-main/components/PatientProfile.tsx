'use client';

import { useState } from 'react';
import { ArrowLeft, Eye, User, Activity, Pill, FileSymlink, ChevronDown, ChevronUp } from 'lucide-react';
import { PatientCase, ClaimType } from '@/types';
import { format } from 'date-fns';

interface PatientProfileProps {
  patientId: string;
  cases: PatientCase[];
  onViewClaim: (caseId: string) => void;
  /** Called when doctor picks a case action — bypasses PatientInfoForm */
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
  'new': { label: 'New', className: 'bg-blue-50 text-blue-600' },
  'draft': { label: 'Draft', className: 'bg-yellow-50 text-yellow-700' },
  'diagnostic': { label: 'In Review', className: 'bg-orange-50 text-orange-700' },
  'ongoing': { label: 'In Progress', className: 'bg-green-50 text-green-700' },
  'completed': { label: 'Completed', className: 'bg-green-50 text-green-700' },
};

const caseActionOptions: { claimType: ClaimType; label: string; description: string; icon: React.ReactNode; color: string }[] = [
  {
    claimType: 'ongoing-management',
    label: 'Ongoing Management',
    description: 'Record monitoring visits and treatment protocols for this patient.',
    icon: <Activity className="w-5 h-5" />,
    color: 'emerald',
  },
  {
    claimType: 'medication-report',
    label: 'Medication Report',
    description: 'Follow-up notes and new prescriptions for a chronic patient.',
    icon: <Pill className="w-5 h-5" />,
    color: 'violet',
  },
  {
    claimType: 'referral',
    label: 'Referral',
    description: 'Generate a specialist referral letter for this patient.',
    icon: <FileSymlink className="w-5 h-5" />,
    color: 'orange',
  },
];

const colorClasses: Record<string, { border: string; bg: string; text: string; hover: string }> = {
  emerald: {
    border: 'border-emerald-200 hover:border-emerald-500',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    hover: 'hover:bg-emerald-100',
  },
  violet: {
    border: 'border-violet-200 hover:border-violet-500',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    hover: 'hover:bg-violet-100',
  },
  orange: {
    border: 'border-orange-200 hover:border-orange-500',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    hover: 'hover:bg-orange-100',
  },
};

const PatientProfile = ({ patientId, cases, onViewClaim, onNewCaseAction, onBack, userRole }: PatientProfileProps) => {
  const [showCaseActions, setShowCaseActions] = useState(false);

  const sortedCases = [...cases].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const patient = sortedCases[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest text-gray-400">Patient Portfolio</p>
            <h1 className="text-2xl font-bold text-gray-900">{patient?.patientName ?? patientId}</h1>
          </div>
          {userRole === 'doctor' && (
            <button
              onClick={() => setShowCaseActions((v) => !v)}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors"
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
          <div className="border-t border-gray-100 bg-gray-50">
            <div className="max-w-5xl mx-auto px-6 py-5">
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">
                Select a case action for {patient?.patientName}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {caseActionOptions.map((opt) => {
                  const c = colorClasses[opt.color];
                  return (
                    <button
                      key={opt.claimType}
                      type="button"
                      onClick={() => {
                        setShowCaseActions(false);
                        onNewCaseAction(patientId, opt.claimType);
                      }}
                      className={`flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-colors bg-white ${c.border}`}
                    >
                      <span className={`flex items-center gap-2 font-semibold text-sm ${c.text}`}>
                        {opt.icon}
                        {opt.label}
                      </span>
                      <span className="text-xs leading-relaxed text-gray-500">{opt.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Patient Info Card */}
        {patient && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                <User className="w-7 h-7 text-slate-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{patient.patientName}</h2>
                <p className="text-sm text-gray-500">
                  ID: <span className="font-mono">{patient.patientId}</span>
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
                  <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
                  <p className="text-gray-800 mt-1 font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Claims List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Claims ({sortedCases.length})</h3>
          </div>

          {sortedCases.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {sortedCases.map((claim) => {
                const ct = claimTypeBadge[claim.claimType ?? 'diagnostic'];
                const st = statusBadge[claim.status] ?? {
                  label: claim.status,
                  className: 'bg-gray-100 text-gray-600',
                };
                return (
                  <div
                    key={claim.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ct.className}`}
                        >
                          {ct.label}
                        </span>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${st.className}`}
                        >
                          {st.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {claim.condition || 'No condition recorded'}
                        {claim.icdCode ? ` — ${claim.icdCode}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
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
              <p className="text-gray-400">No claims yet for this patient.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientProfile;
