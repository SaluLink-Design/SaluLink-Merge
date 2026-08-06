import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PatientCase, TreatmentItem, SelectedMedication, MedicalPlan, MedicationReport, ReferralData, ClaimType, CibRecord, BenefitState, ProgressReview, TreatmentDecision, ClinicalReviewStatus, EMPTY_PROGRESS_REVIEW, EMPTY_FOLLOW_UP_VISIT_ACTIONS, EMPTY_MEDICATION_RENEW_NOTES, FollowUpVisitActions, MedicationMode, MedicationRenewNotes, ChronicConditionCase, CareAction, ActionStatus, ChronicRegistrationStatus, ChronicSubmissionStatus, CibEvidenceItem, RegistrationPhase, PractitionerRole } from '@/types';
import { casesForLocalStorage, safeLocalStorage } from '@/lib/casePersistStorage';
import { normalizeSelectedMedication } from '@/lib/medicationCoverage';
import {
  enrollmentToBenefitState,
  reconcileMedicationsForBenefitState,
  resolveEffectiveBenefitState,
} from '@/lib/benefitState';
import { normalizeTreatmentDecision } from '@/lib/followUpContext';
import { normalizePatientCase, normalizePatientCases } from '@/lib/normalizePatientCase';
import {
  deleteCaseAttachments,
  hydrateCasesWithAttachments,
  saveCaseAttachments,
} from '@/lib/attachmentStore';
import {
  compileActionTemplate,
  createCibEvidenceItemFromTemplate,
  createChronicCaseId,
  getNextStatus,
  getRequirementsForPath,
  materializePathwayActivities,
  spawnRegistrationActions,
  syncActionsFromCibEvidence,
  syncActionsFromDiagnostics,
} from '@/lib/careActions';
import {
  getConditionRules,
  getDefaultApprovalPath,
  loadCibRegistrationRules,
  resolveApprovalPathForPractitioner,
} from '@/lib/cibRegistrationRules';
import {
  applyMockResultsToOrder,
  buildInvestigationOrder,
  buildOngoingBasketOrder,
  normalizeTreatmentCode,
} from '@/lib/investigationOrders';

