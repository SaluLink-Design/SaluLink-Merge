'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Activity,
  FlaskConical,
  Scan,
  Stethoscope,
  HeartPulse,
  Pill,
  Calendar,
  FileSymlink,
  User,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import type { PatientCase } from '@/types';
import {
  buildPatientRecord,
  claimTypeLabel,
  sectionRecordCount,
  type PatientRecord,
  type PatientRecordSectionId,
  type PatientRecordTestRow,
} from '@/lib/patientRecord';

interface PatientRecordViewProps {
  cases: PatientCase[];
  profileId: string;
  onViewClaim: (caseId: string) => void;
  onChangePatient: () => void;
  onBack: () => void;
}

const sectionMeta: {
  id: PatientRecordSectionId;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'conditions',
    title: 'Diagnoses & conditions',
    subtitle: 'Chronic conditions and ICD codes across claims',
    icon: <Activity className="w-6 h-6" stroke="url(#authi-stroke-gradient)" />,
  },
  {
    id: 'labs',
    title: 'Lab results',
    subtitle: 'Pathology and laboratory tests from diagnostic & ongoing care',
    icon: <FlaskConical className="w-6 h-6" stroke="url(#authi-stroke-gradient)" />,
  },
  {
    id: 'imaging',
    title: 'Imaging',
    subtitle: 'Radiology and imaging studies with documentation',
    icon: <Scan className="w-6 h-6" stroke="url(#authi-stroke-gradient)" />,
  },
  {
    id: 'diagnostic',
    title: 'Diagnostic testing',
    subtitle: 'Other diagnostic basket tests and procedures',
    icon: <Stethoscope className="w-6 h-6" stroke="url(#authi-stroke-gradient)" />,
  },
  {
    id: 'ongoing',
    title: 'Ongoing monitoring',
    subtitle: 'Treatment basket monitoring from ongoing management claims',
    icon: <HeartPulse className="w-6 h-6" stroke="url(#authi-stroke-gradient)" />,
  },
  {
    id: 'medications',
    title: 'Medications',
    subtitle: 'Chronic medicines and medication report changes',
    icon: <Pill className="w-6 h-6" stroke="url(#authi-stroke-gradient)" />,
  },
  {
    id: 'visits',
    title: 'Visits & clinical notes',
    subtitle: 'Claim timeline with clinical note excerpts',
    icon: <Calendar className="w-6 h-6" stroke="url(#authi-stroke-gradient)" />,
  },
  {
    id: 'referrals',
    title: 'Referrals',
    subtitle: 'Specialist referrals generated for this patient',
    icon: <FileSymlink className="w-6 h-6" stroke="url(#authi-stroke-gradient)" />,
  },
];

