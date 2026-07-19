'use client';

import { useEffect, useMemo, useState } from 'react';
import { HeartPulse, Eye, Lock } from 'lucide-react';
import type { TreatmentItem } from '@/types';
import CareCoordinationPanel from '@/components/CareCoordinationPanel';
import CareActivitiesPanel from '@/components/CareActivitiesPanel';
import RegistrationProgressBar from '@/components/RegistrationProgressBar';
import { useStore } from '@/lib/store';
import { buildSchemePathwayStatus, isRegistrationUnlocked } from '@/lib/careActions';
import { getPatientCibRecords, isWorkflowB } from '@/lib/benefitState';

interface ChronicCaseViewProps {
  profileId: string;
  condition: string;
  patientId: string;
  cases: ReturnType<typeof useStore.getState>['cases'];
  icdCode?: string;
  clinicalNote?: string;
  diagnosisDate?: string;
  diagnosticTreatments?: TreatmentItem[];
  showSchemeView?: boolean;
  mode?: 'registration' | 'full';
  /** Gate the detailed Initial/Long-Term Care Activities panels behind a toggle in the parent. Defaults to shown. */
  showActivityPanels?: boolean;
}

const registrationStatusLabel: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete',
  submitted: 'Submitted',
};

const ChronicCaseView = ({
  profileId,
  condition,
  patientId,
  cases,
  icdCode,
  clinicalNote,
  diagnosisDate,
  diagnosticTreatments = [],
  showSchemeView = false,
  mode = 'full',
  showActivityPanels = true,
}: ChronicCaseViewProps) => {
  const chronicCase = useStore((s) => s.getChronicCase(profileId, condition));
  const ensureChronicCase = useStore((s) => s.ensureChronicCase);
  const setChronicCaseApprovalPath = useStore((s) => s.setChronicCaseApprovalPath);
  const advanceCareAction = useStore((s) => s.advanceCareAction);
  const addCareAction = useStore((s) => s.addCareAction);
  const syncChronicCaseDiagnostics = useStore((s) => s.syncChronicCaseDiagnostics);
  const materializeChronicCasePathway = useStore((s) => s.materializeChronicCasePathway);

  const [approvalPathId, setApprovalPathId] = useState(chronicCase?.approvalPathId);

  useEffect(() => {
    ensureChronicCase(profileId, condition, { icdCode, approvalPathId });
  }, [profileId, condition, icdCode, approvalPathId, ensureChronicCase]);

  useEffect(() => {
    if (chronicCase?.approvalPathId) {
      setApprovalPathId(chronicCase.approvalPathId);
    }
  }, [chronicCase?.approvalPathId]);

  const cibRecords = getPatientCibRecords(cases, patientId);
  const conditionCib = cibRecords.find((r) => r.conditionName === condition);
  const cibApproved = conditionCib ? isWorkflowB(conditionCib.benefitState) : false;
  const pathwayUnlocked = isRegistrationUnlocked(chronicCase, cibApproved);

  useEffect(() => {
    if (pathwayUnlocked) {
      materializeChronicCasePathway(profileId, condition);
    }
  }, [pathwayUnlocked, profileId, condition, materializeChronicCasePathway]);

  const workflowContext = useMemo(
    () => ({
      icdCode,
      diagnosisDate,
      clinicalNote,
      diagnosticTreatments,
    }),
    [icdCode, diagnosisDate, clinicalNote, diagnosticTreatments]
  );

  const pathwayStatus = useMemo(
    () => buildSchemePathwayStatus(condition, chronicCase, cibApproved, workflowContext),
    [condition, chronicCase, cibApproved, workflowContext]
  );

  const handleSelectPath = (pathId: string) => {
    setApprovalPathId(pathId);
    setChronicCaseApprovalPath(profileId, condition, pathId);
  };

  const regStatus = chronicCase?.registrationStatus ?? 'not_started';

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl authi-gradient flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest text-slate-400">Chronic Case</p>
            <h2 className="text-xl font-semibold text-slate-900">{condition}</h2>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
              regStatus === 'submitted' || cibApproved
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : regStatus === 'in_progress'
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {cibApproved ? 'Benefit active' : registrationStatusLabel[regStatus] ?? regStatus}
          </span>
        </div>
        {icdCode && <p className="text-sm font-mono text-indigo-600 ml-[3.25rem]">{icdCode}</p>}
      </div>

      {(mode === 'registration' || !pathwayUnlocked) && (
        <CareCoordinationPanel
          condition={condition}
          chronicCase={chronicCase}
          approvalPathId={approvalPathId}
          workflowContext={workflowContext}
          onAdvanceAction={(actionId) => advanceCareAction(profileId, condition, actionId)}
          templateFilter="all_wizard"
        />
      )}

      {pathwayUnlocked && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <RegistrationProgressBar percent={100} completed={1} total={1} compact />
          <p className="text-sm text-emerald-800 mt-2">
            CIB registration complete — care pathway unlocked.
          </p>
        </div>
      )}

      {mode === 'full' && pathwayUnlocked && showActivityPanels && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900 mb-1">Initial Assessment Activities</h3>
            <p className="text-xs text-slate-500 mb-4">Diagnostic basket — initial chronic pathway</p>
            <CareActivitiesPanel
              profileId={profileId}
              condition={condition}
              chronicCase={chronicCase}
              onCreateAction={(action) => addCareAction(profileId, condition, action)}
              onAdvanceAction={(actionId) => advanceCareAction(profileId, condition, actionId)}
              phaseFilter="pathway"
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900 mb-1">Long-Term Care Activities</h3>
            <p className="text-xs text-slate-500 mb-4">Ongoing management basket requirements</p>
            <CareActivitiesPanel
              profileId={profileId}
              condition={condition}
              chronicCase={chronicCase}
              onCreateAction={(action) => addCareAction(profileId, condition, action)}
              onAdvanceAction={(actionId) => advanceCareAction(profileId, condition, actionId)}
              phaseFilter="ongoing"
            />
          </div>
        </>
      )}

      {mode === 'full' && !pathwayUnlocked && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex items-start gap-3">
          <Lock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-700">Care pathway locked</p>
            <p className="text-xs text-slate-500 mt-1">
              Complete chronic registration to unlock diagnostic and ongoing management activities.
            </p>
          </div>
        </div>
      )}

      {showSchemeView && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-violet-600" />
            <h3 className="font-semibold text-violet-900">Scheme Pathway View</h3>
          </div>
          <p className="text-xs text-violet-700 mb-4">
            Operational visibility — how the scheme sees progression through the pathway.
          </p>
          <ul className="space-y-2">
            {pathwayStatus.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm">
                <span className={item.complete ? 'text-emerald-600' : 'text-slate-400'}>
                  {item.complete ? '✓' : '□'}
                </span>
                <span className={item.complete ? 'text-slate-800' : 'text-slate-500'}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ChronicCaseView;
