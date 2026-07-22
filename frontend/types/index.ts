// Core Types for SaluLink Chronic Treatment App

// ---------------------------------------------------------------------------
// CIB Benefit State Machine
// ---------------------------------------------------------------------------

/** Ordered states a patient's condition moves through in the Discovery CIB system */
export type BenefitState =
  | 'unregistered'
  | 'pending_cib_review'
  | 'approved_chronic'
  | 'formulary_compliant'
  | 'pmb_compliant'
  | 'dsp_compliant';

/** The funding bucket that will pay for a medicine at a given benefit state */
export type FundingSource =
  | 'day-to-day'
  | 'msa'
  | 'pmb_pending'
  | 'chronic_benefit';

/** A single CIB registration record for one chronic condition on a patient */
export interface CibRecord {
  conditionName: string;
  icd10: string;
  /** Date CIB application was submitted (ISO string) */
  submissionDate?: string;
  /** Date Discovery approved the chronic benefit (ISO string) */
  approvalDate?: string;
  /** Treating doctor's recorded diagnosis date — used for retrospective benefit connection */
  diagnosisDate?: string;
  benefitState: BenefitState;
  formularyAligned: boolean;
  /** The medicine that was submitted with the original CIB application */
  submittedMedicine?: string;
  /** Notes about funding lag (medicine prescribed before CIB approval) */
  fundingLagNote?: string;
}

/** Evidence items required for a CIB application */
export interface EvidenceCompleteness {
  icdConfirmed: boolean;
  diagnosisDateRecorded: boolean;
  labResultsAttached: boolean;
  imagingAttached: boolean;
  clinicalNotesIncluded: boolean;
  pmbCdlConditionMatch: boolean;
  medicineFormularyAligned: boolean;
  /** Derived score 0–100 based on how many items are complete */
  score: number;
  /** Items that are missing or incomplete */
  missingItems: string[];
}

export interface ChronicCondition {
  condition: string;
  icdCode: string;
  icdDescription: string;
}

export interface MedicineItem {
  condition: string;
  cdaCore: string;
  cdaExecutive: string;
  medicineClass: string;
  activeIngredient: string;
  medicineNameAndStrength: string;
  formularyStatus?: 'listed' | 'unlisted';
  planRestriction?: {
    type: 'only' | 'not_available';
    plans: MedicalPlan[];
    originalText: string;
  };
}

export interface TreatmentBasketItem {
  condition: string;
  diagnosticBasket: {
    description: string;
    code: string;
    covered: string;
  };
  ongoingManagementBasket: {
    description: string;
    code: string;
    covered: string;
  };
  specialists?: string;
  /** "Number of specialists we cover each year" — raw scheme text, e.g. "3". Parse defensively. */
  specialistVisitsCovered?: string;
}

export interface MatchedCondition {
  condition: string;
  icdCode: string;
  icdDescription: string;
  similarityScore: number;
}

export interface ClinicalAppeal {
  treatmentCode: string;
  treatmentDescription: string;
  rationale: string;
  images: string[];
  createdAt: Date;
}

export interface TreatmentItem {
  description: string;
  code: string;
  maxCovered: number;
  timesCompleted: number;
  /** Set when this use exceeds the annual basket limit via clinical appeal */
  viaClinicalAppeal?: boolean;
  documentation: {
    notes: string;
    images: string[];
  };
}

