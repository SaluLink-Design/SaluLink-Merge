'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useStore } from '@/lib/store';
import { DataService } from '@/lib/dataService';
import { PDFExportService } from '@/lib/pdfExport';
import { saveCaseToDatabase } from '@/lib/caseService';
import { Menu, FileDown, Save, CheckCircle, ArrowLeft, ArrowRight, ChevronRight } from 'lucide-react';

// Components
import ClinicalNoteInput from '@/components/ClinicalNoteInput';
import ConditionSelection from '@/components/ConditionSelection';
import IcdCodeSelection from '@/components/IcdCodeSelection';
import DiagnosticBasket from '@/components/DiagnosticBasket';
import MedicationSelection from '@/components/MedicationSelection';
import ChronicRegistrationNote from '@/components/ChronicRegistrationNote';
import Sidebar from '@/components/Sidebar';
import AllCasesView from '@/components/AllCasesView';
import CaseActions from '@/components/CaseActions';
import OngoingManagement from '@/components/OngoingManagement';
import MedicationReport from '@/components/MedicationReport';
import Referral from '@/components/Referral';
import FinalClaimSummary from '@/components/FinalClaimSummary';
import PatientExportModal from '@/components/PatientExportModal';
import Dashboard from '@/components/Dashboard';
import PatientInfoForm, { PatientInfo } from '@/components/PatientInfoForm';
import CaseOptionsView from '@/components/CaseOptionsView';
import { MatchedCondition, PatientCase } from '@/types';
import type { PatientExportData } from '@/lib/patientExport';

type WorkflowMode = 'new' | 'ongoing' | 'medication' | 'referral';
type UserRole = 'assistant' | 'doctor';

