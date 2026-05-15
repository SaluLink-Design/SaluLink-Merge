'use client';

import { useState, useMemo } from 'react';
import { Search, X, FolderOpen, Clock, CheckCircle, ArrowLeft, Calendar, FileText } from 'lucide-react';
import { PatientCase } from '@/types';
import { format } from 'date-fns';

interface AllCasesViewProps {
  cases: PatientCase[];
  onLoadCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
  onClose: () => void;
}

const AllCasesView = ({ cases, onLoadCase, onDeleteCase, onClose }: AllCasesViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PatientCase['status']>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'condition'>('date');

  const getStatusColor = (status: PatientCase['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'ongoing':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'diagnostic':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: PatientCase['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'ongoing':
        return <Clock className="w-4 h-4" />;
      default:
        return <FolderOpen className="w-4 h-4" />;
    }
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
        case 'condition':
          return a.condition.localeCompare(b.condition);
        case 'date':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return sorted;
  }, [cases, searchTerm, statusFilter, sortBy]);

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-hidden">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">All Patient Cases</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    {filteredAndSortedCases.length} of {cases.length} case(s)
                  </p>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-wrap gap-4">
              {/* Search */}
              <div className="flex-1 min-w-[300px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by patient name, ID, condition, or ICD code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="diagnostic">Diagnostic</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="date">Sort by Date</option>
                <option value="name">Sort by Name</option>
                <option value="condition">Sort by Condition</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cases Grid */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-7xl mx-auto px-6 py-6">
            {filteredAndSortedCases.length === 0 ? (
              <div className="text-center py-20">
                <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  {searchTerm || statusFilter !== 'all' ? 'No cases found' : 'No saved cases yet'}
                </h3>
                <p className="text-gray-500">
                  {searchTerm || statusFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Create your first patient case to get started'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAndSortedCases.map((patientCase) => (
                  <div
                    key={patientCase.id}
                    className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-primary-300 hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => {
                      onLoadCase(patientCase.id);
                      onClose();
                    }}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {patientCase.patientName}
                        </h3>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          ID: {patientCase.patientId}
                        </p>
                      </div>
                      <div
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-semibold border ${getStatusColor(
                          patientCase.status
                        )}`}
                      >
                        {getStatusIcon(patientCase.status)}
                        <span className="capitalize">{patientCase.status}</span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="space-y-3 mb-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Condition</p>
                        <p className="text-sm font-semibold text-gray-900">{patientCase.condition}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">ICD Code</p>
                          <p className="text-sm font-mono font-semibold text-gray-900">
                            {patientCase.icdCode}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Plan</p>
                          <p className="text-sm font-semibold text-gray-900">{patientCase.plan}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(patientCase.updatedAt), 'MMM dd, yyyy')}
                        </div>
                        {(patientCase.medicationReports?.length || 0) > 0 && (
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {patientCase.medicationReports?.length} report(s)
                          </span>
                        )}
                        {(patientCase.referrals?.length || 0) > 0 && (
                          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                            {patientCase.referrals?.length} referral(s)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex gap-2 pt-4 border-t border-gray-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLoadCase(patientCase.id);
                          onClose();
                        }}
                        className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors"
                      >
                        Open Case
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete case for ${patientCase.patientName}?`)) {
                            onDeleteCase(patientCase.id);
                          }
                        }}
                        className="px-4 py-2.5 bg-red-50 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllCasesView;
