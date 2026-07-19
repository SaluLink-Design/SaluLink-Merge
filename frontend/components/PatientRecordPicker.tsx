'use client';

import { useMemo, useState } from 'react';
import { Search, User } from 'lucide-react';
import { format } from 'date-fns';
import type { PatientCase } from '@/types';
import { buildPatientRecord } from '@/lib/patientRecord';
import { groupCasesByProfile } from '@/lib/patientPortfolio';

interface PatientRecordPickerProps {
  cases: PatientCase[];
  onSelectPatient: (profileId: string) => void;
  onBack: () => void;
}

const PatientRecordPicker = ({ cases, onSelectPatient, onBack }: PatientRecordPickerProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  const patientGroups = useMemo(() => {
    const groups = groupCasesByProfile(cases).map((g) => ({
      profileId: g.profileId,
      patientId: g.patientId,
      patientName: g.patientName,
      claimCount: g.claims.length,
      latestUpdated: new Date(g.latestClaim.updatedAt),
    }));

    if (!searchTerm.trim()) return groups;
    const q = searchTerm.toLowerCase();
    return groups.filter(
      (g) =>
        g.patientName.toLowerCase().includes(q) || g.patientId.toLowerCase().includes(q)
    );
  }, [cases, searchTerm]);

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <p className="text-xs tracking-wide mb-2 font-bold authi-gradient-text">Reports</p>
          <h1 className="text-4xl font-semibold text-slate-900">Patient records</h1>
          <p className="text-slate-500 mt-1">
            Select a patient to view their full medical record, lab results, and testing history.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by patient name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <p className="text-sm text-slate-400 mt-3">
            {patientGroups.length} patient{patientGroups.length !== 1 ? 's' : ''} found
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {patientGroups.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {patientGroups.map((group) => {
                const record = buildPatientRecord(cases, group.profileId);
                const labCount = record?.labResults.length ?? 0;
                const conditionCount = record?.conditions.length ?? 0;

                return (
                  <button
                    key={group.profileId}
                    type="button"
                    onClick={() => onSelectPatient(group.profileId)}
                    className="w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{group.patientName}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{group.patientId}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {group.claimCount} claim{group.claimCount !== 1 ? 's' : ''}
                        {conditionCount > 0 && ` · ${conditionCount} condition${conditionCount !== 1 ? 's' : ''}`}
                        {labCount > 0 && ` · ${labCount} lab entr${labCount !== 1 ? 'ies' : 'y'}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400">
                        Updated {format(group.latestUpdated, 'dd MMM yyyy')}
                      </p>
                      <span className="badge-blue mt-2">
                        Open record
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 px-6">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium">No patients found</p>
              <p className="text-sm text-slate-400 mt-1">
                {cases.length === 0
                  ? 'Create a patient case first to build a medical record.'
                  : 'Try a different search term.'}
              </p>
              <button
                type="button"
                onClick={onBack}
                className="mt-6 authi-btn-secondary px-5 py-2.5 text-sm rounded-xl"
              >
                Back to dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientRecordPicker;
