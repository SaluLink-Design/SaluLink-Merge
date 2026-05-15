import { useState } from 'react';
import { Search, Filter, Download, Plus, ChevronDown } from 'lucide-react';

type CaseStatus = 'new' | 'in-progress' | 'pending-review' | 'completed';

interface PatientCase {
  id: string;
  patientName: string;
  condition: string;
  icdCode: string;
  status: CaseStatus;
  lastUpdated: string;
  plan: string;
}

const MOCK_CASES: PatientCase[] = [
  { id: 'C001', patientName: 'John Smith', condition: 'Diabetes Type 2', icdCode: 'E11.9', status: 'new', lastUpdated: '2026-05-14', plan: 'Comprehensive' },
  { id: 'C002', patientName: 'Sarah Johnson', condition: 'Hypertension', icdCode: 'I10', status: 'in-progress', lastUpdated: '2026-05-13', plan: 'Executive' },
  { id: 'C003', patientName: 'Michael Brown', condition: 'Asthma', icdCode: 'J45.9', status: 'pending-review', lastUpdated: '2026-05-12', plan: 'Priority' },
  { id: 'C004', patientName: 'Emily Davis', condition: 'COPD', icdCode: 'J44.9', status: 'completed', lastUpdated: '2026-05-11', plan: 'Core' },
  { id: 'C005', patientName: 'David Wilson', condition: 'Rheumatoid Arthritis', icdCode: 'M06.9', status: 'in-progress', lastUpdated: '2026-05-10', plan: 'Saver' },
];

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');

  return (
    <div className="size-full bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">SaluLink Dashboard</h1>
        <p className="text-gray-600">Chronic Condition Management System</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white border-2 border-gray-300 p-6">
          <div className="text-gray-500 mb-2">Total Cases</div>
          <div className="text-3xl font-bold">142</div>
        </div>
        <div className="bg-white border-2 border-gray-300 p-6">
          <div className="text-gray-500 mb-2">New Cases</div>
          <div className="text-3xl font-bold">23</div>
        </div>
        <div className="bg-white border-2 border-gray-300 p-6">
          <div className="text-gray-500 mb-2">Pending Review</div>
          <div className="text-3xl font-bold">18</div>
        </div>
        <div className="bg-white border-2 border-gray-300 p-6">
          <div className="text-gray-500 mb-2">Completed</div>
          <div className="text-3xl font-bold">89</div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white border-2 border-gray-300 p-4 mb-6">
        <div className="flex gap-4 items-center">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search patients, conditions, or ICD codes..."
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 focus:outline-none focus:border-gray-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter by Status */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <select
              className="pl-10 pr-8 py-2 border-2 border-gray-300 bg-white appearance-none focus:outline-none focus:border-gray-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="in-progress">In Progress</option>
              <option value="pending-review">Pending Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              className="pl-4 pr-8 py-2 border-2 border-gray-300 bg-white appearance-none focus:outline-none focus:border-gray-500"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="date">Sort: Date</option>
              <option value="patient">Sort: Patient</option>
              <option value="condition">Sort: Condition</option>
              <option value="status">Sort: Status</option>
            </select>
          </div>

          {/* New Case Button */}
          <button className="px-6 py-2 bg-gray-800 text-white flex items-center gap-2 hover:bg-gray-700">
            <Plus size={20} />
            New Case
          </button>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white border-2 border-gray-300">
        {/* Table Header */}
        <div className="grid grid-cols-7 gap-4 p-4 bg-gray-100 border-b-2 border-gray-300 font-bold">
          <div>Case ID</div>
          <div>Patient Name</div>
          <div>Condition</div>
          <div>ICD-10 Code</div>
          <div>Medical Plan</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {/* Table Rows */}
        {MOCK_CASES.map((caseItem) => (
          <div
            key={caseItem.id}
            className="grid grid-cols-7 gap-4 p-4 border-b border-gray-200 hover:bg-gray-50"
          >
            <div className="font-mono">{caseItem.id}</div>
            <div>{caseItem.patientName}</div>
            <div>{caseItem.condition}</div>
            <div className="font-mono">{caseItem.icdCode}</div>
            <div>{caseItem.plan}</div>
            <div>
              <span
                className={`px-3 py-1 text-sm border ${
                  caseItem.status === 'new'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : caseItem.status === 'in-progress'
                    ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                    : caseItem.status === 'pending-review'
                    ? 'bg-orange-50 border-orange-300 text-orange-700'
                    : 'bg-green-50 border-green-300 text-green-700'
                }`}
              >
                {caseItem.status}
              </span>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 border-2 border-gray-300 hover:bg-gray-100">
                View
              </button>
              <button className="px-3 py-1 border-2 border-gray-300 hover:bg-gray-100">
                <Download size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="mt-6 flex justify-between items-center">
        <div className="text-gray-600">Showing 5 of 142 cases</div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border-2 border-gray-300 hover:bg-gray-100">
            Previous
          </button>
          <button className="px-4 py-2 border-2 border-gray-300 bg-gray-800 text-white">
            1
          </button>
          <button className="px-4 py-2 border-2 border-gray-300 hover:bg-gray-100">
            2
          </button>
          <button className="px-4 py-2 border-2 border-gray-300 hover:bg-gray-100">
            3
          </button>
          <button className="px-4 py-2 border-2 border-gray-300 hover:bg-gray-100">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}