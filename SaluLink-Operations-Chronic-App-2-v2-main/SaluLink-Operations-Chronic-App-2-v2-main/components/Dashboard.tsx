'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, Plus, ChevronDown, Download, Eye } from 'lucide-react';
import { PatientCase } from '@/types';
import { format } from 'date-fns';

interface DashboardProps {
  cases: PatientCase[];
  onNewCase: () => void;
  onViewCase: (caseId: string) => void;
  totalStats?: {
    total: number;
    new: number;
    inProgress: number;
    completed: number;
  };
  practiceName?: string;
  userRole?: string | null;
  onLogout?: () => void;
}

const Dashboard = ({ cases, onNewCase, onViewCase, totalStats, practiceName, userRole, onLogout }: DashboardProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

  const getStatusDisplay = (status: string) => {
    const statusMap: { [key: string]: { label: string; className: string } } = {
      'new': { label: 'new', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
      'draft': { label: 'draft', className: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
      'diagnostic': { label: 'pending-review', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
      'ongoing': { label: 'in-progress', className: 'bg-green-100 text-green-700 border border-green-200' },
      'completed': { label: 'completed', className: 'bg-green-100 text-green-700 border border-green-200' },
    };
    return statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  };

  const filteredAndSortedCases = useMemo(() => {
    let filtered = cases;

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.condition.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.icdCode.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.patientName.localeCompare(b.patientName);
        case 'date':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return sorted;
  }, [cases, searchTerm, statusFilter, sortBy]);

  const stats = totalStats || {
    total: cases.length,
    new: cases.filter(c => c.status === 'new').length,
    inProgress: cases.filter(c => c.status === 'ongoing' || c.status === 'diagnostic').length,
    completed: cases.filter(c => c.status === 'completed').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">SaluLink Dashboard</h1>
              <p className="text-gray-600 mt-1">Chronic Condition Management System</p>
            </div>
            {(practiceName || userRole) && (
              <div className="rounded-3xl bg-slate-800 px-5 py-4 text-white shadow-sm">
                <p className="text-sm text-slate-300">Practice</p>
                <p className="mt-1 text-lg font-semibold text-white">{practiceName || 'Your practice'}</p>
                <p className="text-sm text-slate-400">Role: {userRole === 'assistant' ? 'Assistant' : userRole === 'doctor' ? 'Doctor' : 'Guest'}</p>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition"
                  >
                    Logout
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm font-medium">Total Cases</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm font-medium">New Cases</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.new}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm font-medium">Pending Review</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.inProgress}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm font-medium">Completed</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.completed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search and Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients, conditions, or ICD codes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filters */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 bg-white"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="draft">Draft</option>
              <option value="diagnostic">Pending Review</option>
              <option value="ongoing">In Progress</option>
              <option value="completed">Completed</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'name')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="date">Sort: Date</option>
              <option value="name">Sort: Name</option>
            </select>

            {/* New Case Button */}
            <button
              onClick={onNewCase}
              className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              New Case
            </button>
          </div>

          {/* Results Count */}
          <p className="text-sm text-gray-500">
            Showing {filteredAndSortedCases.length} of {cases.length} case(s)
          </p>
        </div>

        {/* Cases Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {filteredAndSortedCases.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Case ID</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Patient Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Condition</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ICD-10 Code</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Medical Plan</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedCases.map((caseItem) => {
                    const statusDisplay = getStatusDisplay(caseItem.status);
                    return (
                      <tr key={caseItem.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{caseItem.id.slice(0, 8)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{caseItem.patientName}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{caseItem.condition}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{caseItem.icdCode}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{caseItem.plan || '-'}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusDisplay.className}`}>
                            {statusDisplay.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => onViewCase(caseItem.id)}
                            className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
                          >
                            <Eye className="w-4 h-4" />
                            View
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
              <p className="text-gray-500 text-lg">No cases found</p>
              <p className="text-gray-400 text-sm mt-1">Create a new case to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
