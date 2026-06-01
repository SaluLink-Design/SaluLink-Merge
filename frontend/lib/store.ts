import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PatientCase, TreatmentItem, SelectedMedication, MedicalPlan, MedicationReport, ReferralData, ClaimType, CibRecord, BenefitState } from '@/types';
import { casesForLocalStorage, safeLocalStorage } from '@/lib/casePersistStorage';
import { normalizeSelectedMedication } from '@/lib/medicationCoverage';
import {
  enrollmentToBenefitState,
  reconcileMedicationsForBenefitState,
  resolveEffectiveBenefitState,
} from '@/lib/benefitState';
import { normalizePatientCase, normalizePatientCases } from '@/lib/normalizePatientCase';
import { createCaseId, resolveProfileIdForSave } from '@/lib/patientPortfolio';
import {
  deleteCaseAttachments,
  hydrateCasesWithAttachments,
  saveCaseAttachments,
} from '@/lib/attachmentStore';

const syncCaseAttachments = (caseData: PatientCase | undefined) => {
  if (caseData) void saveCaseAttachments(caseData.id, caseData);
};

const syncAllCaseAttachments = (cases: PatientCase[]) => {
  cases.forEach((c) => void saveCaseAttachments(c.id, c));
};

const normalizeMedications = (
  medications?: SelectedMedication[] | null
): SelectedMedication[] => (medications ?? []).map((medication) => normalizeSelectedMedication(medication));

interface AppState {
  // Current workflow state
  currentStep: number;
  medicationSubstep: number; // 1 = medication selection, 2 = registration note
  clinicalNote: string;
  extractedKeywords: string[];
  selectedCondition: string | null;
  selectedIcdCode: string | null;
  selectedIcdDescription: string | null;

  /**
   * The active benefit state for the current workflow session.
   * - null = not yet determined (prompt the user)
   * - 'unregistered' | 'pending_cib_review' = Workflow A (evidence generation)
   * - 'approved_chronic' and above = Workflow B (evidence maintenance)
   */
  activeBenefitState: BenefitState | null;
  /** Treating doctor's diagnosis date for current condition (ISO date string) */
  diagnosisDate: string;

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
  setActiveBenefitState: (state: BenefitState | null) => void;
  setDiagnosisDate: (date: string) => void;
  /** Recompute medication funding fields after CIB state change */
  reconcileMedicationsForBenefitState: () => void;

  addDiagnosticTreatment: (treatment: TreatmentItem) => void;
  updateDiagnosticTreatment: (index: number, treatment: Partial<TreatmentItem>) => void;
  
  addOngoingTreatment: (treatment: TreatmentItem) => void;
  updateOngoingTreatment: (index: number, treatment: Partial<TreatmentItem>) => void;
  
  addMedication: (medication: SelectedMedication) => void;
  removeMedication: (index: number) => void;
  updateMedicationNote: (index: number, note: string) => void;
  setMedicationNote: (note: string) => void;
  setSelectedPlan: (plan: MedicalPlan) => void;

  /** Upsert a CIB record on a patient case (matched by conditionName) */
  upsertCibRecord: (caseId: string, record: CibRecord) => void;
  /** Update only the benefit state for a specific condition's CIB record */
  updateCibBenefitState: (caseId: string, conditionName: string, benefitState: BenefitState) => void;
  
  saveCase: (patientName: string, patientId: string, claimType?: ClaimType) => void;
  addCase: (patientCase: PatientCase) => void;
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
      activeBenefitState: null,
      diagnosisDate: '',
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

      setActiveBenefitState: (state) => {
        set({ activeBenefitState: state });
        if (state) get().reconcileMedicationsForBenefitState();
      },

      setDiagnosisDate: (date) => set({ diagnosisDate: date }),

      reconcileMedicationsForBenefitState: () => {
        const state = get();
        if (!state.selectedCondition || !state.activeBenefitState || state.medications.length === 0) {
          return;
        }
        const medications = reconcileMedicationsForBenefitState(
          state.medications,
          state.selectedCondition,
          state.selectedPlan,
          state.activeBenefitState
        );
        set({ medications });
      },

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
      
      updateOngoingTreatment: (index, treatment) =>
        set((state) => {
          const ongoingTreatments = state.ongoingTreatments.map((t, i) =>
            i === index ? { ...t, ...treatment } : t
          );
          if (state.currentCaseId) {
            const c = state.cases.find((x) => x.id === state.currentCaseId);
            if (c) {
              syncCaseAttachments({ ...c, ongoingTreatments });
            }
          }
          return { ongoingTreatments };
        }),
      
