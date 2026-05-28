'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { DataService } from '@/lib/dataService';
import { PDFExportService } from '@/lib/pdfExport';
import { saveCaseToDatabase, updateCaseDeliveryStatus } from '@/lib/caseService';
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
import IcdCodeSelection from '@/components/IcdCodeSelection';
import DiagnosticBasket from '@/components/DiagnosticBasket';
import MedicationSelection from '@/components/MedicationSelection';
import ChronicRegistrationNote from '@/components/ChronicRegistrationNote';
import OngoingManagement from '@/components/OngoingManagement';
import MedicationReport from '@/components/MedicationReport';
import Referral from '@/components/Referral';
import FinalClaimSummary from '@/components/FinalClaimSummary';
import PatientExportModal from '@/components/PatientExportModal';
import Dashboard from '@/components/Dashboard';
import PatientInfoForm, { PatientInfo } from '@/components/PatientInfoForm';
import CaseOptionsView from '@/components/CaseOptionsView';
import PatientProfile from '@/components/PatientProfile';
import CibApplicationAssistant from '@/components/CibApplicationAssistant';
import DiagnosticEvidenceReview from '@/components/DiagnosticEvidenceReview';
import CibRegistrationStep from '@/components/CibRegistrationStep';
import { MatchedCondition, PatientCase, SelectedMedication, ClaimType, BenefitState, CibRecord } from '@/types';
import { normalizeSelectedMedication } from '@/lib/medicationCoverage';
import {
  benefitStateLabel,
  buildDefaultCibRecord,
  enrollmentToBenefitState,
  getCibRecordForCondition,
  getPatientCibRecords,
  getPatientEnrollmentStatus,
  getPatientMedicalScheme,
  isWorkflowA,
  isWorkflowB,
} from '@/lib/benefitState';
import { canProceedFromEvidenceReview } from '@/lib/diagnosticEvidence';
import type { PatientExportData } from '@/lib/patientExport';
import AppSidebar from '@/components/AppSidebar';
import PatientRecordPicker from '@/components/PatientRecordPicker';
import PatientRecordView from '@/components/PatientRecordView';
import { normalizePatientCase } from '@/lib/normalizePatientCase';
import {
  createCaseId,
  createProfileId,
  filterCasesByProfile,
  resolveProfileId,
  validateNewPatientIntake,
} from '@/lib/patientPortfolio';

type UserRole = 'assistant' | 'doctor';

type AppView =
  | 'landing'
  | 'onboarding'
  | 'assistant-home'
  | 'dashboard'
  | 'patient-info'
  | 'patient-profile'
  | 'patient-record'
  | 'case-options'
  | 'workflow';

const deduplicateMedications = (medications: SelectedMedication[]): SelectedMedication[] => {
  return medications.map(normalizeSelectedMedication).reduce((acc: SelectedMedication[], current) => {
    const duplicate = acc.find(item =>
      item.medicineNameAndStrength === current.medicineNameAndStrength
    );
    if (!duplicate) {
      acc.push(current);
    }
    return acc;
  }, []);
};

