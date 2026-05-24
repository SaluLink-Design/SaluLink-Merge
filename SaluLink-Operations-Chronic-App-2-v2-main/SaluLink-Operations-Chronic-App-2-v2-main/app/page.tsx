'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useStore } from '@/lib/store';
import { DataService } from '@/lib/dataService';
import { PDFExportService } from '@/lib/pdfExport';
import { saveCaseToDatabase } from '@/lib/caseService';
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
import { MatchedCondition, PatientCase, SelectedMedication, ClaimType } from '@/types';
import type { PatientExportData } from '@/lib/patientExport';
import AppSidebar from '@/components/AppSidebar';

type UserRole = 'assistant' | 'doctor';

type AppView = 'landing' | 'onboarding' | 'assistant-home' | 'dashboard' | 'patient-info' | 'patient-profile' | 'case-options' | 'workflow';

const deduplicateMedications = (medications: any[]) => {
  return medications.reduce((acc: any[], current) => {
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matchedConditions, setMatchedConditions] = useState<MatchedCondition[]>([]);
  const [currentClaimType, setCurrentClaimType] = useState<ClaimType>('diagnostic');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [medicalAidNumber, setMedicalAidNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPatientExport, setShowPatientExport] = useState(false);
  
  const [practiceName, setPracticeName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [assistantName, setAssistantName] = useState('');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [onboardingPracticeName, setOnboardingPracticeName] = useState('');
  const [onboardingDoctorName, setOnboardingDoctorName] = useState('');
  const [onboardingAssistantName, setOnboardingAssistantName] = useState('');
  const [onboardingErrors, setOnboardingErrors] = useState<Partial<Record<'practiceName' | 'doctorName' | 'assistantName', string>>>({});
  const [landingRole, setLandingRole] = useState<UserRole>('assistant');

  // View state
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [currentCaseForView, setCurrentCaseForView] = useState<PatientCase | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  // Prefill data for "New Claim for this Patient"
  const [patientInfoPrefill, setPatientInfoPrefill] = useState<Partial<PatientInfo> | undefined>(undefined);

  useEffect(() => {
    const init = async () => {
      await DataService.initialize();
      setIsInitialized(true);
    };
    init();
  }, []);

  const isPracticeReady = Boolean(practiceName.trim());

  const handleStartOnboarding = () => {
    setOnboardingPracticeName(practiceName);
    setOnboardingDoctorName(doctorName);
    setOnboardingAssistantName(assistantName);
    setCurrentView('onboarding');
  };

  const handleOpenAssistantWorkspace = () => {
    if (!isPracticeReady) {
      setCurrentView('onboarding');
      return;
    }
    setLandingRole('assistant');
    setUserRole('assistant');
    setCurrentView('assistant-home');
  };

  const handleOpenDoctorWorkspace = () => {
    if (!isPracticeReady) {
      setCurrentView('onboarding');
      return;
    }
    setLandingRole('doctor');
    setUserRole('doctor');
    setCurrentView('dashboard');
  };

  const handleSavePracticeInfo = (practice: { practiceName: string; doctorName: string; assistantName: string }) => {
    setPracticeName(practice.practiceName);
    setDoctorName(practice.doctorName);
    setAssistantName(practice.assistantName);
    setUserRole(null);
    setCurrentView('landing');
  };

  const handleOnboardingSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errors: typeof onboardingErrors = {};

    if (!onboardingPracticeName.trim()) {
      errors.practiceName = 'Practice name is required';
    }
    if (!onboardingDoctorName.trim()) {
      errors.doctorName = 'Doctor name is required';
    }
    if (!onboardingAssistantName.trim()) {
      errors.assistantName = 'Assistant name is required';
    }

    if (Object.keys(errors).length > 0) {
      setOnboardingErrors(errors);
      return;
    }

    setOnboardingErrors({});
    handleSavePracticeInfo({
      practiceName: onboardingPracticeName.trim(),
      doctorName: onboardingDoctorName.trim(),
      assistantName: onboardingAssistantName.trim(),
    });
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

  const handleBackToAssistantHome = () => {
    setCurrentView('assistant-home');
    setSelectedCaseId(null);
    setCurrentCaseForView(null);
  };

  const handleLogout = () => {
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
    setPatientName('');
    setPatientId('');
    setPatientEmail('');
    setPatientPhone('');
    setMedicalAidNumber('');
    setMatchedConditions([]);
    setCurrentView('patient-info');
  };

  const handlePatientInfoSubmit = (patientInfo: PatientInfo) => {
    setPatientName(patientInfo.patientName);
    setPatientId(patientInfo.patientId);
    setPatientEmail(patientInfo.patientEmail);
    setPatientPhone(patientInfo.patientPhone);
    setMedicalAidNumber(patientInfo.medicalAidNumber);
    store.setSelectedPlan(patientInfo.plan);

    const isAssistantIntake = userRole === 'assistant';

    if (patientInfo.claimType) {
      setCurrentClaimType(patientInfo.claimType);
    }

    const newCase: PatientCase = {
      id: Date.now().toString(),
      patientName: patientInfo.patientName,
      patientId: patientInfo.patientId,
      patientEmail: patientInfo.patientEmail,
      patientPhone: patientInfo.patientPhone,
      medicalAidNumber: patientInfo.medicalAidNumber,
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
    };

    store.addCase(newCase);
    setSelectedCaseId(newCase.id);
    setPatientInfoPrefill(undefined);

    if (isAssistantIntake) {
      setCurrentCaseForView(newCase);
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
    store.updateCase(caseId, { claimType, updatedAt: new Date() });
    setCurrentClaimType(claimType);
    if (currentCaseForView?.id === caseId) {
      setCurrentCaseForView({ ...currentCaseForView, claimType, updatedAt: new Date() });
    }
  };

  const handleViewCase = (caseId: string) => {
    const caseData = store.cases.find(c => c.id === caseId);
    if (caseData) {
      setSelectedCaseId(caseId);
      setCurrentCaseForView(caseData);
      setCurrentView('case-options');
    }
  };

  const handleViewPatientProfile = (patientId: string) => {
    setSelectedPatientId(patientId);
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
  const handleNewCaseActionForPatient = (pid: string, claimType: ClaimType) => {
    const patientCases = store.cases.filter((c) => c.patientId === pid);
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

    if (withCondition) {
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
      id: Date.now().toString(),
      patientName: latest.patientName,
      patientId: latest.patientId,
      patientEmail: latest.patientEmail,
      patientPhone: latest.patientPhone,
      medicalAidNumber: latest.medicalAidNumber,
      claimType,
      createdAt: new Date(),
      updatedAt: new Date(),
      clinicalNote: '',
      condition: withCondition?.condition || '',
      icdCode: withCondition?.icdCode || '',
      icdDescription: withCondition?.icdDescription || '',
      diagnosticTreatments: [],
      ongoingTreatments: [],
      medications: claimType === 'medication-report' ? [...latest.medications] : [],
      medicationNote: claimType === 'medication-report' ? (latest.medicationNote || '') : '',
      plan: latest.plan,
      status: 'new',
    };

    store.addCase(newCase);
    setSelectedCaseId(newCase.id);
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
        body: JSON.stringify({ clinical_note: store.clinicalNote }),
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
  };

  const handleNextStep = () => {
    // Validation
    if (store.currentStep === 1 && !store.selectedCondition) {
      alert('Please select a condition');
      return;
    }
    if (store.currentStep === 2 && !store.selectedIcdCode) {
      alert('Please select an ICD-10 code');
      return;
    }
    
    // Handle medication substeps
    if (store.currentStep === 4) {
      if (store.medicationSubstep === 1) {
        // Moving from medication selection to registration note
        if (store.medications.length === 0) {
          alert('Please select at least one medication before proceeding');
          return;
        }
        store.setMedicationSubstep(2);
        return;
      } else if (store.medicationSubstep === 2) {
        // Moving from registration note to final claim
        // Optional validation for registration note
        if (!store.medicationNote && !store.medications.some(m => m.note)) {
          const proceed = confirm('No registration note has been entered. Do you want to proceed without a note?');
          if (!proceed) return;
        }
        store.setCurrentStep(5);
        return;
      }
    }
    
    const nextStep = store.currentStep + 1;
    store.setCurrentStep(nextStep);
  };

  const handlePreviousStep = () => {
    // Handle medication substeps
    if (store.currentStep === 4 && store.medicationSubstep === 2) {
      store.setMedicationSubstep(1);
      return;
    }
    
    store.setCurrentStep(Math.max(0, store.currentStep - 1));
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
    };
  };

  const refreshCurrentCaseView = () => {
    const caseId = store.currentCaseId || selectedCaseId;
    if (!caseId) return;
    const updated = store.cases.find((c) => c.id === caseId);
    if (updated) {
      setCurrentCaseForView(updated);
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
      });

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

        setShowSaveModal(false);
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

        setShowSaveModal(false);
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

    setShowSaveModal(false);

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

  const steps = [
    { id: 0, title: 'Clinical Note' },
    { id: 1, title: 'Condition' },
    { id: 2, title: 'ICD Code' },
    { id: 3, title: 'Diagnostics' },
    { id: 4, title: 'Medication' },
    { id: 5, title: 'Final Claim' },
  ];

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

            {isPracticeReady && (
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
            )}

            <button
              onClick={handleStartOnboarding}
              className="authi-btn-primary rounded-xl px-4 py-2 text-xs"
            >
              Practice onboarding
            </button>
          </div>

          {/* Main welcome content */}
          <div className="authi-surface-card p-10">
            <div className="max-w-3xl">
              {isPracticeReady ? (
                <>
                  <p className="text-sm font-bold uppercase tracking-[0.3em] authi-gradient-text">Welcome back</p>
                  <h2 className="mt-4 text-4xl font-semibold text-slate-950">Choose how you want to work today</h2>
                  <p className="mt-6 text-lg leading-8 text-slate-600">
                    Switch between assistant and doctor roles for {practiceName}. Open the workspace for the role you need.
                  </p>

                  <div className="authi-tab-group mt-8">
                    <button
                      type="button"
                      onClick={() => setLandingRole('assistant')}
                      className={
                        landingRole === 'assistant' ? 'authi-tab-selected' : 'authi-tab-inactive'
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
                        landingRole === 'doctor' ? 'authi-tab-selected' : 'authi-tab-inactive'
                      }
                    >
                      <span className={landingRole === 'doctor' ? 'authi-gradient-text font-bold' : ''}>
                        Doctor{doctorName ? ` · ${doctorName}` : ''}
                      </span>
                    </button>
                  </div>

                  {landingRole === 'assistant' ? (
                    <div className="authi-panel-card mt-8 authi-tint">
                      <p className="text-sm uppercase tracking-[0.24em] authi-gradient-text font-bold">Assistant role</p>
                      <h3 className="mt-3 text-xl font-semibold text-slate-900">Patient intake and records</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Create new patient cases and browse saved records. Download claim PDFs or ZIP exports once the doctor has finalized a case.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenAssistantWorkspace}
                        className="authi-btn-primary mt-6 rounded-2xl px-5 py-3 text-sm"
                      >
                        Open assistant workspace
                      </button>
                    </div>
                  ) : (
                    <div className="authi-panel-card mt-8 authi-tint">
                      <p className="text-sm uppercase tracking-[0.24em] authi-gradient-text font-bold">Doctor role</p>
                      <h3 className="mt-3 text-xl font-semibold text-slate-900">Claim workflow and sign-off</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Review cases, select conditions, match ICD codes, and finalize claims for your patients.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenDoctorWorkspace}
                        className="authi-btn-primary mt-6 rounded-2xl px-5 py-3 text-sm"
                      >
                        Open doctor workspace
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-bold uppercase tracking-[0.3em] authi-gradient-text">Welcome</p>
                  <h2 className="mt-4 text-4xl font-semibold text-slate-950">Your practice onboarding and claim workflow, built for teams.</h2>
                  <p className="mt-6 text-lg leading-8 text-slate-600">
                    Begin by registering your practice. Once onboarding is complete, you can switch between assistant and doctor roles from this page.
                  </p>

                  <div className="mt-10 grid gap-6 sm:grid-cols-2">
                    <div className="authi-panel-card">
                      <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Start here</p>
                      <h3 className="mt-3 text-xl font-semibold text-slate-900">Assistant intake</h3>
                      <p className="mt-2 text-sm text-slate-600">Create patient records, add medical history, and begin new cases.</p>
                    </div>
                    <div className="authi-panel-card">
                      <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Next</p>
                      <h3 className="mt-3 text-xl font-semibold text-slate-900">Doctor workflow</h3>
                      <p className="mt-2 text-sm text-slate-600">Review cases, select conditions, match ICD codes, and finalize claims.</p>
                    </div>
                  </div>

                  <div className="mt-10">
                    <button
                      onClick={handleStartOnboarding}
                      className="authi-btn-primary rounded-2xl px-6 py-3 text-sm"
                    >
                      Get started — set up your practice
                    </button>
                  </div>
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
      <div className="min-h-screen bg-white py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between gap-4 mb-8 authi-surface-card px-6 py-5 rounded-2xl">
            <div>
              <p className="text-sm tracking-wide authi-gradient-text font-semibold">
                {assistantName || 'Assistant'}
              </p>
              <h1 className="mt-3 text-4xl font-semibold text-slate-900">Assistant workspace</h1>
              <p className="mt-3 text-sm text-slate-500">
                Choose how you want to work with patient records.
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="authi-btn-secondary px-4 py-3 text-sm shrink-0"
            >
              Back to home
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <button
              type="button"
              onClick={handleAssistantNewCase}
              className="authi-choice-card group"
            >
              <p className="text-sm uppercase tracking-[0.3em] authi-gradient-text font-semibold group-hover:opacity-90">
                New patient case
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-900">Create a new patient intake</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Add patient details and start a case. The doctor completes the clinical workflow and finalizes the claim.
              </p>
            </button>

            <button
              type="button"
              onClick={handleAssistantViewRecords}
              className="authi-choice-card group"
            >
              <p className="text-sm uppercase tracking-[0.3em] authi-gradient-text font-semibold group-hover:opacity-90">
                Patient records
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-900">View and download cases</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Browse existing cases. Export claim PDFs or download documents with attachments (ZIP) when ready.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'onboarding') {
    return (
      <div className="min-h-screen bg-white py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-between gap-4 mb-8 authi-surface-card px-6 py-5 rounded-2xl">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] authi-gradient-text font-semibold">Practice onboarding</p>
              <h1 className="mt-3 text-4xl font-semibold text-slate-900">Set up your clinic and team</h1>
              <p className="mt-2 text-slate-500">Enter practice details once, then let your assistant and doctor use the system from the same workflow.</p>
            </div>
            <button
              onClick={handleLogout}
              className="authi-btn-secondary px-4 py-3 text-sm shrink-0"
            >
              Back to home
            </button>
          </div>

          <form onSubmit={handleOnboardingSubmit} className="authi-surface-card rounded-[32px] p-8">
            <div className="grid gap-6">
              <div>
                <label className="text-sm font-medium text-slate-700">Practice name</label>
                <input
                  value={onboardingPracticeName}
                  onChange={(e) => setOnboardingPracticeName(e.target.value)}
                  className={`authi-input mt-2 px-4 py-3 ${onboardingErrors.practiceName ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : ''}`}
                  placeholder="Enter your practice name"
                />
                {onboardingErrors.practiceName && <p className="mt-2 text-sm text-rose-500">{onboardingErrors.practiceName}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Doctor name</label>
                <input
                  value={onboardingDoctorName}
                  onChange={(e) => setOnboardingDoctorName(e.target.value)}
                  className={`authi-input mt-2 px-4 py-3 ${onboardingErrors.doctorName ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : ''}`}
                  placeholder="Enter doctor name"
                />
                {onboardingErrors.doctorName && <p className="mt-2 text-sm text-rose-500">{onboardingErrors.doctorName}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Assistant name</label>
                <input
                  value={onboardingAssistantName}
                  onChange={(e) => setOnboardingAssistantName(e.target.value)}
                  className={`authi-input mt-2 px-4 py-3 ${onboardingErrors.assistantName ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : ''}`}
                  placeholder="e.g. Sarah"
                />
                {onboardingErrors.assistantName && <p className="mt-2 text-sm text-rose-500">{onboardingErrors.assistantName}</p>}
              </div>

              <button
                type="submit"
                className="authi-btn-primary mt-4 w-full rounded-2xl px-6 py-3 text-sm"
              >
                Save practice details
              </button>
            </div>
          </form>
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
        canCreateCase={userRole === 'doctor' || userRole === 'assistant'}
        practiceName={practiceName}
        doctorName={doctorName}
        assistantName={assistantName}
        userRole={userRole}
        onLogout={userRole === 'assistant' ? handleBackToAssistantHome : handleLogout}
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
  if (currentView === 'patient-profile' && selectedPatientId) {
    const patientCases = store.cases.filter((c) => c.patientId === selectedPatientId);
    return (
      <PatientProfile
        patientId={selectedPatientId}
        cases={patientCases}
        onViewClaim={handleViewCase}
        onNewCaseAction={handleNewCaseActionForPatient}
        onBack={handleBackToDashboard}
        userRole={userRole}
      />
    );
  }

  // Case options view
  if (currentView === 'case-options' && currentCaseForView) {
    const cameFromProfile = selectedPatientId !== null;
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

    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
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
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentClaimType === 'diagnostic' && (
          <>
            {/* Progress Steps */}
            <div className="mb-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                {steps.map((step, index) => (
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
                        {step.id === 4 && store.currentStep === 4 && (
                          <span className="block text-xs text-blue-500 mt-0.5">
                            {store.medicationSubstep === 1 ? '(Selection)' : '(Registration Note)'}
                          </span>
                        )}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
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
              )}

              {store.currentStep === 4 && store.selectedCondition && (
                <>
                  {store.medicationSubstep === 1 && (
                    <MedicationSelection
                      condition={store.selectedCondition}
                      selectedPlan={store.selectedPlan}
                      medications={store.medications}
                      onAddMedication={store.addMedication}
                      onRemoveMedication={store.removeMedication}
                      onSetPlan={store.setSelectedPlan}
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

              {store.currentStep === 5 && (
                <FinalClaimSummary
                  clinicalNote={store.clinicalNote}
                  selectedCondition={store.selectedCondition!}
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
                  onConfirm={() => setShowSaveModal(true)}
                  onBack={handlePreviousStep}
                  confirmLabel="Confirm and Save Claim"
                />
              )}

              {/* Navigation Buttons */}
              {store.currentStep > 0 && store.currentStep < 5 && (
                <div className="flex justify-between">
                  <button
                    onClick={handlePreviousStep}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    {store.currentStep === 4 && store.medicationSubstep === 2 ? 'Back to Medications' : 'Previous'}
                  </button>
                  <button
                    onClick={handleNextStep}
                    className="btn-primary flex items-center gap-2"
                  >
                    {store.currentStep === 4 && store.medicationSubstep === 1
                      ? 'Continue to Registration Note'
                      : store.currentStep === 4 && store.medicationSubstep === 2
                      ? 'Continue to Final Claim'
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
            treatments={store.ongoingTreatments}
            onAddTreatment={store.addOngoingTreatment}
            onUpdateTreatment={store.updateOngoingTreatment}
            onRemoveTreatment={(index) => {
              const newTreatments = store.ongoingTreatments.filter((_, i) => i !== index);
              useStore.setState({ ongoingTreatments: newTreatments });
            }}
            onExportSingleTreatment={handleExportSingleTreatment}
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

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2">{userRole === 'doctor' ? 'Confirm Claim' : 'Finalize Patient Case'}</h3>
            <p className="text-sm text-gray-600 mb-6">
              {userRole === 'doctor'
                ? 'Save or export the claim without re-entering the patient information.'
                : 'Enter patient details to save the case. You can choose to save only or export documents.'}
            </p>
            {userRole !== 'doctor' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-colors"
                    placeholder="Enter patient name"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient ID / Medical Record Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-colors"
                    placeholder="Enter patient ID or MRN"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient Email (Optional)
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-colors"
                    placeholder="patient@example.com"
                    value={patientEmail}
                    onChange={(e) => setPatientEmail(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-colors"
                    placeholder="+27 XX XXX XXXX"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">Save Options:</p>
              <div className="space-y-2">
                <button
                  onClick={handleSaveCaseOnly}
                  disabled={isSaving}
                  className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-5 h-5" />
                  {isSaving
                    ? 'Saving...'
                    : userRole === 'doctor'
                    ? 'Confirm and Save Claim'
                    : 'Save Patient Case'}
                </button>
                <p className="text-xs text-gray-500 text-center mb-3">or export documents</p>
                <button
                  onClick={() => handleSaveCase(false)}
                  disabled={isSaving}
                  className="w-full py-2.5 px-4 bg-primary-400 text-brand-black font-medium rounded-lg hover:bg-primary-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export as PDF
                </button>
                <button
                  onClick={() => handleSaveCase(true)}
                  disabled={isSaving}
                  className="w-full py-2.5 px-4 bg-accent-600 text-white font-medium rounded-lg hover:bg-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export with Attachments (ZIP)
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowSaveModal(false)}
              disabled={isSaving}
              className="w-full mt-4 py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
      <AppSidebar currentView={currentView} onNavigate={setCurrentView} userRole={userRole} />
      <div className="flex-1 ml-60 min-w-0 overflow-y-auto">
        {renderView()}
      </div>
    </div>
  );
}

