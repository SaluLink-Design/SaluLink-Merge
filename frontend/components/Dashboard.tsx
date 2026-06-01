'use client';

import { useState, useMemo } from 'react';
import { Search, Plus, User, Send } from 'lucide-react';
import { PatientCase, ClaimType, DeliveryStatus } from '@/types';
import { format } from 'date-fns';
import { groupCasesByProfile } from '@/lib/patientPortfolio';

interface DashboardProps {
  cases: PatientCase[];
  onNewCase: () => void;
  onViewCase: (caseId: string) => void;
  onViewPatientProfile?: (profileId: string) => void;
  onSendToPatient?: (caseId: string) => void;
  canCreateCase?: boolean;
  practiceName?: string;
  doctorName?: string;
  assistantName?: string;
  userRole?: string | null;
  onBackToWorkspace?: () => void;
}

const claimTypeBadge: Record<ClaimType, { label: string; className: string }> = {
  'diagnostic': { label: 'Diagnostic', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  'ongoing-management': { label: 'Ongoing Mgmt', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  'medication-report': { label: 'Medication', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
  'referral': { label: 'Referral', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
};

const deliveryBadge: Record<DeliveryStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600 border border-slate-200' },
  ready_to_send: { label: 'Ready to send', className: 'bg-amber-100 text-amber-800 border border-amber-200' },
  sent_to_patient: { label: 'Sent', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
};

const statusBadge: Record<string, { label: string; className: string }> = {
  'new': { label: 'New', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  'draft': { label: 'Draft', className: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  'diagnostic': { label: 'In Review', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  'ongoing': { label: 'In Progress', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  'completed': { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
};

/** Doctor portfolio table only — matches original bordered pill design */
const doctorClaimBadgeClass: Record<ClaimType, string> = {
  diagnostic: 'badge-blue',
  'ongoing-management': 'badge-green',
  'medication-report': 'badge-purple',
  referral: 'badge-orange',
};

/** Status column only — green pill for completed (not blue like claim type) */
const DOCTOR_STATUS_PILL_BASE =
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border';

const doctorStatusPillClass = (status: PatientCase['status']): string => {
  switch (status) {
    case 'completed':
    case 'ongoing':
      return `${DOCTOR_STATUS_PILL_BASE} bg-emerald-100 text-emerald-700 !border-emerald-200`;
    case 'new':
      return `${DOCTOR_STATUS_PILL_BASE} bg-blue-100 text-blue-700 border-blue-200`;
    case 'draft':
      return `${DOCTOR_STATUS_PILL_BASE} bg-yellow-100 text-yellow-700 border-yellow-200`;
    case 'diagnostic':
      return `${DOCTOR_STATUS_PILL_BASE} bg-orange-100 text-orange-700 border-orange-200`;
    default:
      return `${DOCTOR_STATUS_PILL_BASE} bg-slate-100 text-slate-600 border-slate-200`;
  }
};

const Dashboard = ({
  cases,
  onNewCase,
  onViewCase,
  onViewPatientProfile,
  onSendToPatient,
  canCreateCase = true,
  practiceName,
  doctorName,
  assistantName,
  userRole,
  onBackToWorkspace,
}: DashboardProps) => {
  const displayName =
    userRole === 'assistant'
      ? assistantName || 'Assistant'
      : doctorName || 'Doctor';
  const isDoctor = userRole === 'doctor';
  const isAssistant = userRole === 'assistant';
  const isWorkspaceBrand = isDoctor || isAssistant;
  const [searchTerm, setSearchTerm] = useState('');

  const contentPanelClass = isWorkspaceBrand
    ? 'bg-white rounded-2xl border border-slate-200 shadow-sm transition'
    : 'bg-white rounded-2xl border border-slate-200 shadow-sm transition';

  const renderBadge = (label: string, fallbackClassName: string) => {
    if (isWorkspaceBrand) {
      return (
        <span className="authi-badge-pill-minimal">
          <span>{label}</span>
        </span>
      );
    }
    return (
      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${fallbackClassName}`}>
        {label}
      </span>
    );
  };

  const patientGroups = useMemo(() => {
    const groups = groupCasesByProfile(cases);
    if (!searchTerm) return groups;
    const q = searchTerm.toLowerCase();
    return groups.filter(
      (g) =>
        g.patientName.toLowerCase().includes(q) ||
        g.patientId.toLowerCase().includes(q) ||
        g.latestClaim.condition.toLowerCase().includes(q)
    );
  }, [cases, searchTerm]);

  const totalPatients = useMemo(() => groupCasesByProfile(cases).length, [cases]);
  const totalCompleted = cases.filter((c) => c.status === 'completed').length;
  const readyToSend = cases.filter((c) => c.deliveryStatus === 'ready_to_send').length;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className={`bg-white border-b ${isWorkspaceBrand ? 'border-slate-200' : 'border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p
                className={`text-xs tracking-wide mb-2 font-bold ${
                  isWorkspaceBrand ? 'authi-gradient-text' : 'text-slate-400'
                }`}
              >
                {displayName}
              </p>
              <h1 className="text-4xl font-semibold text-slate-900">
                {isAssistant ? 'Patient Records' : 'Patient Portfolio'}
              </h1>
              <p className="text-slate-500 mt-1">
                {isAssistant
                  ? 'Patient intake and claim documents — grouped by patient'
                  : 'Chronic Condition Management — grouped by patient'}
              </p>
            </div>
            {onBackToWorkspace && (
              <button
                type="button"
                onClick={onBackToWorkspace}
                className="self-start px-5 py-3 text-sm rounded-2xl font-semibold transition hover:opacity-90 authi-btn-primary text-white"
              >
                Back to workspace
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Patients', value: totalPatients },
              { label: 'Total Claims', value: cases.length },
              { label: 'Completed Claims', value: totalCompleted },
              ...(readyToSend > 0 ? [{ label: 'Ready to Send', value: readyToSend }] : []),
            ].map((stat) => (
              <div
                key={stat.label}
                className={
                  isWorkspaceBrand
                    ? 'bg-slate-50 border border-slate-200 rounded-2xl p-6'
                    : 'bg-slate-50 border border-slate-200 rounded-2xl p-6'
                }
              >
                <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search and Controls */}
        <div className={`${contentPanelClass} p-5 mb-6`}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search patients by name, ID, or condition..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={
                  isWorkspaceBrand
                    ? 'w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition'
                    : 'w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition'
                }
              />
            </div>
            {canCreateCase && (
              <button
                onClick={onNewCase}
                className={`px-5 py-2.5 text-white rounded-xl transition font-semibold flex items-center gap-2 whitespace-nowrap shadow-md hover:opacity-90 authi-gradient shadow-[#6366f1]/20`}
              >
                <Plus className="w-4 h-4" />
                New Case
              </button>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-3">
            {patientGroups.length} patient{patientGroups.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Patient Portfolio Table — doctor & assistant share the same layout */}
        {isWorkspaceBrand ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {patientGroups.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Patient ID
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Total Claims
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Last Claim Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Last Updated
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientGroups.map((group) => {
                      const ctLabel = group.latestClaim.claimType
                        ? claimTypeBadge[group.latestClaim.claimType].label
                        : 'Intake';
                      const ctClass = group.latestClaim.claimType
                        ? doctorClaimBadgeClass[group.latestClaim.claimType]
                        : 'badge-slate';
                      const stLabel =
                        statusBadge[group.latestClaim.status]?.label ?? group.latestClaim.status;
                      const stClass = doctorStatusPillClass(group.latestClaim.status);

                      return (
                        <tr
                          key={group.profileId}
                          className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                                <User className="w-4 h-4 text-slate-400" />
                              </div>
                              <span className="text-sm font-semibold text-slate-900">
                                {group.patientName}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">{group.patientId}</td>
                          <td className="px-6 py-4 text-sm text-slate-900 font-semibold">
                            {group.claims.length}
                          </td>
                          <td className="px-6 py-4">
                            <span className={ctClass}>{ctLabel}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={stClass}>{stLabel}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {format(new Date(group.latestClaim.updatedAt), 'dd MMM yyyy')}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() =>
                                onViewPatientProfile
                                  ? onViewPatientProfile(group.profileId)
                                  : onViewCase(group.latestClaim.id)
                              }
                              className="authi-btn-primary px-3 py-1.5 text-white text-xs font-semibold rounded-lg"
                            >
                              View Profile
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4">
                  <User className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-slate-700 text-lg font-medium">No patients found</p>
                <p className="text-slate-400 text-sm mt-1">Create a new case to get started</p>
              </div>
            )}
          </div>
        ) : (
        <div className={`${contentPanelClass} overflow-hidden`}>
          {patientGroups.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Patient ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Total Claims
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Last Claim Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Delivery
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {patientGroups.map((group) => {
                    const ctBadge = group.latestClaim.claimType
                      ? claimTypeBadge[group.latestClaim.claimType]
                      : { label: 'Intake', className: 'bg-slate-100 text-slate-500 border border-slate-200' };
                    const stBadge = statusBadge[group.latestClaim.status] ?? {
                      label: group.latestClaim.status,
                      className: 'bg-slate-100 text-slate-500 border border-slate-200',
                    };
                    return (
                      <tr
                        key={group.profileId}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                              <User className="w-4 h-4 text-slate-400" />
                            </div>
                            <span className="text-sm font-medium text-slate-900">{group.patientName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 font-mono">{group.patientId}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 font-semibold">{group.claims.length}</td>
                        <td className="px-6 py-4">{renderBadge(ctBadge.label, ctBadge.className)}</td>
                        <td className="px-6 py-4">{renderBadge(stBadge.label, stBadge.className)}</td>
                        <td className="px-6 py-4">
                          {renderBadge(
                            deliveryBadge[group.latestClaim.deliveryStatus ?? 'draft'].label,
                            deliveryBadge[group.latestClaim.deliveryStatus ?? 'draft'].className
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {format(new Date(group.latestClaim.updatedAt), 'dd MMM yyyy')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() =>
                                onViewPatientProfile
                                  ? onViewPatientProfile(group.profileId)
                                  : onViewCase(group.latestClaim.id)
                              }
                              className="authi-btn-primary px-3 py-1.5 text-white text-xs font-semibold rounded-lg"
                            >
                              View Profile
                            </button>
                            {onSendToPatient &&
                              group.latestClaim.deliveryStatus === 'ready_to_send' &&
                              group.latestClaim.patientEmail && (
                                <button
                                  type="button"
                                  onClick={() => onSendToPatient(group.latestClaim.id)}
                                  className="px-3 py-1.5 border border-emerald-300 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-50 flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" />
                                  Send
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4">
                <User className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-slate-700 text-lg font-medium">No patients found</p>
              <p className="text-slate-400 text-sm mt-1">
                {canCreateCase ? 'Create a new case to get started' : 'No patient cases available yet'}
              </p>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