export interface SelectedMedication {
  medicineClass: string;
  activeIngredient: string;
  medicineNameAndStrength: string;
  /** Brand name parsed from the catalogue label */
  brandName?: string;
  /** Strength chosen by the doctor (e.g. "100mg") */
  selectedStrength?: string;
  /** Original Discovery catalogue label before strength selection */
  catalogueLabel?: string;
  cdaAmount: string;
  formularyStatus: 'listed' | 'unlisted';
  coverageDecision: 'full_cover' | 'cap_limited';
  copayRisk: boolean;
  coverageNote: string;
  cdaCapAmount?: number;
  unlistedClinicalRationale?: string;
  note?: string;
  documentation?: {
    notes: string;
    images: string[];
  };
  /** The funding bucket that will cover this medicine given the patient's current benefit state */
  fundingSource?: FundingSource;
  /** True if this medicine qualifies as disease-modifying therapy under CIB rules */
  isDiseaseModifying?: boolean;
  /** Warning shown when medicine is prescribed before CIB approval (funding lag) */
  fundingLagWarning?: string;
  /** CIB-specific note (e.g. non-DMT may not be chronic-funded) */
  cibFundingNote?: string;
  /** Section 12 — explicit dosage (e.g. "1 tablet twice daily") */
  dosage?: string;
  /** Section 12 — duration the medicine has been used */
  durationUsed?: string;
  /** Section 12 — date medicine was first prescribed for this condition */
  dateFirstDiagnosed?: string;
}

export type MedicalPlan = 'Core' | 'Priority' | 'Saver' | 'Executive' | 'Comprehensive';

/** Medical scheme — drives tailored baskets and formulary data */
export type MedicalScheme = 'discovery' | 'gems';

/** Patient-level chronic programme enrollment at intake */
export type CibEnrollmentStatus = 'unregistered' | 'registered';

export type ClaimType =
  | 'diagnostic'
  | 'ongoing-management'
  | 'medication-report'
  | 'referral'
  | 'specialist-review';

/** Structured patient progress captured at a chronic follow-up visit */
export interface ProgressReview {
  symptoms: string;
  medicationAdherence: string;
  sideEffects: string;
  qualityOfLife: string;
  patientReportedConcerns: string;
}

export type TreatmentDecisionType = 'continue' | 'adjust' | 'change' | 'refer';

/** Doctor-confirmed clinical review at a chronic follow-up visit (history-based assessment) */
export type ClinicalReviewStatus = 'improving' | 'stable' | 'deteriorating';

export interface TreatmentDecision {
  decision: TreatmentDecisionType;
  /** @deprecated — narrative lives in medication motivation or referral note */
  rationale?: string;
}

/**
 * GP medication path when Medication action is selected.
 * renew = repeat script; escalate_change = refer to neurologist for medication change (no GP formulary swap).
 */
export type MedicationMode = 'renew' | 'escalate_change';

/** Light side-effect / adherence capture on script renew (not full Progress Review) */
export interface MedicationRenewNotes {
  sideEffects: string;
  adherence: string;
}

export const EMPTY_MEDICATION_RENEW_NOTES: MedicationRenewNotes = {
  sideEffects: '',
  adherence: '',
};

/**
 * Visit actions for a follow-up / specialist visit.
 * Exactly one of medication, monitoring, referral, or continueOnly may be active.
 */
export interface FollowUpVisitActions {
  medication: boolean;
  monitoring: boolean;
  referral: boolean;
  continueOnly: boolean;
}

export const EMPTY_FOLLOW_UP_VISIT_ACTIONS: FollowUpVisitActions = {
  medication: false,
  monitoring: false,
  referral: false,
  continueOnly: false,
};

export const EMPTY_PROGRESS_REVIEW: ProgressReview = {
  symptoms: '',
  medicationAdherence: '',
  sideEffects: '',
  qualityOfLife: '',
  patientReportedConcerns: '',
};

export type DeliveryStatus = 'draft' | 'ready_to_send' | 'sent_to_patient';