      addMedication: (medication) => set((state) => {
        const isDuplicate = state.medications.some(
          m => m.medicineNameAndStrength === medication.medicineNameAndStrength
        );

        if (isDuplicate) {
          return state;
        }

        return {
          medications: [...state.medications, normalizeSelectedMedication(medication)],
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

      upsertCibRecord: (caseId, record) => set((state) => ({
        cases: state.cases.map((c) => {
          if (c.id !== caseId) return c;
          const existing = c.cibRecords ?? [];
          const idx = existing.findIndex((r) => r.conditionName === record.conditionName);
          const updated = idx === -1
            ? [...existing, record]
            : existing.map((r, i) => (i === idx ? { ...r, ...record } : r));
          return { ...c, cibRecords: updated, updatedAt: new Date() };
        }),
      })),

      updateCibBenefitState: (caseId, conditionName, benefitState) => set((state) => ({
        cases: state.cases.map((c) => {
          if (c.id !== caseId) return c;
          const existing = c.cibRecords ?? [];
          const updated = existing.map((r) =>
            r.conditionName === conditionName ? { ...r, benefitState } : r
          );
          return { ...c, cibRecords: updated, updatedAt: new Date() };
        }),
      })),
      
      saveCase: (patientName, patientId, claimType = 'diagnostic') => {
        const state = get();

        const uniqueMedications = normalizeMedications(state.medications).reduce((acc: SelectedMedication[], current) => {
          const duplicate = acc.find(item =>
            item.medicineNameAndStrength === current.medicineNameAndStrength
          );
          if (!duplicate) {
            acc.push(current);
          }
          return acc;
        }, []);

        const status = state.ongoingTreatments.length > 0
          ? 'ongoing'
          : state.diagnosticTreatments.length > 0
          ? 'diagnostic'
          : 'draft';

        const priorCase = state.currentCaseId
          ? state.cases.find((c) => c.id === state.currentCaseId)
          : undefined;

        const profileId = resolveProfileIdForSave(state.cases, patientId, priorCase);

        const cibRecords = (() => {
          const existing = priorCase?.cibRecords ?? [];
          if (!state.selectedCondition || !state.diagnosisDate) return existing.length ? existing : undefined;
          const idx = existing.findIndex((r) => r.conditionName === state.selectedCondition);
          const draft: CibRecord = {
            conditionName: state.selectedCondition,
            icd10: state.selectedIcdCode || '',
            diagnosisDate: state.diagnosisDate,
            benefitState: state.activeBenefitState ?? 'unregistered',
            formularyAligned: state.medications.every((m) => m.formularyStatus === 'listed'),
          };
          if (idx === -1) return [...existing, draft];
          return existing.map((r, i) => (i === idx ? { ...r, ...draft } : r));
        })();

        const casePayload: Partial<PatientCase> & { id: string } = {
          id: priorCase?.id ?? createCaseId(),
          profileId,
          patientName,
          patientId,
          claimType,
          createdAt: priorCase?.createdAt ?? new Date(),
          updatedAt: new Date(),
          clinicalNote: state.clinicalNote,
          condition: state.selectedCondition || '',
          icdCode: state.selectedIcdCode || '',
          icdDescription: state.selectedIcdDescription || '',
          diagnosticTreatments: state.diagnosticTreatments,
          ongoingTreatments: state.ongoingTreatments,
          medications: normalizeMedications(uniqueMedications),
          medicationNote: state.medicationNote,
          plan: state.selectedPlan,
          status,
          medicalScheme: priorCase?.medicalScheme,
          cibEnrollmentStatus: priorCase?.cibEnrollmentStatus,
          cibRecords,
        };

        const normalizedCase = normalizePatientCase(casePayload);

        if (priorCase) {
          set((s) => {
            syncCaseAttachments(normalizedCase);
            return {
              cases: s.cases.map((c) => (c.id === priorCase.id ? normalizedCase : c)),
              currentCaseId: normalizedCase.id,
            };
          });
          return;
        }

        set((s) => {
          syncCaseAttachments(normalizedCase);
          return {
            cases: [...s.cases, normalizedCase],
            currentCaseId: normalizedCase.id,
          };
        });
      },

      addCase: (patientCase) =>
        set((state) => {
          const normalizedCase = normalizePatientCase(patientCase);
          syncCaseAttachments(normalizedCase);
          return {
            cases: [...state.cases, normalizedCase],
            currentCaseId: normalizedCase.id,
          };
        }),
      
      loadCase: (caseId) => {
        const state = get();
        const selectedCase = state.cases.find(c => c.id === caseId);

        if (selectedCase) {
          const uniqueMedications = normalizeMedications(selectedCase.medications).reduce((acc: SelectedMedication[], current) => {
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
            activeBenefitState: (() => {
              const rec = selectedCase.cibRecords?.find(
                (r) => r.conditionName === selectedCase.condition
              );
              return resolveEffectiveBenefitState(
                selectedCase.cibEnrollmentStatus ?? 'unregistered',
                rec?.benefitState
              );
            })(),
            diagnosisDate:
              selectedCase.cibRecords?.find((r) => r.conditionName === selectedCase.condition)
                ?.diagnosisDate ?? '',
          });
        }
      },
      
      updateCase: (caseId, updates) => set((state) => {
        const normalizedUpdates: Partial<PatientCase> = {
          ...updates,
          medications:
            updates.medications !== undefined
              ? normalizeMedications(updates.medications)
              : undefined,
        };
        const updatedCases = state.cases.map(c =>
          c.id === caseId
            ? { ...c, ...normalizedUpdates, updatedAt: new Date() }
            : c
        );

        if (state.currentCaseId !== caseId) {
          return { cases: updatedCases };
        }

        const workflowSync: Partial<AppState> = {};
        if (normalizedUpdates.ongoingTreatments !== undefined) {
          workflowSync.ongoingTreatments = normalizedUpdates.ongoingTreatments;
        }
        if (normalizedUpdates.diagnosticTreatments !== undefined) {
          workflowSync.diagnosticTreatments = normalizedUpdates.diagnosticTreatments;
        }
        if (normalizedUpdates.medications !== undefined) {
          workflowSync.medications = normalizedUpdates.medications;
        }
        if (normalizedUpdates.medicationNote !== undefined) {
          workflowSync.medicationNote = normalizedUpdates.medicationNote;
        }
        if (normalizedUpdates.clinicalNote !== undefined) {
          workflowSync.clinicalNote = normalizedUpdates.clinicalNote;
        }
        if (normalizedUpdates.condition !== undefined) {
          workflowSync.selectedCondition = normalizedUpdates.condition;
        }
        if (normalizedUpdates.icdCode !== undefined) {
          workflowSync.selectedIcdCode = normalizedUpdates.icdCode;
        }
        if (normalizedUpdates.icdDescription !== undefined) {
          workflowSync.selectedIcdDescription = normalizedUpdates.icdDescription;
        }
        if (normalizedUpdates.plan !== undefined) {
          workflowSync.selectedPlan = normalizedUpdates.plan;
        }

        const merged = { cases: updatedCases, ...workflowSync };
        const updated = updatedCases.find((c) => c.id === caseId);
        syncCaseAttachments(updated);
        return merged;
      }),

      deleteCase: (caseId) => {
        void deleteCaseAttachments(caseId);
        set((state) => ({
          cases: state.cases.filter((c) => c.id !== caseId),
          currentCaseId: state.currentCaseId === caseId ? null : state.currentCaseId,
        }));
      },

      addMedicationReport: (caseId, report) => set((state) => ({
        cases: state.cases.map(c =>
          c.id === caseId
            ? {
                ...c,
                medicationReports: [
                  ...(c.medicationReports || []),
                  {
                    ...report,
                    originalMedications: normalizeMedications(report.originalMedications),
                    newMedications: normalizeMedications(report.newMedications),
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
        activeBenefitState: null,
        diagnosisDate: '',
        diagnosticTreatments: [],
        ongoingTreatments: [],
        medications: [],
        medicationNote: '',
        currentCaseId: null,
      }),
    }),
    {
      name: 'salulink-storage',
      storage: safeLocalStorage,
      partialize: (state) => ({
        cases: casesForLocalStorage(state.cases),
        selectedPlan: state.selectedPlan,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { cases?: PatientCase[]; selectedPlan?: MedicalPlan };
        return {
          ...currentState,
          ...persisted,
          cases: normalizePatientCases(persisted?.cases ?? []),
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error || !state?.cases?.length) return;
        const normalized = state.cases.map((c) => normalizePatientCase(c));
        void hydrateCasesWithAttachments(normalized).then((hydrated) => {
          const cases = hydrated.map((c) => normalizePatientCase(c));
          useStore.setState({ cases });
          syncAllCaseAttachments(cases);
        });
      },
    }
  )
);

