'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { DataService } from '@/lib/dataService';
import { PDFExportService } from '@/lib/pdfExport';
import {
  saveCaseToDatabase,
  updateCaseDeliveryStatus,
  fetchCaseRegistrationHandoff,
  fetchCaseRegistrationHandoffsBulk,
  fetchActionableInboundReferralCount,
  getAllCases,
  type CaseRegistrationHandoff,
} from '@/lib/caseService';
import { useAuth } from '@/lib/AuthContext';
import { getDoctorDisplayName } from '@/lib/workspaceService';
import { fetchEmailDeliveryConfigured } from '@/lib/email/checkEmailDelivery';
import { deliverClaimToPatient } from '@/lib/patientDelivery';
import AuthLanding from '@/components/auth/AuthLanding';
import DoctorOnboardingForm from '@/components/auth/DoctorOnboardingForm';
import InviteAssistantPanel from '@/components/auth/InviteAssistantPanel';
import ClaimCompletionModal, { type ClaimCompletionAction } from '@/components/ClaimCompletionModal';
import { Save, CheckCircle, ArrowLeft, ArrowRight, ChevronRight } from 'lucide-react';

// Components
import ClinicalNoteInput from '@/components/ClinicalNoteInput';
import ConditionSelection from '@/components/ConditionSelection';
import DiagnosticBasket from '@/components/DiagnosticBasket';
import MedicationSelection from '@/components/MedicationSelection';
import ChronicRegistrationNote from '@/components/ChronicRegistrationNote';
import FollowUpDocumentation, { FollowUpCompletionPayload } from '@/components/FollowUpDocumentation';
import FollowUpClaimSummary from '@/components/FollowUpClaimSummary';
import FollowUpVisitActions from '@/components/FollowUpVisitActions';
import FollowUpConditionControl from '@/components/FollowUpConditionControl';
import FollowUpBasketUtilisation from '@/components/FollowUpBasketUtilisation';
import MedicationReport from '@/components/MedicationReport';
import Referral from '@/components/Referral';
import FinalClaimSummary from '@/components/FinalClaimSummary';
import PatientExportModal from '@/components/PatientExportModal';
import Dashboard from '@/components/Dashboard';
import PatientInfoForm, { PatientInfo } from '@/components/PatientInfoForm';
import CaseOptionsView from '@/components/CaseOptionsView';
import PatientProfile from '@/components/PatientProfile';
import CibApplicationAssistant from '@/components/CibApplicationAssistant';
import DiagnosisConfirmation from '@/components/DiagnosisConfirmation';
import ChronicRegistrationWorkspace from '@/components/ChronicRegistrationWorkspace';
import RegistrationCompleteStep from '@/components/RegistrationCompleteStep';
import {
  MatchedCondition,
  PatientCase,
  SelectedMedication,
  ClaimType,
  BenefitState,
  CibRecord,
  EMPTY_PROGRESS_REVIEW,
  EMPTY_FOLLOW_UP_VISIT_ACTIONS,
  EMPTY_MEDICATION_RENEW_NOTES,
} from '@/types';
import {
  buildFollowUpAssessmentNote,
  buildVisitContextNotes,
  deriveTreatmentDecisionFromVisitActions,
  getDiagnosticClinicalNoteFromPortfolio,
  hasFollowUpVisitActionsSelected,
} from '@/lib/followUpContext';
import { normalizeConditionName } from '@/lib/conditionNames';
import { resolveActiveMedicationsAfterChange } from '@/lib/medicationChange';
import {
  benefitStateLabel,
  buildDefaultCibRecord,
  canStartRegisteredPatientActions,
  enrollmentToBenefitState,
  resolveEffectiveBenefitState,
  getCibRecordForCondition,
  getPatientCibRecords,
  getPatientEnrollmentStatus,
  getPatientMedicalScheme,
  isWorkflowA,
  isWorkflowB,
} from '@/lib/benefitState';
import { canProceedFromEvidenceReview, deriveEvidenceFromDiagnostics } from '@/lib/diagnosticEvidence';
import {
  buildCareActionFromTemplate,
  findActionForRequirement,
} from '@/lib/careActions';
import type { PatientExportData } from '@/lib/patientExport';
import AppSidebar from '@/components/AppSidebar';
import PatientRecordPicker from '@/components/PatientRecordPicker';
import PatientRecordView from '@/components/PatientRecordView';
import DirectoryListingSettings from '@/components/DirectoryListingSettings';
import { normalizePatientCase } from '@/lib/normalizePatientCase';
import {
  getConditionRules,
  loadCibRegistrationRules,
  resolveApprovalPathForPractitioner,
  getAllowedConditionsForRole,
} from '@/lib/cibRegistrationRules';
import {
  createCaseId,
  createProfileId,
  filterCasesByProfile,
  filterPortfolioClaimsByProfile,
  findResumableClaim,
  getLatestMedicationsFromPortfolio,
  hydratePortfolioMedications,
  isIncompleteClaim,
  mergeWorkspaceCaseFromRemote,
  portfolioClaims,
  pruneSupersededPortfolioDrafts,
  resolveProfileId,
  resolveProfileIdForSave,
  validateNewPatientIntake,
} from '@/lib/patientPortfolio';

type UserRole = 'assistant' | 'doctor';

type AppView =
  | 'landing'
  | 'onboarding'
  | 'assistant-home'
  | 'dashboard'
  | 'settings'
  | 'patient-info'
  | 'patient-profile'
  | 'patient-record'
  | 'case-options'
  | 'workflow';

/**
 * Pure computation of the local-state patch a specialist's completed CIB
 * handoff should apply to a case — shared by the single-case check (on
 * manual case open) and the dashboard-wide bulk check. Returns null when
 * there is nothing new to apply (already registered locally).
 */
function computeHandoffPatch(
  current: PatientCase,
  handoff: CaseRegistrationHandoff
): Partial<PatientCase> | null {
  const handoffMedications = handoff.medications ?? [];
  const needsMedications =
    handoffMedications.length > 0 && (current.medications?.length ?? 0) === 0;
  const needsRegistration = current.cibEnrollmentStatus !== 'registered';
  const needsAwaitingClear = current.awaitingSpecialist === true;

  if (!needsRegistration && !needsMedications && !needsAwaitingClear) return null;

  const patch: Partial<PatientCase> = {
    awaitingSpecialist: false,
  };

  if (needsRegistration) {
    const conditionName = current.condition;
    const existingCibRecords = current.cibRecords ?? [];
    const idx = conditionName ? existingCibRecords.findIndex((r) => r.conditionName === conditionName) : -1;
    const handoffRecord: CibRecord = {
      conditionName: conditionName || existingCibRecords[idx]?.conditionName || '',
      icd10: handoff.icdCode || current.icdCode,
      diagnosisDate: handoff.diagnosisDate ?? undefined,
      submissionDate: handoff.registrationCompletedAt?.slice(0, 10),
      benefitState: 'approved_chronic',
      formularyAligned: true,
    };
    const cibRecords =
      idx === -1
        ? [...existingCibRecords, handoffRecord]
        : existingCibRecords.map((r, i) => (i === idx ? { ...r, ...handoffRecord } : r));

    patch.cibEnrollmentStatus = 'registered';
    patch.icdCode = handoff.icdCode || current.icdCode;
    patch.icdDescription = handoff.icdDescription || current.icdDescription;
    patch.cibRecords = cibRecords;
  }

  if (needsMedications) {
    patch.medications = handoffMedications;
  }

  return patch;
}