const DocumentedBadge = ({ documented }: { documented: boolean }) => (
  <span
    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
      documented
        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
        : 'bg-amber-100 text-amber-800 border border-amber-200'
    }`}
  >
    {documented ? 'Documented' : 'Pending docs'}
  </span>
);

const TestTable = ({
  rows,
  onViewClaim,
  showUsage = false,
}: {
  rows: PatientRecordTestRow[];
  onViewClaim: (caseId: string) => void;
  showUsage?: boolean;
}) => {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 py-4">No records in this category yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            <th className="py-2 pr-4 text-xs font-semibold text-slate-500 uppercase">Test / procedure</th>
            <th className="py-2 pr-4 text-xs font-semibold text-slate-500 uppercase">Code</th>
            <th className="py-2 pr-4 text-xs font-semibold text-slate-500 uppercase">Date</th>
            <th className="py-2 pr-4 text-xs font-semibold text-slate-500 uppercase">Claim</th>
            <th className="py-2 pr-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
            {showUsage && (
              <th className="py-2 pr-4 text-xs font-semibold text-slate-500 uppercase">Usage</th>
            )}
            <th className="py-2 text-xs font-semibold text-slate-500 uppercase">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
              <td className="py-3 pr-4">
                <p className="font-medium text-slate-900">{row.description}</p>
                {row.notesPreview && (
                  <p className="text-xs text-slate-500 mt-0.5 max-w-md">{row.notesPreview}</p>
                )}
                {row.attachmentCount > 0 && (
                  <p className="text-xs text-violet-600 mt-0.5">
                    {row.attachmentCount} attachment{row.attachmentCount !== 1 ? 's' : ''}
                  </p>
                )}
              </td>
              <td className="py-3 pr-4 text-slate-600 font-mono text-xs">{row.code || '—'}</td>
              <td className="py-3 pr-4 text-slate-600 whitespace-nowrap">
                {format(row.claimDate, 'dd MMM yyyy')}
              </td>
              <td className="py-3 pr-4 text-slate-600">{claimTypeLabel(row.claimType)}</td>
              <td className="py-3 pr-4">
                <DocumentedBadge documented={row.documented} />
              </td>
              {showUsage && (
                <td className="py-3 pr-4 text-slate-600 text-xs">
                  {row.timesCompleted ?? 0} / {row.maxCovered ?? '—'}
                </td>
              )}
              <td className="py-3">
                <button
                  type="button"
                  onClick={() => onViewClaim(row.caseId)}
                  className="text-xs font-semibold authi-gradient-text hover:opacity-80"
                >
                  View claim
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const SectionDetail = ({
  record,
  sectionId,
  onViewClaim,
  onClose,
}: {
  record: PatientRecord;
  sectionId: PatientRecordSectionId;
  onViewClaim: (caseId: string) => void;
  onClose: () => void;
}) => {
  const meta = sectionMeta.find((s) => s.id === sectionId);
  if (!meta) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative bg-white w-full sm:max-w-4xl max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div>
            <p className="text-xs uppercase tracking-wide authi-gradient-text font-semibold">
              {meta.title}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">{meta.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl"
            aria-label="Close section"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {sectionId === 'conditions' && (
            <ul className="space-y-3">
              {record.conditions.map((c) => (
                <li key={c.name} className="authi-sub-card">
                  <p className="font-semibold text-slate-900">{c.name}</p>
                  {c.icdCode && (
                    <p className="text-sm text-violet-600 font-mono mt-0.5">{c.icdCode}</p>
                  )}
                  {c.icdDescription && (
                    <p className="text-sm text-slate-600 mt-1">{c.icdDescription}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">
                    Last documented {format(c.lastUpdated, 'dd MMM yyyy')}
                    {c.fromCib ? ' · CIB registered' : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {sectionId === 'labs' && (
            <TestTable rows={record.labResults} onViewClaim={onViewClaim} />
          )}
          {sectionId === 'imaging' && (
            <TestTable rows={record.imaging} onViewClaim={onViewClaim} />
          )}
          {sectionId === 'diagnostic' && (
            <TestTable rows={record.diagnosticTesting} onViewClaim={onViewClaim} />
          )}
          {sectionId === 'ongoing' && (
            <TestTable rows={record.ongoingMonitoring} onViewClaim={onViewClaim} showUsage />
          )}
          {sectionId === 'medications' && (
            <ul className="space-y-2">
              {record.medications.map((m) => (
                <li
                  key={`${m.name}-${m.caseId}`}
                  className="flex items-start justify-between gap-4 py-3 border-b border-slate-100"
                >
                  <div>
                    <p className="font-medium text-slate-900">{m.name}</p>
                    {m.activeIngredient && (
                      <p className="text-xs text-slate-500">{m.activeIngredient}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      Last prescribed {format(m.lastPrescribed, 'dd MMM yyyy')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewClaim(m.caseId)}
                    className="text-xs font-semibold authi-gradient-text shrink-0"
                  >
                    View claim
                  </button>
                </li>
              ))}
            </ul>
          )}
          {sectionId === 'visits' && (
            <ul className="space-y-3">
              {record.visits.map((v) => (
                <li key={v.caseId} className="authi-sub-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{v.condition}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {format(v.date, 'dd MMM yyyy')} · {claimTypeLabel(v.claimType)} ·{' '}
                        {v.status}
                      </p>
                      <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                        {v.clinicalNoteExcerpt}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onViewClaim(v.caseId)}
                      className="text-xs font-semibold authi-gradient-text shrink-0"
                    >
                      View claim
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {sectionId === 'referrals' && (
            <ul className="space-y-3">
              {record.referrals.map((r) => (
                <li key={r.id} className="authi-sub-card">
                  <p className="font-medium text-slate-900">{r.specialistType}</p>
                  <p className="text-xs text-slate-500 mt-1 capitalize">{r.urgency} · {format(new Date(r.createdAt), 'dd MMM yyyy')}</p>
                  <p className="text-sm text-slate-700 mt-2">{r.referralNote}</p>
                  <button
                    type="button"
                    onClick={() => onViewClaim(r.caseId)}
                    className="text-xs font-semibold authi-gradient-text mt-2"
                  >
                    View claim
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const PatientRecordView = ({
  cases,
  profileId,
  onViewClaim,
  onChangePatient,
  onBack,
}: PatientRecordViewProps) => {
  const [activeSection, setActiveSection] = useState<PatientRecordSectionId | null>(null);
  const record = buildPatientRecord(cases, profileId);

  if (!record) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-slate-600">Patient record not found.</p>
      </div>
    );
  }

  const { demographics } = record;

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wide authi-gradient-text font-semibold">
                Patient record
              </p>
              <h1 className="text-2xl font-semibold text-slate-900 truncate">
                {demographics.patientName}
              </h1>
              <p className="text-sm text-slate-500 font-mono">{demographics.patientId}</p>
            </div>
            <button
              type="button"
              onClick={onChangePatient}
              className="authi-btn-secondary px-4 py-2.5 text-sm rounded-xl"
            >
              Change patient
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Demographics */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="authi-avatar-lg w-14 h-14">
              <User className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{demographics.patientName}</h2>
              <p className="text-sm text-slate-500">{demographics.cibEnrollmentStatus}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              ['Scheme', demographics.medicalScheme],
              ['Plan', demographics.plan],
              ['Medical aid', demographics.medicalAidNumber],
              ['Email', demographics.patientEmail],
              ['Phone', demographics.patientPhone],
              ['Total claims', String(record.totalClaims)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                <p className="text-slate-900 mt-1 font-medium break-words">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Claims', value: record.totalClaims },
            { label: 'Conditions', value: record.conditions.length },
            { label: 'Lab entries', value: record.labResults.length },
            { label: 'Imaging', value: record.imaging.length },
            { label: 'Medications', value: record.medications.length },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center"
            >
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Category hub */}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] authi-gradient-text font-semibold mb-4">
            Medical record sections
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sectionMeta.map((section) => {
              const count = sectionRecordCount(record, section.id);
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-[#6366f1]/40 hover:shadow-sm transition-all text-left group"
                >
                  <div className="w-12 h-12 rounded-xl authi-tint border border-[rgba(99,102,241,0.2)] flex items-center justify-center shrink-0">
                    {section.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{section.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{section.subtitle}</p>
                    <p className="text-xs font-medium authi-gradient-text mt-1.5">
                      {count} record{count !== 1 ? 's' : ''} found
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#6366f1] shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeSection && (
        <SectionDetail
          record={record}
          sectionId={activeSection}
          onViewClaim={onViewClaim}
          onClose={() => setActiveSection(null)}
        />
      )}
    </div>
  );
};

export default PatientRecordView;
