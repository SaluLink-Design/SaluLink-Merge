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
import { useStore } from '@/lib/store';
import RecordAttachmentList from '@/components/RecordAttachmentList';
import {
  buildPatientRecord,
  claimTypeLabel,
  sectionRecordCount,
  type PatientRecord,
  type PatientRecordSectionId,
  type PatientRecordTestRow,
  type PatientRecordVisitRow,
} from '@/lib/patientRecord';

interface PatientRecordViewProps {
  cases: PatientCase[];
  profileId: string;
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
    subtitle: 'Chronic conditions and ICD codes on file',
    icon: <Activity className="w-6 h-6 text-indigo-500" />,
  },
  {
    id: 'labs',
    title: 'Lab results',
    subtitle: 'Pathology and laboratory tests with findings and uploads',
    icon: <FlaskConical className="w-6 h-6 text-indigo-500" />,
  },
  {
    id: 'imaging',
    title: 'Imaging',
    subtitle: 'Radiology and imaging studies with reports and uploads',
    icon: <Scan className="w-6 h-6 text-indigo-500" />,
  },
  {
    id: 'diagnostic',
    title: 'Diagnostic testing',
    subtitle: 'Other diagnostic procedures with clinical documentation',
    icon: <Stethoscope className="w-6 h-6 text-indigo-500" />,
  },
  {
    id: 'ongoing',
    title: 'Ongoing monitoring',
    subtitle: 'Monitoring tests from follow-up visits',
    icon: <HeartPulse className="w-6 h-6 text-indigo-500" />,
  },
  {
    id: 'medications',
    title: 'Medications',
    subtitle: 'Current chronic medicines on file',
    icon: <Pill className="w-6 h-6 text-indigo-500" />,
  },
  {
    id: 'visits',
    title: 'Visits & clinical notes',
    subtitle: 'Visit timeline with full clinical notes',
    icon: <Calendar className="w-6 h-6 text-indigo-500" />,
  },
  {
    id: 'referrals',
    title: 'Referrals',
    subtitle: 'Specialist referrals for this patient',
    icon: <FileSymlink className="w-6 h-6 text-indigo-500" />,
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
  onViewResult,
  showUsage = false,
}: {
  rows: PatientRecordTestRow[];
  onViewResult: (row: PatientRecordTestRow) => void;
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
                  <p className="text-xs text-slate-500 mt-0.5 max-w-md line-clamp-2">{row.notesPreview}</p>
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
                  onClick={() => onViewResult(row)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  View results
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TestResultDetail = ({
  row,
  onClose,
}: {
  row: PatientRecordTestRow;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
    <button
      type="button"
      className="absolute inset-0 bg-black/40"
      aria-label="Close"
      onClick={onClose}
    />
    <div className="relative bg-white w-full sm:max-w-2xl max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Test result</p>
          <p className="text-base font-semibold text-slate-900 mt-0.5 line-clamp-2">{row.description}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-xl shrink-0"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Code</p>
            <p className="font-mono text-slate-900 mt-1">{row.code || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Date</p>
            <p className="text-slate-900 mt-1">{format(row.claimDate, 'dd MMM yyyy')}</p>
          </div>
          {row.condition && (
            <div className="col-span-2">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Condition</p>
              <p className="text-slate-900 mt-1">{row.condition}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Status</p>
            <div className="mt-1">
              <DocumentedBadge documented={row.documented} />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Clinical findings &amp; interpretation
          </p>
          {row.fullNotes ? (
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-4">
              {row.fullNotes}
            </p>
          ) : (
            <p className="text-sm text-slate-500">No findings or notes recorded for this test.</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Uploaded documents
          </p>
          <RecordAttachmentList attachments={row.images} />
        </div>
      </div>
    </div>
  </div>
);

const VisitNoteDetail = ({
  visit,
  onClose,
}: {
  visit: PatientRecordVisitRow;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
    <button
      type="button"
      className="absolute inset-0 bg-black/40"
      aria-label="Close"
      onClick={onClose}
    />
    <div className="relative bg-white w-full sm:max-w-2xl max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Clinical note</p>
          <p className="text-base font-semibold text-slate-900 mt-0.5">{visit.condition}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {format(visit.date, 'dd MMM yyyy')} · {claimTypeLabel(visit.claimType)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-xl shrink-0"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {visit.fullClinicalNote ? (
          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
            {visit.fullClinicalNote}
          </p>
        ) : (
          <p className="text-sm text-slate-500">No clinical note recorded for this visit.</p>
        )}
      </div>
    </div>
  </div>
);

const SectionDetail = ({
  record,
  sectionId,
  onViewResult,
  onViewVisit,
  onClose,
}: {
  record: PatientRecord;
  sectionId: PatientRecordSectionId;
  onViewResult: (row: PatientRecordTestRow) => void;
  onViewVisit: (visit: PatientRecordVisitRow) => void;
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
            <p className="text-xs uppercase tracking-wide text-slate-900 font-semibold">
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
                <li key={c.name} className="bg-white border border-slate-200 rounded-xl p-4">
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
            <TestTable rows={record.labResults} onViewResult={onViewResult} />
          )}
          {sectionId === 'imaging' && (
            <TestTable rows={record.imaging} onViewResult={onViewResult} />
          )}
          {sectionId === 'diagnostic' && (
            <TestTable rows={record.diagnosticTesting} onViewResult={onViewResult} />
          )}
          {sectionId === 'ongoing' && (
            <TestTable rows={record.ongoingMonitoring} onViewResult={onViewResult} showUsage />
          )}
          {sectionId === 'medications' && (
            record.medications.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No medications on file.</p>
            ) : (
              <ul className="space-y-2">
                {record.medications.map((m) => (
                  <li
                    key={`${m.name}-${m.caseId}`}
                    className="py-3 px-4 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <p className="font-medium text-slate-900">{m.name}</p>
                    {m.activeIngredient && (
                      <p className="text-xs text-slate-500 mt-0.5">{m.activeIngredient}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      Last prescribed {format(m.lastPrescribed, 'dd MMM yyyy')}
                    </p>
                    {m.formularyStatus && (
                      <span
                        className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.formularyStatus === 'unlisted'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {m.formularyStatus === 'unlisted' ? 'Cap-limited' : 'Fully covered'}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )
          )}
          {sectionId === 'visits' && (
            <ul className="space-y-3">
              {record.visits.map((v) => (
                <li key={v.caseId} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{v.condition}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {format(v.date, 'dd MMM yyyy')} · {claimTypeLabel(v.claimType)}
                      </p>
                      <p className="text-sm text-slate-700 mt-2 leading-relaxed line-clamp-3">
                        {v.clinicalNoteExcerpt}
                      </p>
                    </div>
                    {v.fullClinicalNote && (
                      <button
                        type="button"
                        onClick={() => onViewVisit(v)}
                        className="text-xs font-semibold text-blue-600 shrink-0 hover:text-blue-700"
                      >
                        View note
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {sectionId === 'referrals' && (
            <ul className="space-y-3">
              {record.referrals.map((r) => (
                <li key={r.id} className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="font-medium text-slate-900">{r.specialistType}</p>
                  <p className="text-xs text-slate-500 mt-1 capitalize">
                    {r.urgency} · {format(new Date(r.createdAt), 'dd MMM yyyy')}
                  </p>
                  <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{r.referralNote}</p>
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
  onChangePatient,
  onBack,
}: PatientRecordViewProps) => {
  const [activeSection, setActiveSection] = useState<PatientRecordSectionId | null>(null);
  const [selectedTest, setSelectedTest] = useState<PatientRecordTestRow | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<PatientRecordVisitRow | null>(null);
  const chronicCases = useStore((s) => s.chronicCases);
  const record = buildPatientRecord(cases, profileId, chronicCases);

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
              <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
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
              className="px-4 py-2.5 text-sm font-semibold rounded-xl authi-gradient text-white hover:opacity-90 transition shadow-md shadow-[#6366f1]/20"
            >
              Change patient
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <User className="w-7 h-7 text-blue-400" />
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
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                <p className="text-slate-900 mt-1 font-medium break-words">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Conditions', value: record.conditions.length },
            { label: 'Lab entries', value: record.labResults.length },
            { label: 'Imaging', value: record.imaging.length },
            { label: 'Medications', value: record.medications.length },
            { label: 'Visits', value: record.visits.length },
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

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold mb-4">
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
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                    {section.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{section.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{section.subtitle}</p>
                    <p className="text-xs font-medium text-indigo-600 mt-1.5">
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
          onViewResult={(row) => setSelectedTest(row)}
          onViewVisit={(visit) => setSelectedVisit(visit)}
          onClose={() => setActiveSection(null)}
        />
      )}

      {selectedTest && (
        <TestResultDetail row={selectedTest} onClose={() => setSelectedTest(null)} />
      )}

      {selectedVisit && (
        <VisitNoteDetail visit={selectedVisit} onClose={() => setSelectedVisit(null)} />
      )}
    </div>
  );
};

export default PatientRecordView;