export default function Home() {
  const store = useStore();
  const auth = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matchedConditions, setMatchedConditions] = useState<MatchedCondition[]>([]);
  const [conditionSelectionMode, setConditionSelectionMode] = useState<'authi' | 'manual'>('authi');
  const [lastAnalyzedNote, setLastAnalyzedNote] = useState('');
  const [currentClaimType, setCurrentClaimType] = useState<ClaimType>('diagnostic');
  const [showClaimCompletion, setShowClaimCompletion] = useState(false);
  const [emailDeliveryConfigured, setEmailDeliveryConfigured] = useState(false);
  const [claimCompletionSource, setClaimCompletionSource] = useState<'cib' | 'final' | 'follow-up'>('final');
  const [pendingFollowUpPayload, setPendingFollowUpPayload] = useState<FollowUpCompletionPayload | null>(null);
  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [medicalAidNumber, setMedicalAidNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPatientExport, setShowPatientExport] = useState(false);
  const [newReferralCount, setNewReferralCount] = useState(0);

  const practiceName = auth.workspace?.name ?? '';
  const doctorName = getDoctorDisplayName(auth.profile);
  const practitionerRole = auth.profile?.practitionerRole ?? 'gp';
  const assistantMember = auth.members.find((m) => m.role === 'assistant');
  const assistantName = assistantMember?.displayName || 'Assistant';
  const hasActiveAssistant = auth.members.some(
    (m) => m.role === 'assistant' && m.status === 'active'
  );
  const hasPendingAssistantInvite = auth.invites.some((i) => i.status === 'pending');
  const assistantWorkspaceReady = hasActiveAssistant || hasPendingAssistantInvite;
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [landingRole, setLandingRole] = useState<UserRole>('doctor');

  // View state
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [currentCaseForView, setCurrentCaseForView] = useState<PatientCase | null>(null);
  const [registrationHandoffNotice, setRegistrationHandoffNotice] = useState<{
    caseId: string;
    icdCode: string;
    diagnosisDate: string | null;
    completedAt: string;
  } | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [recordProfileId, setRecordProfileId] = useState<string | null>(null);
  // Prefill data for "New Claim for this Patient"
  const [patientInfoPrefill, setPatientInfoPrefill] = useState<Partial<PatientInfo> | undefined>(undefined);

  const [showCibAssistant, setShowCibAssistant] = useState(false);
  const [isCibSubmitting, setIsCibSubmitting] = useState(false);
  const [cibAssistantCondition, setCibAssistantCondition] = useState('');

  useEffect(() => {
    const init = async () => {
      const scheme =
        (store.currentCaseId &&
          store.cases.find((c) => c.id === store.currentCaseId)?.medicalScheme) ||
        'discovery';
      DataService.setActiveScheme(scheme);
      await DataService.initialize(scheme);
      setIsInitialized(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (auth.isAssistant) {
      setUserRole('assistant');
    } else if (auth.isOwner) {
      setUserRole('doctor');
    }
  }, [auth.isAssistant, auth.isOwner]);

  useEffect(() => {
    if (auth.isAssistant && auth.workspace && currentView === 'landing') {
      setCurrentView('assistant-home');
    }
  }, [auth.isAssistant, auth.workspace, currentView]);

  useEffect(() => {
    if (auth.isOwner && !assistantWorkspaceReady) {
      setLandingRole('doctor');
    }
  }, [auth.isOwner, assistantWorkspaceReady]);

  useEffect(() => {
    if (!auth.user) {
      setEmailDeliveryConfigured(false);
      return;
    }
    void fetchEmailDeliveryConfigured().then(setEmailDeliveryConfigured);
  }, [auth.user]);

  // Cross-account reality: GP logs out, specialist logs in/out, then GP logs
  // back in. Local persisted cases can be stale across that switch, so always
  // merge authoritative workspace cases from Supabase on session/workspace load.
  useEffect(() => {
    if (!auth.user || !auth.workspace?.id) return;

    let cancelled = false;
    const syncCasesFromWorkspace = async () => {
      const result = await getAllCases(auth.workspace!.id);
      if (!result.success || cancelled) return;

      // Drop any locally-persisted case that doesn't belong to the workspace
      // we're now logged into. Without this, cases from a previous account
      // on this browser (e.g. a GP's patient) leak into the next account
      // that logs in (e.g. a specialist) via the localStorage-backed store.
      const currentCases = useStore
        .getState()
        .cases.filter((c) => c.workspaceId === auth.workspace!.id);
      const byId = new Map(currentCases.map((c) => [c.id, c]));

      for (const row of result.cases as Record<string, any>[]) {
        const mapped = normalizePatientCase({
          id: row.id,
          patientName: row.patient_name ?? '',
          patientId: row.patient_id ?? '',
          patientEmail: row.patient_email ?? undefined,
          patientPhone: row.patient_phone ?? undefined,
          medicalAidNumber: row.medical_aid_number ?? undefined,
          clinicalNote: row.clinical_note ?? '',
          condition: row.condition_name ?? '',
          icdCode: row.icd_code ?? '',
          icdDescription: row.icd_description ?? '',
          medicationNote: row.medication_note ?? '',
          plan: row.plan ?? 'Core',
          status: row.status ?? 'draft',
          workspaceId: row.workspace_id ?? undefined,
          deliveryStatus: row.delivery_status ?? undefined,
          doctorApproved: row.doctor_approved ?? undefined,
          createdAt: row.created_at ? new Date(row.created_at) : new Date(),
          updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
        });

        const existing = byId.get(mapped.id);
        byId.set(
          mapped.id,
          normalizePatientCase(
            mergeWorkspaceCaseFromRemote(
              existing ? normalizePatientCase(existing) : undefined,
              mapped
            )
          )
        );
      }

      const merged = Array.from(byId.values());
      const removeIds = new Set<string>();
      const profileIds = new Set(merged.map((c) => resolveProfileId(c)));
      for (const profileId of profileIds) {
        for (const id of pruneSupersededPortfolioDrafts(merged, profileId)) {
          removeIds.add(id);
        }
      }

      useStore.setState({ cases: merged.filter((c) => !removeIds.has(c.id)) });
    };

    void syncCasesFromWorkspace();
    return () => {
      cancelled = true;
    };
  }, [auth.user, auth.workspace?.id]);

  const isPracticeReady = Boolean(auth.workspace?.id);

  const notifyPatientDeliveryResult = (
    email: string,
    delivery: Awaited<ReturnType<typeof deliverClaimToPatient>>
  ) => {
    if (delivery.method === 'automated') {
      alert(`Claim package emailed to ${email}.`);
      return;
    }
    const isNotConfigured = delivery.reason.includes('RESEND_');
    alert(
      isNotConfigured
        ? `Automated email is not configured yet.\n\n${delivery.reason}\n\nThe claim ZIP was downloaded and your email app was opened — attach the file before you send.`
        : `Could not send automatically: ${delivery.reason}\n\nThe claim ZIP was downloaded and your email app was opened instead.`
    );
  };

  const handleOpenAssistantWorkspace = () => {
    if (!isPracticeReady) return;
    setLandingRole('assistant');
    setUserRole('assistant');
    setCurrentView('assistant-home');
  };

  const handleOpenDoctorWorkspace = () => {
    if (!isPracticeReady) return;
    setLandingRole('doctor');
    setUserRole('doctor');
    setCurrentView('dashboard');
  };

  const handleAssistantNewCase = () => {
    setUserRole('assistant');
    store.resetWorkflow();
    setPatientName('');
    setPatientId('');
    setPatientEmail('');
    setPatientPhone('');
    setMedicalAidNumber('');
    setMatchedConditions([]);
    setConditionSelectionMode('authi');
    setLastAnalyzedNote('');
    setCurrentView('patient-info');
  };

  const handleAssistantViewRecords = () => {
    setUserRole('assistant');
    setCurrentView('dashboard');
  };

  const clearActiveCaseContext = () => {
    setSelectedCaseId(null);
    setCurrentCaseForView(null);
    setPatientName('');
    setPatientId('');
    setPatientEmail('');
    setPatientPhone('');
    setMedicalAidNumber('');
    setMatchedConditions([]);
    setConditionSelectionMode('authi');
    setLastAnalyzedNote('');
    store.resetWorkflow();
  };

  const handleBackToDoctorWorkspace = () => {
    clearActiveCaseContext();
    setUserRole('doctor');
    setLandingRole('doctor');
    setCurrentView('landing');
  };

  const handleBackToAssistantHome = () => {
    clearActiveCaseContext();
    setUserRole('assistant');
    setCurrentView('assistant-home');
  };

  /** Leave patient management / workflow and return to the role workspace hub */
  const handleBackToWorkspace = () => {
    if (userRole === 'assistant') {
      handleBackToAssistantHome();
    } else {
      handleBackToDoctorWorkspace();
    }
  };

  const handleOpenReports = () => {
    setRecordProfileId(null);
    setCurrentView('patient-record');
  };

  const handleOpenPatientRecord = (profileId: string) => {
    setRecordProfileId(profileId);
    setCurrentView('patient-record');
  };

  const handleChangeRecordPatient = () => {
    setRecordProfileId(null);
  };

  const handleBackFromPatientRecord = () => {
    if (recordProfileId && selectedProfileId === recordProfileId) {
      handleBackToPatientProfile();
    } else {
      handleBackToDashboard();
    }
  };

  const handleLogout = async () => {
    await auth.signOutAccount();
    setUserRole(null);
    setCurrentView('landing');
    setSelectedCaseId(null);
    setCurrentCaseForView(null);
    setPatientName('');
    setPatientId('');
    setPatientEmail('');
    setPatientPhone('');
    setMedicalAidNumber('');
    store.resetWorkflow();
  };

  const handleDeleteAccount = async () => {
    const typed = window.prompt(
      'Delete your account permanently?\n\nType DELETE to confirm.\n\nThis removes your workspace, cases, and profile, then frees your email so it can be used again.'
    );
    if (typed?.trim().toUpperCase() !== 'DELETE') return;

    const { error } = await auth.deleteAccount();
    if (error) {
      alert(`Could not delete account: ${error}`);
      return;
    }

    alert('Account deleted. You can now sign up again with the same email.');
    setUserRole(null);
    setCurrentView('landing');
    setSelectedCaseId(null);
    setCurrentCaseForView(null);
    setSelectedProfileId(null);
    setRecordProfileId(null);
    setPatientName('');
    setPatientId('');
    setPatientEmail('');
    setPatientPhone('');
    setMedicalAidNumber('');
    store.resetWorkflow();
  };

  // Dashboard workflow handlers
  const handleNewCaseClick = () => {
    if (userRole !== 'assistant') {
      setUserRole('doctor');
    }
    store.resetWorkflow();
    setSelectedProfileId(null);
    setPatientInfoPrefill(undefined);
    setPatientName('');
    setPatientId('');
    setPatientEmail('');
    setPatientPhone('');
    setMedicalAidNumber('');
    setMatchedConditions([]);
    setConditionSelectionMode('authi');
    setLastAnalyzedNote('');
    setCurrentView('patient-info');
  };

  const handlePatientInfoSubmit = (patientInfo: PatientInfo) => {
    const intakeCheck = validateNewPatientIntake(
      store.cases,
      patientInfo.patientId,
      patientInfo.patientName
    );
    if (!intakeCheck.ok) {
      alert(intakeCheck.message);
      return;
    }

    setPatientName(patientInfo.patientName);
    setPatientId(patientInfo.patientId);
    setPatientEmail(patientInfo.patientEmail);
    setPatientPhone(patientInfo.patientPhone);
    setMedicalAidNumber(patientInfo.medicalAidNumber);
    store.setSelectedPlan(patientInfo.plan);

    const isAssistantIntake = userRole === 'assistant';
    const newProfileId = createProfileId();

    if (patientInfo.claimType) {
      setCurrentClaimType(patientInfo.claimType);
    }

    const enrollment = patientInfo.cibEnrollmentStatus;
    const scheme = patientInfo.medicalScheme;
    DataService.setActiveScheme(scheme);
    void DataService.initialize(scheme);

    const newCase: PatientCase = {
      id: createCaseId(),
      profileId: newProfileId,
      patientName: patientInfo.patientName,
      patientId: patientInfo.patientId,
      patientEmail: patientInfo.patientEmail,
      patientPhone: patientInfo.patientPhone,
      medicalAidNumber: patientInfo.medicalAidNumber,
      medicalScheme: scheme,
      cibEnrollmentStatus: enrollment,
      ...(enrollment === 'unregistered' ? { claimType: 'diagnostic' as ClaimType } : {}),
      ...(patientInfo.claimType ? { claimType: patientInfo.claimType } : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
      clinicalNote: '',
      condition: '',
      icdCode: '',
      icdDescription: '',
      diagnosticTreatments: [],
      ongoingTreatments: [],
      medications: [],
      medicationNote: '',
      plan: patientInfo.plan,
      status: 'new',
      cibRecords: [],
      workspaceId: auth.workspace?.id,
      deliveryStatus: 'draft',
    };

    store.addCase(newCase);
    setSelectedCaseId(newCase.id);
    setPatientInfoPrefill(undefined);

    store.setActiveBenefitState(enrollmentToBenefitState(enrollment));
    if (enrollment === 'unregistered') {
      setCurrentClaimType('diagnostic');
    } else if (patientInfo.claimType) {
      setCurrentClaimType(patientInfo.claimType);
    }

    if (isAssistantIntake) {
      setCurrentCaseForView(normalizePatientCase(newCase));
      setCurrentView('case-options');
      return;
    }

    if (!patientInfo.claimType) {
      alert('Please select a claim type to continue.');
      return;
    }

    setCurrentView('workflow');
  };

  const handleDoctorSelectClaimType = (caseId: string, claimType: ClaimType) => {
    const caseData = store.cases.find((c) => c.id === caseId);
    if (
      caseData?.cibEnrollmentStatus === 'unregistered' &&
      caseData.status === 'new' &&
      claimType !== 'diagnostic'
    ) {
      alert('Unregistered patients must start with the diagnostic evidence workflow.');
      return;
    }
    store.updateCase(caseId, { claimType, updatedAt: new Date() });
    setCurrentClaimType(claimType);
    if (currentCaseForView?.id === caseId) {
      setCurrentCaseForView(
        normalizePatientCase({ ...currentCaseForView, claimType, updatedAt: new Date() })
      );
    }
  };

  /**
   * Phase 3 GP-side handoff bridge: the GP's benefitState/CibRecord system is
   * entirely local Zustand/localStorage state with no read path from Supabase.
   * Rather than rewiring that system, check on case open whether a specialist
   * has completed registration against this case in their own workspace, and
   * if so, fold that outcome into this case's local record — flips
   * cibEnrollmentStatus to 'registered' and adds an approved_chronic CibRecord
   * so CaseOptionsView's existing claimTypeRecommendation() naturally steers
   * future claims on this patient toward ongoing-management/medication-report.
   */
  const applyRegistrationHandoffIfPresent = async (caseId: string) => {
    const result = await fetchCaseRegistrationHandoff(caseId);
    if (!result.success || !result.handoff?.isRegistered) return;
    const handoff = result.handoff;

    const current = useStore.getState().cases.find((c) => c.id === caseId);
    if (!current) return;

    setRegistrationHandoffNotice({
      caseId,
      icdCode: handoff.icdCode || current.icdCode,
      diagnosisDate: handoff.diagnosisDate,
      completedAt: handoff.registrationCompletedAt ?? new Date().toISOString(),
    });

    // The GP is looking at this case right now — clear the unseen-handoff
    // badge even if the patch itself was already applied by an earlier
    // bulk dashboard check.
    store.updateCase(caseId, { specialistHandoffAcknowledged: true });

    const patch = computeHandoffPatch(current, handoff);
    if (!patch) return; // already applied, nothing new to fold in

    store.updateCase(caseId, patch);

    setCurrentCaseForView((prev) =>
      prev && prev.id === caseId ? normalizePatientCase({ ...prev, ...patch }) : prev
    );
  };

  /**
   * Dashboard-wide counterpart to applyRegistrationHandoffIfPresent — checks
   * every case that isn't already known to be registered/acknowledged, so
   * the GP sees a "specialist completed CIB" badge on the case list without
   * having to open each case individually.
   *
   * Deliberately does NOT gate on `referrals.length > 0` — that local array
   * is only populated by one specific referral entry point (the CIB
   * investigation referral form) and can be empty even when a real
   * Supabase-side referral/registration exists for the case (e.g. the case
   * was referred from a different browser/session, or through the
   * PDF-only Referral flow that never touches this field). Checking by
   * case id against Supabase directly is the only reliable signal.
   */
  const checkOutstandingHandoffsForDashboard = async () => {
    const candidateIds = useStore
      .getState()
      .cases.filter((c) => !c.specialistHandoffAcknowledged)
      .map((c) => c.id);

    if (candidateIds.length === 0) return;

    const result = await fetchCaseRegistrationHandoffsBulk(candidateIds);
    if (!result.success) return;

    for (const [caseId, handoff] of Object.entries(result.handoffs)) {
      const current = useStore.getState().cases.find((c) => c.id === caseId);
      if (!current) continue;

      const patch = computeHandoffPatch(current, handoff);
      store.updateCase(caseId, {
        ...(patch ?? {}),
        specialistHandoffAcknowledged: false,
      });
    }
  };

  useEffect(() => {
    if (currentView !== 'dashboard') return;

    void checkOutstandingHandoffsForDashboard();
    // Keep dashboard in sync with specialist submissions that may complete
    // after the GP has already opened this screen.
    const interval = setInterval(() => {
      void checkOutstandingHandoffsForDashboard();
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  useEffect(() => {
    if (currentView !== 'dashboard' || !auth.workspace?.id) return;

    const refreshReferralCount = async () => {
      const count = await fetchActionableInboundReferralCount(auth.workspace!.id);
      setNewReferralCount(count);
    };
    const handleFocus = () => void refreshReferralCount();

    void refreshReferralCount();
    const interval = setInterval(() => void refreshReferralCount(), 30000);
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [auth.workspace?.id, currentView]);

  const handleViewCase = (caseId: string) => {
    const caseData = store.cases.find(c => c.id === caseId);
    if (caseData) {
      setSelectedCaseId(caseId);
      setSelectedProfileId(resolveProfileId(caseData));
      setCurrentCaseForView(normalizePatientCase(caseData));
      setCurrentView('case-options');
      void applyRegistrationHandoffIfPresent(caseId);
    }
  };

  const backfillEnrollmentForProfile = (profileId: string) => {
    const profileCases = filterCasesByProfile(store.cases, profileId);
    if (profileCases.length === 0) return;
    const medicalPatientId = profileCases[0].patientId;
    const chronicForProfile = store.chronicCases.filter((c) => c.profileId === profileId);
    const unlocked =
      canStartRegisteredPatientActions(store.cases, medicalPatientId, chronicForProfile) ||
      profileCases.some(
        (c) =>
          c.status === 'completed' &&
          Boolean(c.condition?.trim()) &&
          Boolean(c.icdCode?.trim())
      ) ||
      chronicForProfile.some(
        (c) => c.registrationStatus === 'submitted' || c.registrationStatus === 'complete'
      );
    if (!unlocked) return;
    for (const claim of profileCases) {
      if (claim.cibEnrollmentStatus !== 'registered') {
        store.updateCase(claim.id, { cibEnrollmentStatus: 'registered' });
      }
    }
  };

  const propagateEnrollmentRegistered = (medicalPatientId: string) => {
    for (const claim of store.cases) {
      if (claim.patientId !== medicalPatientId) continue;
      if (claim.cibEnrollmentStatus === 'registered') continue;
      store.updateCase(claim.id, { cibEnrollmentStatus: 'registered' });
    }
  };

  const handleViewPatientProfile = (profileId: string) => {
    purgeStaleDraftsForProfile(profileId);
    backfillEnrollmentForProfile(profileId);
    // Force unlock after CIB submit even when chronic profile ids drifted
    const profileCases = filterCasesByProfile(useStore.getState().cases, profileId);
    const medicalPatientId = profileCases[0]?.patientId;
    if (medicalPatientId) {
      const chronic = useStore
        .getState()
        .chronicCases.filter((c) => c.profileId === profileId);
      if (canStartRegisteredPatientActions(useStore.getState().cases, medicalPatientId, chronic)) {
        propagateEnrollmentRegistered(medicalPatientId);
      }
    }
    setSelectedProfileId(profileId);
    setCurrentView('patient-profile');
  };

  const handleStartClinicalNote = () => {
    if (userRole === 'assistant') return;
    if (selectedCaseId && currentCaseForView && !currentCaseForView.claimType) {
      alert('Select a claim type before starting the workflow.');
      return;
    }
    if (selectedCaseId && currentCaseForView) {
      setPatientName(currentCaseForView.patientName);
      setPatientId(currentCaseForView.patientId);
      setPatientEmail(currentCaseForView.patientEmail || '');
      setPatientPhone(currentCaseForView.patientPhone || '');
      setMedicalAidNumber(currentCaseForView.medicalAidNumber || '');
      setCurrentClaimType(currentCaseForView.claimType ?? 'diagnostic');
      const scheme = currentCaseForView.medicalScheme ?? 'discovery';
      DataService.setActiveScheme(scheme);
      void DataService.initialize(scheme);
      store.loadCase(selectedCaseId);
      store.setCurrentStep(0);
      setCurrentView('workflow');
    }
  };

  const handleContinueWorkflow = () => {
    if (userRole === 'assistant') return;
    if (selectedCaseId && currentCaseForView && !currentCaseForView.claimType) {
      alert('Select a claim type before continuing the workflow.');
      return;
    }
    if (selectedCaseId && currentCaseForView) {
      setPatientName(currentCaseForView.patientName);
      setPatientId(currentCaseForView.patientId);
      setPatientEmail(currentCaseForView.patientEmail || '');
      setPatientPhone(currentCaseForView.patientPhone || '');
      setMedicalAidNumber(currentCaseForView.medicalAidNumber || '');
      setCurrentClaimType(currentCaseForView.claimType ?? 'diagnostic');
      const scheme = currentCaseForView.medicalScheme ?? 'discovery';
      DataService.setActiveScheme(scheme);
      void DataService.initialize(scheme);
      store.loadCase(selectedCaseId);

      const claimType = currentCaseForView.claimType ?? 'diagnostic';
      if (claimType === 'ongoing-management') {
        store.setCurrentStep(resumeChronicFollowUpStep(currentCaseForView));
      } else if (claimType === 'medication-report') {
        store.setCurrentStep(0);
      } else {
        const unregFlow =
          claimType === 'diagnostic' &&
          (currentCaseForView.cibEnrollmentStatus === 'unregistered' ||
            isWorkflowA(currentCaseForView.cibRecords?.[0]?.benefitState));
        let startStep = 0;
        if (currentCaseForView.clinicalNote) startStep = 1;
        if (unregFlow) {
          if (currentCaseForView.condition) startStep = 2;
          if (currentCaseForView.diagnosticTreatments.length > 0) startStep = 3;
          if (currentCaseForView.icdCode) startStep = 4;
          if (currentCaseForView.medications.length > 0) startStep = 4;
          if (currentCaseForView.medicationNote) startStep = 5;
        } else {
          if (currentCaseForView.condition) startStep = 2;
          if (currentCaseForView.diagnosticTreatments.length > 0) startStep = 3;
          if (currentCaseForView.icdCode) startStep = 4;
          if (currentCaseForView.medications.length > 0) startStep = 4;
          if (currentCaseForView.medicationNote) startStep = 5;
        }
        store.setCurrentStep(startStep);
      }
      setCurrentView('workflow');
    }
  };

  const handleBackToDashboard = () => {
    abandonWorkflowDraft();
    setCurrentView('dashboard');
    setSelectedCaseId(null);
    setCurrentCaseForView(null);
    store.resetWorkflow();
    setPatientName('');
    setPatientId('');
    setPatientEmail('');
    setPatientPhone('');
    setMedicalAidNumber('');
    setMatchedConditions([]);
    setConditionSelectionMode('authi');
    setLastAnalyzedNote('');
  };

  /**
   * A sent CIB referral is a deliberate pause, not an abandoned workflow.
   * Keep the case visible/resumable in the workspace, mark it as awaiting the
   * specialist, and close the GP's CIB screen after they dismiss the sent note.
   */
  const closeCibAfterReferral = () => {
    const caseId = store.currentCaseId || selectedCaseId;
    if (caseId) {
      store.updateCase(caseId, {
        status: 'ongoing',
        isWorkflowDraft: false,
        awaitingSpecialist: true,
        updatedAt: new Date(),
      });
    }

    setCurrentView('dashboard');
    setSelectedCaseId(null);
    setCurrentCaseForView(null);
    store.resetWorkflow();
    setPatientName('');
    setPatientId('');
    setPatientEmail('');
    setPatientPhone('');
    setMedicalAidNumber('');
    setMatchedConditions([]);
    setConditionSelectionMode('authi');
    setLastAnalyzedNote('');
  };

  const handleBackToPatientProfile = () => {
    abandonWorkflowDraft();
    setCurrentView('patient-profile');
    setSelectedCaseId(null);
    setCurrentCaseForView(null);
  };

  /** Remove unsaved New Case Action drafts when leaving the workflow without saving */
  const abandonWorkflowDraft = () => {
    const draftId = store.currentCaseId || selectedCaseId;
    if (!draftId) return;
    const draft = store.cases.find((c) => c.id === draftId);
    if (!draft?.isWorkflowDraft) return;
    // Once a condition is chosen the case is synced to Supabase — keep it as the single resumable draft
    if (draft.condition?.trim() || draft.status === 'draft') {
      store.updateCase(draftId, {
        isWorkflowDraft: false,
        status: draft.status === 'new' ? 'draft' : draft.status,
      });
      return;
    }
    store.deleteCase(draftId);
    setSelectedCaseId(null);
  };

  const purgeStaleDraftsForProfile = (profileId: string, keepCaseId?: string) => {
    for (const caseId of pruneSupersededPortfolioDrafts(store.cases, profileId)) {
      if (caseId === keepCaseId) continue;
      store.deleteCase(caseId);
    }
  };

  const purgeSupersededIncompleteClaims = (
    profileId: string,
    keepCaseId: string,
    condition: string,
    claimType: ClaimType
  ) => {
    const targetCondition = condition.trim().toLowerCase();
    for (const claim of filterCasesByProfile(store.cases, profileId)) {
      if (claim.id === keepCaseId || !isIncompleteClaim(claim)) continue;
      if ((claim.condition ?? '').trim().toLowerCase() !== targetCondition) continue;
      if ((claim.claimType ?? 'diagnostic') !== claimType) continue;
      store.deleteCase(claim.id);
    }
  };

  const resumeDiagnosticWorkflow = (
    profileId: string,
    condition: string,
    claimCase: PatientCase
  ) => {
    purgeSupersededIncompleteClaims(profileId, claimCase.id, condition, 'diagnostic');

    const chronicCase = store.getChronicCase(profileId, condition);

    store.resetWorkflow();
    store.loadCase(claimCase.id);
    setMatchedConditions([]);
    setConditionSelectionMode('manual');
    setCurrentClaimType('diagnostic');
    setPatientName(claimCase.patientName);
    setPatientId(claimCase.patientId);
    setPatientEmail(claimCase.patientEmail || '');
    setPatientPhone(claimCase.patientPhone || '');
    setMedicalAidNumber(claimCase.medicalAidNumber || '');
    store.setSelectedPlan(claimCase.plan);
    store.setClinicalNote(claimCase.clinicalNote || '');
    store.setSelectedCondition(
      condition,
      chronicCase?.icdCode ?? claimCase.icdCode,
      claimCase.icdDescription
    );
    store.setDiagnosisDate(chronicCase?.diagnosisDate ?? store.diagnosisDate);
    store.setActiveBenefitState('unregistered');
    setSelectedCaseId(claimCase.id);
    setSelectedProfileId(profileId);
    store.ensureChronicCase(profileId, condition, {
      icdCode: chronicCase?.icdCode,
      approvalPathId: chronicCase?.approvalPathId,
    });
    void store.spawnChronicCaseRegistrationActions(profileId, condition, practitionerRole);
    store.setCurrentStep(2);
    setCurrentView('workflow');
  };

  const handleSidebarNavigate = (view: AppView) => {
    if (currentView === 'workflow' && view !== 'workflow') {
      abandonWorkflowDraft();
      store.resetWorkflow();
    }
    setCurrentView(view);
  };

  /**
   * Called from PatientProfile when the doctor selects a case action type.
   * Creates a draft claim for the existing patient (hidden from portfolio until saved),
   * pre-fills data from their latest case, and routes into the relevant workflow.
   */
  const handleNewCaseActionForPatient = (profileId: string, claimType: ClaimType) => {
    abandonWorkflowDraft();

    const patientCases = filterPortfolioClaimsByProfile(store.cases, profileId);
    if (patientCases.length === 0) return;

    const latest = [...patientCases].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];

    const chronicForProfile = store.chronicCases.filter((c) => c.profileId === profileId);
    if (
      claimType !== 'diagnostic' &&
      !canStartRegisteredPatientActions(store.cases, latest.patientId, chronicForProfile)
    ) {
      alert('Complete chronic registration before starting this visit type.');
      return;
    }

    const startCaseAction = (hydratedCases: typeof patientCases) => {
      const withCondition = hydratedCases
        .filter((c) => c.condition)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

      const canStartRegistered = canStartRegisteredPatientActions(
        store.cases,
        latest.patientId,
        chronicForProfile
      );
      const effectiveClaimType: ClaimType = canStartRegistered ? claimType : 'diagnostic';

      const resumable =
        findResumableClaim(store.cases, profileId, {
          claimType: effectiveClaimType,
          condition: withCondition?.condition,
        }) ??
        findResumableClaim(store.cases, profileId, { claimType: effectiveClaimType });

      if (resumable) {
        if (effectiveClaimType === 'diagnostic' && resumable.condition) {
          resumeDiagnosticWorkflow(profileId, resumable.condition, resumable);
          return;
        }
        purgeSupersededIncompleteClaims(
          profileId,
          resumable.id,
          resumable.condition || withCondition?.condition || '',
          effectiveClaimType
        );
        store.resetWorkflow();
        store.loadCase(resumable.id);
        setMatchedConditions([]);
        setConditionSelectionMode('authi');
        setLastAnalyzedNote('');
        setCurrentClaimType(effectiveClaimType);
        setPatientName(resumable.patientName);
        setPatientId(resumable.patientId);
        setPatientEmail(resumable.patientEmail || '');
        setPatientPhone(resumable.patientPhone || '');
        setMedicalAidNumber(resumable.medicalAidNumber || '');
        store.setSelectedPlan(resumable.plan);
        setSelectedCaseId(resumable.id);
        setSelectedProfileId(profileId);
        setCurrentView('workflow');
        return;
      }

      store.resetWorkflow();
      setMatchedConditions([]);
      setConditionSelectionMode('authi');
      setLastAnalyzedNote('');
      setCurrentClaimType(claimType);
      setPatientName(latest.patientName);
      setPatientId(latest.patientId);
      setPatientEmail(latest.patientEmail || '');
      setPatientPhone(latest.patientPhone || '');
      setMedicalAidNumber(latest.medicalAidNumber || '');
      store.setSelectedPlan(latest.plan);

      if (claimType !== 'diagnostic' && withCondition) {
        store.setSelectedCondition(
          withCondition.condition,
          withCondition.icdCode,
          withCondition.icdDescription
        );
      }

      const medSource = getLatestMedicationsFromPortfolio(hydratedCases);

      if (
        (claimType === 'medication-report' || claimType === 'ongoing-management' || claimType === 'specialist-review') &&
        medSource.medications.length > 0
      ) {
        medSource.medications.forEach((med) => store.addMedication(med));
        store.setMedicationNote(medSource.medicationNote);
      }

      const newCase: PatientCase = {
        id: createCaseId(),
        profileId: resolveProfileId(latest),
        patientName: latest.patientName,
        patientId: latest.patientId,
        patientEmail: latest.patientEmail,
        patientPhone: latest.patientPhone,
        medicalAidNumber: latest.medicalAidNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
        clinicalNote: '',
        condition: claimType === 'diagnostic' ? '' : withCondition?.condition || '',
        icdCode: claimType === 'diagnostic' ? '' : withCondition?.icdCode || '',
        icdDescription: claimType === 'diagnostic' ? '' : withCondition?.icdDescription || '',
        diagnosticTreatments: [],
        ongoingTreatments: [],
        medications:
          claimType === 'medication-report' ||
          claimType === 'ongoing-management' ||
          claimType === 'specialist-review'
            ? [...medSource.medications]
            : [],
        medicationNote:
          claimType === 'medication-report' ||
          claimType === 'ongoing-management' ||
          claimType === 'specialist-review'
            ? medSource.medicationNote
            : '',
        plan: latest.plan,
        status: 'new',
        medicalScheme: latest.medicalScheme ?? 'discovery',
        cibEnrollmentStatus: latest.cibEnrollmentStatus ?? 'unregistered',
        claimType:
          (latest.cibEnrollmentStatus ?? 'unregistered') === 'unregistered'
            ? 'diagnostic'
            : claimType,
        cibRecords: latest.cibRecords ?? [],
        isWorkflowDraft: true,
        workspaceId: auth.workspace?.id,
      };

      store.addCase(newCase);
      setSelectedCaseId(newCase.id);
      setSelectedProfileId(profileId);

      if (claimType === 'diagnostic') {
        store.setActiveBenefitState('unregistered');
        store.setDiagnosisDate('');
      } else {
        const conditionName = withCondition?.condition || '';
        const conditionRecord = getCibRecordForCondition(
          [...hydratedCases, newCase],
          latest.patientId,
          conditionName
        );
        store.setActiveBenefitState(
          resolveEffectiveBenefitState(
            newCase.cibEnrollmentStatus ?? 'unregistered',
            conditionRecord?.benefitState
          )
        );
        if (conditionRecord?.diagnosisDate) {
          store.setDiagnosisDate(conditionRecord.diagnosisDate);
        }
      }
      DataService.setActiveScheme(newCase.medicalScheme ?? 'discovery');
      void DataService.initialize(newCase.medicalScheme ?? 'discovery');

      if (claimType === 'ongoing-management' || claimType === 'specialist-review') {
        store.setCurrentStep(0);
        store.setProgressReview({ ...EMPTY_PROGRESS_REVIEW });
        store.setFollowUpVisitActions({ ...EMPTY_FOLLOW_UP_VISIT_ACTIONS });
        store.setMedicationMode(null);
        store.setMedicationRenewNotes({ ...EMPTY_MEDICATION_RENEW_NOTES });
        store.setTreatmentDecision(null);
        store.setClinicalReview(null);
        store.setMonitoringSkipped(false);
      }

      setCurrentView('workflow');
    };

    if (claimType === 'medication-report' || claimType === 'ongoing-management' || claimType === 'specialist-review') {
      void hydratePortfolioMedications(patientCases, (caseId, medications) => {
        store.updateCase(caseId, { medications });
      }).then(startCaseAction);
      return;
    }

    startCaseAction(patientCases);
  };

  const handleContinueRegistration = (profileId: string, condition: string) => {
    const resumable =
      findResumableClaim(store.cases, profileId, { condition, claimType: 'diagnostic' }) ??
      findResumableClaim(store.cases, profileId, { claimType: 'diagnostic' });

    if (resumable) {
      resumeDiagnosticWorkflow(profileId, condition, resumable);
      return;
    }

    const patientCases = filterPortfolioClaimsByProfile(store.cases, profileId);
    const latest =
      patientCases.find((c) => c.condition === condition) ??
      [...patientCases].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
    if (!latest) return;

    const chronicCase = store.getChronicCase(profileId, condition);

    store.resetWorkflow();
    setMatchedConditions([]);
    setConditionSelectionMode('manual');
    setCurrentClaimType('diagnostic');
    setPatientName(latest.patientName);
    setPatientId(latest.patientId);
    setPatientEmail(latest.patientEmail || '');
    setPatientPhone(latest.patientPhone || '');
    setMedicalAidNumber(latest.medicalAidNumber || '');
    store.setSelectedPlan(latest.plan);
    store.setClinicalNote(latest.clinicalNote || '');
    store.setSelectedCondition(
      condition,
      chronicCase?.icdCode ?? latest.icdCode,
      latest.icdDescription
    );
    store.setDiagnosisDate(chronicCase?.diagnosisDate ?? store.diagnosisDate);
    store.setActiveBenefitState('unregistered');
    latest.diagnosticTreatments?.forEach((t) => store.addDiagnosticTreatment(t));
    latest.medications?.forEach((m) => store.addMedication(m));
    if (latest.medicationNote) store.setMedicationNote(latest.medicationNote);

    const draftCase: PatientCase = {
      ...latest,
      id: createCaseId(),
      profileId,
      condition,
      icdCode: chronicCase?.icdCode ?? latest.icdCode,
      status: 'draft',
      isWorkflowDraft: true,
      claimType: 'diagnostic',
      cibEnrollmentStatus: 'unregistered',
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    store.addCase(draftCase);
    setSelectedCaseId(draftCase.id);
    setSelectedProfileId(profileId);
    store.ensureChronicCase(profileId, condition, {
      icdCode: chronicCase?.icdCode,
      approvalPathId: chronicCase?.approvalPathId,
    });
    void store.spawnChronicCaseRegistrationActions(profileId, condition, practitionerRole);
    store.setCurrentStep(2);
    setCurrentView('workflow');
  };

  const handleCancelPatientInfo = () => {
    if (userRole === 'assistant') {
      handleBackToAssistantHome();
    } else {
      handleBackToDashboard();
    }
  };

  const exportCaseDocuments = async (caseData: PatientCase, includeAttachments: boolean) => {
    if (
      caseData.status !== 'completed' &&
      !(caseData.condition && caseData.icdCode)
    ) {
      alert('This case is not ready to export yet. Wait until the doctor has saved the patient case.');
      return;
    }

    const pdfService = new PDFExportService();
    if (includeAttachments) {
      await pdfService.exportInitialClaimWithAttachments(caseData);
    } else {
      pdfService.exportInitialClaim(caseData);
    }
  };

  const handleAssistantExportPdf = () => {
    if (currentCaseForView) {
      void exportCaseDocuments(currentCaseForView, false);
    }
  };

  const handleAssistantExportZip = () => {
    if (currentCaseForView) {
      void exportCaseDocuments(currentCaseForView, true);
    }
  };

  const runClinicalNoteAnalysis = async (options?: { advanceOnMatch?: boolean }) => {
    const note = store.clinicalNote.trim();
    if (!note || isAnalyzing) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinical_note: note,
          benefit_state: store.activeBenefitState ?? 'unregistered',
          workflow_mode: isWorkflowB(store.activeBenefitState) ? 'maintenance' : 'registration',
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      store.setExtractedKeywords(data.extracted_keywords || []);

      const conditions = data.matched_conditions || [];
      const mappedConditions = conditions.map((condition: any) => ({
        condition: condition.condition,
        icdCode: condition.icd_code,
        icdDescription: condition.icd_description,
        similarityScore: condition.similarity_score || 0,
      }));

      const deduplicatedConditions = mappedConditions.reduce(
        (acc: MatchedCondition[], current: MatchedCondition) => {
          const existingIndex = acc.findIndex((item) => item.condition === current.condition);
          if (existingIndex === -1) {
            acc.push(current);
          } else if (current.similarityScore > acc[existingIndex].similarityScore) {
            acc[existingIndex] = current;
          }
          return acc;
        },
        []
      );

      setMatchedConditions(deduplicatedConditions);
      setLastAnalyzedNote(note);

      if (options?.advanceOnMatch && deduplicatedConditions.length > 0) {
        setConditionSelectionMode('authi');
        store.setCurrentStep(1);
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      if (options?.advanceOnMatch) {
        const errorMessage = error.message || 'Failed to analyze note. Please try again.';
        alert(
          `Analysis Error: ${errorMessage}\n\nIf this persists, the backend may be initializing. Please wait a moment and try again.`
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = () => {
    void runClinicalNoteAnalysis({ advanceOnMatch: true });
  };

  useEffect(() => {
    if (currentView !== 'workflow' || store.currentStep !== 1) return;
    const note = store.clinicalNote.trim();
    if (!note || isAnalyzing || note === lastAnalyzedNote) return;
    if (matchedConditions.length > 0) return;
    void runClinicalNoteAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run when note/step changes only
  }, [currentView, store.currentStep, store.clinicalNote, isAnalyzing, lastAnalyzedNote, matchedConditions.length]);

  const handleChooseConditionManually = () => {
    if (!store.clinicalNote.trim()) {
      const proceed = confirm(
        'No clinical note entered yet. Continue without documentation? A note is recommended for scheme compliance.'
      );
      if (!proceed) return;
    }
    setConditionSelectionMode('manual');
    store.setCurrentStep(1);
    const note = store.clinicalNote.trim();
    if (note && note !== lastAnalyzedNote && matchedConditions.length === 0) {
      void runClinicalNoteAnalysis();
    }
  };

  const handleSelectConditionName = (condition: string) => {
    store.setSelectedConditionName(condition);
    const pid = patientId || store.cases.find((c) => c.id === store.currentCaseId)?.patientId;
    const workflowCase = store.cases.find((c) => c.id === (store.currentCaseId || selectedCaseId));
    const profileKey = workflowCase ? resolveProfileId(workflowCase) : undefined;
    if (profileKey) {
      store.ensureChronicCase(profileKey, condition);
      void store.spawnChronicCaseRegistrationActions(profileKey, condition, practitionerRole);
    }
    if (pid) {
      const enrollment = getPatientEnrollmentStatus(store.cases, pid);
      const rec = getCibRecordForCondition(store.cases, pid, condition);
      store.setActiveBenefitState(
        resolveEffectiveBenefitState(enrollment, rec?.benefitState)
      );
      if (rec?.diagnosisDate) store.setDiagnosisDate(rec.diagnosisDate);
    }

    // The unregistered-diagnostic pathway (undiagnosed condition -> ChronicRegistrationWorkspace)
    // lets the GP refer to a specialist before the case has ever been explicitly saved. A
    // referral row's case_id FK needs the case to already exist in Supabase, so push a minimal
    // upsert as soon as a condition is chosen — well before the GP can reach the refer button.
    const caseIdToSync = store.currentCaseId || selectedCaseId;
    if (caseIdToSync && isUnregisteredDiagnosticFlow()) {
      void saveCaseToDatabase({
        caseId: caseIdToSync,
        patientName,
        patientId,
        patientEmail,
        patientPhone,
        medicalAidNumber,
        clinicalNote: store.clinicalNote,
        conditionName: condition,
        icdCode: store.selectedIcdCode || '',
        icdDescription: store.selectedIcdDescription || '',
        diagnosticTreatments: store.diagnosticTreatments,
        ongoingTreatments: store.ongoingTreatments,
        medications: store.medications,
        medicationNote: store.medicationNote,
        plan: store.selectedPlan,
        workspaceId: auth.workspace?.id,
        createdBy: auth.user?.id,
      })
        .then(() => {
          store.updateCase(caseIdToSync, {
            condition,
            status: 'draft',
            isWorkflowDraft: false,
          });
        })
        .catch(() => {
          // Non-fatal — referral creation will simply stay local-only if this sync fails
        });
    }
  };

  const handleSelectIcdCode = (icdCode: string, description: string) => {
    if (!store.selectedCondition) return;
    store.setSelectedCondition(store.selectedCondition, icdCode, description);
  };

  const getWorkflowCase = () =>
    store.cases.find((c) => c.id === (store.currentCaseId || selectedCaseId));

  const isUnregisteredDiagnosticFlow = () => {
    const c = getWorkflowCase();
    return (
      currentClaimType === 'diagnostic' &&
      (c?.cibEnrollmentStatus === 'unregistered' || isWorkflowA(store.activeBenefitState))
    );
  };

  const medicationStepIndex = () => 4;
  const finalStepIndex = () => (isUnregisteredDiagnosticFlow() ? 3 : 5);
  const registrationWorkspaceStep = () => 2;

  const handleNextStep = () => {
    if (isSharedCareVisitFlow()) {
      const specialistFlow = isSpecialistReviewFlow();
      if (store.currentStep === 0) {
        if (store.clinicalNote.trim().length < 20) {
          alert('Enter a clinical note before continuing.');
          return;
        }
      }
      if (store.currentStep === 1 && !store.clinicalReview) {
        alert('Confirm whether the condition is improving, stable, or deteriorating.');
        return;
      }
      if (store.currentStep === 2 && !hasFollowUpVisitActionsSelected(store.followUpVisitActions)) {
        alert('Select at least one visit action, or continue current plan only.');
        return;
      }
      if (
        store.currentStep === 2 &&
        store.followUpVisitActions.medication &&
        !specialistFlow &&
        !store.medicationMode
      ) {
        alert('Choose renew script or escalate for treatment change.');
        return;
      }
      if (store.currentStep === 2) {
        const derived =
          specialistFlow && store.followUpVisitActions.medication
            ? { decision: 'change' as const }
            : deriveTreatmentDecisionFromVisitActions(
                store.followUpVisitActions,
                store.medicationMode
              );
        store.setTreatmentDecision(derived);
        if (store.currentCaseId) {
          store.updateCase(store.currentCaseId, {
            followUpVisitActions: store.followUpVisitActions,
            medicationMode: store.medicationMode ?? undefined,
            medicationRenewNotes: store.medicationRenewNotes,
            treatmentDecision: derived,
            clinicalReview: store.clinicalReview ?? undefined,
            clinicalNote: store.clinicalNote,
          });
        }
        if (store.followUpVisitActions.continueOnly) {
          setPendingFollowUpPayload({
            includeMedicationReport: false,
            includeReferral: false,
          });
          store.setCurrentStep(CHRONIC_FINAL_STEP);
          return;
        }
      }
      if (store.currentStep >= CHRONIC_FINAL_STEP) return;
      store.setCurrentStep(store.currentStep + 1);
      return;
    }

    if (store.currentStep === 1 && !store.selectedCondition) {
      alert('Please select a condition');
      return;
    }

    if (isUnregisteredDiagnosticFlow()) {
      if (store.currentStep === 1) {
        const workflowCase = getWorkflowCase();
        const profileKey = workflowCase
          ? resolveProfileId(workflowCase)
          : resolveProfileIdForSave(store.cases, patientId) ?? createProfileId();
        if (store.selectedCondition) {
          store.ensureChronicCase(profileKey, store.selectedCondition, {
            icdCode: store.selectedIcdCode || undefined,
          });
          void store.spawnChronicCaseRegistrationActions(profileKey, store.selectedCondition, practitionerRole);
        }
        store.setCurrentStep(registrationWorkspaceStep());
        return;
      }
      if (store.currentStep >= registrationWorkspaceStep()) return;
    } else {
      if (store.currentStep === 2) {
        const workflowBMode = isWorkflowB(store.activeBenefitState);
        if (!workflowBMode && store.diagnosticTreatments.length === 0) {
          alert('Select at least one diagnostic test from the basket.');
          return;
        }
      }
      if (store.currentStep === 3 && !store.selectedIcdCode) {
        alert('Confirm an ICD-10 code before continuing.');
        return;
      }
      if (store.currentStep === 4) {
        if (store.medicationSubstep === 1) {
          if (store.medications.length === 0) {
            alert('Please select at least one medication before proceeding');
            return;
          }
          store.setMedicationSubstep(2);
          return;
        }
        if (store.medicationSubstep === 2) {
          if (!store.medicationNote && !store.medications.some((m) => m.note)) {
            const proceed = confirm('No registration note has been entered. Do you want to proceed without a note?');
            if (!proceed) return;
          }
          store.setCurrentStep(5);
          return;
        }
      }
    }

    store.setCurrentStep(store.currentStep + 1);
  };

  const handlePreviousStep = () => {
    if (isSharedCareVisitFlow()) {
      if (store.currentStep === CHRONIC_FINAL_STEP && store.followUpVisitActions.continueOnly) {
        store.setCurrentStep(2);
        return;
      }
      store.setCurrentStep(Math.max(0, store.currentStep - 1));
      return;
    }

    if (isUnregisteredDiagnosticFlow()) {
      if (store.currentStep === finalStepIndex()) {
        store.setCurrentStep(registrationWorkspaceStep());
        return;
      }
      if (store.currentStep === registrationWorkspaceStep()) {
        store.setCurrentStep(1);
        return;
      }
      store.setCurrentStep(Math.max(0, store.currentStep - 1));
      return;
    }

    const medStep = medicationStepIndex();
    if (store.currentStep === medStep && store.medicationSubstep === 2) {
      store.setMedicationSubstep(1);
      return;
    }
    if (store.currentStep === finalStepIndex()) {
      store.setCurrentStep(medStep);
      store.setMedicationSubstep(2);
      return;
    }
    store.setCurrentStep(Math.max(0, store.currentStep - 1));
  };

  const handleCibRegistrationSubmit = async (motivationNote: string) => {
    const caseId = store.currentCaseId || selectedCaseId;
    if (!caseId || !store.selectedCondition) return;

    if (!store.selectedIcdCode) {
      alert('Confirm an ICD-10 code before submitting.');
      return;
    }
    if (!store.diagnosisDate) {
      alert('Diagnosis date is required for CIB registration.');
      return;
    }
    if (store.medications.length === 0) {
      alert('Please select at least one medication before submitting.');
      return;
    }

    if (!isUnregisteredDiagnosticFlow()) {
      const gate = canProceedFromEvidenceReview({
        treatments: store.diagnosticTreatments,
        conditionName: store.selectedCondition,
        icdCode: store.selectedIcdCode ?? '',
        clinicalNote: store.clinicalNote,
        diagnosisDate: store.diagnosisDate,
        benefitState: store.activeBenefitState ?? 'unregistered',
        medicationsFormularyAligned: store.medications.every((m) => m.formularyStatus === 'listed'),
      });
      if (!gate.ok) {
        alert(gate.reason);
        return;
      }
    }

    const wasUnregisteredFlow = isUnregisteredDiagnosticFlow();

    setIsCibSubmitting(true);
    try {
      const record: CibRecord = {
        ...buildDefaultCibRecord(
          store.selectedCondition,
          store.selectedIcdCode || '',
          store.diagnosisDate,
          store.medications[0]?.medicineNameAndStrength
        ),
        benefitState: 'pending_cib_review',
        submissionDate: new Date().toISOString().slice(0, 10),
        fundingLagNote: motivationNote.trim() || undefined,
        formularyAligned: store.medications.every((m) => m.formularyStatus === 'listed'),
      };

      const patientData = getPatientInfoForSave();
      const cibDiagnosticTreatments =
        store.diagnosticTreatments.length > 0
          ? store.diagnosticTreatments
          : (() => {
              const workflowCase = getWorkflowCase();
              const profileKey = workflowCase
                ? resolveProfileId(workflowCase)
                : resolveProfileIdForSave(store.cases, patientId);
              const chronicCase = profileKey
                ? store.getChronicCase(profileKey, store.selectedCondition!)
                : undefined;
              return (chronicCase?.cibEvidence ?? []).map((item) => ({
                description: item.description,
                code: item.code,
                maxCovered: 1,
                timesCompleted: item.documentation?.notes?.trim() ? 1 : 0,
                documentation: item.documentation ?? { notes: '', images: [] },
              }));
            })();

      if (!auth.workspace?.id) {
        throw new Error('Practice workspace is not ready. Cannot save CIB registration.');
      }

      const saveResult = await saveCaseToDatabase({
        caseId,
        ...patientData,
        clinicalNote: store.clinicalNote,
        conditionName: store.selectedCondition,
        icdCode: store.selectedIcdCode || '',
        icdDescription: store.selectedIcdDescription || '',
        diagnosticTreatments: cibDiagnosticTreatments,
        ongoingTreatments: store.ongoingTreatments,
        medications: store.medications,
        medicationNote: motivationNote,
        plan: store.selectedPlan,
        isFinalSave: true,
        workspaceId: auth.workspace.id,
        createdBy: auth.user?.id,
        deliveryStatus: 'ready_to_send',
        doctorApproved: auth.isOwner,
        diagnosisDate: store.diagnosisDate,
      });

      if (!saveResult.success) {
        throw new Error(saveResult.error ?? 'Failed to save CIB registration to the database');
      }

      store.upsertCibRecord(caseId, record);
      store.setActiveBenefitState('pending_cib_review');
      store.setMedicationNote(motivationNote);

      store.updateCase(caseId, {
        ...patientData,
        clinicalNote: store.clinicalNote,
        condition: store.selectedCondition,
        icdCode: store.selectedIcdCode || '',
        icdDescription: store.selectedIcdDescription || '',
        diagnosticTreatments: cibDiagnosticTreatments,
        medications: store.medications,
        medicationNote: motivationNote,
        plan: store.selectedPlan,
        status: 'completed',
        doctorApproved: auth.isOwner,
        deliveryStatus: 'ready_to_send',
        isWorkflowDraft: false,
        cibEnrollmentStatus: 'registered',
        workspaceId: auth.workspace.id,
        updatedAt: new Date(),
      });

      const workflowCase = getWorkflowCase();
      const profileKey = workflowCase
        ? resolveProfileId(workflowCase)
        : resolveProfileIdForSave(store.cases, patientId);
      if (profileKey && store.selectedCondition) {
        store.completeChronicRegistration(profileKey, store.selectedCondition, store.diagnosisDate);
        purgeStaleDraftsForProfile(profileKey, caseId);
      }
      if (patientData.patientId) {
        propagateEnrollmentRegistered(patientData.patientId);
      }

      if (wasUnregisteredFlow) {
        store.setCurrentStep(3);
      } else {
        setClaimCompletionSource('cib');
        setShowClaimCompletion(true);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit CIB registration');
    } finally {
      setIsCibSubmitting(false);
    }
  };

  const handleExportPDF = () => {
    const patientCase = buildCurrentCaseSnapshot();
    if (!patientCase?.condition || !patientCase.icdCode) {
      alert('Please complete the workflow first');
      return;
    }

    const pdfService = new PDFExportService();
    pdfService.exportInitialClaim(patientCase);
  };

  const getPatientInfoForSave = () => {
    const caseId = store.currentCaseId || selectedCaseId;
    const selectedCase = caseId ? store.cases.find((c) => c.id === caseId) : null;

    return {
      patientName: patientName || selectedCase?.patientName || '',
      patientId: patientId || selectedCase?.patientId || '',
      patientEmail: patientEmail || selectedCase?.patientEmail || '',
      patientPhone: patientPhone || selectedCase?.patientPhone || '',
      medicalAidNumber: medicalAidNumber || selectedCase?.medicalAidNumber || '',
    };
  };

  /** Merges live workflow state with the saved case for claim PDF/export and final summary */
  const buildCurrentCaseSnapshot = (): PatientCase | null => {
    const caseId = store.currentCaseId || selectedCaseId;
    if (!caseId) return null;

    const base = store.cases.find((c) => c.id === caseId);
    const patientData = getPatientInfoForSave();

    const status =
      store.ongoingTreatments.length > 0
        ? 'ongoing'
        : store.diagnosticTreatments.length > 0
        ? 'diagnostic'
        : base?.status ?? 'draft';

    return {
      id: caseId,
      patientName: patientData.patientName || base?.patientName || 'Patient',
      patientId: patientData.patientId || base?.patientId || 'N/A',
      patientEmail: patientData.patientEmail || base?.patientEmail,
      patientPhone: patientData.patientPhone || base?.patientPhone,
      medicalAidNumber: patientData.medicalAidNumber || base?.medicalAidNumber,
      claimType: base?.claimType ?? currentClaimType,
      createdAt: base?.createdAt ?? new Date(),
      updatedAt: new Date(),
      clinicalNote: store.clinicalNote || base?.clinicalNote || '',
      progressReview: store.progressReview,
      treatmentDecision: store.treatmentDecision ?? base?.treatmentDecision,
      clinicalReview: store.clinicalReview ?? base?.clinicalReview,
      monitoringSkipped: store.monitoringSkipped,
      monitoringSkipReason: store.monitoringSkipReason || base?.monitoringSkipReason,
      condition: store.selectedCondition || base?.condition || '',
      icdCode: store.selectedIcdCode || base?.icdCode || '',
      icdDescription: store.selectedIcdDescription || base?.icdDescription || '',
      diagnosticTreatments: store.diagnosticTreatments,
      ongoingTreatments: store.ongoingTreatments,
      medications: store.medications,
      medicationNote: store.medicationNote || base?.medicationNote || '',
      plan: store.selectedPlan || base?.plan || 'Core',
      status: status as PatientCase['status'],
      medicationReports:
        store.cases.find((c) => c.id === caseId)?.medicationReports ?? base?.medicationReports,
      referrals: base?.referrals,
      clinicalAppeals: base?.clinicalAppeals,
      cibRecords: base?.cibRecords,
      medicalScheme: base?.medicalScheme ?? getPatientMedicalScheme(store.cases, patientData.patientId),
      cibEnrollmentStatus: base?.cibEnrollmentStatus ?? 'unregistered',
    };
  };

  const syncCibRecordOnCase = (record: CibRecord) => {
    const caseId = store.currentCaseId || selectedCaseId;
    if (caseId) {
      store.upsertCibRecord(caseId, record);
    }
  };

  const handleBenefitStateChange = (newState: BenefitState) => {
    store.setActiveBenefitState(newState);
    const condition = store.selectedCondition;
    const caseId = store.currentCaseId || selectedCaseId;
    if (condition && caseId) {
      const existing = store.cases
        .find((c) => c.id === caseId)
        ?.cibRecords?.find((r) => r.conditionName === condition);
      store.upsertCibRecord(caseId, {
        conditionName: condition,
        icd10: store.selectedIcdCode || existing?.icd10 || '',
        diagnosisDate: store.diagnosisDate || existing?.diagnosisDate,
        benefitState: newState,
        formularyAligned: existing?.formularyAligned ?? true,
        approvalDate:
          newState !== 'unregistered' && newState !== 'pending_cib_review'
            ? existing?.approvalDate ?? new Date().toISOString().slice(0, 10)
            : existing?.approvalDate,
      });
      if (isWorkflowB(newState)) {
        store.reconcileMedicationsForBenefitState();
      }
    }
  };

  const refreshCurrentCaseView = () => {
    const caseId = store.currentCaseId || selectedCaseId;
    if (!caseId) return;
    const updated = store.cases.find((c) => c.id === caseId);
    if (updated) {
      setCurrentCaseForView(normalizePatientCase(updated));
      setSelectedCaseId(caseId);
    }
  };

  const handleExportWithAttachments = async () => {
    const patientCase = buildCurrentCaseSnapshot();
    if (!patientCase?.condition || !patientCase.icdCode) {
      alert('Please complete the workflow first');
      return;
    }

    const pdfService = new PDFExportService();
    await pdfService.exportInitialClaimWithAttachments(patientCase);
  };

  const persistCompletedCase = async (
    deliveryStatus: 'ready_to_send' | 'sent_to_patient',
    doctorApproved: boolean
  ) => {
    const patientData = getPatientInfoForSave();
    if (!patientData.patientName || !patientData.patientId) {
      throw new Error('Please enter patient name and ID');
    }

    const caseIdForSave = store.currentCaseId || selectedCaseId;
    const baseCase = caseIdForSave ? store.cases.find((c) => c.id === caseIdForSave) : undefined;
    const profileId = resolveProfileIdForSave(
      store.cases,
      patientData.patientId,
      baseCase,
      selectedProfileId
    );

    const caseUpdates = {
      patientName: patientData.patientName,
      patientId: patientData.patientId,
      patientEmail: patientData.patientEmail,
      patientPhone: patientData.patientPhone,
      medicalAidNumber: patientData.medicalAidNumber,
      clinicalNote: store.clinicalNote,
      condition: store.selectedCondition || '',
      icdCode: store.selectedIcdCode || '',
      icdDescription: store.selectedIcdDescription || '',
      progressReview: store.progressReview,
      treatmentDecision: store.treatmentDecision ?? undefined,
      clinicalReview: store.clinicalReview ?? undefined,
      monitoringSkipped: store.monitoringSkipped,
      monitoringSkipReason: store.monitoringSkipReason || undefined,
      diagnosticTreatments: store.diagnosticTreatments,
      ongoingTreatments: store.ongoingTreatments,
      medications: store.medications,
      medicationNote: store.medicationNote,
      plan: store.selectedPlan,
      status: 'completed' as const,
      deliveryStatus,
      doctorApproved,
      updatedAt: new Date(),
      ...(profileId ? { profileId } : {}),
      claimType: baseCase?.claimType ?? currentClaimType,
      isWorkflowDraft: false,
    };

    await saveCaseToDatabase({
      caseId: caseIdForSave ?? undefined,
      ...patientData,
      clinicalNote: store.clinicalNote,
      conditionName: store.selectedCondition || '',
      icdCode: store.selectedIcdCode || '',
      icdDescription: store.selectedIcdDescription || '',
      diagnosticTreatments: store.diagnosticTreatments,
      ongoingTreatments: store.ongoingTreatments,
      medications: store.medications,
      medicationNote: store.medicationNote,
      plan: store.selectedPlan,
      isFinalSave: true,
      workspaceId: auth.workspace?.id,
      createdBy: auth.user?.id,
      deliveryStatus,
      doctorApproved,
    });

    if (caseIdForSave) {
      store.updateCase(caseIdForSave, caseUpdates);
    } else {
      store.saveCase(patientData.patientName, patientData.patientId, currentClaimType);
      if (store.currentCaseId) {
        setSelectedCaseId(store.currentCaseId);
        store.updateCase(store.currentCaseId, caseUpdates);
      }
    }

    const savedId = store.currentCaseId || selectedCaseId || caseIdForSave;
    const savedCase = savedId ? useStore.getState().cases.find((c) => c.id === savedId) : undefined;
    if (savedCase) {
      setSelectedProfileId(resolveProfileId(savedCase));
      purgeStaleDraftsForProfile(resolveProfileId(savedCase), savedId ?? undefined);
    }
  };

  const handleClaimCompletionAction = async (action: ClaimCompletionAction) => {
    if (claimCompletionSource === 'final') {
      const gate = canProceedFromEvidenceReview({
        treatments: store.diagnosticTreatments,
        conditionName: store.selectedCondition || '',
        icdCode: store.selectedIcdCode || '',
        clinicalNote: store.clinicalNote,
        diagnosisDate: store.diagnosisDate,
        benefitState: store.activeBenefitState ?? 'unregistered',
        medicationsFormularyAligned: store.medications.every((m) => m.formularyStatus === 'listed'),
      });
      if (!gate.ok) {
        alert(gate.reason);
        return;
      }
    }

    setIsSaving(true);
    try {
      const isDoctor = userRole === 'doctor';
      let deliveryStatus: 'ready_to_send' | 'sent_to_patient' =
        action === 'send_patient' ? 'sent_to_patient' : 'ready_to_send';

      if (action === 'send_patient') {
        const caseSnapshot = buildCurrentCaseSnapshot();
        const email = patientEmail || getPatientInfoForSave().patientEmail;
        if (caseSnapshot && email) {
          const delivery = await deliverClaimToPatient(
            caseSnapshot,
            email,
            practiceName || 'Your practice',
            doctorName
          );
          deliveryStatus = delivery.method === 'automated' ? 'sent_to_patient' : 'ready_to_send';
          notifyPatientDeliveryResult(email, delivery);
        }
      }

      await persistCompletedCase(deliveryStatus, isDoctor);

      if (action === 'export_pdf') {
        handleExportPDF();
      } else if (action === 'export_zip') {
        await handleExportWithAttachments();
      }

      setShowClaimCompletion(false);
      setPendingFollowUpPayload(null);
      store.resetWorkflow();
      setCurrentView(userRole === 'assistant' ? 'assistant-home' : 'dashboard');
      if (action !== 'send_patient') {
        alert(action === 'save' ? 'Case saved to workspace.' : 'Case saved and exported successfully!');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to complete claim');
    } finally {
      setIsSaving(false);
    }
  };

  const sendCaseToPatient = async (caseData: PatientCase) => {
    if (!caseData.patientEmail) {
      alert('No patient email on this case.');
      return;
    }

    if (
      caseData.status !== 'completed' &&
      !(caseData.condition && caseData.icdCode)
    ) {
      alert('This case is not ready to send yet. Wait until the claim is completed.');
      return;
    }

    const normalized = normalizePatientCase(caseData);
    const delivery = await deliverClaimToPatient(
      normalized,
      caseData.patientEmail,
      practiceName || 'Your practice',
      doctorName
    );

    notifyPatientDeliveryResult(caseData.patientEmail, delivery);

    if (delivery.method === 'automated') {
      store.updateCase(caseData.id, { deliveryStatus: 'sent_to_patient', updatedAt: new Date() });
      try {
        await updateCaseDeliveryStatus(caseData.id, 'sent_to_patient');
      } catch {
        // Local state updated even if remote sync fails
      }
    }
  };

  const handleDashboardSendToPatient = async (caseId: string) => {
    const caseData = store.cases.find((c) => c.id === caseId);
    if (!caseData) return;
    await sendCaseToPatient(caseData);
  };

  const handleCaseOptionsSendToPatient = async () => {
    if (!currentCaseForView) return;
    await sendCaseToPatient(currentCaseForView);
  };

  const handleSaveCaseOnly = async () => {
    const patientData = getPatientInfoForSave();
    if (!patientData.patientName || !patientData.patientId) {
      alert('Please enter patient name and ID');
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveCaseToDatabase({
        caseId: (store.currentCaseId || selectedCaseId) ?? undefined,
        patientName: patientData.patientName,
        patientId: patientData.patientId,
        patientEmail: patientData.patientEmail,
        patientPhone: patientData.patientPhone,
        medicalAidNumber: patientData.medicalAidNumber,
        clinicalNote: store.clinicalNote,
        conditionName: store.selectedCondition || '',
        icdCode: store.selectedIcdCode || '',
        icdDescription: store.selectedIcdDescription || '',
        diagnosticTreatments: store.diagnosticTreatments,
        ongoingTreatments: store.ongoingTreatments,
        medications: store.medications,
        medicationNote: store.medicationNote,
        plan: store.selectedPlan,
        isFinalSave: true,
        workspaceId: auth.workspace?.id,
        createdBy: auth.user?.id,
        deliveryStatus: userRole === 'doctor' ? 'ready_to_send' : 'ready_to_send',
        doctorApproved: userRole === 'doctor',
      });

      const caseIdForSave = store.currentCaseId || selectedCaseId;
      const baseCase = caseIdForSave ? store.cases.find((c) => c.id === caseIdForSave) : undefined;
      const profileId = resolveProfileIdForSave(
        store.cases,
        patientData.patientId,
        baseCase,
        selectedProfileId
      );
      const caseUpdates = {
        patientName: patientData.patientName,
        patientId: patientData.patientId,
        patientEmail: patientData.patientEmail,
        patientPhone: patientData.patientPhone,
        medicalAidNumber: patientData.medicalAidNumber,
        clinicalNote: store.clinicalNote,
        condition: store.selectedCondition || '',
        icdCode: store.selectedIcdCode || '',
        icdDescription: store.selectedIcdDescription || '',
        diagnosticTreatments: store.diagnosticTreatments,
        ongoingTreatments: store.ongoingTreatments,
        medications: store.medications,
        medicationNote: store.medicationNote,
        plan: store.selectedPlan,
        status: 'completed' as const,
        updatedAt: new Date(),
        deliveryStatus: 'ready_to_send' as const,
        doctorApproved: userRole === 'doctor',
        cibRecords: baseCase?.cibRecords,
        ...(profileId ? { profileId } : {}),
        claimType: baseCase?.claimType ?? currentClaimType,
        isWorkflowDraft: false,
      };

      const applyLocalSave = () => {
        if (caseIdForSave) {
          store.updateCase(caseIdForSave, caseUpdates);
        } else {
          store.saveCase(patientData.patientName, patientData.patientId, currentClaimType);
          if (store.currentCaseId) {
            setSelectedCaseId(store.currentCaseId);
            store.updateCase(store.currentCaseId, caseUpdates);
          }
        }
        const savedId = store.currentCaseId || selectedCaseId || caseIdForSave;
        const savedCase = savedId ? useStore.getState().cases.find((c) => c.id === savedId) : undefined;
        if (savedCase) setSelectedProfileId(resolveProfileId(savedCase));
      };

      if (!result.success) {
        applyLocalSave();

        setShowClaimCompletion(false);
        store.resetWorkflow();
        setCurrentView('dashboard');
        alert(`Saved locally. Remote save failed: ${result.error || 'Unknown error'}`);
      } else {
        applyLocalSave();

        setShowClaimCompletion(false);
        store.resetWorkflow();
        setCurrentView('dashboard');
        alert('Case saved successfully!');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save case');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCase = async (includeAttachments: boolean = false) => {
    if (!patientName || !patientId) {
      alert('Please enter patient name and ID');
      return;
    }

    const patientData = getPatientInfoForSave();
    if (selectedCaseId) {
      store.updateCase(selectedCaseId, {
        patientName: patientData.patientName,
        patientId: patientData.patientId,
        patientEmail: patientData.patientEmail,
        patientPhone: patientData.patientPhone,
        medicalAidNumber: patientData.medicalAidNumber,
        clinicalNote: store.clinicalNote,
        condition: store.selectedCondition || '',
        icdCode: store.selectedIcdCode || '',
        icdDescription: store.selectedIcdDescription || '',
        diagnosticTreatments: store.diagnosticTreatments,
        ongoingTreatments: store.ongoingTreatments,
        medications: store.medications,
        medicationNote: store.medicationNote,
        plan: store.selectedPlan,
        status: 'completed',
        updatedAt: new Date(),
        isWorkflowDraft: false,
      });
    } else {
      store.saveCase(patientData.patientName, patientData.patientId, currentClaimType);
      if (store.currentCaseId) {
        setSelectedCaseId(store.currentCaseId);
        store.updateCase(store.currentCaseId, { isWorkflowDraft: false });
      }
    }

    setShowClaimCompletion(false);

    if (includeAttachments) {
      await handleExportWithAttachments();
    } else {
      handleExportPDF();
    }

    store.resetWorkflow();
    setCurrentView('dashboard');
    alert('Case saved and exported successfully!');
  };

  const handleLoadCase = (caseId: string) => {
    store.loadCase(caseId);
    const loadedCase = store.cases.find(c => c.id === caseId);
    if (loadedCase) {
      setPatientName(loadedCase.patientName);
      setPatientId(loadedCase.patientId);
      setCurrentClaimType(loadedCase.claimType ?? 'diagnostic');
      store.setCurrentStep(5);
    }
  };

  const persistFollowUpCaseFields = () => {
    if (!store.currentCaseId) return;
    const specialistFlow = isSpecialistReviewFlow();
    const derived =
      store.treatmentDecision ??
      (specialistFlow && store.followUpVisitActions.medication
        ? { decision: 'change' as const }
        : deriveTreatmentDecisionFromVisitActions(
            store.followUpVisitActions,
            store.medicationMode
          ));
    const currentCase = store.cases.find((c) => c.id === store.currentCaseId);
    store.updateCase(store.currentCaseId, {
      clinicalNote: store.clinicalNote,
      progressReview: store.progressReview,
      followUpVisitActions: store.followUpVisitActions,
      medicationMode: store.medicationMode ?? undefined,
      medicationRenewNotes: store.medicationRenewNotes,
      treatmentDecision: derived,
      clinicalReview: store.clinicalReview ?? undefined,
      ongoingTreatments: [...store.ongoingTreatments],
      investigationOrders: currentCase?.investigationOrders,
      monitoringSkipped: store.monitoringSkipped,
      monitoringSkipReason: store.monitoringSkipReason || undefined,
      status: 'ongoing',
    });
  };

  const applyFollowUpCompletionPayload = (payload: FollowUpCompletionPayload | null) => {
    persistFollowUpCaseFields();

    if (payload?.includeMedicationReport && payload.medicationReport) {
      const { newMedications, motivationLetter, documentation, mode } = payload.medicationReport;
      const renewNotes = buildVisitContextNotes(
        store.clinicalNote,
        store.clinicalReview,
        payload.medicationRenewNotes ?? store.medicationRenewNotes
      );
      const isRenew =
        payload.medicationMode === 'renew' ||
        mode === 'renew' ||
        mode === 'standalone_renew';

      if (isRenew) {
        persistMedicationReportChanges(
          renewNotes,
          store.medications.length > 0 ? store.medications : newMedications,
          '',
          documentation
        );
      } else {
        persistMedicationReportChanges(
          renewNotes,
          newMedications,
          motivationLetter,
          documentation
        );
      }
    }

    if (payload?.includeReferral && payload.referral && store.currentCaseId) {
      store.addReferral(store.currentCaseId, {
        caseId: store.currentCaseId,
        urgency: payload.referral.urgency,
        referralNote: payload.referral.referralNote,
        specialistType: payload.referral.specialistType,
      });
    }
  };

  const handleFollowUpDocumentationComplete = (payload: FollowUpCompletionPayload) => {
    setPendingFollowUpPayload(payload);
    store.setCurrentStep(CHRONIC_FINAL_STEP);
  };

  const handleFollowUpSummaryConfirm = () => {
    const activeCase = store.cases.find((c) => c.id === store.currentCaseId);
    const pendingOrder = activeCase?.investigationOrders?.find((o) => o.status === 'ordered');
    if (pendingOrder) {
      alert(
        pendingOrder.coordinationType === 'referral'
          ? `This visit still has an outstanding referral for ${pendingOrder.label} (${pendingOrder.referralSpecialty ?? 'specialist'}). Wait for results before completing this visit.`
          : `This visit still has an outstanding order for ${pendingOrder.label}. Wait for results before completing this visit.`
      );
      return;
    }

    applyFollowUpCompletionPayload(pendingFollowUpPayload);
    if (store.currentCaseId) {
      store.updateCase(store.currentCaseId, {
        status: 'completed',
        isWorkflowDraft: false,
        doctorApproved: auth.isOwner,
        deliveryStatus: 'ready_to_send',
      });
    }

    const patientData = getPatientInfoForSave();
    const caseIdForSave = store.currentCaseId || selectedCaseId;
    if (caseIdForSave && patientData.patientName && patientData.patientId && auth.workspace?.id) {
      void saveCaseToDatabase({
        caseId: caseIdForSave,
        patientName: patientData.patientName,
        patientId: patientData.patientId,
        patientEmail: patientData.patientEmail,
        patientPhone: patientData.patientPhone,
        medicalAidNumber: patientData.medicalAidNumber,
        clinicalNote: store.clinicalNote,
        conditionName: store.selectedCondition || '',
        icdCode: store.selectedIcdCode || '',
        icdDescription: store.selectedIcdDescription || '',
        diagnosticTreatments: store.diagnosticTreatments,
        ongoingTreatments: store.ongoingTreatments,
        medications: store.medications,
        medicationNote: store.medicationNote,
        plan: store.selectedPlan,
        isFinalSave: true,
        workspaceId: auth.workspace.id,
        createdBy: auth.user?.id,
        deliveryStatus: 'ready_to_send',
        doctorApproved: auth.isOwner,
      }).catch((error) => {
        console.error('Failed to persist follow-up visit to database:', error);
      });
    }

    setClaimCompletionSource('follow-up');
    setShowClaimCompletion(true);
  };

  const handleOngoingManagementSaveOnly = () => {
    persistFollowUpCaseFields();
    if (store.currentCaseId) {
      store.updateCase(store.currentCaseId, {
        status: 'completed',
        isWorkflowDraft: false,
      });
    }
    store.resetWorkflow();
    setCurrentView('dashboard');
  };

  const handleExportSingleTreatment = async (treatmentIndex: number) => {
    if (store.currentCaseId) {
      const currentCase = store.cases.find(c => c.id === store.currentCaseId);
      if (currentCase) {
        const pdfService = new PDFExportService();
        await pdfService.exportSingleOngoingTreatment(currentCase, treatmentIndex);
        alert('Treatment exported successfully!');
      }
    }
  };

  const handleOngoingManagementSavePdfOnly = () => {
    persistFollowUpCaseFields();
    if (store.currentCaseId) {
      store.updateCase(store.currentCaseId, {
        status: 'completed',
        isWorkflowDraft: false,
      });
      const snapshot = buildCurrentCaseSnapshot();
      if (snapshot) {
        const pdfService = new PDFExportService();
        pdfService.exportInitialClaim(snapshot);
      }
    }
    store.resetWorkflow();
    setCurrentView('dashboard');
    alert('Follow-up visit saved and claim PDF exported!');
  };

  const handleOngoingManagementSaveWithAttachments = async () => {
    persistFollowUpCaseFields();
    if (store.currentCaseId) {
      store.updateCase(store.currentCaseId, {
        status: 'completed',
        isWorkflowDraft: false,
      });
      const snapshot = buildCurrentCaseSnapshot();
      if (snapshot) {
        const pdfService = new PDFExportService();
        await pdfService.exportInitialClaimWithAttachments(snapshot);
      }
    }
    store.resetWorkflow();
    setCurrentView('dashboard');
    alert('Follow-up visit saved and full claim exported with attachments!');
  };

  const persistMedicationReportChanges = (
    followUpNotes: string,
    newMeds?: SelectedMedication[],
    motivationLetter?: string,
    documentation?: { notes: string; images: string[] }
  ) => {
    if (!store.currentCaseId) return;

    const currentCase = store.cases.find((c) => c.id === store.currentCaseId);
    if (!currentCase) return;

    const baselineMeds =
      store.medications.length > 0 ? store.medications : (currentCase.medications ?? []);

    const updatedMedications = resolveActiveMedicationsAfterChange(baselineMeds, newMeds);

    store.addMedicationReport(store.currentCaseId, {
      caseId: store.currentCaseId,
      originalMedications: baselineMeds,
      followUpNotes,
      newMedications: newMeds || [],
      motivationLetter: motivationLetter || '',
      documentation,
    });

    store.updateCase(store.currentCaseId, {
      medications: updatedMedications,
    });
  };

  const handleMedicationReportSaveOnly = (
    followUpNotes: string,
    newMeds?: SelectedMedication[],
    motivationLetter?: string,
    documentation?: { notes: string; images: string[] }
  ) => {
    persistMedicationReportChanges(followUpNotes, newMeds, motivationLetter, documentation);
    if (store.currentCaseId) {
      store.updateCase(store.currentCaseId, { status: 'completed', isWorkflowDraft: false });
    }
    store.resetWorkflow();
    setCurrentView('dashboard');
    alert('Medication report saved.');
  };

  const handleMedicationReportSavePdfOnly = (
    followUpNotes: string,
    newMeds?: SelectedMedication[],
    motivationLetter?: string,
    documentation?: { notes: string; images: string[] }
  ) => {
    persistMedicationReportChanges(followUpNotes, newMeds, motivationLetter, documentation);
    if (store.currentCaseId) {
      store.updateCase(store.currentCaseId, { status: 'completed', isWorkflowDraft: false });
    }
    const snapshot = buildCurrentCaseSnapshot();
    if (snapshot) {
      const pdfService = new PDFExportService();
      pdfService.exportInitialClaim(snapshot);
    }
    store.resetWorkflow();
    setCurrentView('dashboard');
    alert('Medication report saved and claim PDF exported!');
  };

  const handleMedicationReportSaveWithAttachments = async (
    followUpNotes: string,
    newMeds?: SelectedMedication[],
    motivationLetter?: string,
    documentation?: { notes: string; images: string[] }
  ) => {
    persistMedicationReportChanges(followUpNotes, newMeds, motivationLetter, documentation);
    if (store.currentCaseId) {
      store.updateCase(store.currentCaseId, { status: 'completed', isWorkflowDraft: false });
    }
    const snapshot = buildCurrentCaseSnapshot();
    if (snapshot) {
      const pdfService = new PDFExportService();
      await pdfService.exportInitialClaimWithAttachments(snapshot);
    }
    store.resetWorkflow();
    setCurrentView('dashboard');
    alert('Medication report saved and full claim exported with attachments!');
  };

  const handleReferralSavePdfOnly = (urgency: 'routine' | 'urgent' | 'emergency', referralNote: string, specialistType: string) => {
    if (store.currentCaseId) {
      const currentCase = store.cases.find(c => c.id === store.currentCaseId);
      if (currentCase) {
        const updatedCase = {
          ...currentCase,
          referrals: [...(currentCase.referrals || []), {
            id: Date.now().toString(),
            caseId: store.currentCaseId,
            urgency,
            referralNote,
            specialistType,
            createdAt: new Date(),
          }],
          updatedAt: new Date(),
        };

        store.addReferral(store.currentCaseId, {
          caseId: store.currentCaseId,
          urgency,
          referralNote,
          specialistType,
        });

        const pdfService = new PDFExportService();
        pdfService.exportReferral(updatedCase, urgency, referralNote, specialistType);
      }
    }
    alert('Referral saved and PDF exported!');
  };

  const handleReferralSaveWithAttachments = async (urgency: 'routine' | 'urgent' | 'emergency', referralNote: string, specialistType: string) => {
    if (store.currentCaseId) {
      const currentCase = store.cases.find(c => c.id === store.currentCaseId);
      if (currentCase) {
        const updatedCase = {
          ...currentCase,
          referrals: [...(currentCase.referrals || []), {
            id: Date.now().toString(),
            caseId: store.currentCaseId,
            urgency,
            referralNote,
            specialistType,
            createdAt: new Date(),
          }],
          updatedAt: new Date(),
        };

        store.addReferral(store.currentCaseId, {
          caseId: store.currentCaseId,
          urgency,
          referralNote,
          specialistType,
        });

        const pdfService = new PDFExportService();
        await pdfService.exportReferralWithAttachments(updatedCase, urgency, referralNote, specialistType);
      }
    }
    alert('Referral saved and exported with attachments!');
  };

  const handleSendToPatient = () => {
    if (!store.currentCaseId) {
      alert('No case loaded. Please save the case first.');
      return;
    }
    setShowPatientExport(true);
  };

  const resolveCaseIdForCib = (): string | null => {
    if (store.currentCaseId) return store.currentCaseId;
    if (selectedCaseId) return selectedCaseId;
    if (selectedProfileId) {
      const patientCases = filterCasesByProfile(store.cases, selectedProfileId);
      const latest = [...patientCases].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
      return latest?.id ?? null;
    }
    return null;
  };

  const handleOpenCibAssistant = (conditionName: string) => {
    setCibAssistantCondition(conditionName);
    const activeProfileId =
      (store.currentCaseId &&
        store.cases.find((c) => c.id === store.currentCaseId) &&
        resolveProfileId(store.cases.find((c) => c.id === store.currentCaseId)!)) ||
      selectedProfileId;
    if (activeProfileId) {
      const patientCases = filterCasesByProfile(store.cases, activeProfileId);
      const latest = [...patientCases].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
      if (latest) {
        setPatientName(latest.patientName);
        setPatientId(latest.patientId);
        setMedicalAidNumber(latest.medicalAidNumber || '');
        store.setSelectedPlan(latest.plan);
      }
      const matchCase =
        patientCases.find((c) => c.condition === conditionName) ?? latest;
      if (matchCase?.icdCode) {
        store.setSelectedCondition(conditionName, matchCase.icdCode, matchCase.icdDescription);
      }
      const rec = getCibRecordForCondition(
        store.cases,
        latest?.patientId ?? patientId,
        conditionName
      );
      if (rec?.diagnosisDate) store.setDiagnosisDate(rec.diagnosisDate);
    }
    setShowCibAssistant(true);
  };

  const handleCibRecordCreated = (record: CibRecord) => {
    const caseId = resolveCaseIdForCib();
    if (caseId) {
      store.upsertCibRecord(caseId, record);
      const workflowCase = store.cases.find((c) => c.id === caseId);
      const enrollment =
        workflowCase?.cibEnrollmentStatus ??
        getPatientEnrollmentStatus(store.cases, workflowCase?.patientId ?? patientId);
      store.setActiveBenefitState(
        resolveEffectiveBenefitState(enrollment, record.benefitState)
      );
      if (record.diagnosisDate) store.setDiagnosisDate(record.diagnosisDate);
      store.reconcileMedicationsForBenefitState();
    }
    setShowCibAssistant(false);
  };

  const cibAssistantModal = showCibAssistant ? (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <CibApplicationAssistant
          conditionName={cibAssistantCondition}
          icdCode={store.selectedIcdCode ?? ''}
          patientName={patientName}
          patientId={patientId}
          medicalAidNumber={medicalAidNumber}
          plan={store.selectedPlan}
          clinicalNote={store.clinicalNote}
          diagnosisDate={store.diagnosisDate}
          submittedMedicine={store.medications[0]?.medicineNameAndStrength}
          diagnosticTreatments={store.diagnosticTreatments}
          onClose={() => setShowCibAssistant(false)}
          onCibRecordCreated={handleCibRecordCreated}
        />
      </div>
    </div>
  ) : null;

  const getPatientExportData = (): PatientExportData | null => {
    if (!store.currentCaseId) return null;

    const currentCase = store.cases.find(c => c.id === store.currentCaseId);
    if (!currentCase) return null;

    return {
      patientName: currentCase.patientName,
      patientId: currentCase.patientId,
      clinicalNote: currentCase.clinicalNote,
      registrationNote: currentCase.medicationNote || '',
      conditions: [{
        id: '1',
        name: currentCase.condition,
        icdCode: currentCase.icdCode,
        icdDescription: currentCase.icdDescription,
      }],
      medications: currentCase.medications.map((med, index) => ({
        id: index.toString(),
        name: med.medicineNameAndStrength,
        nappiCode: '',
        quantity: 1,
        dosage: med.note || med.cdaAmount || 'As prescribed',
      })),
    };
  };

  const standardDiagnosticSteps = [
    { id: 0, title: 'Clinical Note' },
    { id: 1, title: 'Condition' },
    { id: 2, title: 'Diagnostics' },
    { id: 3, title: 'Confirm Diagnosis' },
    { id: 4, title: 'Medication' },
    { id: 5, title: 'Final Claim' },
  ];

  const unregisteredDiagnosticSteps = [
    { id: 0, title: 'Clinical Note' },
    { id: 1, title: 'Condition' },
    { id: 2, title: 'Registration Workspace' },
    { id: 3, title: 'Complete' },
  ];

  const chronicCareSteps = [
    { id: 0, title: 'Visit Context' },
    { id: 1, title: 'Condition Control' },
    { id: 2, title: 'Visit Actions' },
    { id: 3, title: 'Complete Actions' },
    { id: 4, title: 'Visit Summary' },
  ];

  const CHRONIC_FINAL_STEP = 4;

  const isSharedCareVisitFlow = () =>
    currentClaimType === 'ongoing-management' || currentClaimType === 'specialist-review';

  const isSpecialistReviewFlow = () => currentClaimType === 'specialist-review';

  const isChronicFollowUpFlow = () => isSharedCareVisitFlow();

  const resumeChronicFollowUpStep = (caseData: PatientCase) => {
    if (!caseData.clinicalNote?.trim()) return 0;
    if (!caseData.clinicalReview) return 1;
    const actions = caseData.followUpVisitActions ?? EMPTY_FOLLOW_UP_VISIT_ACTIONS;
    if (!hasFollowUpVisitActionsSelected(actions)) return 2;
    if (actions.continueOnly) return CHRONIC_FINAL_STEP;
    if (caseData.status !== 'completed') return 3;
    return CHRONIC_FINAL_STEP;
  };

  if (auth.authLoading || (auth.session && auth.isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (!auth.session) {
    return <AuthLanding />;
  }

  if (!auth.workspace) {
    if (auth.isAssistant) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="authi-surface-card p-8 max-w-md text-center">
            <p className="text-lg font-semibold text-slate-900">No workspace linked yet</p>
            <p className="text-sm text-slate-600 mt-2">
              Ask your doctor to send you an invite link, then sign in with the invited email.
            </p>
            <button
              type="button"
              onClick={() => void auth.signOutAccount()}
              className="authi-btn-secondary mt-6 px-5 py-3 text-sm rounded-xl"
            >
              Sign out
            </button>
          </div>
        </div>
      );
    }
    return <DoctorOnboardingForm />;
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Loading SaluLink Chronic App...</p>
        </div>
      </div>
    );
  }

  const renderView = (): React.ReactNode => {

  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-10">

          {/* Practice context strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8 rounded-2xl bg-white border border-[#38b6ff]/40 px-5 py-4 transition hover:border-[#38b6ff]/60">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Practice</p>
              <p className={`mt-0.5 text-sm font-semibold ${practiceName ? 'text-slate-900' : 'text-slate-400'}`}>
                {practiceName || 'Not set up yet'}
              </p>
            </div>

            {isPracticeReady && auth.isOwner && (
              assistantWorkspaceReady ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLandingRole('assistant')}
                    className={
                      landingRole === 'assistant'
                        ? 'authi-role-pill-active'
                        : 'authi-role-pill-inactive'
                    }
                  >
                    <span className={landingRole === 'assistant' ? 'authi-gradient-text font-bold' : ''}>
                      Assistant{assistantName ? ` · ${assistantName}` : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLandingRole('doctor')}
                    className={
                      landingRole === 'doctor'
                        ? 'authi-role-pill-active'
                        : 'authi-role-pill-inactive'
                    }
                  >
                    <span className={landingRole === 'doctor' ? 'authi-gradient-text font-bold' : ''}>
                      Doctor{doctorName ? ` · ${doctorName}` : ''}
                    </span>
                  </button>
                </div>
              ) : (
                <p className="text-sm font-semibold text-slate-700">
                  <span className="authi-gradient-text">Doctor</span>
                  {doctorName ? ` · ${doctorName}` : ''}
                </p>
              )
            )}

            <button
              onClick={() => void handleLogout()}
              className="authi-btn-secondary rounded-xl px-4 py-2 text-xs"
            >
              Sign out
            </button>
          </div>

          {/* Main welcome content */}
          <div className="authi-surface-card p-10">
            <div className="max-w-3xl">
              {isPracticeReady ? (
                <>
                  <p className="text-sm font-bold uppercase tracking-[0.3em] authi-gradient-text">Welcome back</p>
                  <h2 className="mt-4 text-4xl font-semibold text-slate-950">
                    {auth.isOwner ? 'Your practice workspace' : 'Assistant workspace'}
                  </h2>
                  <p className="mt-6 text-lg leading-8 text-slate-600">
                    {auth.isOwner
                      ? `Clinical care and diagnostics for ${practiceName}, plus a separate claim workflow for your assistant.`
                      : `Run the claim workflow for ${practiceName} — intake, packaging, and patient delivery.`}
                  </p>

                  {auth.isOwner && (landingRole === 'doctor' || !assistantWorkspaceReady) && (
                    <>
                      <div className="authi-panel-card mt-8 authi-tint">
                        <p className="text-sm uppercase tracking-[0.24em] authi-gradient-text font-bold">Doctor workspace</p>
                        <h3 className="mt-3 text-xl font-semibold text-slate-900">Clinical care and diagnostics</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Patient portfolios, diagnostic evidence, ongoing management, medication reports, referrals, and CIB registration.
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenDoctorWorkspace}
                          className="authi-btn-primary mt-6 rounded-2xl px-5 py-3 text-sm"
                        >
                          Open doctor workspace
                        </button>
                      </div>
                      <InviteAssistantPanel />
                    </>
                  )}

                  {auth.isOwner && assistantWorkspaceReady && landingRole === 'assistant' && (
                    <div className="authi-panel-card mt-8 authi-tint">
                      <p className="text-sm uppercase tracking-[0.24em] authi-gradient-text font-bold">Assistant workspace</p>
                      <h3 className="mt-3 text-xl font-semibold text-slate-900">Claim workflow</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {hasActiveAssistant
                          ? `${assistantName} handles patient intake, assembles claim packages, and delivers documents when ready.`
                          : 'Invite sent — once your assistant accepts, they can run the full claim workflow from this workspace.'}
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenAssistantWorkspace}
                        className="authi-btn-primary mt-6 rounded-2xl px-5 py-3 text-sm"
                      >
                        Open assistant workspace
                      </button>
                    </div>
                  )}

                  {auth.isAssistant && (
                    <div className="authi-panel-card mt-8 authi-tint">
                      <p className="text-sm uppercase tracking-[0.24em] authi-gradient-text font-bold">Assistant workspace</p>
                      <h3 className="mt-3 text-xl font-semibold text-slate-900">Claim workflow</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Patient intake, claim assembly, export, and delivery — you manage the full claim pipeline.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenAssistantWorkspace}
                        className="authi-btn-primary mt-6 rounded-2xl px-5 py-3 text-sm"
                      >
                        Open assistant workspace
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-bold uppercase tracking-[0.3em] authi-gradient-text">Welcome</p>
                  <h2 className="mt-4 text-4xl font-semibold text-slate-950">Setting up your workspace…</h2>
                  <p className="mt-6 text-lg leading-8 text-slate-600">
                    Complete practice setup to start managing claims with your team.
                  </p>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  }

  if (currentView === 'assistant-home') {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs tracking-wide mb-2 font-bold authi-gradient-text">
                  {assistantName || 'Assistant'}
                </p>
                <h1 className="text-4xl font-semibold text-slate-900">Assistant workspace</h1>
                <p className="text-slate-500 mt-1">
                  Claim workflow — intake, documents, and delivery for {practiceName || 'your practice'}.
                </p>
              </div>
              {auth.isOwner && !auth.isAssistant ? (
                <button
                  type="button"
                  onClick={handleBackToDoctorWorkspace}
                  className="authi-btn-secondary px-5 py-3 text-sm shrink-0 self-start"
                >
                  Back to practice
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="authi-btn-secondary px-5 py-3 text-sm shrink-0 self-start"
                >
                  Sign out
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid gap-6 md:grid-cols-2">
            <button
              type="button"
              onClick={handleAssistantNewCase}
              className="authi-choice-card group text-left"
            >
              <p className="text-sm uppercase tracking-[0.3em] authi-gradient-text font-semibold group-hover:opacity-90">
                New patient case
              </p>
              <h2 className="mt-4 text-2xl font-semibold text-slate-900">Create a new patient intake</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Capture patient and scheme details, open a case, and carry the claim through to export or delivery.
              </p>
            </button>

            <button
              type="button"
              onClick={handleAssistantViewRecords}
              className="authi-choice-card group text-left"
            >
              <p className="text-sm uppercase tracking-[0.3em] authi-gradient-text font-semibold group-hover:opacity-90">
                Patient records
              </p>
              <h2 className="mt-4 text-2xl font-semibold text-slate-900">View and download cases</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Browse existing patients and claims. Export PDFs or download ZIP packages when ready.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard view
  if (currentView === 'dashboard') {
    return (
      <Dashboard
        cases={portfolioClaims(store.cases)}
        onNewCase={handleNewCaseClick}
        onViewCase={handleViewCase}
        onViewPatientProfile={handleViewPatientProfile}
        onSendToPatient={handleDashboardSendToPatient}
        canCreateCase={userRole === 'doctor' || userRole === 'assistant'}
        practiceName={practiceName}
        doctorName={doctorName}
        assistantName={assistantName}
        userRole={userRole}
        onBackToWorkspace={handleBackToWorkspace}
        onOpenSettings={() => handleSidebarNavigate('settings')}
        newReferralCount={newReferralCount}
      />
    );
  }

  // Workspace settings
  if (currentView === 'settings') {
    const isDoctorWorkspace = userRole === 'doctor';
    return (
      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-2">
          <p className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">
            Workspace settings
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">Account</h2>
          <p className="text-sm text-slate-500">
            Signed in as {auth.user?.email ?? '—'}
          </p>
        </div>

        <DirectoryListingSettings />

        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6 space-y-4">
          <h3 className="text-base font-semibold text-rose-900">Danger zone</h3>
          <p className="text-sm text-rose-800">
            Deleting your account is permanent. It removes your workspace, cases, and profile,
            then frees your email so it can be used again.
          </p>
          <button
            type="button"
            onClick={() => void handleDeleteAccount()}
            disabled={!isDoctorWorkspace}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-rose-300 text-rose-700 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete account
          </button>
          {!isDoctorWorkspace && (
            <p className="text-xs text-rose-700">
              Only doctor/owner accounts can delete a workspace account.
            </p>
          )}
        </div>
      </main>
    );
  }

  // Patient info form view
  if (currentView === 'patient-info') {
    return (
      <PatientInfoForm
        onSave={handlePatientInfoSubmit}
        onCancel={handleCancelPatientInfo}
        prefillData={patientInfoPrefill}
        showClaimType={userRole !== 'assistant'}
      />
    );
  }

  // Patient profile view
  if (currentView === 'patient-profile' && selectedProfileId) {
    const patientCases = filterPortfolioClaimsByProfile(store.cases, selectedProfileId);
    return (
      <div>
        <PatientProfile
          profileId={selectedProfileId}
          cases={patientCases}
          onViewClaim={handleViewCase}
          onNewCaseAction={handleNewCaseActionForPatient}
          onContinueRegistration={handleContinueRegistration}
          onViewPatientRecord={handleOpenPatientRecord}
          onBack={handleBackToDashboard}
          userRole={userRole}
        />
        {cibAssistantModal}
      </div>
    );
  }

  // Patient record / Reports hub
  if (currentView === 'patient-record') {
    if (!recordProfileId) {
      return (
        <PatientRecordPicker
          cases={portfolioClaims(store.cases)}
          onSelectPatient={handleOpenPatientRecord}
          onBack={handleBackToDashboard}
        />
      );
    }
    return (
      <PatientRecordView
        cases={store.cases}
        profileId={recordProfileId}
        onChangePatient={handleChangeRecordPatient}
        onBack={handleBackFromPatientRecord}
      />
    );
  }

  // Case options view
  if (currentView === 'case-options' && currentCaseForView) {
    const cameFromProfile = selectedProfileId !== null;
    return (
      <CaseOptionsView
        caseData={currentCaseForView}
        onStartClinicalNote={handleStartClinicalNote}
        onContinueWorkflow={handleContinueWorkflow}
        onClose={
          userRole === 'assistant'
            ? handleBackToAssistantHome
            : cameFromProfile
              ? handleBackToPatientProfile
              : handleBackToDashboard
        }
        readOnly={userRole === 'assistant'}
        onExportPdf={handleAssistantExportPdf}
        onExportZip={handleAssistantExportZip}
        onSendToPatient={
          userRole === 'assistant' || userRole === 'doctor'
            ? handleCaseOptionsSendToPatient
            : undefined
        }
        onSelectClaimType={
          userRole === 'doctor' && selectedCaseId
            ? (claimType) => handleDoctorSelectClaimType(selectedCaseId, claimType)
            : undefined
        }
        patientCibRecords={getPatientCibRecords(store.cases, currentCaseForView.patientId)}
        registrationHandoffNotice={
          registrationHandoffNotice?.caseId === currentCaseForView.id ? registrationHandoffNotice : null
        }
        hasOutboundReferral={
          !registrationHandoffNotice &&
          (currentCaseForView.referrals?.length ?? 0) > 0
        }
        medicalOnly={cameFromProfile && userRole === 'doctor'}
      />
    );
  }

  // Workflow view (doctor only — assistants use case view + exports)
  if (currentView === 'workflow' && userRole === 'assistant') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl bg-slate-50 border border-slate-200 p-8 text-center shadow-sm">
          <p className="text-slate-600">The clinical workflow is only available in the doctor workspace.</p>
          <button
            type="button"
            onClick={handleBackToDashboard}
            className="mt-6 btn-primary w-full"
          >
            Back to patient records
          </button>
        </div>
      </div>
    );
  }

  if (currentView === 'workflow') {
    const claimTypeLabel: Record<ClaimType, string> = {
      diagnostic: 'Diagnostic Claim',
      'ongoing-management': 'Patient Follow-Up Visit',
      'specialist-review': 'Annual / Specialist Review',
      'medication-report': 'Medication Report',
      referral: 'Referral',
    };

    const currentCase = store.cases.find((c) => c.id === (store.currentCaseId || selectedCaseId));
    const workflowBenefitState = currentCase
      ? resolveEffectiveBenefitState(
          currentCase.cibEnrollmentStatus ?? 'unregistered',
          store.activeBenefitState
        )
      : store.activeBenefitState ?? 'unregistered';
    const isWorkflowAMode = isWorkflowA(workflowBenefitState);

    const unregisteredDiagnostic =
      currentClaimType === 'diagnostic' &&
      (currentCase?.cibEnrollmentStatus === 'unregistered' || isWorkflowAMode);

    const workflowProfileIdEarly = currentCase
      ? resolveProfileId(currentCase)
      : resolveProfileIdForSave(store.cases, patientId) ?? createProfileId();
    const chronicCaseEarly =
      store.selectedCondition
        ? store.getChronicCase(workflowProfileIdEarly, store.selectedCondition)
        : undefined;
    const registrationSubmitted =
      chronicCaseEarly?.registrationStatus === 'submitted' ||
      chronicCaseEarly?.registrationStatus === 'complete';
    // Stay on the CIB registration step shell after submit so we don't flip into
    // the standard diagnostic ICD step (same index = 3).
    const stayOnRegistrationShell =
      currentClaimType === 'diagnostic' &&
      (unregisteredDiagnostic ||
        (registrationSubmitted && store.currentStep === 3));

    const workflowSteps = stayOnRegistrationShell
      ? unregisteredDiagnosticSteps
      : standardDiagnosticSteps;
    const medStep = stayOnRegistrationShell ? registrationWorkspaceStep() : 4;
    const finStep = stayOnRegistrationShell ? finalStepIndex() : 5;
    const workspaceStep = registrationWorkspaceStep();
    const scheme = currentCase?.medicalScheme ?? getPatientMedicalScheme(store.cases, patientId);
    const gemsBlocked = scheme === 'gems' && !DataService.isSchemeDataAvailable();

    const conditionCibRecord = store.selectedCondition
      ? currentCase?.cibRecords?.find((r) => r.conditionName === store.selectedCondition) ??
        getCibRecordForCondition(store.cases, patientId, store.selectedCondition)
      : undefined;

    const workflowProfileId = workflowProfileIdEarly;

    const chronicCaseForCondition = chronicCaseEarly;

    const chronicApprovalPathId = chronicCaseForCondition?.approvalPathId;

    // After CIB submit we set cibEnrollmentStatus=registered, which flips
    // unregisteredDiagnostic off. Step 3 would then render DiagnosisConfirmation
    // (ICD) instead of RegistrationComplete — keep the completion screen when
    // chronic registration was just submitted in this diagnostic encounter.
    const showCibRegistrationComplete =
      currentClaimType === 'diagnostic' &&
      store.currentStep === 3 &&
      registrationSubmitted;

    return (
      <div className="min-h-screen bg-white">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-20">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBackToDashboard}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                  title="Back"
                >
                  <ArrowLeft className="w-6 h-6 text-slate-500" />
                </button>
                <div>
                  <p className="text-xl font-semibold text-slate-900 tracking-tight">{claimTypeLabel[currentClaimType]}</p>
                  <p className="text-sm text-slate-500">{patientName} ({patientId})</p>
                </div>
              </div>
              {currentCase?.cibEnrollmentStatus === 'registered' && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                  Registered
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {gemsBlocked && (
          <div className="mb-6 rounded-2xl border border-slate-300 bg-slate-100 p-6 text-center">
            <p className="font-semibold text-slate-800">GEMS scheme data is not yet available</p>
            <p className="text-sm text-slate-600 mt-2">
              Switch the patient to Discovery Health at intake to use tailored baskets and formulary rules.
            </p>
          </div>
        )}
        {currentClaimType === 'diagnostic' && !gemsBlocked && (
          <>
            <div className="mb-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-x-auto">
              <div
                className={`flex items-start ${
                  unregisteredDiagnostic ? 'min-w-[58rem]' : 'min-w-[42rem]'
                }`}
              >
                {workflowSteps.map((step, index) => (
                  <div key={step.id} className="flex items-start flex-1 min-w-0">
                    <div className="flex flex-col items-center flex-1 min-w-0 px-0.5">
                      <div
                        className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${
                          store.currentStep > step.id
                            ? 'authi-gradient text-white'
                            : store.currentStep === step.id
                            ? 'authi-gradient text-white'
                            : 'bg-indigo-50 text-indigo-400'
                        }`}
                      >
                        {store.currentStep > step.id ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          step.id + 1
                        )}
                      </div>
                      <span
                        className={`mt-2 w-full text-center text-[11px] sm:text-xs font-medium leading-tight min-h-[2.75rem] ${
                          store.currentStep >= step.id ? 'text-slate-900' : 'text-indigo-300'
                        }`}
                      >
                        {step.title}
                        {!unregisteredDiagnostic && step.id === medStep && store.currentStep === medStep && (
                          <span className="block text-[10px] text-blue-500 mt-0.5 font-normal">
                            {store.medicationSubstep === 1 ? '(Selection)' : '(Registration Note)'}
                          </span>
                        )}
                      </span>
                    </div>
                    {index < workflowSteps.length - 1 && (
                      <div className="relative flex h-10 shrink-0 items-center flex-1 min-w-[0.75rem] max-w-[2.5rem] px-0.5">
                        <div
                          className={`h-1 w-full rounded-full ${
                            store.currentStep > step.id ? 'authi-gradient' : 'bg-slate-200'
                          }`}
                        />
                        {store.currentStep === step.id + 1 && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <ChevronRight
                              className="w-5 h-5 text-accent-500 animate-slide-arrow"
                              style={{ animation: 'slideArrow 0.8s ease-out' }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step Content */}
            <div className="space-y-6">
              {store.currentStep === 0 && (
                <ClinicalNoteInput
                  value={store.clinicalNote}
                  onChange={store.setClinicalNote}
                  onAnalyze={handleAnalyze}
                  onChooseManually={handleChooseConditionManually}
                  isAnalyzing={isAnalyzing}
                />
              )}

              {store.currentStep === 1 && (
                <ConditionSelection
                  matchedConditions={matchedConditions}
                  onSelect={handleSelectConditionName}
                  selectedCondition={store.selectedCondition}
                  suspectedMode={unregisteredDiagnostic}
                  defaultTab={conditionSelectionMode}
                  deferIcdSelection
                  isAnalyzingSuggestions={isAnalyzing}
                  hasClinicalNote={Boolean(store.clinicalNote.trim())}
                  allowedConditions={getAllowedConditionsForRole(practitionerRole)}
                />
              )}

              {unregisteredDiagnostic &&
                !showCibRegistrationComplete &&
                store.currentStep === workspaceStep &&
                store.selectedCondition && (
                <ChronicRegistrationWorkspace
                  profileId={workflowProfileId}
                  patientName={patientName}
                  patientId={patientId}
                  medicalAidNumber={medicalAidNumber}
                  medicalScheme={scheme}
                  selectedCondition={store.selectedCondition}
                  selectedIcdCode={store.selectedIcdCode}
                  selectedIcdDescription={store.selectedIcdDescription}
                  clinicalNote={store.clinicalNote}
                  diagnosticTreatments={store.diagnosticTreatments}
                  medications={store.medications}
                  diagnosisDate={store.diagnosisDate}
                  selectedPlan={store.selectedPlan}
                  benefitState={store.activeBenefitState ?? 'unregistered'}
                  chronicCase={chronicCaseForCondition}
                  approvalPathId={chronicApprovalPathId}
                  caseId={store.currentCaseId || selectedCaseId || undefined}
                  practitionerRole={practitionerRole}
                  onEnsureApprovalPath={() => {
                    if (!store.selectedCondition) return;
                    void loadCibRegistrationRules().then((rules) => {
                      const conditionRules = getConditionRules(rules, store.selectedCondition!);
                      if (!conditionRules) return;
                      const pathId = resolveApprovalPathForPractitioner(
                        practitionerRole,
                        conditionRules
                      );
                      store.setChronicCaseApprovalPath(
                        workflowProfileId,
                        store.selectedCondition!,
                        pathId
                      );
                      void store.spawnChronicCaseRegistrationActions(
                        workflowProfileId,
                        store.selectedCondition!,
                        practitionerRole
                      );
                    });
                  }}
                  onSyncRegistrationActions={() => {
                    if (!store.selectedCondition) return;
                    void store.spawnChronicCaseRegistrationActions(
                      workflowProfileId,
                      store.selectedCondition,
                      practitionerRole
                    );
                  }}
                  onPrepareRegistrationActions={(actionTemplates) => {
                    if (!store.selectedCondition) return;
                    const condition = store.selectedCondition;
                    store.ensureChronicCase(workflowProfileId, condition);

                    for (const template of actionTemplates) {
                      if (template.autoResolvable) continue;
                      const latestCase = useStore
                        .getState()
                        .getChronicCase(workflowProfileId, condition);
                      const registrationActions =
                        latestCase?.careActions.filter((action) => action.phase === 'registration') ?? [];
                      if (findActionForRequirement(registrationActions, template.requirementKey)) {
                        continue;
                      }
                      store.addCareAction(
                        workflowProfileId,
                        condition,
                        buildCareActionFromTemplate(
                          template,
                          workflowProfileId,
                          condition,
                          'registration',
                          'not_started'
                        )
                      );
                    }
                  }}
                  onSelectIcd={handleSelectIcdCode}
                  onDiagnosisDateChange={(date) => {
                    store.setDiagnosisDate(date);
                    if (date && store.selectedCondition) {
                      syncCibRecordOnCase({
                        conditionName: store.selectedCondition,
                        icd10: store.selectedIcdCode || '',
                        diagnosisDate: date,
                        benefitState: store.activeBenefitState ?? 'unregistered',
                        formularyAligned: true,
                      });
                      store.ensureChronicCase(workflowProfileId, store.selectedCondition, {
                        icdCode: store.selectedIcdCode || undefined,
                      });
                    }
                  }}
                  onAdvanceCareAction={(actionId) => {
                    store.advanceCareAction(
                      workflowProfileId,
                      store.selectedCondition!,
                      actionId
                    );
                  }}
                  onOrderInvestigation={(actionId) => {
                    store.orderInvestigationAction(
                      workflowProfileId,
                      store.selectedCondition!,
                      actionId
                    );
                  }}
                  onReferInvestigation={(actionId, referral) => {
                    store.referInvestigationAction(
                      workflowProfileId,
                      store.selectedCondition!,
                      actionId,
                      referral,
                      {
                        caseId: store.currentCaseId || selectedCaseId || undefined,
                        practitionerRole,
                      }
                    );
                  }}
                  onReferralSent={closeCibAfterReferral}
                  onSpecialistOutcome={(result) => {
                    if (!store.selectedCondition) return;
                    void loadCibRegistrationRules().then((rules) => {
                      const conditionRules = getConditionRules(rules, store.selectedCondition!);
                      if (!conditionRules) return;
                      const pathId = resolveApprovalPathForPractitioner(
                        practitionerRole,
                        conditionRules,
                        result.careOwnership
                      );
                      store.setChronicCaseApprovalPath(
                        workflowProfileId,
                        store.selectedCondition!,
                        pathId
                      );
                    });
                  }}
                  onMockReceiveResults={(orderId) => {
                    store.mockReceiveInvestigationResults(
                      workflowProfileId,
                      store.selectedCondition!,
                      orderId
                    );
                  }}
                  onSetRegistrationPhase={(phase) => {
                    store.setChronicCaseRegistrationPhase(
                      workflowProfileId,
                      store.selectedCondition!,
                      phase
                    );
                  }}
                  onSetInterpretation={(actionId, notes) => {
                    store.setActionInterpretation(
                      workflowProfileId,
                      store.selectedCondition!,
                      actionId,
                      notes
                    );
                  }}
                  onAddMedication={store.addMedication}
                  onRemoveMedication={store.removeMedication}
                  onUpdateMedicationSection12={store.updateMedicationSection12}
                  onBack={handlePreviousStep}
                  onSubmit={handleCibRegistrationSubmit}
                  isSubmitting={isCibSubmitting}
                />
              )}

              {(showCibRegistrationComplete ||
                (unregisteredDiagnostic && store.currentStep === finStep)) &&
                store.selectedCondition && (
                <RegistrationCompleteStep
                  condition={store.selectedCondition}
                  icdCode={store.selectedIcdCode || ''}
                  diagnosisDate={store.diagnosisDate}
                  chronicCase={chronicCaseForCondition}
                  onViewPatientProfile={() => {
                    setSelectedProfileId(workflowProfileId);
                    setCurrentView('patient-profile');
                  }}
                  onBackToDashboard={handleBackToDashboard}
                />
              )}

              {!unregisteredDiagnostic &&
                !showCibRegistrationComplete &&
                store.currentStep === 2 &&
                store.selectedCondition && (
                <div className="space-y-6">
                  {isWorkflowAMode ? (
                    <DiagnosticBasket
                      condition={store.selectedCondition}
                      treatments={store.diagnosticTreatments}
                      onAddTreatment={store.addDiagnosticTreatment}
                      onUpdateTreatment={store.updateDiagnosticTreatment}
                      onRemoveTreatment={store.removeDiagnosticTreatment}
                    />
                  ) : (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                      <p className="text-sm font-semibold text-emerald-900">CIB approved — Workflow B</p>
                      <p className="text-xs text-emerald-800 mt-2 leading-relaxed">
                        This patient is on the chronic benefit pathway for {store.selectedCondition}.
                        Use <strong>Ongoing Management</strong> for treatment basket monitoring.
                      </p>
                      {conditionCibRecord?.approvalDate && (
                        <p className="text-xs text-emerald-700 mt-2">
                          CIB approved: {conditionCibRecord.approvalDate}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!unregisteredDiagnostic &&
                !showCibRegistrationComplete &&
                store.currentStep === 3 &&
                store.selectedCondition && (
                <DiagnosisConfirmation
                  condition={store.selectedCondition}
                  selectedIcdCode={store.selectedIcdCode}
                  diagnosticTreatments={store.diagnosticTreatments}
                  onSelectIcd={handleSelectIcdCode}
                />
              )}

              {!unregisteredDiagnostic && store.currentStep === medStep && store.selectedCondition && (
                <>
                  {store.medicationSubstep === 1 && (
                    <MedicationSelection
                      condition={store.selectedCondition}
                      selectedPlan={store.selectedPlan}
                      benefitState={store.activeBenefitState}
                      medications={store.medications}
                      onAddMedication={store.addMedication}
                      onRemoveMedication={store.removeMedication}
                    />
                  )}
                  
                  {store.medicationSubstep === 2 && (
                    <ChronicRegistrationNote
                      medications={store.medications}
                      medicationNote={store.medicationNote}
                      onSetMedicationNote={store.setMedicationNote}
                      onUpdateMedicationNote={store.updateMedicationNote}
                    />
                  )}
                </>
              )}

              {store.currentStep === finStep && store.selectedCondition && !unregisteredDiagnostic && (
                <div className="space-y-4">
                  <FinalClaimSummary
                      clinicalNote={store.clinicalNote}
                      selectedCondition={store.selectedCondition}
                      selectedIcdCode={store.selectedIcdCode!}
                      selectedIcdDescription={store.selectedIcdDescription!}
                      diagnosticTreatments={store.diagnosticTreatments}
                      ongoingTreatments={store.ongoingTreatments}
                      medications={store.medications}
                      medicationNote={store.medicationNote}
                      medicationReports={
                        store.cases.find((c) => c.id === store.currentCaseId)?.medicationReports
                      }
                      selectedPlan={store.selectedPlan}
                      benefitState={store.activeBenefitState}
                      diagnosisDate={store.diagnosisDate}
                      cibRecords={currentCase?.cibRecords}
                      onConfirm={() => {
                        setClaimCompletionSource('final');
                        setShowClaimCompletion(true);
                      }}
                      onBack={handlePreviousStep}
                      confirmLabel="Confirm and Save Claim"
                    />
                </div>
              )}

              {store.currentStep > 0 &&
                store.currentStep < (stayOnRegistrationShell ? workspaceStep : finStep) && (
                <div className="flex justify-between">
                  <button
                    onClick={handlePreviousStep}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    {store.currentStep === medStep && store.medicationSubstep === 2
                      ? 'Back to Medications'
                      : 'Previous'}
                  </button>
                  <button
                    onClick={handleNextStep}
                    className="btn-primary flex items-center gap-2"
                  >
                    {stayOnRegistrationShell && store.currentStep === 1
                      ? 'Continue to Registration Workspace'
                      : store.currentStep === medStep && store.medicationSubstep === 1
                      ? 'Continue to Registration Note'
                      : store.currentStep === medStep && store.medicationSubstep === 2
                      ? 'Continue to Final Claim'
                      : store.currentStep === 1
                      ? 'Continue to Diagnostics'
                      : store.currentStep === 2
                      ? 'Continue to Confirm Diagnosis'
                      : store.currentStep === 3
                      ? 'Continue to Medication'
                      : 'Next'}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {store.currentStep === 0 && matchedConditions.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={handleNextStep}
                    className="btn-primary flex items-center gap-2"
                  >
                    Next
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {(currentClaimType === 'ongoing-management' || currentClaimType === 'specialist-review') &&
          !gemsBlocked &&
          (() => {
          const specialistFlow = currentClaimType === 'specialist-review';
          const rawFollowUpCondition =
            store.selectedCondition ||
            store.cases.find((c) => c.id === store.currentCaseId)?.condition ||
            '';
          const followUpCondition = rawFollowUpCondition
            ? normalizeConditionName(rawFollowUpCondition)
            : '';
          const followUpPatientId =
            patientId || store.cases.find((c) => c.id === store.currentCaseId)?.patientId || '';
          const followUpPatientCases = (() => {
            const current = store.cases.find((c) => c.id === store.currentCaseId);
            return current
              ? filterPortfolioClaimsByProfile(store.cases, resolveProfileId(current))
              : portfolioClaims(store.cases);
          })();
          const assessmentNote = buildFollowUpAssessmentNote(
            store.clinicalNote,
            store.progressReview,
            store.clinicalReview
          );
          const visitContextNotes = buildVisitContextNotes(
            store.clinicalNote,
            store.clinicalReview,
            store.medicationRenewNotes
          );
          const derivedDecision =
            store.treatmentDecision ??
            (specialistFlow && store.followUpVisitActions.medication
              ? { decision: 'change' as const }
              : deriveTreatmentDecisionFromVisitActions(
                  store.followUpVisitActions,
                  store.medicationMode
                ));
          const workflowCaseSnapshot = currentCase
            ? {
                ...currentCase,
                clinicalNote: store.clinicalNote,
                progressReview: store.progressReview,
                treatmentDecision: store.treatmentDecision ?? undefined,
                clinicalReview: store.clinicalReview ?? undefined,
                ongoingTreatments: store.ongoingTreatments,
              }
            : null;

          return (
            <>
              <div className="mb-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-x-auto">
                <div className="flex items-start min-w-[56rem]">
                  {chronicCareSteps.map((step, index) => (
                    <div key={step.id} className="flex items-start flex-1 min-w-0">
                      <div className="flex flex-col items-center flex-1 min-w-0 px-0.5">
                        <div
                          className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${
                            store.currentStep > step.id
                              ? 'authi-gradient text-white'
                              : store.currentStep === step.id
                              ? 'authi-gradient text-white'
                              : 'bg-indigo-50 text-indigo-400'
                          }`}
                        >
                          {store.currentStep > step.id ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            step.id + 1
                          )}
                        </div>
                        <span
                          className={`mt-2 w-full text-center text-[11px] sm:text-xs font-medium leading-tight min-h-[2.75rem] ${
                            store.currentStep >= step.id ? 'text-slate-900' : 'text-indigo-300'
                          }`}
                        >
                          {step.title}
                        </span>
                      </div>
                      {index < chronicCareSteps.length - 1 && (
                        <div className="relative flex h-10 shrink-0 items-center flex-1 min-w-[0.75rem] max-w-[2.5rem] px-0.5">
                          <div
                            className={`h-1 w-full rounded-full ${
                              store.currentStep > step.id ? 'authi-gradient' : 'bg-slate-200'
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {store.currentStep === 0 && (
                  <>
                    <FollowUpBasketUtilisation
                      condition={followUpCondition}
                      patientId={followUpPatientId}
                      patientCases={followUpPatientCases}
                      currentCaseId={store.currentCaseId}
                      ongoingTreatments={store.ongoingTreatments}
                    />
                    <ClinicalNoteInput
                      variant="follow-up"
                      value={store.clinicalNote}
                      onChange={store.setClinicalNote}
                      onAnalyze={() => {}}
                      isAnalyzing={false}
                    />
                  </>
                )}

                {store.currentStep === 1 && (
                  <FollowUpConditionControl
                    value={store.clinicalReview}
                    onChange={store.setClinicalReview}
                    onSuggestEscalate={
                      specialistFlow
                        ? undefined
                        : () => {
                            store.setCurrentStep(2);
                            store.setFollowUpVisitActions({ referral: true, continueOnly: false });
                          }
                    }
                  />
                )}

                {store.currentStep === 2 && (
                  <FollowUpVisitActions
                    value={store.followUpVisitActions}
                    medicationMode={store.medicationMode}
                    onChange={store.setFollowUpVisitActions}
                    onMedicationModeChange={store.setMedicationMode}
                    specialistFlow={specialistFlow}
                    clinicalReviewDeteriorating={store.clinicalReview === 'deteriorating'}
                  />
                )}

                {store.currentStep === 3 && workflowCaseSnapshot && (
                  <FollowUpDocumentation
                    patientCase={{
                      ...workflowCaseSnapshot,
                      clinicalNote: store.clinicalNote,
                      clinicalReview: store.clinicalReview ?? undefined,
                      medications: store.medications,
                      medicationNote: store.medicationNote,
                    }}
                    visitActions={store.followUpVisitActions}
                    medicationMode={store.medicationMode}
                    medicationRenewNotes={store.medicationRenewNotes}
                    onMedicationRenewNotesChange={store.setMedicationRenewNotes}
                    progressReview={store.progressReview}
                    ongoingTreatments={store.ongoingTreatments}
                    currentMedications={store.medications}
                    medicationNote={store.medicationNote}
                    condition={followUpCondition}
                    selectedPlan={store.selectedPlan}
                    benefitState={store.activeBenefitState}
                    diagnosticClinicalNote={getDiagnosticClinicalNoteFromPortfolio(
                      followUpPatientCases
                    )}
                    assessmentNote={assessmentNote}
                    initialFollowUpNotes={visitContextNotes}
                    monitoringSkipped={store.monitoringSkipped}
                    specialistFlow={specialistFlow}
                    onSetMonitoringSkipped={(skipped, reason) =>
                      store.setMonitoringSkipped(skipped, reason)
                    }
                    onAddTreatment={store.addOngoingTreatment}
                    onUpdateTreatment={store.updateOngoingTreatment}
                    onRemoveTreatment={(index) => {
                      const newTreatments = store.ongoingTreatments.filter((_, i) => i !== index);
                      useStore.setState({ ongoingTreatments: newTreatments });
                    }}
                    onExportSingleTreatment={handleExportSingleTreatment}
                    onSubmitClinicalAppeal={(appeal) => {
                      if (!store.currentCaseId) return;
                      const existing =
                        store.cases.find((c) => c.id === store.currentCaseId)?.clinicalAppeals ?? [];
                      store.updateCase(store.currentCaseId, {
                        clinicalAppeals: [...existing, { ...appeal, createdAt: new Date() }],
                      });
                    }}
                    patientId={followUpPatientId}
                    patientCases={followUpPatientCases}
                    currentCaseId={store.currentCaseId}
                    practitionerRole={practitionerRole}
                    investigationOrders={
                      store.cases.find((c) => c.id === store.currentCaseId)?.investigationOrders ?? []
                    }
                    onOrderInvestigation={(code, label) => {
                      if (!store.currentCaseId) return;
                      const codeNorm = code.trim().split(/\s+/)[0] ?? code;
                      const isLab = ['4081', '3755', '3797'].includes(codeNorm);
                      store.orderOngoingInvestigation(
                        store.currentCaseId,
                        code,
                        label,
                        isLab ? 'pathologist' : 'clinical_technologist'
                      );
                    }}
                    onReferInvestigation={(code, label) => {
                      if (!store.currentCaseId) return;
                      store.referOngoingInvestigation(
                        store.currentCaseId,
                        code,
                        label,
                        practitionerRole
                      );
                    }}
                    onMockReceiveResults={(orderId) => {
                      if (!store.currentCaseId) return;
                      store.mockReceiveOngoingResults(store.currentCaseId, orderId);
                    }}
                    onRequestReferralFromBasket={() => {
                      store.setFollowUpVisitActions({
                        ...store.followUpVisitActions,
                        referral: true,
                        continueOnly: false,
                      });
                    }}
                    onConfirmReferral={(code, label, referral) => {
                      if (!store.currentCaseId) return;
                      store.referOngoingInvestigation(
                        store.currentCaseId,
                        code,
                        label,
                        practitionerRole,
                        {
                          referralId: referral.referralId,
                          referralSpecialty: referral.specialistType,
                          urgency: referral.urgency,
                          referralNote: referral.referralNote,
                        }
                      );
                    }}
                    isReferring={isSaving}
                    onBack={handlePreviousStep}
                    onComplete={handleFollowUpDocumentationComplete}
                  />
                )}

                {store.currentStep === 4 && workflowCaseSnapshot && derivedDecision && (
                  <FollowUpClaimSummary
                    patientCase={{
                      ...workflowCaseSnapshot,
                      medications: store.medications,
                      medicationNote: store.medicationNote,
                      clinicalNote: store.clinicalNote,
                    }}
                    progressReview={store.progressReview}
                    clinicalReview={store.clinicalReview}
                    visitActions={store.followUpVisitActions}
                    medicationMode={store.medicationMode}
                    treatmentDecision={derivedDecision}
                    ongoingTreatments={store.ongoingTreatments}
                    investigationOrders={
                      store.cases.find((c) => c.id === store.currentCaseId)?.investigationOrders ?? []
                    }
                    medications={store.medications}
                    previousMedications={store.medications}
                    newMedications={pendingFollowUpPayload?.medicationReport?.newMedications ?? []}
                    benefitState={store.activeBenefitState}
                    onBack={handlePreviousStep}
                    onConfirm={handleFollowUpSummaryConfirm}
                  />
                )}

                {store.currentStep < 3 && (
                <div className="flex justify-between">
                  <button
                    onClick={handlePreviousStep}
                    disabled={store.currentStep === 0}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-40"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                  </button>
                  <button onClick={handleNextStep} className="btn-primary flex items-center gap-2">
                    {store.currentStep === 0
                      ? 'Continue to Condition Control'
                      : store.currentStep === 1
                      ? 'Continue to Visit Actions'
                      : store.followUpVisitActions.continueOnly
                      ? 'Continue to Visit Summary'
                      : 'Continue to Complete Actions'}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
                )}
              </div>
            </>
          );
        })()}

        {currentClaimType === 'medication-report' && store.currentCaseId && (
          <MedicationReport
            reportMode="standalone_renew"
            currentMedications={store.medications}
            medicationNote={store.medicationNote}
            condition={store.selectedCondition || store.cases.find(c => c.id === store.currentCaseId)?.condition || ''}
            selectedPlan={store.selectedPlan}
            benefitState={store.activeBenefitState}
            onSaveOnly={handleMedicationReportSaveOnly}
            onSavePdfOnly={handleMedicationReportSavePdfOnly}
            onSaveWithAttachments={handleMedicationReportSaveWithAttachments}
          />
        )}

        {currentClaimType === 'referral' && store.currentCaseId && (() => {
          const currentCase = store.cases.find((c) => c.id === store.currentCaseId);
          return currentCase ? (
            <Referral
              patientCase={currentCase}
              onSavePdfOnly={(urgency, referralNote, specialistType) => {
                handleReferralSavePdfOnly(urgency, referralNote, specialistType);
                if (store.currentCaseId) {
                  store.updateCase(store.currentCaseId, { status: 'completed', isWorkflowDraft: false });
                }
                store.resetWorkflow();
                setCurrentView('dashboard');
              }}
              onSaveWithAttachments={async (urgency, referralNote, specialistType) => {
                await handleReferralSaveWithAttachments(urgency, referralNote, specialistType);
                if (store.currentCaseId) {
                  store.updateCase(store.currentCaseId, { status: 'completed', isWorkflowDraft: false });
                }
                store.resetWorkflow();
                setCurrentView('dashboard');
              }}
            />
          ) : null;
        })()}
      </main>

      {cibAssistantModal}

      <ClaimCompletionModal
        isOpen={showClaimCompletion}
        onClose={() => {
          setShowClaimCompletion(false);
          setPendingFollowUpPayload(null);
        }}
        patientName={patientName || getPatientInfoForSave().patientName || 'Patient'}
        patientEmail={patientEmail || getPatientInfoForSave().patientEmail}
        isDoctor={userRole === 'doctor'}
        isSubmitting={isSaving}
        emailDeliveryConfigured={emailDeliveryConfigured}
        title={
          claimCompletionSource === 'cib'
            ? 'CIB registration complete'
            : claimCompletionSource === 'follow-up'
              ? 'Follow-up visit complete'
              : 'Claim complete'
        }
        subtitle={
          claimCompletionSource === 'cib'
            ? 'Patient marked as pending chronic benefit review. Choose how to handle the claim package.'
            : claimCompletionSource === 'follow-up'
              ? 'Save to your workspace, or export and send documents to the patient.'
              : 'Choose whether to save, export, or send documents to the patient.'
        }
        onAction={handleClaimCompletionAction}
      />

      {/* Patient Export Modal */}
      {showPatientExport && getPatientExportData() && (
        <PatientExportModal
          isOpen={showPatientExport}
          onClose={() => setShowPatientExport(false)}
          data={getPatientExportData()!}
        />
      )}
    </div>
    );
  }

    // Fallback
    return (
      <Dashboard
        cases={portfolioClaims(store.cases)}
        onNewCase={handleNewCaseClick}
        onViewCase={handleViewCase}
        onViewPatientProfile={handleViewPatientProfile}
      />
    );
  }; // end renderView

  return (
    <div className="flex min-h-screen bg-white">
      <AppSidebar
        currentView={currentView}
        onNavigate={handleSidebarNavigate}
        onReportsNavigate={handleOpenReports}
        userRole={userRole}
        onSignOut={() => void handleLogout()}
      />
      <div className="flex-1 ml-60 min-w-0 overflow-y-auto">
        {renderView()}
      </div>
    </div>
  );
}

