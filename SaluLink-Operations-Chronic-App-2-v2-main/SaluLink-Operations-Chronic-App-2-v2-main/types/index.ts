// Core Types for SaluLink Chronic Treatment App

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

export interface TreatmentItem {
  description: string;
  code: string;
  maxCovered: number;
  timesCompleted: number;
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
  note?: string;
  documentation?: {
    notes: string;
    images: string[];
  };
}

export type MedicalPlan = 'Core' | 'Priority' | 'Saver' | 'Executive' | 'Comprehensive';

export type ClaimType = 'diagnostic' | 'ongoing-management' | 'medication-report' | 'referral';

export interface PatientCase {
  id: string;
  patientName: string;
  patientId: string;
  patientEmail?: string;
  patientPhone?: string;
  medicalAidNumber?: string;
  claimType: ClaimType;
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
  medicationReports?: MedicationReport[];
  referrals?: ReferralData[];
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

