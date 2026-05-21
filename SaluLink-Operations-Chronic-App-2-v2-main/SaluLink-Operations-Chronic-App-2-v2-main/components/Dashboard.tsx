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
  'new': { label: 'New', className: 'bg-blue-50 text-blue-600' },
  'draft': { label: 'Draft', className: 'bg-yellow-50 text-yellow-700' },
  'diagnostic': { label: 'In Review', className: 'bg-orange-50 text-orange-700' },
  'ongoing': { label: 'In Progress', className: 'bg-green-50 text-green-700' },
  'completed': { label: 'Completed', className: 'bg-green-50 text-green-700' },
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
  userRole,
  onLogout,
}: DashboardProps) => {
  const [searchTerm, setSearchTerm] = useState('');

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                {userRole === 'assistant' ? 'Patient Records' : 'Patient Portfolio'}
              </h1>
              <p className="text-gray-600 mt-1">
                {userRole === 'assistant'
                  ? 'Create patient intake and download claim documents'
                  : 'Chronic Condition Management — grouped by patient'}
              </p>
            </div>
            {(practiceName || userRole) && (
              <div className="rounded-3xl bg-slate-800 px-5 py-4 text-white shadow-sm">
                <p className="text-sm text-slate-300">Practice</p>
                {practiceName && (
                  <p className="mt-1 text-lg font-semibold text-white">{practiceName}</p>
                )}
                <p className="text-sm text-slate-400">
                  Role: {userRole === 'assistant' ? 'Assistant' : userRole === 'doctor' ? 'Doctor' : 'Guest'}
                </p>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition"
                  >
                    {userRole === 'assistant' ? 'Back to workspace' : 'Logout'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm font-medium">Total Patients</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totalPatients}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm font-medium">Total Claims</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{cases.length}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm font-medium">Completed Claims</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totalCompleted}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search and Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients by name, ID, or condition..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {canCreateCase && (
              <button
                onClick={onNewCase}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                New Case
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-3">
            {patientGroups.length} patient{patientGroups.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Patient Portfolio Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {patientGroups.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Patient ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Total Claims
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Last Claim Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {patientGroups.map((group) => {
                    const ctBadge = claimTypeBadge[group.latestClaim.claimType ?? 'diagnostic'];
                    const stBadge = statusBadge[group.latestClaim.status] ?? { label: group.latestClaim.status, className: 'bg-gray-100 text-gray-600' };
                    return (
                      <tr key={group.patientId} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                              <User className="w-4 h-4 text-slate-500" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">{group.patientName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 font-mono">{group.patientId}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-semibold">{group.claims.length}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ctBadge.className}`}>
                            {ctBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${stBadge.className}`}>
                            {stBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {format(new Date(group.latestClaim.updatedAt), 'dd MMM yyyy')}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() =>
                              onViewPatientProfile
                                ? onViewPatientProfile(group.patientId)
                                : onViewCase(group.latestClaim.id)
                            }
                            className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 transition-colors"
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
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No patients found</p>
              <p className="text-gray-400 text-sm mt-1">
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