type AppView = 'landing' | 'onboarding' | 'assistant-home' | 'dashboard' | 'patient-info' | 'case-options' | 'workflow';

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
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowMode>('new');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [medicalAidNumber, setMedicalAidNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showCaseActions, setShowCaseActions] = useState(false);
  const [showAllCases, setShowAllCases] = useState(false);
  const [showPatientExport, setShowPatientExport] = useState(false);
  
  const [practiceName, setPracticeName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [assistantName, setAssistantName] = useState('');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [onboardingPracticeName, setOnboardingPracticeName] = useState('');
  const [onboardingDoctorName, setOnboardingDoctorName] = useState('');
  const [onboardingAssistantName, setOnboardingAssistantName] = useState('');
  const [onboardingErrors, setOnboardingErrors] = useState<Partial<Record<'practiceName' | 'doctorName' | 'assistantName', string>>>({});

  // New dashboard workflow states
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [currentCaseForView, setCurrentCaseForView] = useState<PatientCase | null>(null);

  useEffect(() => {
    const init = async () => {
      await DataService.initialize();
      setIsInitialized(true);
    };
    init();
  }, []);

  const handleStartOnboarding = () => {
    setCurrentView('onboarding');
  };

  const handleSavePracticeInfo = (practice: { practiceName: string; doctorName: string; assistantName: string }) => {
    setPracticeName(practice.practiceName);
    setDoctorName(practice.doctorName);
    setAssistantName(practice.assistantName);
    // After saving practice details, remain on the onboarding page so
    // the user can explicitly choose Assistant or Doctor roles later.
    setUserRole(null);
    setCurrentView('onboarding');
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

  const handleLoginAsAssistant = () => {
    if (!practiceName) {
      setCurrentView('onboarding');
      return;
    }
    setUserRole('assistant');
    setCurrentView('assistant-home');
  };

  const handleAssistantNewCase = () => {
    setCurrentView('patient-info');
  };

  const handleAssistantViewRecords = () => {
    setCurrentView('dashboard');
  };

  const handleLoginAsDoctor = () => {
    if (!practiceName) {
      setCurrentView('onboarding');
      return;
    }
    setUserRole('doctor');
    setCurrentView('dashboard');
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
    // Save patient info to state
    setPatientName(patientInfo.patientName);
    setPatientId(patientInfo.patientId);
    setPatientEmail(patientInfo.patientEmail);
    setPatientPhone(patientInfo.patientPhone);
    setMedicalAidNumber(patientInfo.medicalAidNumber);
    store.setSelectedPlan(patientInfo.plan);

    // Create a new case with status "new"
    const newCase: PatientCase = {
      id: Date.now().toString(),
      patientName: patientInfo.patientName,
      patientId: patientInfo.patientId,
      patientEmail: patientInfo.patientEmail,
      patientPhone: patientInfo.patientPhone,
      medicalAidNumber: patientInfo.medicalAidNumber,
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

    // Add to store through a proper action so the dashboard updates correctly
    store.addCase(newCase);
    setSelectedCaseId(newCase.id);

    // Return to dashboard to show the newly created case
    setCurrentView('dashboard');
  };

  const handleViewCase = (caseId: string) => {
    const caseData = store.cases.find(c => c.id === caseId);
    if (caseData) {
      setSelectedCaseId(caseId);
      setCurrentCaseForView(caseData);
      setCurrentView('case-options');
    }
  };

  const handleStartClinicalNote = () => {
    if (selectedCaseId && currentCaseForView) {
      // Load the case into the workflow
      setPatientName(currentCaseForView.patientName);
      setPatientId(currentCaseForView.patientId);
      setPatientEmail(currentCaseForView.patientEmail || '');
      setPatientPhone(currentCaseForView.patientPhone || '');
      setMedicalAidNumber(currentCaseForView.medicalAidNumber || '');
      
      store.loadCase(selectedCaseId);
      store.setCurrentStep(0);
      setCurrentWorkflow('new');
      setCurrentView('workflow');
    }
  };

  const handleContinueWorkflow = () => {
    if (selectedCaseId && currentCaseForView) {
      // Load the case and continue from where it left off
      setPatientName(currentCaseForView.patientName);
      setPatientId(currentCaseForView.patientId);
      setPatientEmail(currentCaseForView.patientEmail || '');
      setPatientPhone(currentCaseForView.patientPhone || '');
      setMedicalAidNumber(currentCaseForView.medicalAidNumber || '');
      
      store.loadCase(selectedCaseId);
      
      // Determine which step to continue from
      let startStep = 0;
      if (currentCaseForView.clinicalNote) startStep = 1;
      if (currentCaseForView.condition) startStep = 2;
      if (currentCaseForView.diagnosticTreatments.length > 0) startStep = 3;
      if (currentCaseForView.medications.length > 0) startStep = 4;
      if (currentCaseForView.medicationNote) startStep = 5;
      
      store.setCurrentStep(startStep);
      setCurrentWorkflow('new');
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
    if (!store.selectedCondition || !store.selectedIcdCode) {
      alert('Please complete the workflow first');
      return;
    }

    const pdfService = new PDFExportService();
    const patientCase = {
      id: Date.now().toString(),
      patientName: patientName || 'Patient',
      patientId: patientId || 'N/A',
      createdAt: new Date(),
      updatedAt: new Date(),
      clinicalNote: store.clinicalNote,
      condition: store.selectedCondition,
      icdCode: store.selectedIcdCode,
      icdDescription: store.selectedIcdDescription || '',
      diagnosticTreatments: store.diagnosticTreatments,
      ongoingTreatments: store.ongoingTreatments,
      medications: store.medications,
      medicationNote: store.medicationNote,
      plan: store.selectedPlan,
      status: 'diagnostic' as const,
    };

    pdfService.exportInitialClaim(patientCase);
  };

  const getPatientInfoForSave = () => {
    const selectedCase = selectedCaseId
      ? store.cases.find((c) => c.id === selectedCaseId)
      : null;

    return {
      patientName: patientName || selectedCase?.patientName || '',
      patientId: patientId || selectedCase?.patientId || '',
      patientEmail: patientEmail || selectedCase?.patientEmail || '',
      patientPhone: patientPhone || selectedCase?.patientPhone || '',
      medicalAidNumber: medicalAidNumber || selectedCase?.medicalAidNumber || '',
    };
  };

  const handleExportWithAttachments = async () => {
    if (!store.selectedCondition || !store.selectedIcdCode) {
      alert('Please complete the workflow first');
      return;
    }

    const patientData = getPatientInfoForSave();
    const pdfService = new PDFExportService();
    const patientCase = {
      id: Date.now().toString(),
      patientName: patientData.patientName || 'Patient',
      patientId: patientData.patientId || 'N/A',
      createdAt: new Date(),
      updatedAt: new Date(),
      clinicalNote: store.clinicalNote,
      condition: store.selectedCondition,
      icdCode: store.selectedIcdCode,
      icdDescription: store.selectedIcdDescription || '',
      diagnosticTreatments: store.diagnosticTreatments,
      ongoingTreatments: store.ongoingTreatments,
      medications: store.medications,
      medicationNote: store.medicationNote,
      plan: store.selectedPlan,
      status: 'diagnostic' as const,
    };

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

      if (!result.success) {
        // Remote save failed (network or server). Fall back to local save so user doesn't lose work.
        if (selectedCaseId) {
          store.updateCase(selectedCaseId, {
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
            status: 'completed',
            updatedAt: new Date(),
          });
        } else {
          store.saveCase(patientName, patientId);
          if (store.currentCaseId) {
            setSelectedCaseId(store.currentCaseId);
            store.updateCase(store.currentCaseId, {
              status: 'completed',
            });
          }
        }

        setShowSaveModal(false);
        setShowCaseActions(true);
        alert(`Saved locally. Remote save failed: ${result.error || 'Unknown error'}`);
      } else {
        // Remote save succeeded. Update or create local case accordingly.
        if (selectedCaseId) {
          store.updateCase(selectedCaseId, {
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
            status: 'completed',
            updatedAt: new Date(),
          });
        } else {
          store.saveCase(patientName, patientId);
          if (store.currentCaseId) {
            setSelectedCaseId(store.currentCaseId);
            store.updateCase(store.currentCaseId, {
              status: 'completed',
            });
          }
        }

        setShowSaveModal(false);
        setShowCaseActions(true);
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
        status: store.ongoingTreatments.length > 0
          ? 'ongoing'
          : store.diagnosticTreatments.length > 0
          ? 'diagnostic'
          : 'draft',
        updatedAt: new Date(),
      });
    } else {
      store.saveCase(patientData.patientName, patientData.patientId);
      if (store.currentCaseId) {
        setSelectedCaseId(store.currentCaseId);
      }
    }

    setShowSaveModal(false);
    setShowCaseActions(true);

    if (includeAttachments) {
      await handleExportWithAttachments();
    } else {
      handleExportPDF();
    }
    alert('Case saved and exported successfully!');
  };

  const handleLoadCase = (caseId: string) => {
    store.loadCase(caseId);
    setCurrentWorkflow('new');
    setShowCaseActions(true);
    const loadedCase = store.cases.find(c => c.id === caseId);
    if (loadedCase) {
      setPatientName(loadedCase.patientName);
      setPatientId(loadedCase.patientId);
      store.setCurrentStep(5);
    }
  };

  const handleOngoingManagementSaveOnly = () => {
    if (store.currentCaseId) {
      store.updateCase(store.currentCaseId, {
        ongoingTreatments: store.ongoingTreatments,
        status: 'ongoing',
      });
    }
    alert('Ongoing management treatments saved successfully!');
    setCurrentWorkflow('new');
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
      const currentCase = store.cases.find(c => c.id === store.currentCaseId);
      if (currentCase) {
        const updatedCase = {
          ...currentCase,
          ongoingTreatments: store.ongoingTreatments,
          status: 'ongoing' as const,
          updatedAt: new Date(),
        };

        store.updateCase(store.currentCaseId, {
          ongoingTreatments: store.ongoingTreatments,
          status: 'ongoing',
        });

        const pdfService = new PDFExportService();
        pdfService.exportOngoingManagement(updatedCase);
      }
    }
    alert('Ongoing management saved and PDF exported!');
    setCurrentWorkflow('new');
  };

  const handleOngoingManagementSaveWithAttachments = async () => {
    if (store.currentCaseId) {
      const currentCase = store.cases.find(c => c.id === store.currentCaseId);
      if (currentCase) {
        const updatedCase = {
          ...currentCase,
          ongoingTreatments: store.ongoingTreatments,
          status: 'ongoing' as const,
          updatedAt: new Date(),
        };

        store.updateCase(store.currentCaseId, {
          ongoingTreatments: store.ongoingTreatments,
          status: 'ongoing',
        });

        const pdfService = new PDFExportService();
        await pdfService.exportOngoingManagementWithAttachments(updatedCase);
      }
    }
    alert('Ongoing management saved and exported with attachments!');
    setCurrentWorkflow('new');
  };

  const handleMedicationReportSavePdfOnly = (followUpNotes: string, newMeds?: any[], motivationLetter?: string, documentation?: { notes: string; images: string[] }) => {
    if (store.currentCaseId) {
      const currentCase = store.cases.find(c => c.id === store.currentCaseId);
      if (currentCase) {
        const combinedMedications = newMeds && newMeds.length > 0
          ? deduplicateMedications([...currentCase.medications, ...newMeds])
          : currentCase.medications;

        const newMedicationReport = {
          id: Date.now().toString(),
          caseId: store.currentCaseId,
          originalMedications: currentCase.medications,
          followUpNotes,
          newMedications: newMeds || [],
          motivationLetter: motivationLetter || '',
          documentation,
          createdAt: new Date(),
        };

        const updatedCase = {
          ...currentCase,
          medicationReports: [...(currentCase.medicationReports || []), newMedicationReport],
          medications: combinedMedications,
          updatedAt: new Date(),
        };

        store.addMedicationReport(store.currentCaseId, {
          caseId: store.currentCaseId,
          originalMedications: currentCase.medications,
          followUpNotes,
          newMedications: newMeds || [],
          motivationLetter: motivationLetter || '',
          documentation,
        });

        if (newMeds && newMeds.length > 0) {
          store.updateCase(store.currentCaseId, {
            medications: combinedMedications,
          });
        }

        const pdfService = new PDFExportService();
        pdfService.exportMedicationReport(updatedCase, followUpNotes, newMeds, motivationLetter);
      }
    }
    alert('Medication report saved and PDF exported!');
    setCurrentWorkflow('new');
  };

  const handleMedicationReportSaveWithAttachments = async (followUpNotes: string, newMeds?: any[], motivationLetter?: string, documentation?: { notes: string; images: string [] }) => {
    if (store.currentCaseId) {
      const currentCase = store.cases.find(c => c.id === store.currentCaseId);
      if (currentCase) {
        const combinedMedications = newMeds && newMeds.length > 0
          ? deduplicateMedications([...currentCase.medications, ...newMeds])
          : currentCase.medications;

        const newMedicationReport = {
          id: Date.now().toString(),
          caseId: store.currentCaseId,
          originalMedications: currentCase.medications,
          followUpNotes,
          newMedications: newMeds || [],
          motivationLetter: motivationLetter || '',
          documentation,
          createdAt: new Date(),
        };

        const updatedCase = {
          ...currentCase,
          medicationReports: [...(currentCase.medicationReports || []), newMedicationReport],
          medications: combinedMedications,
          updatedAt: new Date(),
        };

        store.addMedicationReport(store.currentCaseId, {
          caseId: store.currentCaseId,
          originalMedications: currentCase.medications,
          followUpNotes,
          newMedications: newMeds || [],
          motivationLetter: motivationLetter || '',
          documentation,
        });

        if (newMeds && newMeds.length > 0) {
          store.updateCase(store.currentCaseId, {
            medications: combinedMedications,
          });
        }

        const pdfService = new PDFExportService();
        await pdfService.exportMedicationReportWithAttachments(updatedCase, followUpNotes, newMeds, motivationLetter, documentation);
      }
    }
    alert('Medication report saved and exported with attachments!');
    setCurrentWorkflow('new');
  };

  const handleReferralSavePdfOnly = (urgency: 'routine' | 'urgent' | 'emergency', referralNote: string, specialistType: string) => {
    if (store.currentCaseId) {
      const currentCase = store.cases.find(c => c.id === store.currentCaseId);
      if (currentCase) {
        const newReferral = {
          id: Date.now().toString(),
          caseId: store.currentCaseId,
          urgency,
          referralNote,
          specialistType,
          createdAt: new Date(),
        };

        const updatedCase = {
          ...currentCase,
          referrals: [...(currentCase.referrals || []), newReferral],
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
    setCurrentWorkflow('new');
  };

  const handleReferralSaveWithAttachments = async (urgency: 'routine' | 'urgent' | 'emergency', referralNote: string, specialistType: string) => {
    if (store.currentCaseId) {
      const currentCase = store.cases.find(c => c.id === store.currentCaseId);
      if (currentCase) {
        const newReferral = {
          id: Date.now().toString(),
          caseId: store.currentCaseId,
          urgency,
          referralNote,
          specialistType,
          createdAt: new Date(),
        };

        const updatedCase = {
          ...currentCase,
          referrals: [...(currentCase.referrals || []), newReferral],
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
    setCurrentWorkflow('new');
  };

  const handleNewClaim = () => {
    store.resetWorkflow();
    setPatientName('');
    setPatientId('');
    setMatchedConditions([]);
    setCurrentWorkflow('new');
    setShowCaseActions(false);
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

  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid lg:grid-cols-[280px_1fr] gap-8">
            <aside className="rounded-[32px] bg-slate-900 border border-white/10 p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-12 h-12 rounded-3xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xl font-bold">S</div>
                <div>
                  <p className="text-sm text-slate-400 uppercase tracking-[0.3em]">SaluLink</p>
                  <h1 className="text-2xl font-semibold">Chronic Treatment App</h1>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-3xl bg-slate-800 p-5 border border-white/10">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Practice</p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {practiceName || 'Dr. Johnson’s practice'}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Set up your clinic, invite your assistant, and start patient intake.
                  </p>
                </div>

                <div className="rounded-3xl bg-slate-800 p-5 border border-white/10">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Roles</p>
                  <div className="mt-4 space-y-3">
                    <button
                      onClick={handleLoginAsAssistant}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-left text-sm font-semibold text-white hover:border-blue-400 transition"
                    >
                      Assistant login
                      <span className="block text-xs text-slate-500 mt-1">Choose between creating a new patient case or viewing existing records.</span>
                    </button>
                    <button
                      onClick={handleLoginAsDoctor}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-left text-sm font-semibold text-white hover:border-violet-400 transition"
                    >
                      Doctor login
                      <span className="block text-xs text-slate-500 mt-1">Review cases, complete claim workflow, and sign off.</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleStartOnboarding}
                  className="w-full rounded-2xl bg-primary-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-primary-500 transition"
                >
                  Practice onboarding
                </button>
              </div>
            </aside>

            <main className="rounded-[32px] bg-white p-10 shadow-2xl">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-600">Welcome</p>
                <h2 className="mt-4 text-4xl font-semibold text-slate-950">Your practice onboarding and claim workflow, built for teams.</h2>
                <p className="mt-6 text-lg leading-8 text-slate-600">
                  Begin by registering your practice. The assistant can capture patient intake first, then the doctor can return to complete the claim workflow and save the case.
                </p>

                <div className="mt-10 grid gap-6 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 p-6">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Start here</p>
                    <h3 className="mt-3 text-xl font-semibold text-slate-900">Assistant intake</h3>
                    <p className="mt-2 text-sm text-slate-600">Create patient records, add medical history, and begin new cases.</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 p-6">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Next</p>
                    <h3 className="mt-3 text-xl font-semibold text-slate-900">Doctor workflow</h3>
                    <p className="mt-2 text-sm text-slate-600">Review cases, select conditions, match ICD codes, and finalize claims.</p>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'assistant-home') {
    return (
      <div className="min-h-screen bg-slate-950 text-white py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Assistant dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold text-white">Assistant workspace</h1>
              <p className="mt-3 text-sm text-slate-400">
                {assistantName ? `${assistantName}` : 'Assistant'} — choose how you want to work with patient records.
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:border-white/20 transition"
            >
              Back to home
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <button
              onClick={handleAssistantNewCase}
              className="rounded-[28px] border border-white/10 bg-slate-900 p-10 text-left transition hover:border-blue-400"
            >
              <p className="text-sm uppercase tracking-[0.3em] text-indigo-400">New patient case</p>
              <h2 className="mt-4 text-3xl font-semibold text-white">Create a new patient intake</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Add a new patient record, capture clinical history, and start a case for the doctor to finalize.
              </p>
            </button>

            <button
              onClick={handleAssistantViewRecords}
              className="rounded-[28px] border border-white/10 bg-slate-900 p-10 text-left transition hover:border-violet-400"
            >
              <p className="text-sm uppercase tracking-[0.3em] text-violet-400">View patient records</p>
              <h2 className="mt-4 text-3xl font-semibold text-white">Browse existing cases</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Review previously created patient cases and download PDFs for existing records.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'onboarding') {
    return (
      <div className="min-h-screen bg-slate-950 text-white py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Practice onboarding</p>
              <h1 className="mt-3 text-4xl font-semibold text-white">Set up your clinic and team</h1>
              <p className="mt-2 text-slate-400">Enter practice details once, then let your assistant and doctor use the system from the same workflow.</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:border-white/20 transition"
            >
              Back to home
            </button>
          </div>

          <form onSubmit={handleOnboardingSubmit} className="rounded-[32px] bg-slate-900 border border-white/10 p-8 shadow-2xl">
            <div className="grid gap-6">
              <div>
                <label className="text-sm font-medium text-slate-200">Practice name</label>
                <input
                  value={onboardingPracticeName}
                  onChange={(e) => setOnboardingPracticeName(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-primary-400 focus:outline-none"
                  placeholder="e.g. Dr. Johnson’s Practice"
                />
                {onboardingErrors.practiceName && <p className="mt-2 text-sm text-rose-400">{onboardingErrors.practiceName}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-200">Doctor name</label>
                <input
                  value={onboardingDoctorName}
                  onChange={(e) => setOnboardingDoctorName(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-primary-400 focus:outline-none"
                  placeholder="e.g. Dr. Johnson"
                />
                {onboardingErrors.doctorName && <p className="mt-2 text-sm text-rose-400">{onboardingErrors.doctorName}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-200">Assistant name</label>
                <input
                  value={onboardingAssistantName}
                  onChange={(e) => setOnboardingAssistantName(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-primary-400 focus:outline-none"
                  placeholder="e.g. Sarah"
                />
                {onboardingErrors.assistantName && <p className="mt-2 text-sm text-rose-400">{onboardingErrors.assistantName}</p>}
              </div>

              <button
                type="submit"
                className="mt-4 rounded-2xl bg-primary-400 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-primary-500 transition"
              >
                Save practice details
              </button>
            </div>
          </form>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleLoginAsAssistant}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:border-blue-400 transition"
            >
              Assistant login
            </button>

            <button
              onClick={handleLoginAsDoctor}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:border-violet-400 transition"
            >
              Doctor login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard view
  if (currentView === 'dashboard') {
    return (
      <div>
        <Dashboard
          cases={store.cases}
          onNewCase={handleNewCaseClick}
          onViewCase={handleViewCase}
          practiceName={practiceName}
          userRole={userRole}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  // Patient info form view
  if (currentView === 'patient-info') {
    return (
      <PatientInfoForm
        onSave={handlePatientInfoSubmit}
        onCancel={handleBackToDashboard}
      />
    );
  }

  // Case options view
  if (currentView === 'case-options' && currentCaseForView) {
    return (
      <CaseOptionsView
        caseData={currentCaseForView}
        onStartClinicalNote={handleStartClinicalNote}
        onContinueWorkflow={handleContinueWorkflow}
        onClose={handleBackToDashboard}
      />
    );
  }

  // Workflow view (original workflow)
  if (currentView === 'workflow') {
    return (
      <div className="min-h-screen bg-primary-50">
        {showAllCases && (
          <AllCasesView
            cases={store.cases}
            onLoadCase={handleLoadCase}
            onDeleteCase={store.deleteCase}
            onClose={() => setShowAllCases(false)}
          />
        )}

        {/* Header */}
        <header className="bg-white border-b border-primary-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-20">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBackToDashboard}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                  <p className="text-xl font-bold text-gray-800 tracking-tight">Clinical Workflow</p>
                  <p className="text-sm text-gray-600">{patientName} ({patientId})</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={store.toggleSidebar}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <Sidebar
          isOpen={store.sidebarOpen}
          onClose={store.toggleSidebar}
          cases={store.cases}
          onLoadCase={handleLoadCase}
          onDeleteCase={store.deleteCase}
          onViewAll={() => setShowAllCases(true)}
        />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentWorkflow === 'new' && (
          <>
            {/* Progress Steps */}
            <div className="mb-8 bg-white rounded-xl shadow-sm border border-primary-200 p-6">
              <div className="flex items-center justify-between">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center w-full">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                          store.currentStep > step.id
                            ? 'bg-accent-600 text-white'
                            : store.currentStep === step.id
                            ? 'bg-primary-400 text-brand-black'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {store.currentStep > step.id ? (
                          <CheckCircle className="w-6 h-6" />
                        ) : (
                          step.id + 1
                        )}
                      </div>
                      <span className={`mt-2 text-sm font-medium text-center ${
                        store.currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'
                      }`}>
                        {step.title}
                        {step.id === 4 && store.currentStep === 4 && (
                          <span className="block text-xs text-primary-500 mt-0.5">
                            {store.medicationSubstep === 1 ? '(Selection)' : '(Registration Note)'}
                          </span>
                        )}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className="relative flex-1 mx-4 flex items-center">
                        <div
                          className={`h-1 w-full ${
                            store.currentStep > step.id ? 'bg-accent-500' : 'bg-gray-200'
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
                <>
                  <FinalClaimSummary
                    clinicalNote={store.clinicalNote}
                    selectedCondition={store.selectedCondition!}
                    selectedIcdCode={store.selectedIcdCode!}
                    selectedIcdDescription={store.selectedIcdDescription!}
                    diagnosticTreatments={store.diagnosticTreatments}
                    ongoingTreatments={store.ongoingTreatments}
                    medications={store.medications}
                    medicationNote={store.medicationNote}
                    selectedPlan={store.selectedPlan}
                    onConfirm={() => setShowSaveModal(true)}
                    onBack={handlePreviousStep}
                    onNewClaim={handleNewClaim}
                    confirmLabel={userRole === 'doctor' ? 'Confirm Claim' : 'Confirm and Finalize Claim'}
                  />

                  {showCaseActions && store.currentCaseId && (
                    <CaseActions
                      onOngoingManagement={() => setCurrentWorkflow('ongoing')}
                      onMedicationReport={() => setCurrentWorkflow('medication')}
                      onReferral={() => setCurrentWorkflow('referral')}
                      onSendToPatient={handleSendToPatient}
                    />
                  )}
                </>
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

        {currentWorkflow === 'ongoing' && store.selectedCondition && (
          <>
            <button
              onClick={() => setCurrentWorkflow('new')}
              className="btn-secondary flex items-center gap-2 mb-6"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Case
            </button>
            <OngoingManagement
              condition={store.selectedCondition}
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
          </>
        )}

        {currentWorkflow === 'medication' && store.currentCaseId && (
          <>
            <button
              onClick={() => setCurrentWorkflow('new')}
              className="btn-secondary flex items-center gap-2 mb-6"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Case
            </button>
            <MedicationReport
              currentMedications={store.medications}
              medicationNote={store.medicationNote}
              condition={store.selectedCondition!}
              selectedPlan={store.selectedPlan}
              onSavePdfOnly={handleMedicationReportSavePdfOnly}
              onSaveWithAttachments={handleMedicationReportSaveWithAttachments}
            />
          </>
        )}

        {currentWorkflow === 'referral' && store.currentCaseId && (
          <>
            <button
              onClick={() => setCurrentWorkflow('new')}
              className="btn-secondary flex items-center gap-2 mb-6"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Case
            </button>
            {(() => {
              const currentCase = store.cases.find(c => c.id === store.currentCaseId);
              return currentCase ? (
                <Referral
                  patientCase={currentCase}
                  onSavePdfOnly={handleReferralSavePdfOnly}
                  onSaveWithAttachments={handleReferralSaveWithAttachments}
                />
              ) : null;
            })()}
          </>
        )}
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
                  {isSaving ? 'Saving...' : 'Save Patient Case'}
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

  // Fallback - should not reach here
  return <Dashboard cases={store.cases} onNewCase={handleNewCaseClick} onViewCase={handleViewCase} />;
}