export interface PatientCase {
  id: string;
  /** Internal portfolio key — groups claims for one person (multiple claims per profile). */
  profileId?: string;
  patientName: string;
  patientId: string;
  patientEmail?: string;
  patientPhone?: string;
  medicalAidNumber?: string;
  medicalScheme?: MedicalScheme;
  /** Patient-level CIB enrollment captured at onboarding */
  cibEnrollmentStatus?: CibEnrollmentStatus;
  claimType?: ClaimType;
  createdAt: Date;
  updatedAt: Date;
  clinicalNote: string;
  /** Structured progress review from a chronic follow-up visit (legacy drafts) */
  progressReview?: ProgressReview;
  /** Multi-select visit actions for the GP follow-up shell */
  followUpVisitActions?: FollowUpVisitActions;
  /** GP medication sub-path when medication action selected */
  medicationMode?: MedicationMode | null;
  /** Side effects / adherence captured on script renew */
  medicationRenewNotes?: MedicationRenewNotes;
  /** Treatment decision — derived from visit actions for compatibility */
  treatmentDecision?: TreatmentDecision;
  /** Doctor-confirmed condition trajectory after clinical review */
  clinicalReview?: ClinicalReviewStatus;
  /** Optional one-line basis for the clinical assessment (history / known results) */
  clinicalReviewBasis?: string;
  /** Doctor chose not to document new basket monitoring this visit */
  monitoringSkipped?: boolean;
  /** Clinical justification when monitoring was skipped */
  monitoringSkipReason?: string;
  condition: string;
  icdCode: string;
  icdDescription: string;
  diagnosticTreatments: TreatmentItem[];
  ongoingTreatments: TreatmentItem[];
  medications: SelectedMedication[];
  medicationNote: string;
  plan: MedicalPlan;
  status: 'new' | 'draft' | 'diagnostic' | 'ongoing' | 'completed';
  /** Claim document delivery queue state */
  deliveryStatus?: DeliveryStatus;
  /** Doctor has signed off on this claim */
  doctorApproved?: boolean;
  workspaceId?: string;
  medicationReports?: MedicationReport[];
  referrals?: ReferralData[];
  /** Appeals filed when care exceeds the standard baseline basket (per treatment, current year) */
  clinicalAppeals?: ClinicalAppeal[];
  /** CIB registration records — one per chronic condition the patient has registered */
  cibRecords?: CibRecord[];
  /** True while a New Case Action workflow is in progress — hidden from portfolio until saved */
  isWorkflowDraft?: boolean;
  /** Visit-scoped investigation orders (ongoing follow-up / specialist review) */
  investigationOrders?: InvestigationOrder[];
  /**
   * The GP has sent the CIB investigation referral and has no further CIB
   * action until the specialist completes registration.
   */
  awaitingSpecialist?: boolean;
  /**
   * False once a specialist's completed CIB registration has been pulled into
   * this case (via bulk dashboard check or manual case open) but the GP
   * hasn't opened the case to see it yet — drives the dashboard badge.
   * Undefined means "no specialist handoff has landed on this case".
   */
  specialistHandoffAcknowledged?: boolean;
}

export interface ReferralData {
  id: string;
  caseId: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  referralNote: string;
  specialistType: string;
  createdAt: Date;
}

export interface MedicationReport {
  id: string;
  caseId: string;
  originalMedications: SelectedMedication[];
  followUpNotes: string;
  newMedications: SelectedMedication[];
  motivationLetter: string;
  documentation?: {
    notes: string;
    images: string[];
  };
  createdAt: Date;
}

export interface AnalysisResult {
  extractedKeywords: string[];
  matchedConditions: MatchedCondition[];
}

