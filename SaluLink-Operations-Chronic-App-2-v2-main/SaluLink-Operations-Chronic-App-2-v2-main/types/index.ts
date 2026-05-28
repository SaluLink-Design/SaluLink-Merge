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
}

export type MedicalPlan = 'Core' | 'Priority' | 'Saver' | 'Executive' | 'Comprehensive';

/** Medical scheme — drives tailored baskets and formulary data */
export type MedicalScheme = 'discovery' | 'gems';

/** Patient-level chronic programme enrollment at intake */
export type CibEnrollmentStatus = 'unregistered' | 'registered';

export type ClaimType = 'diagnostic' | 'ongoing-management' | 'medication-report' | 'referral';

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

