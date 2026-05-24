'use client';

import { useState, useMemo } from 'react';
import { Search, Plus, User } from 'lucide-react';
import { PatientCase, ClaimType } from '@/types';
import { format } from 'date-fns';

interface DashboardProps {
  cases: PatientCase[];
  onNewCase: () => void;
  onViewCase: (caseId: string) => void;
  onViewPatientProfile?: (patientId: string) => void;
  canCreateCase?: boolean;
  practiceName?: string;
  doctorName?: string;
  assistantName?: string;
  userRole?: string | null;
  onLogout?: () => void;
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

interface PatientGroup {
  patientId: string;
  patientName: string;
  claims: PatientCase[];
  latestClaim: PatientCase;
}

const Dashboard = ({
  cases,
  onNewCase,
  onViewCase,
  onViewPatientProfile,
  canCreateCase = true,
  practiceName,
  doctorName,
  assistantName,
  userRole,
  onLogout,
}: DashboardProps) => {
  const displayName =
    userRole === 'assistant'
      ? assistantName || 'Assistant'
      : doctorName || 'Doctor';
  const isDoctor = userRole === 'doctor';
  const isAuthiBrand = isDoctor || userRole === 'assistant';
  const [searchTerm, setSearchTerm] = useState('');

  const contentPanelClass = isDoctor
    ? 'authi-gradient-border-panel'
    : `bg-white rounded-2xl border shadow-sm transition ${isAuthiBrand ? 'border-[#38b6ff]/40 hover:border-[#38b6ff]/55' : 'border-slate-200'}`;

  const renderBadge = (label: string, fallbackClassName: string) =>
    isAuthiBrand ? (
      <span className="authi-badge-pill">
        <span>{label}</span>
      </span>
    ) : (
      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${fallbackClassName}`}>
        {label}
      </span>
    );

  const patientGroups = useMemo(() => {
    const grouped = new Map<string, PatientCase[]>();
    for (const c of cases) {
      const key = c.patientId;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(c);
    }

    const groups: PatientGroup[] = [];
    grouped.forEach((claims, patientId) => {
      const sorted = [...claims].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      groups.push({
        patientId,
        patientName: sorted[0].patientName,
        claims: sorted,
        latestClaim: sorted[0],
      });
    });

    return groups
      .filter((g) => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
          g.patientName.toLowerCase().includes(q) ||
          g.patientId.toLowerCase().includes(q) ||
          g.latestClaim.condition.toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.latestClaim.updatedAt).getTime() -
          new Date(a.latestClaim.updatedAt).getTime()
      );
  }, [cases, searchTerm]);

  const totalPatients = useMemo(() => new Set(cases.map((c) => c.patientId)).size, [cases]);
  const totalCompleted = cases.filter((c) => c.status === 'completed').length;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-[#38b6ff]/25">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p
                className={`text-xs tracking-wide mb-2 font-bold ${
                  isDoctor ? 'authi-gradient-text' : isAuthiBrand ? 'text-[#38b6ff]' : 'text-slate-400'
                }`}
              >
                {displayName}
              </p>
              <h1 className="text-4xl font-semibold text-slate-900">
                {userRole === 'assistant' ? 'Patient Records' : 'Patient Portfolio'}
              </h1>
              <p className="text-slate-500 mt-1">
                {userRole === 'assistant'
                  ? 'Create patient intake and download claim documents'
                  : 'Chronic Condition Management — grouped by patient'}
              </p>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className={`self-start px-5 py-3 text-sm ${
                  isDoctor
                    ? 'authi-btn-gradient-border'
                    : isAuthiBrand
                      ? 'authi-btn-secondary'
                      : 'rounded-2xl border border-slate-300 bg-white font-semibold text-slate-700 hover:border-slate-400 transition'
                }`}
              >
                {userRole === 'assistant' ? 'Back to workspace' : 'Logout'}
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Patients', value: totalPatients },
              { label: 'Total Claims', value: cases.length },
              { label: 'Completed Claims', value: totalCompleted },
            ].map((stat) => (
              <div
                key={stat.label}
                className={
                  isDoctor
                    ? 'authi-gradient-border-stat'
                    : isAuthiBrand
                      ? 'authi-stat-card'
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
                  isDoctor
                    ? 'authi-input-gradient-border pl-10 pr-4 py-2.5'
                    : isAuthiBrand
                      ? 'authi-input pl-10 pr-4 py-2.5'
                      : `w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`
                }
              />
            </div>
            {canCreateCase && (
              <button
                onClick={onNewCase}
                className={`px-5 py-2.5 text-white rounded-xl transition font-semibold flex items-center gap-2 whitespace-nowrap shadow-md hover:opacity-90 ${isAuthiBrand ? 'authi-gradient shadow-[#6366f1]/20' : 'bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700'}`}
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

        {/* Patient Portfolio Table */}
        <div className={`${contentPanelClass} overflow-hidden`}>
          {patientGroups.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className={`bg-slate-50 border-0 ${
                      !isDoctor ? `border-b ${isAuthiBrand ? 'border-[#38b6ff]/20' : 'border-slate-200'}` : ''
                    }`}
                  >
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
                  {isDoctor && (
                    <tr aria-hidden="true" className="leading-[0]">
                      <td colSpan={7} className="p-0 border-0">
                        <div className="authi-gradient-line w-full" />
                      </td>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {patientGroups.map((group) => {
                    const ctBadge = group.latestClaim.claimType
                      ? claimTypeBadge[group.latestClaim.claimType]
                      : { label: 'Intake', className: 'bg-slate-100 text-slate-500 border border-slate-200' };
                    const stBadge = statusBadge[group.latestClaim.status] ?? {
                      label: group.latestClaim.status,
                      className: 'bg-slate-100 text-slate-500',
                    };
                    return (
                      <tr
                        key={group.patientId}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={
                                isAuthiBrand
                                  ? 'authi-avatar w-8 h-8'
                                  : 'w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center'
                              }
                            >
                              <User className={`w-4 h-4 ${isAuthiBrand ? 'text-white' : 'text-slate-400'}`} />
                            </div>
                            <span className="text-sm font-medium text-slate-900">{group.patientName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 font-mono">{group.patientId}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 font-semibold">{group.claims.length}</td>
                        <td className="px-6 py-4">{renderBadge(ctBadge.label, ctBadge.className)}</td>
                        <td className="px-6 py-4">{renderBadge(stBadge.label, stBadge.className)}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {format(new Date(group.latestClaim.updatedAt), 'dd MMM yyyy')}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() =>
                              onViewPatientProfile
                                ? onViewPatientProfile(group.patientId)
                                : onViewCase(group.latestClaim.id)
                            }
                            className={`px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition hover:opacity-90 ${isAuthiBrand ? 'authi-gradient shadow-sm shadow-[#6366f1]/15' : 'bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700'}`}
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
              <div
                className={
                  isAuthiBrand
                    ? 'authi-avatar-lg w-14 h-14 mx-auto mb-4'
                    : 'w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4'
                }
              >
                <User className={`w-7 h-7 ${isAuthiBrand ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <p className="text-slate-700 text-lg font-medium">No patients found</p>
              <p className="text-slate-400 text-sm mt-1">
                {canCreateCase ? 'Create a new case to get started' : 'No patient cases available yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