export interface WorkflowStep {
  id: string;
  title: string;
  completed: boolean;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Care Actions — requirement → action → visibility tracking
// ---------------------------------------------------------------------------

export type ActionPhase = 'registration' | 'pathway' | 'ongoing';

export type ActionStatus =
  | 'not_started'
  | 'requested'
  | 'awaiting_completion'
  | 'evidence_received'
  | 'complete';

export type CareActionOwner = 'gp' | 'external' | 'specialist' | 'patient';

export interface CareActionEvidence {
  notes?: string;
  /** GP clinical interpretation — separate from raw external report */
  interpretationNotes?: string;
  documentIds?: string[];
  completedAt?: string;
  completedBy?: string;
  orderedAt?: string;
}

export type PractitionerRole =
  | 'gp'
  | 'neurologist'
  | 'specialist'
  | 'clinical_technologist'
  | 'pathologist';

export type InvestigationOrderStatus = 'ordered' | 'results_received';

export type InvestigationAssigneeRole = 'clinical_technologist' | 'pathologist';

export interface InvestigationOrder {
  id: string;
  actionId: string;
  treatmentCode: string;
  label: string;
  assigneeRole: InvestigationAssigneeRole;
  status: InvestigationOrderStatus;
  orderedAt: string;
  resultsReceivedAt?: string;
  resultsFiles?: string[];
  rawFindings?: string;
  coordinationType?: 'order' | 'referral';
  referredAt?: string;
  referredByRole?: PractitionerRole;
  referralId?: string;
  referralSpecialty?: string;
  /** Distinguishes visit basket orders from CIB registration orders on chronic case */
  visitContext?: 'ongoing';
  caseId?: string;
}

export type RegistrationPhase =
  | 'not_started'
  | 'application_overview'
  | 'requirements'
  | 'awaiting_results'
  | 'interpretation'
  | 'icd_code'
  | 'medication'
  | 'clinical_pack'
  | 'ready_to_submit';

/** CIB registration evidence — separate from post-CIB treatment basket */
export interface CibEvidenceItem {
  code: string;
  description: string;
  documentation: {
    notes: string;
    images: string[];
  };
}

export interface CareActionRequirementRef {
  source: 'cib-rules' | 'basket' | 'workflow';
  type: string;
  code?: string;
  label: string;
}

/** Tracked action instance — converts a scheme requirement into clinical next steps */
export interface CareAction {
  id: string;
  profileId: string;
  condition: string;
  phase: ActionPhase;
  requirementRef: CareActionRequirementRef;
  title: string;
  purpose: string;
  likelyProviders: string[];
  owner: CareActionOwner;
  status: ActionStatus;
  evidence?: CareActionEvidence;
  treatmentItemCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type ChronicRegistrationStatus =
  | 'not_started'
  | 'in_progress'
  | 'complete'
  | 'submitted';

export type ChronicSubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'pending_review'
  | 'approved';

/** Longitudinal condition record — actions persist across visits */
export interface ChronicConditionCase {
  id: string;
  profileId: string;
  condition: string;
  icdCode?: string;
  /** Selected CIB approval path from cib-registration-rules.json */
  approvalPathId?: string;
  registrationStatus?: ChronicRegistrationStatus;
  /** Wizard sub-phase inside Registration Workspace */
  registrationPhase?: RegistrationPhase;
  registrationCompletedAt?: string;
  submissionStatus?: ChronicSubmissionStatus;
  diagnosisDate?: string;
  /** Evidence captured during CIB registration (not treatment basket) */
  cibEvidence?: CibEvidenceItem[];
  investigationOrders?: InvestigationOrder[];
  careActions: CareAction[];
  createdAt: string;
  updatedAt: string;
}

export type CibRequirementType =
  | 'gp_application'
  | 'specialist_application'
  | 'investigation'
  | 'lab_result'
  | 'supporting_diagnosis'
  | 'clinical_notes'
  | 'icd_confirmed'
  | 'diagnosis_date';

export interface CibRequirement {
  type: CibRequirementType;
  label: string;
  code?: string;
  specialty?: string;
  /** How a GP coordinates this requirement — referral for tests not done in general practice */
  gpPathway?: 'referral' | 'order' | 'perform';
  referralSpecialty?: string;
  performer?: string;
  interpreter?: string;
}

export interface CibApprovalPath {
  id: string;
  label: string;
  requirements: CibRequirement[];
}

export interface CibConditionRules {
  condition: string;
  approvalPaths: CibApprovalPath[];
  commonRequirements: CibRequirement[];
}

export interface CareActivityTemplate {
  id: string;
  title: string;
  provider: string;
  purpose: string;
  code?: string;
  phase: 'pathway' | 'ongoing';
}

