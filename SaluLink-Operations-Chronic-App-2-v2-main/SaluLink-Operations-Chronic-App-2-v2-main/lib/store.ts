import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PatientCase, TreatmentItem, SelectedMedication, MedicalPlan, MedicationReport, ReferralData } from '@/types';

interface AppState {
  // Current workflow state
  currentStep: number;
  medicationSubstep: number; // 1 = medication selection, 2 = registration note
  clinicalNote: string;
  extractedKeywords: string[];
  selectedCondition: string | null;
  selectedIcdCode: string | null;
  selectedIcdDescription: string | null;
  
  // Treatment data
  diagnosticTreatments: TreatmentItem[];
  ongoingTreatments: TreatmentItem[];
  medications: SelectedMedication[];
  medicationNote: string;
  selectedPlan: MedicalPlan;
  
  // Patient cases
  cases: PatientCase[];
  currentCaseId: string | null;
  
  // Sidebar
  sidebarOpen: boolean;
  
  // Actions
  setClinicalNote: (note: string) => void;
  setExtractedKeywords: (keywords: string[]) => void;
  setSelectedCondition: (condition: string, icdCode: string, description: string) => void;
  setCurrentStep: (step: number) => void;
  setMedicationSubstep: (substep: number) => void;
  
  addDiagnosticTreatment: (treatment: TreatmentItem) => void;
  updateDiagnosticTreatment: (index: number, treatment: Partial<TreatmentItem>) => void;
  
  addOngoingTreatment: (treatment: TreatmentItem) => void;
  updateOngoingTreatment: (index: number, treatment: Partial<TreatmentItem>) => void;
  
  addMedication: (medication: SelectedMedication) => void;
  removeMedication: (index: number) => void;
  updateMedicationNote: (index: number, note: string) => void;
  setMedicationNote: (note: string) => void;
  setSelectedPlan: (plan: MedicalPlan) => void;
  
  saveCase: (patientName: string, patientId: string) => void;
  loadCase: (caseId: string) => void;
  updateCase: (caseId: string, updates: Partial<PatientCase>) => void;
  deleteCase: (caseId: string) => void;

  addMedicationReport: (caseId: string, report: Omit<MedicationReport, 'id' | 'createdAt'>) => void;
  addReferral: (caseId: string, referral: Omit<ReferralData, 'id' | 'createdAt'>) => void;

  toggleSidebar: () => void;
  resetWorkflow: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStep: 0,
      medicationSubstep: 1,
      clinicalNote: '',
      extractedKeywords: [],
      selectedCondition: null,
      selectedIcdCode: null,
      selectedIcdDescription: null,
      diagnosticTreatments: [],
      ongoingTreatments: [],
      medications: [],
      medicationNote: '',
      selectedPlan: 'Core',
      cases: [],
      currentCaseId: null,
      sidebarOpen: false,
      
      // Actions
      setClinicalNote: (note) => set({ clinicalNote: note }),
      
      setExtractedKeywords: (keywords) => set({ extractedKeywords: keywords }),
      
      setSelectedCondition: (condition, icdCode, description) => set({
        selectedCondition: condition,
        selectedIcdCode: icdCode,
        selectedIcdDescription: description,
      }),
      
      setCurrentStep: (step) => set({ currentStep: step, medicationSubstep: 1 }),
      
      setMedicationSubstep: (substep) => set({ medicationSubstep: substep }),
      
      addDiagnosticTreatment: (treatment) => set((state) => ({
        diagnosticTreatments: [...state.diagnosticTreatments, treatment],
      })),
      
      updateDiagnosticTreatment: (index, treatment) => set((state) => ({
        diagnosticTreatments: state.diagnosticTreatments.map((t, i) =>
          i === index ? { ...t, ...treatment } : t
        ),
      })),
      
      addOngoingTreatment: (treatment) => set((state) => ({
        ongoingTreatments: [...state.ongoingTreatments, treatment],
      })),
      
      updateOngoingTreatment: (index, treatment) => set((state) => ({
        ongoingTreatments: state.ongoingTreatments.map((t, i) =>
          i === index ? { ...t, ...treatment } : t
        ),
      })),
      
      addMedication: (medication) => set((state) => {
        const isDuplicate = state.medications.some(
          m => m.medicineNameAndStrength === medication.medicineNameAndStrength
        );

        if (isDuplicate) {
          return state;
        }

        return {
          medications: [...state.medications, medication],
        };
      }),