export default function Home() {
  const store = useStore();
  const auth = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matchedConditions, setMatchedConditions] = useState<MatchedCondition[]>([]);
  const [currentClaimType, setCurrentClaimType] = useState<ClaimType>('diagnostic');
  const [showClaimCompletion, setShowClaimCompletion] = useState(false);
  const [emailDeliveryConfigured, setEmailDeliveryConfigured] = useState(false);
  const [claimCompletionSource, setClaimCompletionSource] = useState<'cib' | 'final'>('final');
  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [medicalAidNumber, setMedicalAidNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPatientExport, setShowPatientExport] = useState(false);

  const practiceName = auth.workspace?.name ?? '';
  const doctorName = getDoctorDisplayName(auth.profile);
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

  const handleViewCase = (caseId: string) => {
    const caseData = store.cases.find(c => c.id === caseId);
    if (caseData) {
      setSelectedCaseId(caseId);
      setSelectedProfileId(resolveProfileId(caseData));
      setCurrentCaseForView(normalizePatientCase(caseData));
      setCurrentView('case-options');
    }
  };

  const handleViewPatientProfile = (profileId: string) => {
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
      if (claimType === 'ongoing-management' || claimType === 'medication-report') {
        store.setCurrentStep(0);
      } else {
        let startStep = 0;
        if (currentCaseForView.clinicalNote) startStep = 1;
        if (currentCaseForView.condition) startStep = 2;
        if (currentCaseForView.diagnosticTreatments.length > 0) startStep = 3;
        if (currentCaseForView.medications.length > 0) startStep = 4;
        if (currentCaseForView.medicationNote) startStep = 5;
        store.setCurrentStep(startStep);
      }
      setCurrentView('workflow');
    }
  };

  const handleBackToDashboard = () => {
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
  };

  const handleBackToPatientProfile = () => {
    setCurrentView('patient-profile');
    setSelectedCaseId(null);
    setCurrentCaseForView(null);
  };

  /**
   * Called from PatientProfile when the doctor selects a case action type.
   * Creates a new claim for the existing patient, pre-fills data from their latest case,
   * and routes directly into the relevant workflow — no PatientInfoForm needed.
   */
  const handleNewCaseActionForPatient = (profileId: string, claimType: ClaimType) => {
    const patientCases = filterCasesByProfile(store.cases, profileId);
    if (patientCases.length === 0) return;

    const latest = [...patientCases].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];

    store.resetWorkflow();
    setMatchedConditions([]);
    setCurrentClaimType(claimType);
    setPatientName(latest.patientName);
    setPatientId(latest.patientId);
    setPatientEmail(latest.patientEmail || '');
    setPatientPhone(latest.patientPhone || '');
    setMedicalAidNumber(latest.medicalAidNumber || '');
    store.setSelectedPlan(latest.plan);

    // Pre-fill condition from the patient's most recent case that has one
    const withCondition = patientCases
      .filter((c) => c.condition)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

    if (claimType !== 'diagnostic' && withCondition) {
      store.setSelectedCondition(
        withCondition.condition,
        withCondition.icdCode,
        withCondition.icdDescription
      );
    }

    // For medication-report, pre-load current medications from latest case
    if (claimType === 'medication-report' && latest.medications.length > 0) {
      latest.medications.forEach((med) => store.addMedication(med));
      store.setMedicationNote(latest.medicationNote || '');
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
      medications: claimType === 'medication-report' ? [...latest.medications] : [],
      medicationNote: claimType === 'medication-report' ? (latest.medicationNote || '') : '',
      plan: latest.plan,
      status: 'new',
      medicalScheme: latest.medicalScheme ?? 'discovery',
      cibEnrollmentStatus: latest.cibEnrollmentStatus ?? 'unregistered',
      claimType:
        (latest.cibEnrollmentStatus ?? 'unregistered') === 'unregistered'
          ? 'diagnostic'
          : claimType,
      cibRecords: latest.cibRecords ?? [],
    };

    store.addCase(newCase);
    setSelectedCaseId(newCase.id);

    if (claimType === 'diagnostic') {
      store.setActiveBenefitState('unregistered');
      store.setDiagnosisDate('');
    } else {
      const conditionName = withCondition?.condition || '';
      const conditionRecord = getCibRecordForCondition(
        [...patientCases, newCase],
        latest.patientId,
        conditionName
      );
      store.setActiveBenefitState(
        conditionRecord?.benefitState ??
          enrollmentToBenefitState(newCase.cibEnrollmentStatus ?? 'unregistered')
      );
      if (conditionRecord?.diagnosisDate) {
        store.setDiagnosisDate(conditionRecord.diagnosisDate);
      }
    }
    DataService.setActiveScheme(newCase.medicalScheme ?? 'discovery');
    void DataService.initialize(newCase.medicalScheme ?? 'discovery');

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

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinical_note: store.clinicalNote,
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
        similarityScore: condition.similarity_score || 0
      }));

      const deduplicatedConditions = mappedConditions.reduce((acc: MatchedCondition[], current: MatchedCondition) => {
        const existingIndex = acc.findIndex(item => item.condition === current.condition);
        if (existingIndex === -1) {
          acc.push(current);
        } else if (current.similarityScore > acc[existingIndex].similarityScore) {
          acc[existingIndex] = current;
        }
        return acc;
      }, []);

      setMatchedConditions(deduplicatedConditions);

      if (deduplicatedConditions.length > 0) {
        store.setCurrentStep(1);
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      const errorMessage = error.message || 'Failed to analyze note. Please try again.';
      alert(`Analysis Error: ${errorMessage}\n\nIf this persists, the backend may be initializing. Please wait a moment and try again.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectCondition = (condition: string, icdCode: string, description: string) => {
    store.setSelectedCondition(condition, icdCode, description);
    const pid = patientId || store.cases.find((c) => c.id === store.currentCaseId)?.patientId;
    if (pid) {
      const rec = getCibRecordForCondition(store.cases, pid, condition);
      if (rec) {
        store.setActiveBenefitState(rec.benefitState);
        if (rec.diagnosisDate) store.setDiagnosisDate(rec.diagnosisDate);
      } else {
        const enrollment = getPatientEnrollmentStatus(store.cases, pid);
        store.setActiveBenefitState(enrollmentToBenefitState(enrollment));
      }
    }
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

  const medicationStepIndex = () => (isUnregisteredDiagnosticFlow() ? 5 : 4);
  const finalStepIndex = () => (isUnregisteredDiagnosticFlow() ? 6 : 5);
  const maxNavStepIndex = () => (isUnregisteredDiagnosticFlow() ? 5 : 5);

  const handleNextStep = () => {
    if (store.currentStep === 1 && !store.selectedCondition) {
      alert('Please select a condition');
      return;
    }
    if (store.currentStep === 2 && !store.selectedIcdCode) {
      alert('Please select an ICD-10 code');
      return;
    }

    if (isUnregisteredDiagnosticFlow()) {
      if (store.currentStep === 3) {
        if (store.diagnosticTreatments.length === 0) {
          alert('Select at least one diagnostic test from the basket.');
          return;
        }
      }
      if (store.currentStep === 4) {
        const gate = canProceedFromEvidenceReview(
          store.diagnosticTreatments,
          store.selectedIcdCode ?? '',
          store.diagnosisDate
        );
        if (!gate.ok) {
          alert(gate.reason);
          return;
        }
      }
      if (store.currentStep === medicationStepIndex()) {
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
            const proceed = confirm(
              'No registration note has been entered. Proceed to CIB registration without a note?'
            );
            if (!proceed) return;
          }
          store.setCurrentStep(finalStepIndex());
          return;
        }
      }
    } else if (store.currentStep === 4) {
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

    store.setCurrentStep(store.currentStep + 1);
  };

  const handlePreviousStep = () => {
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

    setIsCibSubmitting(true);
    try {
      const record: CibRecord = {
        ...buildDefaultCibRecord(
          store.selectedCondition,
          store.selectedIcdCode || '',
          store.diagnosisDate,
          store.medications[0]?.medicineNameAndStrength
        ),
        fundingLagNote: motivationNote.trim() || undefined,
        formularyAligned: store.medications.every((m) => m.formularyStatus === 'listed'),
      };

      store.upsertCibRecord(caseId, record);
      store.setActiveBenefitState('pending_cib_review');
      store.setMedicationNote(motivationNote);

      const patientData = getPatientInfoForSave();
      store.updateCase(caseId, {
        ...patientData,
        clinicalNote: store.clinicalNote,
        condition: store.selectedCondition,
        icdCode: store.selectedIcdCode || '',
        icdDescription: store.selectedIcdDescription || '',
        diagnosticTreatments: store.diagnosticTreatments,
        medications: store.medications,
        medicationNote: motivationNote,
        plan: store.selectedPlan,
        status: 'completed',
        cibEnrollmentStatus: 'registered',
        doctorApproved: auth.isOwner,
        deliveryStatus: 'ready_to_send',
      });

      setClaimCompletionSource('cib');
      setShowClaimCompletion(true);
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
      deliveryStatus,
      doctorApproved,
      updatedAt: new Date(),
    };

    const caseIdForSave = store.currentCaseId || selectedCaseId;

    await saveCaseToDatabase({
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
  };

  const handleClaimCompletionAction = async (action: ClaimCompletionAction) => {
    setIsSaving(true);
    try {
      const isDoctor = userRole === 'doctor';
      let deliveryStatus: 'ready_to_send' | 'sent_to_patient' =
        action === 'send_patient' ? 'sent_to_patient' : 'ready_to_send';

      if (action === 'send_patient') {
        const exportData = getPatientExportData();
        const email = patientEmail || getPatientInfoForSave().patientEmail;
        if (exportData && email) {
          const delivery = await deliverClaimToPatient(
            exportData,
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

  const handleDashboardSendToPatient = async (caseId: string) => {
    const caseData = store.cases.find((c) => c.id === caseId);
    if (!caseData?.patientEmail) {
      alert('No patient email on this case.');
      return;
    }

    store.loadCase(caseId);
    const exportData: PatientExportData = {
      patientName: caseData.patientName,
      patientId: caseData.patientId,
      clinicalNote: caseData.clinicalNote,
      registrationNote: caseData.medicationNote || '',
      conditions: caseData.condition
        ? [{
            id: '1',
            name: caseData.condition,
            icdCode: caseData.icdCode,
            icdDescription: caseData.icdDescription,
          }]
        : [],
      medications: (caseData.medications ?? []).map((med, index) => ({
        id: index.toString(),
        name: med.medicineNameAndStrength,
        nappiCode: '',
        quantity: 1,
        dosage: med.note || med.cdaAmount || 'As prescribed',
      })),
    };

    const delivery = await deliverClaimToPatient(
      exportData,
      caseData.patientEmail,
      practiceName || 'Your practice',
      doctorName
    );

    if (delivery.method === 'automated') {
      store.updateCase(caseId, { deliveryStatus: 'sent_to_patient', updatedAt: new Date() });
      try {
        await updateCaseDeliveryStatus(caseId, 'sent_to_patient');
      } catch {
        // Local state updated even if remote sync fails
      }
    }
    notifyPatientDeliveryResult(caseData.patientEmail, delivery);
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
      const caseUpdates = {
        patientName,
        patientId,
        patientEmail,
        patientPhone,
        medicalAidNumber,
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
      };

      if (!result.success) {
        if (selectedCaseId) {
          store.updateCase(selectedCaseId, caseUpdates);
        } else {
          store.saveCase(patientName, patientId, currentClaimType);
          if (store.currentCaseId) {
            setSelectedCaseId(store.currentCaseId);
            store.updateCase(store.currentCaseId, { status: 'completed' });
          }
        }

        setShowClaimCompletion(false);
        store.resetWorkflow();
        setCurrentView('dashboard');
        alert(`Saved locally. Remote save failed: ${result.error || 'Unknown error'}`);
      } else {
        if (selectedCaseId) {
          store.updateCase(selectedCaseId, caseUpdates);
        } else {
          store.saveCase(patientName, patientId, currentClaimType);
          if (store.currentCaseId) {
            setSelectedCaseId(store.currentCaseId);
            store.updateCase(store.currentCaseId, { status: 'completed' });
          }
        }

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
      });
    } else {
      store.saveCase(patientData.patientName, patientData.patientId, currentClaimType);
      if (store.currentCaseId) {
        setSelectedCaseId(store.currentCaseId);
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

  const handleOngoingManagementSaveOnly = () => {
    if (store.currentCaseId) {
      store.updateCase(store.currentCaseId, {
        ongoingTreatments: [...store.ongoingTreatments],
        status: 'completed',
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
    if (store.currentCaseId) {
      store.updateCase(store.currentCaseId, {
        ongoingTreatments: [...store.ongoingTreatments],
        status: 'completed',
      });
      const snapshot = buildCurrentCaseSnapshot();
      if (snapshot) {
        const pdfService = new PDFExportService();
        pdfService.exportInitialClaim(snapshot);
      }
    }
    store.resetWorkflow();
    setCurrentView('dashboard');
    alert('Ongoing management saved and claim PDF exported!');
  };

  const handleOngoingManagementSaveWithAttachments = async () => {
    if (store.currentCaseId) {
      store.updateCase(store.currentCaseId, {
        ongoingTreatments: [...store.ongoingTreatments],
        status: 'completed',
      });
      const snapshot = buildCurrentCaseSnapshot();
      if (snapshot) {
        const pdfService = new PDFExportService();
        await pdfService.exportInitialClaimWithAttachments(snapshot);
      }
    }
    store.resetWorkflow();
    setCurrentView('dashboard');
    alert('Ongoing management saved and full claim exported with attachments!');
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

    const combinedMedications =
      newMeds && newMeds.length > 0
        ? deduplicateMedications([...currentCase.medications, ...newMeds])
        : currentCase.medications;

    store.addMedicationReport(store.currentCaseId, {
      caseId: store.currentCaseId,
      originalMedications: currentCase.medications,
      followUpNotes,
      newMedications: newMeds || [],
      motivationLetter: motivationLetter || '',
      documentation,
    });

    store.updateCase(store.currentCaseId, {
      medications: combinedMedications,
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
      store.updateCase(store.currentCaseId, { status: 'completed' });
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
      store.updateCase(store.currentCaseId, { status: 'completed' });
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
      store.updateCase(store.currentCaseId, { status: 'completed' });
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
      store.setActiveBenefitState(record.benefitState);
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
    { id: 2, title: 'ICD Code' },
    { id: 3, title: 'Diagnostics' },
    { id: 4, title: 'Medication' },
    { id: 5, title: 'Final Claim' },
  ];

  const unregisteredDiagnosticSteps = [
    { id: 0, title: 'Clinical Note' },
    { id: 1, title: 'Condition' },
    { id: 2, title: 'ICD Code' },
    { id: 3, title: 'Diagnostics' },
    { id: 4, title: 'Evidence Review' },
    { id: 5, title: 'Medication' },
    { id: 6, title: 'CIB Registration' },
  ];

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
                      ? `Manage claims for ${practiceName}, invite your assistant, and open the doctor workflow.`
                      : `Create patient intake for ${practiceName}. The doctor completes clinical sign-off.`}
                  </p>

                  {auth.isOwner && (landingRole === 'doctor' || !assistantWorkspaceReady) && (
                    <>
                      <div className="authi-panel-card mt-8 authi-tint">
                        <p className="text-sm uppercase tracking-[0.24em] authi-gradient-text font-bold">Doctor role</p>
                        <h3 className="mt-3 text-xl font-semibold text-slate-900">Claim workflow and sign-off</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Review cases, complete CIB registration, and choose save, export, or send to patient.
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
                      <p className="text-sm uppercase tracking-[0.24em] authi-gradient-text font-bold">Assistant role</p>
                      <h3 className="mt-3 text-xl font-semibold text-slate-900">Patient intake and delivery</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {hasActiveAssistant
                          ? `${assistantName} can create patient cases and send claim packages when ready.`
                          : 'Invite sent — once your assistant accepts, they can manage intake from this workspace.'}
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
                      <p className="text-sm uppercase tracking-[0.24em] authi-gradient-text font-bold">Assistant role</p>
                      <h3 className="mt-3 text-xl font-semibold text-slate-900">Patient intake and delivery</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Create cases with patient email on file. Send claim packages when cases are ready.
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
                  Patient intake and claim documents for {practiceName || 'your practice'}.
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
                Add patient details and start a case. The doctor completes the clinical workflow and finalizes the claim.
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
        cases={store.cases}
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
      />
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
    const patientCases = filterCasesByProfile(store.cases, selectedProfileId);
    return (
      <div>
        <PatientProfile
          profileId={selectedProfileId}
          cases={patientCases}
          onViewClaim={handleViewCase}
          onNewCaseAction={handleNewCaseActionForPatient}
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
          cases={store.cases}
          onSelectPatient={handleOpenPatientRecord}
          onBack={handleBackToDashboard}
        />
      );
    }
    return (
      <PatientRecordView
        cases={store.cases}
        profileId={recordProfileId}
        onViewClaim={handleViewCase}
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
        onSelectClaimType={
          userRole === 'doctor' && selectedCaseId
            ? (claimType) => handleDoctorSelectClaimType(selectedCaseId, claimType)
            : undefined
        }
        patientCibRecords={getPatientCibRecords(store.cases, currentCaseForView.patientId)}
      />
    );
  }

  // Workflow view (doctor only — assistants use case view + exports)
  if (currentView === 'workflow' && userRole === 'assistant') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl bg-slate-50 border border-slate-200 p-8 text-center shadow-sm">
          <p className="text-slate-600">The clinical workflow is only available to the doctor role.</p>
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
      'diagnostic': 'Diagnostic Claim',
      'ongoing-management': 'Ongoing Management',
      'medication-report': 'Medication Report',
      'referral': 'Referral',
    };

    const isWorkflowA =
      !store.activeBenefitState ||
      store.activeBenefitState === 'unregistered' ||
      store.activeBenefitState === 'pending_cib_review';

    const currentCase = store.cases.find((c) => c.id === (store.currentCaseId || selectedCaseId));
    const unregisteredDiagnostic =
      currentClaimType === 'diagnostic' &&
      (currentCase?.cibEnrollmentStatus === 'unregistered' || isWorkflowA);
    const workflowSteps = unregisteredDiagnostic
      ? unregisteredDiagnosticSteps
      : standardDiagnosticSteps;
    const medStep = unregisteredDiagnostic ? 5 : 4;
    const finStep = unregisteredDiagnostic ? 6 : 5;
    const scheme = currentCase?.medicalScheme ?? getPatientMedicalScheme(store.cases, patientId);
    const gemsBlocked = scheme === 'gems' && !DataService.isSchemeDataAvailable();

    const conditionCibRecord = store.selectedCondition
      ? currentCase?.cibRecords?.find((r) => r.conditionName === store.selectedCondition) ??
        getCibRecordForCondition(store.cases, patientId, store.selectedCondition)
      : undefined;

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
              <div className="flex items-center justify-between min-w-[640px]">
                {workflowSteps.map((step, index) => (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center w-full">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                          store.currentStep > step.id
                            ? 'authi-gradient text-white'
                            : store.currentStep === step.id
                            ? 'authi-gradient text-white'
                            : 'bg-indigo-50 text-indigo-400'
                        }`}
                      >
                        {store.currentStep > step.id ? (
                          <CheckCircle className="w-6 h-6" />
                        ) : (
                          step.id + 1
                        )}
                      </div>
                      <span className={`mt-2 text-sm font-medium text-center ${
                        store.currentStep >= step.id ? 'text-slate-900' : 'text-indigo-300'
                      }`}>
                        {step.title}
                        {step.id === medStep && store.currentStep === medStep && (
                          <span className="block text-xs text-blue-500 mt-0.5">
                            {store.medicationSubstep === 1 ? '(Selection)' : '(Registration Note)'}
                          </span>
                        )}
                      </span>
                    </div>
                    {index < workflowSteps.length - 1 && (
                      <div className="relative flex-1 mx-4 flex items-center">
                        <div
                          className={`h-1 w-full rounded-full ${
                            store.currentStep > step.id ? 'authi-gradient' : 'bg-slate-200'
                          }`}
                        />
                        {store.currentStep === step.id + 1 && (
                          <div className="absolute inset-0 flex items-center">
                            <ChevronRight
                              className="w-6 h-6 text-accent-500 animate-slide-arrow"
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
                  isAnalyzing={isAnalyzing}
                />
              )}

              {store.currentStep === 1 && (
                <ConditionSelection
                  matchedConditions={matchedConditions}
                  onSelect={handleSelectCondition}
                  selectedCondition={store.selectedCondition}
                />
              )}

              {store.currentStep === 2 && store.selectedCondition && (
                <IcdCodeSelection
                  condition={store.selectedCondition}
                  selectedIcdCode={store.selectedIcdCode}
                  onSelect={(code, desc) => {
                    store.setSelectedCondition(store.selectedCondition!, code, desc);
                  }}
                />
              )}

              {store.currentStep === 3 && store.selectedCondition && (
                <div className="space-y-6">
                  {unregisteredDiagnostic || isWorkflowA ? (
                    <DiagnosticBasket
                      condition={store.selectedCondition}
                      treatments={store.diagnosticTreatments}
                      onAddTreatment={store.addDiagnosticTreatment}
                      onUpdateTreatment={store.updateDiagnosticTreatment}
                      onRemoveTreatment={(index) => {
                        const newTreatments = store.diagnosticTreatments.filter((_, i) => i !== index);
                        useStore.setState({ diagnosticTreatments: newTreatments });
                      }}
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

              {unregisteredDiagnostic && store.currentStep === 4 && store.selectedCondition && (
                <DiagnosticEvidenceReview
                  conditionName={store.selectedCondition}
                  icdCode={store.selectedIcdCode ?? ''}
                  clinicalNote={store.clinicalNote}
                  diagnosticTreatments={store.diagnosticTreatments}
                  diagnosisDate={store.diagnosisDate}
                  benefitState={store.activeBenefitState ?? 'unregistered'}
                  medicationsFormularyAligned={store.medications.every(
                    (m) => m.formularyStatus === 'listed'
                  )}
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
                    }
                  }}
                />
              )}

              {store.currentStep === medStep && store.selectedCondition && (
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

              {store.currentStep === finStep && store.selectedCondition && (
                <div className="space-y-4">
                  {unregisteredDiagnostic ? (
                    <CibRegistrationStep
                      patientName={patientName}
                      patientId={patientId}
                      medicalAidNumber={medicalAidNumber}
                      medicalScheme={scheme}
                      selectedCondition={store.selectedCondition}
                      selectedIcdCode={store.selectedIcdCode!}
                      selectedIcdDescription={store.selectedIcdDescription!}
                      clinicalNote={store.clinicalNote}
                      diagnosticTreatments={store.diagnosticTreatments}
                      medications={store.medications}
                      medicationNote={store.medicationNote}
                      diagnosisDate={store.diagnosisDate}
                      selectedPlan={store.selectedPlan}
                      benefitState={store.activeBenefitState ?? 'unregistered'}
                      onBack={handlePreviousStep}
                      onSubmit={handleCibRegistrationSubmit}
                      isSubmitting={isCibSubmitting}
                    />
                  ) : (
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
                  )}
                </div>
              )}

              {store.currentStep > 0 && store.currentStep < finStep && (
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
                    {store.currentStep === medStep && store.medicationSubstep === 1
                      ? 'Continue to Registration Note'
                      : store.currentStep === medStep && store.medicationSubstep === 2
                      ? unregisteredDiagnostic
                        ? 'Continue to CIB Registration'
                        : 'Continue to Final Claim'
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

        {currentClaimType === 'ongoing-management' && (
          <OngoingManagement
            condition={store.selectedCondition || store.cases.find(c => c.id === store.currentCaseId)?.condition || ''}
            patientId={patientId || store.cases.find(c => c.id === store.currentCaseId)?.patientId || ''}
            patientCases={
              (() => {
                const current = store.cases.find((c) => c.id === store.currentCaseId);
                return current
                  ? filterCasesByProfile(store.cases, resolveProfileId(current))
                  : store.cases;
              })()
            }
            currentCaseId={store.currentCaseId}
            treatments={store.ongoingTreatments}
            clinicalNote={store.clinicalNote || store.cases.find(c => c.id === store.currentCaseId)?.clinicalNote || ''}
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
                clinicalAppeals: [
                  ...existing,
                  { ...appeal, createdAt: new Date() },
                ],
              });
            }}
            onSaveOnly={handleOngoingManagementSaveOnly}
            onSavePdfOnly={handleOngoingManagementSavePdfOnly}
            onSaveWithAttachments={handleOngoingManagementSaveWithAttachments}
          />
        )}

        {currentClaimType === 'medication-report' && store.currentCaseId && (
          <MedicationReport
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
                  store.updateCase(store.currentCaseId, { status: 'completed' });
                }
                store.resetWorkflow();
                setCurrentView('dashboard');
              }}
              onSaveWithAttachments={async (urgency, referralNote, specialistType) => {
                await handleReferralSaveWithAttachments(urgency, referralNote, specialistType);
                if (store.currentCaseId) {
                  store.updateCase(store.currentCaseId, { status: 'completed' });
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
        onClose={() => setShowClaimCompletion(false)}
        patientName={patientName || getPatientInfoForSave().patientName || 'Patient'}
        patientEmail={patientEmail || getPatientInfoForSave().patientEmail}
        isDoctor={userRole === 'doctor'}
        isSubmitting={isSaving}
        emailDeliveryConfigured={emailDeliveryConfigured}
        title={claimCompletionSource === 'cib' ? 'CIB registration complete' : 'Claim complete'}
        subtitle={
          claimCompletionSource === 'cib'
            ? 'Patient marked as pending chronic benefit review. Choose how to handle the claim package.'
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
        cases={store.cases}
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
        onNavigate={setCurrentView}
        onReportsNavigate={handleOpenReports}
        userRole={userRole}
      />
      <div className="flex-1 ml-60 min-w-0 overflow-y-auto">
        {renderView()}
      </div>
    </div>
  );
}