import { createCaseId, resolveProfileIdForSave } from '@/lib/patientPortfolio';

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

  /** Chronic follow-up workflow — structured progress review (legacy drafts) */
  progressReview: ProgressReview;
  /** GP follow-up visit — multi-select actions (med / monitoring / referral / continue) */
  followUpVisitActions: FollowUpVisitActions;
  /** GP medication sub-path when medication action selected */
  medicationMode: MedicationMode | null;
  /** Side effects / adherence on script renew */
  medicationRenewNotes: MedicationRenewNotes;
  /** Chronic follow-up — derived treatment decision for compatibility */
  treatmentDecision: TreatmentDecision | null;
  /** Chronic follow-up workflow — clinical review (improving / stable / deteriorating) */
  clinicalReview: ClinicalReviewStatus | null;
  /** Optional basis note for the clinical assessment */
  clinicalReviewBasis: string;
  /** Chronic follow-up — skip documenting new basket monitoring this visit */
  monitoringSkipped: boolean;
  monitoringSkipReason: string;

  // Treatment data
  diagnosticTreatments: TreatmentItem[];
  ongoingTreatments: TreatmentItem[];
  medications: SelectedMedication[];
  medicationNote: string;
  selectedPlan: MedicalPlan;
  
  // Patient cases
  cases: PatientCase[];
  currentCaseId: string | null;

  /** Longitudinal condition records — care actions persist across visits */
  chronicCases: ChronicConditionCase[];
  
  // Sidebar
  sidebarOpen: boolean;
  
  // Actions
  setClinicalNote: (note: string) => void;
  setExtractedKeywords: (keywords: string[]) => void;
  setSelectedCondition: (condition: string, icdCode: string, description: string) => void;
  /** Condition name only — ICD is confirmed at the diagnosis step */
  setSelectedConditionName: (condition: string) => void;
  setCurrentStep: (step: number) => void;
  setMedicationSubstep: (substep: number) => void;
  setActiveBenefitState: (state: BenefitState | null) => void;
  setDiagnosisDate: (date: string) => void;
  setProgressReview: (review: Partial<ProgressReview>) => void;
  setFollowUpVisitActions: (actions: Partial<FollowUpVisitActions>) => void;
  setMedicationMode: (mode: MedicationMode | null) => void;
  setMedicationRenewNotes: (notes: Partial<MedicationRenewNotes>) => void;
  setTreatmentDecision: (decision: TreatmentDecision | null) => void;
  setClinicalReview: (status: ClinicalReviewStatus | null) => void;
  setClinicalReviewBasis: (basis: string) => void;
  setMonitoringSkipped: (skipped: boolean, reason?: string) => void;
  /** Recompute medication funding fields after CIB state change */
  reconcileMedicationsForBenefitState: () => void;

  addDiagnosticTreatment: (treatment: TreatmentItem) => void;
  updateDiagnosticTreatment: (index: number, treatment: Partial<TreatmentItem>) => void;
  removeDiagnosticTreatment: (index: number) => void;
  
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

  /** Chronic condition case — care coordination */
  getChronicCase: (profileId: string, condition: string) => ChronicConditionCase | undefined;
  ensureChronicCase: (
    profileId: string,
    condition: string,
    opts?: { icdCode?: string; approvalPathId?: string }
  ) => ChronicConditionCase;
  setChronicCaseApprovalPath: (profileId: string, condition: string, approvalPathId: string) => void;
  addCareAction: (profileId: string, condition: string, action: CareAction) => void;
  updateCareAction: (
    profileId: string,
    condition: string,
    actionId: string,
    updates: Partial<CareAction>
  ) => void;
  advanceCareAction: (profileId: string, condition: string, actionId: string) => void;
  syncChronicCaseDiagnostics: (
    profileId: string,
    condition: string,
    diagnosticTreatments: TreatmentItem[]
  ) => void;
  spawnChronicCaseRegistrationActions: (
    profileId: string,
    condition: string,
    practitionerRole?: PractitionerRole
  ) => Promise<void>;
  setChronicCaseRegistrationPhase: (
    profileId: string,
    condition: string,
    phase: RegistrationPhase
  ) => void;
  orderInvestigationAction: (profileId: string, condition: string, actionId: string) => void;
  referInvestigationAction: (
    profileId: string,
    condition: string,
    actionId: string,
    referral: import('@/lib/investigationCoordination').InvestigationReferralInput,
    opts?: { caseId?: string; practitionerRole?: PractitionerRole }
  ) => void;
  mockReceiveInvestigationResults: (
    profileId: string,
    condition: string,
    orderId: string
  ) => void;
  orderOngoingInvestigation: (
    caseId: string,
    treatmentCode: string,
    label: string,
    assigneeRole: import('@/types').InvestigationAssigneeRole
  ) => void;
  referOngoingInvestigation: (
    caseId: string,
    treatmentCode: string,
    label: string,
    practitionerRole: PractitionerRole,
    referralMeta?: {
      referralId?: string;
      referralSpecialty?: string;
      urgency?: 'routine' | 'urgent' | 'emergency';
      referralNote?: string;
    }
  ) => void;
  mockReceiveOngoingResults: (caseId: string, orderId: string) => void;
  /** Undo a pending (not yet returned) ongoing investigation order */
  cancelOngoingInvestigation: (caseId: string, orderId: string) => void;
  updateCibEvidenceItem: (
    profileId: string,
    condition: string,
    code: string,
    patch: Partial<CibEvidenceItem>
  ) => void;
  setActionInterpretation: (
    profileId: string,
    condition: string,
    actionId: string,
    interpretationNotes: string
  ) => void;
  syncChronicCaseCibEvidence: (profileId: string, condition: string) => void;
  materializeChronicCasePathway: (profileId: string, condition: string) => void;
  setChronicCaseRegistrationStatus: (
    profileId: string,
    condition: string,
    status: ChronicRegistrationStatus,
    opts?: { submissionStatus?: ChronicSubmissionStatus; diagnosisDate?: string }
  ) => void;
  completeChronicRegistration: (
    profileId: string,
    condition: string,
    diagnosisDate?: string
  ) => void;
  updateMedicationSection12: (
    index: number,
    fields: Partial<
      Pick<
        SelectedMedication,
        'dosage' | 'durationUsed' | 'dateFirstDiagnosed' | 'selectedStrength' | 'medicineNameAndStrength'
      >
    >
  ) => void;

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
      progressReview: { ...EMPTY_PROGRESS_REVIEW },
      followUpVisitActions: { ...EMPTY_FOLLOW_UP_VISIT_ACTIONS },
      medicationMode: null,
      medicationRenewNotes: { ...EMPTY_MEDICATION_RENEW_NOTES },
      treatmentDecision: null,
      clinicalReview: null,
      clinicalReviewBasis: '',
      monitoringSkipped: false,
      monitoringSkipReason: '',
      diagnosticTreatments: [],
      ongoingTreatments: [],
      medications: [],
      medicationNote: '',
      selectedPlan: 'Core',
      cases: [],
      currentCaseId: null,
      chronicCases: [],
      sidebarOpen: false,
      
      // Actions
      setClinicalNote: (note) => set({ clinicalNote: note }),
      
      setExtractedKeywords: (keywords) => set({ extractedKeywords: keywords }),
      
      setSelectedCondition: (condition, icdCode, description) => set({
        selectedCondition: condition,
        selectedIcdCode: icdCode,
        selectedIcdDescription: description,
      }),

      setSelectedConditionName: (condition) => set({
        selectedCondition: condition,
        selectedIcdCode: null,
        selectedIcdDescription: null,
      }),
      
      setCurrentStep: (step) => set({ currentStep: step, medicationSubstep: 1 }),
      
      setMedicationSubstep: (substep) => set({ medicationSubstep: substep }),

      setActiveBenefitState: (state) => {
        set({ activeBenefitState: state });
        if (state) get().reconcileMedicationsForBenefitState();
      },

      setDiagnosisDate: (date) => set({ diagnosisDate: date }),

      setProgressReview: (review) =>
        set((state) => ({
          progressReview: { ...state.progressReview, ...review },
        })),

      setFollowUpVisitActions: (actions) =>
        set((state) => {
          const next = { ...state.followUpVisitActions, ...actions };
          if (actions.continueOnly === true) {
            next.continueOnly = true;
            next.medication = false;
            next.monitoring = false;
            next.referral = false;
          } else if (actions.referral === true) {
            // Escalation stays exclusive — GP/specialist do not run a referral
            // alongside meds/monitoring (the medication+escalate_change pairing
            // below is a separate, deliberate exception).
            next.continueOnly = false;
            next.medication = false;
            next.monitoring = false;
          } else if (actions.medication === true) {
            next.continueOnly = false;
            next.referral = false;
            // Card toggle clears monitoring explicitly when switching focus.
            // Do not clear monitoring here — mid-flow may keep both.
          } else if (actions.monitoring === true) {
            next.continueOnly = false;
            next.referral = false;
            // Keep medication if already on (med report → ongoing management).
          }
          const patch: Partial<AppState> = { followUpVisitActions: next };
          if (actions.medication === false) {
            patch.medicationMode = null;
          }
          if (actions.medication === true && !state.medicationMode) {
            patch.medicationMode = 'renew';
          }
          if (
            state.medicationMode === 'escalate_change' &&
            actions.medication !== false
          ) {
            next.referral = true;
          }
          patch.followUpVisitActions = next;
          return patch;
        }),

      setMedicationMode: (mode) =>
        set((state) => {
          const patch: Partial<AppState> = { medicationMode: mode };
          if (mode === 'escalate_change') {
            patch.followUpVisitActions = {
              ...state.followUpVisitActions,
              medication: true,
              referral: true,
              continueOnly: false,
            };
          }
          return patch;
        }),

      setMedicationRenewNotes: (notes) =>
        set((state) => ({
          medicationRenewNotes: { ...state.medicationRenewNotes, ...notes },
        })),

      setTreatmentDecision: (decision) => set({ treatmentDecision: decision }),

      setClinicalReview: (status) => set({ clinicalReview: status }),

      setClinicalReviewBasis: (basis) => set({ clinicalReviewBasis: basis }),

      setMonitoringSkipped: (skipped, reason = '') =>
        set({
          monitoringSkipped: skipped,
          monitoringSkipReason: skipped ? reason : '',
        }),

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

      addDiagnosticTreatment: (treatment) => set((state) => {
        const diagnosticTreatments = [...state.diagnosticTreatments, treatment];
        if (!state.currentCaseId) {
          return { diagnosticTreatments };
        }
        const updatedCases = state.cases.map((c) =>
          c.id === state.currentCaseId
            ? { ...c, diagnosticTreatments, updatedAt: new Date() }
            : c
        );
        const updated = updatedCases.find((c) => c.id === state.currentCaseId);
        syncCaseAttachments(updated);
        return { diagnosticTreatments, cases: updatedCases };
      }),

      updateDiagnosticTreatment: (index, treatment) => set((state) => {
        const diagnosticTreatments = state.diagnosticTreatments.map((t, i) => {
          if (i !== index) return t;
          return {
            ...t,
            ...treatment,
            documentation: treatment.documentation
              ? { ...t.documentation, ...treatment.documentation }
              : t.documentation,
          };
        });

        if (!state.currentCaseId) {
          return { diagnosticTreatments };
        }

        const updatedCases = state.cases.map((c) =>
          c.id === state.currentCaseId
            ? { ...c, diagnosticTreatments, updatedAt: new Date() }
            : c
        );
        const updated = updatedCases.find((c) => c.id === state.currentCaseId);
        syncCaseAttachments(updated);
        return { diagnosticTreatments, cases: updatedCases };
      }),

      removeDiagnosticTreatment: (index) => set((state) => {
        const diagnosticTreatments = state.diagnosticTreatments.filter((_, i) => i !== index);
        if (!state.currentCaseId) {
          return { diagnosticTreatments };
        }
        const updatedCases = state.cases.map((c) =>
          c.id === state.currentCaseId
            ? { ...c, diagnosticTreatments, updatedAt: new Date() }
            : c
        );
        const updated = updatedCases.find((c) => c.id === state.currentCaseId);
        syncCaseAttachments(updated);
        return { diagnosticTreatments, cases: updatedCases };
      }),
      
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
          isWorkflowDraft: false,
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
            progressReview: selectedCase.progressReview ?? { ...EMPTY_PROGRESS_REVIEW },
            followUpVisitActions: {
              ...EMPTY_FOLLOW_UP_VISIT_ACTIONS,
              ...(selectedCase.followUpVisitActions ?? {}),
            },
            medicationMode: selectedCase.medicationMode ?? null,
            medicationRenewNotes: {
              ...EMPTY_MEDICATION_RENEW_NOTES,
              ...(selectedCase.medicationRenewNotes ?? {}),
            },
            treatmentDecision: normalizeTreatmentDecision(selectedCase.treatmentDecision) ?? null,
            clinicalReview: selectedCase.clinicalReview ?? null,
            clinicalReviewBasis: selectedCase.clinicalReviewBasis ?? '',
            monitoringSkipped: selectedCase.monitoringSkipped ?? false,
            monitoringSkipReason: selectedCase.monitoringSkipReason ?? '',
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
        if (normalizedUpdates.progressReview !== undefined) {
          workflowSync.progressReview = normalizedUpdates.progressReview;
        }
        if (normalizedUpdates.followUpVisitActions !== undefined) {
          workflowSync.followUpVisitActions = {
            ...EMPTY_FOLLOW_UP_VISIT_ACTIONS,
            ...normalizedUpdates.followUpVisitActions,
          };
        }
        if (normalizedUpdates.medicationMode !== undefined) {
          workflowSync.medicationMode = normalizedUpdates.medicationMode;
        }
        if (normalizedUpdates.medicationRenewNotes !== undefined) {
          workflowSync.medicationRenewNotes = normalizedUpdates.medicationRenewNotes;
        }
        if (normalizedUpdates.treatmentDecision !== undefined) {
          workflowSync.treatmentDecision = normalizedUpdates.treatmentDecision;
        }
        if (normalizedUpdates.clinicalReview !== undefined) {
          workflowSync.clinicalReview = normalizedUpdates.clinicalReview;
        }
        if (normalizedUpdates.clinicalReviewBasis !== undefined) {
          workflowSync.clinicalReviewBasis = normalizedUpdates.clinicalReviewBasis;
        }
        if (normalizedUpdates.monitoringSkipped !== undefined) {
          workflowSync.monitoringSkipped = normalizedUpdates.monitoringSkipped;
        }
        if (normalizedUpdates.monitoringSkipReason !== undefined) {
          workflowSync.monitoringSkipReason = normalizedUpdates.monitoringSkipReason;
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

      getChronicCase: (profileId, condition) => {
        const key = condition.trim().toLowerCase();
        return get().chronicCases.find(
          (c) => c.profileId === profileId && c.condition.trim().toLowerCase() === key
        );
      },

      ensureChronicCase: (profileId, condition, opts) => {
        const existing = get().getChronicCase(profileId, condition);
        if (existing) {
          if (opts?.icdCode || opts?.approvalPathId) {
            const now = new Date().toISOString();
            const updated: ChronicConditionCase = {
              ...existing,
              icdCode: opts.icdCode ?? existing.icdCode,
              approvalPathId: opts.approvalPathId ?? existing.approvalPathId,
              registrationStatus:
                existing.registrationStatus === 'submitted'
                  ? 'submitted'
                  : existing.registrationStatus === 'not_started' || !existing.registrationStatus
                    ? 'in_progress'
                    : existing.registrationStatus,
              updatedAt: now,
            };
            set((state) => ({
              chronicCases: state.chronicCases.map((c) =>
                c.id === existing.id ? updated : c
              ),
            }));
            return updated;
          }
          return existing;
        }
        const now = new Date().toISOString();
        const created: ChronicConditionCase = {
          id: createChronicCaseId(),
          profileId,
          condition,
          icdCode: opts?.icdCode,
          approvalPathId: opts?.approvalPathId,
          registrationStatus: 'not_started',
          registrationPhase: 'application_overview',
          submissionStatus: 'draft',
          cibEvidence: [],
          investigationOrders: [],
          careActions: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ chronicCases: [...state.chronicCases, created] }));
        return created;
      },

      setChronicCaseApprovalPath: (profileId, condition, approvalPathId) => {
        const chronicCase = get().getChronicCase(profileId, condition);
        if (chronicCase?.approvalPathId === approvalPathId) {
          void get().spawnChronicCaseRegistrationActions(profileId, condition);
          return;
        }
        get().ensureChronicCase(profileId, condition, { approvalPathId });
        const ensured = get().getChronicCase(profileId, condition);
        if (!ensured) return;
        const now = new Date().toISOString();
        set((state) => ({
          chronicCases: state.chronicCases.map((c) =>
            c.id === ensured.id
              ? {
                  ...c,
                  approvalPathId,
                  registrationStatus:
                    c.registrationStatus === 'submitted' ? 'submitted' : 'in_progress',
                  updatedAt: now,
                }
              : c
          ),
        }));
        void get().spawnChronicCaseRegistrationActions(profileId, condition);
      },

      addCareAction: (profileId, condition, action) => {
        const chronicCase = get().ensureChronicCase(profileId, condition);
        const now = new Date().toISOString();
        set((state) => ({
          chronicCases: state.chronicCases.map((c) =>
            c.id === chronicCase.id
              ? {
                  ...c,
                  careActions: [...c.careActions, action],
                  updatedAt: now,
                }
              : c
          ),
        }));
      },

      updateCareAction: (profileId, condition, actionId, updates) => {
        const key = condition.trim().toLowerCase();
        const now = new Date().toISOString();
        set((state) => ({
          chronicCases: state.chronicCases.map((c) => {
            if (c.profileId !== profileId || c.condition.trim().toLowerCase() !== key) return c;
            return {
              ...c,
              careActions: c.careActions.map((a) =>
                a.id === actionId ? { ...a, ...updates, updatedAt: now } : a
              ),
              updatedAt: now,
            };
          }),
        }));
      },

      advanceCareAction: (profileId, condition, actionId) => {
        const chronicCase = get().getChronicCase(profileId, condition);
        if (!chronicCase) return;
        const action = chronicCase.careActions.find((a) => a.id === actionId);
        if (!action) return;
        const next = getNextStatus(action.status, action.owner);
        if (!next) return;
        const evidence =
          next === 'evidence_received' || next === 'complete'
            ? {
                ...action.evidence,
                completedAt: new Date().toISOString(),
              }
            : action.evidence;
        get().updateCareAction(profileId, condition, actionId, {
          status: next,
          evidence,
        });
      },

      syncChronicCaseDiagnostics: (profileId, condition, diagnosticTreatments) => {
        const chronicCase = get().getChronicCase(profileId, condition);
        if (!chronicCase) return;
        const synced = syncActionsFromDiagnostics(chronicCase, diagnosticTreatments);
        const now = new Date().toISOString();
        set((state) => ({
          chronicCases: state.chronicCases.map((c) =>
            c.id === chronicCase.id
              ? { ...c, careActions: synced, updatedAt: now }
              : c
          ),
        }));
      },

      spawnChronicCaseRegistrationActions: async (profileId, condition, practitionerRole = 'gp') => {
        let chronicCase = get().getChronicCase(profileId, condition);
        if (!chronicCase) return;
        const rules = await loadCibRegistrationRules();
        const conditionRules = getConditionRules(rules, condition);
        if (!conditionRules) return;
        let pathId = chronicCase.approvalPathId;
        const pathIsValid = conditionRules.approvalPaths.some((path) => path.id === pathId);
        if (!pathId || !pathIsValid) {
          pathId = resolveApprovalPathForPractitioner(practitionerRole, conditionRules);
          chronicCase = get().ensureChronicCase(profileId, condition, { approvalPathId: pathId });
        }
        const toAdd = spawnRegistrationActions(chronicCase, conditionRules, pathId);
        const now = new Date().toISOString();
        set((state) => ({
          chronicCases: state.chronicCases.map((c) =>
            c.id === chronicCase!.id
              ? {
                  ...c,
                  approvalPathId: pathId,
                  registrationPhase: c.registrationPhase ?? 'application_overview',
                  careActions: toAdd.length > 0 ? [...c.careActions, ...toAdd] : c.careActions,
                  registrationStatus:
                    c.registrationStatus === 'submitted' ? 'submitted' : 'in_progress',
                  updatedAt: now,
                }
              : c
          ),
        }));
      },

      setChronicCaseRegistrationPhase: (profileId, condition, phase) => {
        // Phase navigation must not silently no-op while initial chronic-case
        // setup is still racing the first button click.
        const chronicCase =
          get().getChronicCase(profileId, condition) ??
          get().ensureChronicCase(profileId, condition);
        const now = new Date().toISOString();
        set((state) => ({
          chronicCases: state.chronicCases.map((c) =>
            c.id === chronicCase.id ? { ...c, registrationPhase: phase, updatedAt: now } : c
          ),
        }));
      },

      orderInvestigationAction: (profileId, condition, actionId) => {
        const chronicCase = get().getChronicCase(profileId, condition);
        if (!chronicCase) return;
        const action = chronicCase.careActions.find((a) => a.id === actionId);
        if (!action) return;

        void loadCibRegistrationRules().then((rules) => {
          const conditionRules = getConditionRules(rules, condition);
          if (!conditionRules || !chronicCase.approvalPathId) return;
          const templates = getRequirementsForPath(conditionRules, chronicCase.approvalPathId).map(
            compileActionTemplate
          );
          const template = templates.find(
            (t) =>
              t.code === action.treatmentItemCode ||
              t.requirementType === action.requirementRef.type
          );
          const now = new Date().toISOString();
          const order = buildInvestigationOrder(action, { coordinationType: 'order' });
          const evidenceItem = template
            ? createCibEvidenceItemFromTemplate(template)
            : {
                code: action.treatmentItemCode ?? action.id,
                description: action.requirementRef.label,
                documentation: { notes: '', images: [] },
              };

          const existingEvidence = chronicCase.cibEvidence ?? [];
          const hasEvidence = existingEvidence.some((e) => e.code === evidenceItem.code);

          get().updateCareAction(profileId, condition, actionId, {
            status: 'awaiting_completion',
            evidence: {
              ...action.evidence,
              orderedAt: now,
            },
          });

          set((state) => ({
            chronicCases: state.chronicCases.map((c) => {
              if (c.id !== chronicCase.id) return c;
              return {
                ...c,
                investigationOrders: [...(c.investigationOrders ?? []), order],
                cibEvidence: hasEvidence ? c.cibEvidence : [...existingEvidence, evidenceItem],
                registrationPhase: 'awaiting_results',
                updatedAt: now,
              };
            }),
          }));
        });
      },

      referInvestigationAction: (profileId, condition, actionId, referral, opts) => {
        const chronicCase = get().getChronicCase(profileId, condition);
        if (!chronicCase) return;
        const action = chronicCase.careActions.find((a) => a.id === actionId);
        if (!action) return;

        void loadCibRegistrationRules().then((rules) => {
          const conditionRules = getConditionRules(rules, condition);
          if (!conditionRules || !chronicCase.approvalPathId) return;
          const templates = getRequirementsForPath(conditionRules, chronicCase.approvalPathId).map(
            compileActionTemplate
          );
          const template = templates.find(
            (t) =>
              t.code === action.treatmentItemCode ||
              t.requirementType === action.requirementRef.type
          );
          const now = new Date().toISOString();
          // Prefer the real case_referrals.id from Supabase so downstream
          // updateReferralOwnership() calls (SpecialistOutcomePanel) hit the
          // actual row instead of a local placeholder no other account can see.
          const referralId = referral.referralId ?? `ref_${Date.now()}`;
          const caseId = opts?.caseId;

          if (caseId) {
            get().addReferral(caseId, {
              caseId,
              urgency: referral.urgency,
              referralNote: referral.referralNote,
              specialistType: referral.specialistType,
            });
          }

          const order = buildInvestigationOrder(action, {
            coordinationType: 'referral',
            referredAt: now,
            referredByRole: opts?.practitionerRole ?? 'gp',
            referralId,
            referralSpecialty: referral.specialistType,
          });

          const evidenceItem = template
            ? createCibEvidenceItemFromTemplate(template)
            : {
                code: action.treatmentItemCode ?? action.id,
                description: action.requirementRef.label,
                documentation: { notes: '', images: [] },
              };

          const existingEvidence = chronicCase.cibEvidence ?? [];
          const hasEvidence = existingEvidence.some((e) => e.code === evidenceItem.code);

          get().updateCareAction(profileId, condition, actionId, {
            status: 'awaiting_completion',
            evidence: {
              ...action.evidence,
              orderedAt: now,
              notes: `Referred to ${referral.specialistType} (${referral.urgency}). ${referral.referralNote}`,
            },
          });

          set((state) => ({
            chronicCases: state.chronicCases.map((c) => {
              if (c.id !== chronicCase.id) return c;
              return {
                ...c,
                investigationOrders: [...(c.investigationOrders ?? []), order],
                cibEvidence: hasEvidence ? c.cibEvidence : [...existingEvidence, evidenceItem],
                registrationPhase: 'awaiting_results',
                updatedAt: now,
              };
            }),
          }));
        });
      },

      mockReceiveInvestigationResults: (profileId, condition, orderId) => {
        const chronicCase = get().getChronicCase(profileId, condition);
        if (!chronicCase) return;
        const order = chronicCase.investigationOrders?.find((o) => o.id === orderId);
        if (!order) return;
        const updatedOrder = applyMockResultsToOrder(order);
        const now = new Date().toISOString();

        set((state) => ({
          chronicCases: state.chronicCases.map((c) => {
            if (c.id !== chronicCase.id) return c;
            const orders = (c.investigationOrders ?? []).map((o) =>
              o.id === orderId ? updatedOrder : o
            );
            const cibEvidence = (c.cibEvidence ?? []).map((item) =>
              item.code === order.treatmentCode
                ? {
                    ...item,
                    documentation: {
                      notes: updatedOrder.rawFindings ?? item.documentation.notes,
                      images: updatedOrder.resultsFiles ?? item.documentation.images,
                    },
                  }
                : item
            );
            return {
              ...c,
              investigationOrders: orders,
              cibEvidence,
              registrationPhase: 'interpretation',
              updatedAt: now,
            };
          }),
        }));
        get().syncChronicCaseCibEvidence(profileId, condition);
      },

      orderOngoingInvestigation: (caseId, treatmentCode, label, assigneeRole) => {
        const patientCase = get().cases.find((c) => c.id === caseId);
        if (!patientCase) return;
        const existing = (patientCase.investigationOrders ?? []).some(
          (o) =>
            normalizeTreatmentCode(o.treatmentCode) === normalizeTreatmentCode(treatmentCode) &&
            o.status === 'ordered'
        );
        if (existing) return;

        const order = buildOngoingBasketOrder({
          treatmentCode,
          label,
          caseId,
          assigneeRole,
          coordinationType: 'order',
        });
        get().updateCase(caseId, {
          investigationOrders: [...(patientCase.investigationOrders ?? []), order],
        });
      },

      referOngoingInvestigation: (caseId, treatmentCode, label, practitionerRole, referralMeta) => {
        const patientCase = get().cases.find((c) => c.id === caseId);
        if (!patientCase) return;
        const existing = (patientCase.investigationOrders ?? []).some(
          (o) =>
            normalizeTreatmentCode(o.treatmentCode) === normalizeTreatmentCode(treatmentCode) &&
            o.status === 'ordered'
        );
        if (existing) return;

        // Record the referral itself (visible in ReferralInbox outbound list) whenever a
        // real referral was created, not just a local order placeholder.
        if (referralMeta?.referralId) {
          get().addReferral(caseId, {
            caseId,
            urgency: referralMeta.urgency ?? 'routine',
            referralNote: referralMeta.referralNote ?? '',
            specialistType: referralMeta.referralSpecialty ?? '',
          });
        }

        const order = buildOngoingBasketOrder({
          treatmentCode,
          label,
          caseId,
          assigneeRole: 'clinical_technologist',
          coordinationType: 'referral',
          referredByRole: practitionerRole,
          referralId: referralMeta?.referralId,
          referralSpecialty: referralMeta?.referralSpecialty,
        });
        get().updateCase(caseId, {
          investigationOrders: [...(patientCase.investigationOrders ?? []), order],
        });
      },

      mockReceiveOngoingResults: (caseId, orderId) => {
        const patientCase = get().cases.find((c) => c.id === caseId);
        if (!patientCase) return;
        const order = patientCase.investigationOrders?.find((o) => o.id === orderId);
        if (!order) return;

        const updatedOrder = applyMockResultsToOrder(order);
        const codeNorm = normalizeTreatmentCode(order.treatmentCode);
        const existingIdx = patientCase.ongoingTreatments.findIndex(
          (t) => normalizeTreatmentCode(t.code) === codeNorm
        );

        let ongoingTreatments = [...patientCase.ongoingTreatments];
        if (existingIdx >= 0) {
          const existing = ongoingTreatments[existingIdx];
          ongoingTreatments[existingIdx] = {
            ...existing,
            documentation: {
              notes: updatedOrder.rawFindings ?? existing.documentation.notes,
              // Keep real attachments only — mock filenames are not uploadable blobs
              images: existing.documentation.images ?? [],
            },
          };
        } else {
          ongoingTreatments = [
            ...ongoingTreatments,
            {
              description: order.label,
              code: order.treatmentCode,
              maxCovered: 1,
              timesCompleted: 1,
              documentation: {
                notes: updatedOrder.rawFindings ?? '',
                images: [],
              },
            },
          ];
        }

        const investigationOrders = (patientCase.investigationOrders ?? []).map((o) =>
          o.id === orderId ? updatedOrder : o
        );

        get().updateCase(caseId, { investigationOrders, ongoingTreatments });
      },

      cancelOngoingInvestigation: (caseId, orderId) => {
        const patientCase = get().cases.find((c) => c.id === caseId);
        if (!patientCase) return;
        const order = patientCase.investigationOrders?.find((o) => o.id === orderId);
        if (!order || order.status !== 'ordered') return;
        get().updateCase(caseId, {
          investigationOrders: (patientCase.investigationOrders ?? []).filter((o) => o.id !== orderId),
        });
      },

      updateCibEvidenceItem: (profileId, condition, code, patch) => {
        const chronicCase = get().getChronicCase(profileId, condition);
        if (!chronicCase) return;
        const now = new Date().toISOString();
        set((state) => ({
          chronicCases: state.chronicCases.map((c) => {
            if (c.id !== chronicCase.id) return c;
            const items = c.cibEvidence ?? [];
            const idx = items.findIndex((i) => i.code === code);
            if (idx < 0) return c;
            const updated = [...items];
            updated[idx] = { ...updated[idx], ...patch };
            return { ...c, cibEvidence: updated, updatedAt: now };
          }),
        }));
        get().syncChronicCaseCibEvidence(profileId, condition);
      },

      setActionInterpretation: (profileId, condition, actionId, interpretationNotes) => {
        const chronicCase = get().getChronicCase(profileId, condition);
        if (!chronicCase) return;
        const action = chronicCase.careActions.find((a) => a.id === actionId);
        if (!action) return;
        get().updateCareAction(profileId, condition, actionId, {
          evidence: {
            ...action.evidence,
            interpretationNotes,
          },
        });
        get().syncChronicCaseCibEvidence(profileId, condition);
      },

      syncChronicCaseCibEvidence: (profileId, condition) => {
        const chronicCase = get().getChronicCase(profileId, condition);
        if (!chronicCase) return;
        const synced = syncActionsFromCibEvidence(chronicCase);
        const now = new Date().toISOString();
        set((state) => ({
          chronicCases: state.chronicCases.map((c) =>
            c.id === chronicCase.id ? { ...c, careActions: synced, updatedAt: now } : c
          ),
        }));
      },

      materializeChronicCasePathway: (profileId, condition) => {
        const chronicCase = get().getChronicCase(profileId, condition);
        if (!chronicCase) return;
        const toAdd = materializePathwayActivities(chronicCase);
        if (toAdd.length === 0) return;
        const now = new Date().toISOString();
        set((state) => ({
          chronicCases: state.chronicCases.map((c) =>
            c.id === chronicCase.id
              ? { ...c, careActions: [...c.careActions, ...toAdd], updatedAt: now }
              : c
          ),
        }));
      },

      setChronicCaseRegistrationStatus: (profileId, condition, status, opts) => {
        const key = condition.trim().toLowerCase();
        const now = new Date().toISOString();
        set((state) => ({
          chronicCases: state.chronicCases.map((c) => {
            if (c.profileId !== profileId || c.condition.trim().toLowerCase() !== key) return c;
            return {
              ...c,
              registrationStatus: status,
              submissionStatus: opts?.submissionStatus ?? c.submissionStatus,
              diagnosisDate: opts?.diagnosisDate ?? c.diagnosisDate,
              registrationPhase:
                status === 'submitted' || status === 'complete'
                  ? ('ready_to_submit' as const)
                  : c.registrationPhase,
              registrationCompletedAt:
                status === 'submitted' || status === 'complete' ? now : c.registrationCompletedAt,
              updatedAt: now,
            };
          }),
        }));
        if (status === 'submitted' || status === 'complete') {
          get().materializeChronicCasePathway(profileId, condition);
        }
      },

      completeChronicRegistration: (profileId, condition, diagnosisDate) => {
        get().setChronicCaseRegistrationStatus(profileId, condition, 'submitted', {
          submissionStatus: 'submitted',
          diagnosisDate,
        });
      },

      updateMedicationSection12: (index, fields) => {
        set((state) => ({
          medications: state.medications.map((med, i) =>
            i === index ? { ...med, ...fields } : med
          ),
        }));
      },

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
        progressReview: { ...EMPTY_PROGRESS_REVIEW },
        followUpVisitActions: { ...EMPTY_FOLLOW_UP_VISIT_ACTIONS },
        medicationMode: null,
        medicationRenewNotes: { ...EMPTY_MEDICATION_RENEW_NOTES },
        treatmentDecision: null,
        clinicalReview: null,
        clinicalReviewBasis: '',
        monitoringSkipped: false,
        monitoringSkipReason: '',
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
        chronicCases: state.chronicCases,
        selectedPlan: state.selectedPlan,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as {
          cases?: PatientCase[];
          chronicCases?: ChronicConditionCase[];
          selectedPlan?: MedicalPlan;
        };
        return {
          ...currentState,
          ...persisted,
          cases: normalizePatientCases(persisted?.cases ?? []),
          chronicCases: persisted?.chronicCases ?? [],
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

/** Clear persisted case state when switching accounts — prevents cross-practice patient leakage. */
export function clearPersistedCaseStore() {
  useStore.persist.clearStorage();
  useStore.setState({
    cases: [],
    chronicCases: [],
    currentCaseId: null,
    currentStep: 0,
    medicationSubstep: 1,
    clinicalNote: '',
    extractedKeywords: [],
    selectedCondition: null,
    selectedIcdCode: null,
    selectedIcdDescription: null,
    activeBenefitState: null,
    diagnosisDate: '',
    progressReview: { ...EMPTY_PROGRESS_REVIEW },
    followUpVisitActions: { ...EMPTY_FOLLOW_UP_VISIT_ACTIONS },
    medicationMode: null,
    medicationRenewNotes: { ...EMPTY_MEDICATION_RENEW_NOTES },
    treatmentDecision: null,
    clinicalReview: null,
    clinicalReviewBasis: '',
    monitoringSkipped: false,
    monitoringSkipReason: '',
    diagnosticTreatments: [],
    ongoingTreatments: [],
    medications: [],
    medicationNote: '',
  });
}