      removeMedication: (index) => set((state) => ({
        medications: state.medications.filter((_, i) => i !== index),
      })),

      updateMedicationNote: (index, note) => set((state) => ({
        medications: state.medications.map((m, i) =>
          i === index ? { ...m, note } : m
        ),
      })),

      setMedicationNote: (note) => set({ medicationNote: note }),
      
      setSelectedPlan: (plan) => set({ selectedPlan: plan }),
      
      saveCase: (patientName, patientId) => {
        const state = get();

        const uniqueMedications = state.medications.reduce((acc: SelectedMedication[], current) => {
          const duplicate = acc.find(item =>
            item.medicineNameAndStrength === current.medicineNameAndStrength
          );
          if (!duplicate) {
            acc.push(current);
          }
          return acc;
        }, []);

        const newCase: PatientCase = {
          id: Date.now().toString(),
          patientName,
          patientId,
          createdAt: new Date(),
          updatedAt: new Date(),
          clinicalNote: state.clinicalNote,
          condition: state.selectedCondition || '',
          icdCode: state.selectedIcdCode || '',
          icdDescription: state.selectedIcdDescription || '',
          diagnosticTreatments: state.diagnosticTreatments,
          ongoingTreatments: state.ongoingTreatments,
          medications: uniqueMedications,
          medicationNote: state.medicationNote,
          plan: state.selectedPlan,
          status: state.ongoingTreatments.length > 0 ? 'ongoing' : 'diagnostic',
        };

        set((state) => ({
          cases: [...state.cases, newCase],
          currentCaseId: newCase.id,
        }));
      },
      
      loadCase: (caseId) => {
        const state = get();
        const selectedCase = state.cases.find(c => c.id === caseId);

        if (selectedCase) {
          const uniqueMedications = selectedCase.medications.reduce((acc: SelectedMedication[], current) => {
            const duplicate = acc.find(item =>
              item.medicineNameAndStrength === current.medicineNameAndStrength
            );
            if (!duplicate) {
              acc.push(current);
            }
            return acc;
          }, []);

          set({
            currentCaseId: caseId,
            clinicalNote: selectedCase.clinicalNote,
            selectedCondition: selectedCase.condition,
            selectedIcdCode: selectedCase.icdCode,
            selectedIcdDescription: selectedCase.icdDescription,
            diagnosticTreatments: selectedCase.diagnosticTreatments,
            ongoingTreatments: selectedCase.ongoingTreatments,
            medications: uniqueMedications,
            medicationNote: selectedCase.medicationNote,
            selectedPlan: selectedCase.plan,
          });
        }
      },
      
      updateCase: (caseId, updates) => set((state) => ({
        cases: state.cases.map(c =>
          c.id === caseId
            ? { ...c, ...updates, updatedAt: new Date() }
            : c
        ),
      })),
      
      deleteCase: (caseId) => set((state) => ({
        cases: state.cases.filter(c => c.id !== caseId),
        currentCaseId: state.currentCaseId === caseId ? null : state.currentCaseId,
      })),

      addMedicationReport: (caseId, report) => set((state) => ({
        cases: state.cases.map(c =>
          c.id === caseId
            ? {
                ...c,
                medicationReports: [
                  ...(c.medicationReports || []),
                  {
                    ...report,
                    id: Date.now().toString(),
                    createdAt: new Date(),
                  },
                ],
                updatedAt: new Date(),
              }
            : c
        ),
      })),

      addReferral: (caseId, referral) => set((state) => ({
        cases: state.cases.map(c =>
          c.id === caseId
            ? {
                ...c,
                referrals: [
                  ...(c.referrals || []),
                  {
                    ...referral,
                    id: Date.now().toString(),
                    createdAt: new Date(),
                  },
                ],
                updatedAt: new Date(),
              }
            : c
        ),
      })),

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      resetWorkflow: () => set({
        currentStep: 0,
        medicationSubstep: 1,
        clinicalNote: '',
        extractedKeywords: [],
        selectedCondition: null,
        selectedIcdCode: null,
        selectedIcdDescription: null,
        diagnosticTreatments: [],
        ongoingTreatments: [],
        medications: [],
        medicationNote: '',
        currentCaseId: null,
      }),
    }),
    {
      name: 'salulink-storage',
      partialize: (state) => ({
        cases: state.cases,
        selectedPlan: state.selectedPlan,
      }),
    }
  )
);

