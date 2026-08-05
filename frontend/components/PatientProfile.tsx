'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  User,
  Activity,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  FileText,
  HeartPulse,
  CheckCircle2,
} from 'lucide-react';
import { PatientCase, ClaimType } from '@/types';
import { canStartRegisteredPatientActions, getPatientCibRecords, getPatientCibStatusLabel, isWorkflowB } from '@/lib/benefitState';
import { isRegistrationUnlocked } from '@/lib/careActions';
import { getLatestSpecialistTreatmentUpdate } from '@/lib/sharedCare';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { useStore } from '@/lib/store';
import { DataService } from '@/lib/dataService';
import { getSpecialistVisitUsageSummary } from '@/lib/specialistVisitUsage';
import SchemeBasketUtilisation from '@/components/SchemeBasketUtilisation';

interface PatientProfileProps {
  profileId: string;
  cases: PatientCase[];
  allCases?: PatientCase[];
  onViewClaim: (caseId: string) => void;
  onNewCaseAction: (profileId: string, claimType: ClaimType) => void;
  onContinueRegistration?: (profileId: string, condition: string) => void;
  onViewPatientRecord: (profileId: string) => void;
  onBack: () => void;
  userRole?: string | null;
}

const PHASE1_CASE_ACTIONS: {
  claimType: ClaimType;
  label: string;
  description: string;
  icon: React.ReactNode;
  primary?: boolean;
}[] = [
  {
    claimType: 'ongoing-management',
    label: 'Patient Follow-Up Visit',
    description:
      'GP shared care — medication report (renew or refer for change), monitoring, or escalate to neurologist.',
    icon: <Activity className="w-5 h-5 text-indigo-500" />,
    primary: true,
  },
  {
    claimType: 'diagnostic',
    label: 'Diagnostic Claim',
    description:
      'New or changed condition — full diagnostic workflow for CIB registration.',
    icon: <Stethoscope className="w-5 h-5 text-indigo-500" />,
  },
];

const SPECIALIST_CASE_ACTIONS: {
  claimType: ClaimType;
  label: string;
  description: string;
  icon: React.ReactNode;
  primary?: boolean;
}[] = [
  {
    claimType: 'specialist-review',
    label: 'Annual / Specialist Review',
    description:
      'Follow-up clinical anchor visit — update treatment plan, change medications, order monitoring (EEG / labs).',
    icon: <HeartPulse className="w-5 h-5 text-indigo-500" />,
    primary: true,
  },
];

const claimTypeBadge: Record<ClaimType, { label: string; className: string }> = {
  diagnostic: { label: 'Diagnostic', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  'ongoing-management': { label: 'Follow-Up', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  'specialist-review': { label: 'Specialist Review', className: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
  'medication-report': { label: 'Medication', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
  referral: { label: 'Referral', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
};

const statusBadge: Record<string, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-100 text-blue-700' },
  draft: { label: 'Draft', className: 'bg-yellow-100 text-yellow-700' },
  diagnostic: { label: 'In Review', className: 'bg-orange-100 text-orange-700' },
  ongoing: { label: 'In Progress', className: 'bg-emerald-100 text-emerald-700' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
};

const registrationStatusLabel: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete',
  submitted: 'Submitted',
};

const PatientProfile = ({
  profileId,
  cases,
  onViewClaim,
  onNewCaseAction,
  onContinueRegistration,
  onViewPatientRecord,
  onBack,
  userRole,
}: PatientProfileProps) => {
  const [showCaseActions, setShowCaseActions] = useState(false);
  const [basketReady, setBasketReady] = useState(false);
  useEffect(() => {
    void DataService.initialize().then(() => setBasketReady(true));
  }, []);
  const auth = useAuth();
  const practitionerRole = auth.profile?.practitionerRole ?? 'gp';
  const speciality = (auth.profile?.speciality ?? '').toLowerCase();
  const isSpecialist =
    practitionerRole === 'specialist' ||
    practitionerRole === 'neurologist' ||
    speciality.includes('neurolog') ||
    speciality.includes('specialist');
  const isDoctor = userRole === 'doctor';
  const isAssistant = userRole === 'assistant';

  const portfolioCardClass = 'bg-white rounded-2xl border border-slate-200 shadow-sm';

  const sortedCases = [...cases].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const patient = sortedCases[0];
  const medicalPatientId = patient?.patientId ?? '';
  const allStoreCases = useStore((s) => s.cases);
  const allChronicCases = useStore((s) => s.chronicCases);

  const chronicCases = useMemo(
    () => allChronicCases.filter((c) => c.profileId === profileId),
    [allChronicCases, profileId]
  );

  const chronicCasesForUnlock = useMemo(() => {
    const byProfile = allStoreCases
      .filter((c) => c.patientId.trim().toLowerCase() === medicalPatientId.trim().toLowerCase())
      .map((c) => c.profileId)
      .filter((id): id is string => Boolean(id));
    const profileSet = new Set([profileId, ...byProfile]);
    const matched = allChronicCases.filter((c) => profileSet.has(c.profileId));
    // If profile matching fails (synced cases missing profileId), fall back to
    // any submitted chronic case already scoped for this profile id.
    return matched.length > 0 ? matched : chronicCases;
  }, [allChronicCases, allStoreCases, chronicCases, medicalPatientId, profileId]);

  const canStartRegisteredActions = canStartRegisteredPatientActions(
    allStoreCases,
    medicalPatientId,
    chronicCasesForUnlock
  );
  // Banner already uses this path — keep New Case Action in lockstep with it.
  const pathwayUnlockedAnywhere = chronicCases.some((c) => {
    const status = c.registrationStatus ?? 'not_started';
    return status === 'submitted' || status === 'complete';
  });
  const actionsUnlocked = canStartRegisteredActions || pathwayUnlockedAnywhere;
  const cibStatusLabel = getPatientCibStatusLabel(
    allStoreCases,
    medicalPatientId,
    chronicCasesForUnlock
  );
  const filteredCaseActions = actionsUnlocked
    ? isSpecialist
      ? SPECIALIST_CASE_ACTIONS
      : PHASE1_CASE_ACTIONS
    : PHASE1_CASE_ACTIONS.filter((o) => o.claimType === 'diagnostic');

  const specialistTreatmentUpdate = useMemo(
    () => getLatestSpecialistTreatmentUpdate(allStoreCases, medicalPatientId),
    [allStoreCases, medicalPatientId]
  );

  const trackedConditions = useMemo(() => {
    const fromClaims = sortedCases.map((c) => c.condition).filter(Boolean);
    const fromChronic = chronicCases.map((c) => c.condition);
    return Array.from(new Set([...fromClaims, ...fromChronic])).sort();
  }, [sortedCases, chronicCases]);

  const latestCaseForCondition = (condition: string) =>
    sortedCases.find((c) => c.condition === condition) ?? sortedCases[0];

  const claimsForCondition = (condition: string) =>
    sortedCases.filter((c) => c.condition === condition);

  const patientCasesForBasket = useMemo(
    () =>
      medicalPatientId
        ? allStoreCases.filter(
            (c) =>
              c.patientId.trim().toLowerCase() === medicalPatientId.trim().toLowerCase()
          )
        : [],
    [allStoreCases, medicalPatientId]
  );

  const renderPatientDetails = () => {
    if (!patient) return null;
    return (
      <div className="mt-5">
        <p className="text-xs uppercase tracking-widest text-slate-400 mb-3">Patient information</p>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <User className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{patient.patientName}</h2>
            <p className="text-sm text-slate-500">
              ID: <span className="font-mono text-slate-700">{patient.patientId}</span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            ['Medical Aid', patient.medicalAidNumber || '—'],
            ['Scheme', patient.medicalScheme === 'gems' ? 'GEMS' : 'Discovery Health'],
            ['CIB Status', cibStatusLabel],
            ['Plan', patient.plan],
            ['Email', patient.patientEmail || '—'],
            ['Phone', patient.patientPhone || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-slate-400 text-xs uppercase tracking-wide">{label}</p>
              <p className="text-slate-900 mt-1 font-medium">{value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderClaimsList = (conditionClaims: PatientCase[]) => {
    if (conditionClaims.length === 0) {
      return (
        <p className="text-sm text-slate-400 text-center py-6">No claims yet for this condition.</p>
      );
    }

    return (
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
        {conditionClaims.map((claim) => {
          const ct = claim.claimType
            ? claimTypeBadge[claim.claimType]
            : { label: 'Intake', className: 'bg-slate-100 text-slate-500 border border-slate-200' };
          const st = statusBadge[claim.status] ?? {
            label: claim.status,
            className: 'bg-slate-100 text-slate-500',
          };
          return (
            <div
              key={claim.id}
              className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors bg-white"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ct.className}`}>
                    {ct.label}
                  </span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${st.className}`}>
                    {st.label}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900 truncate">
                  {claim.condition || 'No condition recorded'}
                  {claim.icdCode ? ` — ${claim.icdCode}` : ''}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {format(new Date(claim.createdAt), 'dd MMM yyyy')}
                </p>
              </div>
              <button
                onClick={() => onViewClaim(claim.id)}
                className="ml-4 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Eye className="w-4 h-4 shrink-0" />
                View Claim
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest text-slate-400">Patient Portfolio</p>
            <h1 className="text-2xl font-semibold text-slate-900">{patient?.patientName ?? 'Patient'}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isAssistant && (
              <button
                type="button"
                onClick={() => onViewPatientRecord(profileId)}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 bg-white text-slate-800 text-sm font-semibold rounded-xl hover:border-[#6366f1]/40 hover:bg-slate-50 transition"
              >
                <FileText className="w-4 h-4 text-[#6366f1]" />
                View patient record
              </button>
            )}
            {isDoctor && (
              <button
                type="button"
                onClick={() => setShowCaseActions((v) => !v)}
                className="flex items-center gap-2 px-5 py-2.5 authi-gradient text-white text-sm font-semibold rounded-xl hover:opacity-90 transition shadow-md shadow-[#6366f1]/20"
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
        </div>

        {showCaseActions && isDoctor && (
          <div className="border-t border-slate-200 bg-slate-50">
            <div className="max-w-5xl mx-auto px-6 py-5">
              <p className="text-xs uppercase tracking-widest text-slate-900 font-semibold mb-2">
                New case action — {patient?.patientName}
              </p>
              <p className="text-sm text-slate-500 mb-5">
                {actionsUnlocked
                  ? isSpecialist
                    ? 'Start an annual or specialist review visit for this patient.'
                    : 'Choose the type of visit or claim for this patient.'
                  : 'Complete the diagnostic workflow to register this patient on the chronic benefit pathway.'}
              </p>
              <div
                className={`grid gap-4 ${
                  filteredCaseActions.length === 1
                    ? 'grid-cols-1 max-w-md'
                    : filteredCaseActions.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {filteredCaseActions.map((opt) => (
                  <button
                    key={opt.claimType}
                    type="button"
                    onClick={() => {
                      setShowCaseActions(false);
                      onNewCaseAction(profileId, opt.claimType);
                    }}
                    className={`authi-action-card text-left ${
                      opt.primary ? 'ring-2 ring-indigo-300 border-indigo-200' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                      {opt.icon}
                      {opt.label}
                    </span>
                    <span className="text-xs leading-relaxed text-slate-500 mt-2 block">
                      {opt.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {!isSpecialist && specialistTreatmentUpdate && canStartRegisteredActions && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            <p className="font-semibold">Neurologist updated treatment plan</p>
            <p className="text-indigo-800/90 mt-0.5 text-xs">
              Renew scripts from the updated regimen on file — do not redesign therapy without
              escalation.
            </p>
          </div>
        )}
        {trackedConditions.length > 0 ? (
          trackedConditions.map((condition) => {
            const anchor = latestCaseForCondition(condition);
            const chronicCase = chronicCases.find(
              (c) => c.condition.trim().toLowerCase() === condition.trim().toLowerCase()
            );
            const regStatus = chronicCase?.registrationStatus ?? 'not_started';
            const needsRegistration =
              chronicCase &&
              chronicCase.registrationStatus !== 'submitted' &&
              chronicCase.registrationStatus !== 'complete';

            const cibRecords = getPatientCibRecords(allStoreCases, medicalPatientId);
            const conditionCib = cibRecords.find((r) => r.conditionName === condition);
            const cibApproved = conditionCib ? isWorkflowB(conditionCib.benefitState) : false;
            const pathwayUnlocked = isRegistrationUnlocked(chronicCase, cibApproved);
            const icdCode = anchor?.icdCode || conditionCib?.icd10;
            const conditionClaims = claimsForCondition(condition);
            const specialistVisitUsage =
              isSpecialist && basketReady && medicalPatientId
                ? getSpecialistVisitUsageSummary(
                    DataService.getOngoingBasketForCondition(condition),
                    medicalPatientId,
                    condition,
                    allStoreCases
                  )
                : null;

            return (
              <div key={condition} className="space-y-6">
                {/* Patient portfolio — condition, registration, demographics, coverage */}
                <div className={`${portfolioCardClass} p-6`}>
                  <p className="text-xs uppercase tracking-widest text-slate-400 mb-4">
                    Patient portfolio
                  </p>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl authi-gradient flex items-center justify-center shrink-0">
                      <HeartPulse className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs uppercase tracking-widest text-slate-400">Chronic Case</p>
                      <h2 className="text-xl font-semibold text-slate-900">{condition}</h2>
                      {icdCode && (
                        <p className="text-sm font-mono text-indigo-600 mt-0.5">{icdCode}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border shrink-0 ${
                        regStatus === 'submitted' || cibApproved || pathwayUnlocked
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : regStatus === 'in_progress'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {cibApproved || pathwayUnlocked
                        ? 'Benefit active'
                        : registrationStatusLabel[regStatus] ?? regStatus}
                    </span>
                  </div>

                  {needsRegistration && onContinueRegistration && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm text-amber-900">
                        Chronic registration in progress for <strong>{condition}</strong>
                      </p>
                      <button
                        type="button"
                        onClick={() => onContinueRegistration(profileId, condition)}
                        className="text-sm font-semibold text-amber-900 underline hover:text-amber-700"
                      >
                        Continue registration
                      </button>
                    </div>
                  )}

                  {pathwayUnlocked && !needsRegistration && (
                    <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-emerald-800">
                        CIB registration complete — care pathway unlocked. Use{' '}
                        <strong>+ New Case Action</strong> to start{' '}
                        {isSpecialist
                          ? 'an Annual / Specialist Review'
                          : 'follow-up visits or care pathway activities'}
                        .
                      </p>
                    </div>
                  )}

                  {renderPatientDetails()}

                  <div className="mt-5 space-y-3">
                    <p className="text-xs uppercase tracking-widest text-slate-400">
                      Scheme coverage
                    </p>

                    {isSpecialist && specialistVisitUsage?.maxCovered != null && (
                      <div
                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                          specialistVisitUsage.isExhausted
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <HeartPulse
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            specialistVisitUsage.isExhausted ? 'text-amber-600' : 'text-slate-400'
                          }`}
                        />
                        <p
                          className={`text-sm ${
                            specialistVisitUsage.isExhausted ? 'text-amber-900' : 'text-slate-600'
                          }`}
                        >
                          {specialistVisitUsage.usedHistorical} of{' '}
                          {specialistVisitUsage.maxCovered} specialist visits used this year
                          {specialistVisitUsage.isExhausted
                            ? ' — starting a review may be over the covered limit.'
                            : '.'}{' '}
                          <span className="text-slate-400">(Visits tracked in SaluLink)</span>
                        </p>
                      </div>
                    )}

                    {medicalPatientId && (
                      <SchemeBasketUtilisation
                        condition={condition}
                        patientId={medicalPatientId}
                        patientCases={patientCasesForBasket}
                      />
                    )}
                  </div>
                </div>

                {/* Patient activity — claims for this condition */}
                <div className={`${portfolioCardClass} p-6`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-400">
                        Patient activity
                      </p>
                      <h3 className="font-semibold text-slate-900">
                        Claims ({conditionClaims.length})
                      </h3>
                    </div>
                  </div>
                  {renderClaimsList(conditionClaims)}
                </div>
              </div>
            );
          })
        ) : (
          <>
            {patient && (
              <div className={`${portfolioCardClass} p-6`}>
                <p className="text-xs uppercase tracking-widest text-slate-400 mb-4">
                  Patient portfolio
                </p>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <User className="w-7 h-7 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{patient.patientName}</h2>
                    <p className="text-sm text-slate-500">
                      ID: <span className="font-mono text-slate-700">{patient.patientId}</span>
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {[
                    ['Medical Aid', patient.medicalAidNumber || '—'],
                    ['Scheme', patient.medicalScheme === 'gems' ? 'GEMS' : 'Discovery Health'],
                    ['CIB Status', cibStatusLabel],
                    ['Plan', patient.plan],
                    ['Email', patient.patientEmail || '—'],
                    ['Phone', patient.patientPhone || '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-slate-400 text-xs uppercase tracking-wide">{label}</p>
                      <p className="text-slate-900 mt-1 font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={`${portfolioCardClass} p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Patient activity</p>
                  <h3 className="font-semibold text-slate-900">Claims ({sortedCases.length})</h3>
                </div>
              </div>
              {sortedCases.length > 0 ? (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                  {sortedCases.map((claim) => {
                    const ct = claim.claimType
                      ? claimTypeBadge[claim.claimType]
                      : { label: 'Intake', className: 'bg-slate-100 text-slate-500 border border-slate-200' };
                    const st = statusBadge[claim.status] ?? {
                      label: claim.status,
                      className: 'bg-slate-100 text-slate-500',
                    };
                    return (
                      <div
                        key={claim.id}
                        className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors bg-white"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ct.className}`}>
                              {ct.label}
                            </span>
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${st.className}`}>
                              {st.label}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {claim.condition || 'No condition recorded'}
                            {claim.icdCode ? ` — ${claim.icdCode}` : ''}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {format(new Date(claim.createdAt), 'dd MMM yyyy')}
                          </p>
                        </div>
                        <button
                          onClick={() => onViewClaim(claim.id)}
                          className="ml-4 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <Eye className="w-4 h-4 shrink-0" />
                          View Claim
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-6">No claims yet for this patient.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PatientProfile;
