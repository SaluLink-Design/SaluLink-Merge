import {
  BenefitState,
  ChronicConditionCase,
  CibEnrollmentStatus,
  CibRecord,
  ClaimType,
  EvidenceCompleteness,
  FundingSource,
  MedicalScheme,
  PatientCase,
  SelectedMedication,
  TreatmentItem,
} from '@/types';
import { deriveEvidenceFromDiagnostics } from '@/lib/diagnosticEvidence';
import { buildCoverageDecision } from '@/lib/medicationCoverage';
import { MedicalPlan } from '@/types';
import { DataService } from '@/lib/dataService';

/** States where the patient is still proving eligibility (Workflow A) */
export const WORKFLOW_A_STATES: BenefitState[] = ['unregistered', 'pending_cib_review'];

/** States where chronic benefit is active (Workflow B) */
export const WORKFLOW_B_MIN_STATE: BenefitState = 'approved_chronic';

const STATE_RANK: Record<BenefitState, number> = {
  unregistered: 0,
  pending_cib_review: 1,
  approved_chronic: 2,
  formulary_compliant: 3,
  pmb_compliant: 4,
  dsp_compliant: 5,
};

export const isWorkflowA = (state: BenefitState | null | undefined): boolean =>
  !state || WORKFLOW_A_STATES.includes(state);

export const isWorkflowB = (state: BenefitState | null | undefined): boolean =>
  Boolean(state && STATE_RANK[state] >= STATE_RANK[WORKFLOW_B_MIN_STATE]);

export const enrollmentToBenefitState = (status: CibEnrollmentStatus): BenefitState =>
  status === 'registered' ? 'approved_chronic' : 'unregistered';

/**
 * Patient-level CIB registration (registered) unlocks Workflow B even when a condition
 * record is still marked pending_cib_review from the application step.
 */
export const resolveEffectiveBenefitState = (
  enrollment: CibEnrollmentStatus,
  conditionBenefitState?: BenefitState | null
): BenefitState => {
  const fromEnrollment = enrollmentToBenefitState(enrollment);
  if (!conditionBenefitState) return fromEnrollment;
  return STATE_RANK[fromEnrollment] >= STATE_RANK[conditionBenefitState]
    ? fromEnrollment
    : conditionBenefitState;
};

/** Latest enrollment status for a patient across their cases */
export const getPatientEnrollmentStatus = (
  cases: PatientCase[],
  patientId: string
): CibEnrollmentStatus => {
  const patientKey = patientId.trim().toLowerCase();
  const patientCases = cases
    .filter((c) => c.patientId.trim().toLowerCase() === patientKey)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  if (patientCases.some((c) => c.cibEnrollmentStatus === 'registered')) return 'registered';
  return patientCases[0]?.cibEnrollmentStatus ?? 'unregistered';
};

export type PatientCibStatusLabel =
  | 'Not registered'
  | 'Submitted — pending review'
  | 'Registered';

function chronicCasesForPatient(
  chronicCases: ChronicConditionCase[] | undefined,
  patientId: string,
  cases: PatientCase[]
): ChronicConditionCase[] {
  if (!chronicCases?.length) return [];

  const patientKey = patientId.trim().toLowerCase();
  const profileIds = new Set(
    cases
      .filter((c) => c.patientId.trim().toLowerCase() === patientKey)
      .map((c) => c.profileId)
      .filter((id): id is string => Boolean(id))
  );

  // Callers often pass chronic cases already scoped to this profile. Trust those.
  // Also include any chronic case whose profileId matches this patient's cases —
  // but do NOT drop pre-scoped cases when synced patient rows lack profileId.
  if (profileIds.size === 0) return chronicCases;

  const matched = chronicCases.filter((c) => profileIds.has(c.profileId));
  return matched.length > 0 ? matched : chronicCases;
}

function isSubmittedRegistrationStatus(status: string | undefined): boolean {
  return status === 'submitted' || status === 'complete';
}

function hasSubmittedChronicRegistration(
  chronicCases: ChronicConditionCase[] | undefined,
  patientId: string,
  cases: PatientCase[]
): boolean {
  return chronicCasesForPatient(chronicCases, patientId, cases).some((c) =>
    isSubmittedRegistrationStatus(c.registrationStatus)
  );
}

function patientHasRegisteredSignal(cases: PatientCase[], patientId: string): boolean {
  const patientKey = patientId.trim().toLowerCase();
  return cases.some((c) => {
    if (c.patientId.trim().toLowerCase() !== patientKey) return false;
    if (c.cibEnrollmentStatus === 'registered') return true;
    if ((c.cibRecords ?? []).some(
      (r) =>
        r.benefitState === 'pending_cib_review' || isWorkflowB(r.benefitState)
    )) {
      return true;
    }
    // Completed diagnostic with ICD = CIB registration pack finished in practice
    if (
      c.status === 'completed' &&
      Boolean(c.condition?.trim()) &&
      Boolean(c.icdCode?.trim())
    ) {
      return true;
    }
    return false;
  });
}

/** True when post-registration visit types (follow-up, specialist review) may start */
export function canStartRegisteredPatientActions(
  cases: PatientCase[],
  patientId: string,
  chronicCases?: ChronicConditionCase[]
): boolean {
  if (!patientId.trim()) return false;
  if (getPatientEnrollmentStatus(cases, patientId) === 'registered') return true;
  if (patientHasRegisteredSignal(cases, patientId)) return true;
  // Prefer scoped chronic list; if none match filtering, still honour any submitted
  // chronic case the caller handed in (profile-scoped lists from PatientProfile).
  if (
    chronicCases?.some((c) => isSubmittedRegistrationStatus(c.registrationStatus))
  ) {
    return true;
  }
  if (hasSubmittedChronicRegistration(chronicCases, patientId, cases)) return true;
  return getPatientCibRecords(cases, patientId).some((r) => isWorkflowB(r.benefitState));
}

export function getPatientCibStatusLabel(
  cases: PatientCase[],
  patientId: string,
  chronicCases?: ChronicConditionCase[]
): PatientCibStatusLabel {
  if (getPatientEnrollmentStatus(cases, patientId) === 'registered') return 'Registered';
  const cibRecords = getPatientCibRecords(cases, patientId);
  if (cibRecords.some((r) => isWorkflowB(r.benefitState))) return 'Registered';
  if (
    hasSubmittedChronicRegistration(chronicCases, patientId, cases) ||
    cibRecords.some((r) => r.benefitState === 'pending_cib_review') ||
    patientHasRegisteredSignal(cases, patientId)
  ) {
    return 'Submitted — pending review';
  }
  return 'Not registered';
}

export const getPatientMedicalScheme = (
  cases: PatientCase[],
  patientId: string
): MedicalScheme => {
  const patientCases = cases
    .filter((c) => c.patientId === patientId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return patientCases[0]?.medicalScheme ?? 'discovery';
};

export const benefitStateLabel: Record<BenefitState, string> = {
  unregistered: 'Unregistered',
  pending_cib_review: 'Pending CIB Review',
  approved_chronic: 'CIB Approved',
  formulary_compliant: 'Formulary Compliant',
  pmb_compliant: 'PMB Compliant',
  dsp_compliant: 'DSP Compliant',
};

export const fundingSourceLabel: Record<FundingSource, string> = {
  'day-to-day': 'Day-to-day benefits',
  msa: 'Medical Savings Account (MSA)',
  pmb_pending: 'PMB / pending chronic review',
  chronic_benefit: 'Chronic Illness Benefit',
};

export const fundingSourceShortLabel: Record<FundingSource, string> = {
  'day-to-day': 'Day-to-day',
  msa: 'MSA',
  pmb_pending: 'Pending CIB',
  chronic_benefit: 'Chronic benefit',
};

/** Prefer the most advanced CIB record per condition across all cases for a patient */
export const dedupeCibRecordsByCondition = (records: CibRecord[]): CibRecord[] => {
  const map = new Map<string, CibRecord>();
  for (const rec of records) {
    const existing = map.get(rec.conditionName);
    if (!existing || STATE_RANK[rec.benefitState] > STATE_RANK[existing.benefitState]) {
      map.set(rec.conditionName, rec);
    }
  }
  return Array.from(map.values());
};

export const getPatientCibRecords = (cases: PatientCase[], patientId: string): CibRecord[] => {
  const patientKey = patientId.trim().toLowerCase();
  return dedupeCibRecordsByCondition(
    cases
      .filter((c) => c.patientId.trim().toLowerCase() === patientKey)
      .flatMap((c) => c.cibRecords ?? [])
  );
};

export const getCibRecordForCondition = (
  cases: PatientCase[],
  patientId: string,
  conditionName: string
): CibRecord | undefined =>
  getPatientCibRecords(cases, patientId).find((r) => r.conditionName === conditionName);

export const suggestClaimType = (benefitState: BenefitState | null | undefined): ClaimType => {
  if (isWorkflowB(benefitState)) return 'ongoing-management';
  return 'diagnostic';
};

export const claimTypeRecommendation = (
  benefitState: BenefitState | null | undefined,
  claimType: ClaimType,
  enrollment?: CibEnrollmentStatus
): { recommended: ClaimType; aligned: boolean; hint: string } => {
  const effective = enrollment
    ? resolveEffectiveBenefitState(enrollment, benefitState)
    : benefitState ?? 'unregistered';
  const recommended = suggestClaimType(effective);
  const aligned = claimType === recommended;
  if (aligned) {
    return {
      recommended,
      aligned: true,
      hint:
        recommended === 'diagnostic'
          ? 'Diagnostic workflow matches evidence-generation phase (pre-CIB or pending).'
          : 'Ongoing workflow matches chronic management phase (CIB approved).',
    };
  }
  if (isWorkflowA(effective) && claimType !== 'diagnostic') {
    return {
      recommended,
      aligned: false,
      hint:
        'This patient is not yet on the chronic benefit pathway for this condition. A diagnostic claim is usually appropriate until CIB is approved.',
    };
  }
  return {
    recommended,
    aligned: false,
    hint:
      'CIB is approved for this condition. Ongoing management or medication report is usually more appropriate than a full diagnostic registration workflow.',
  };
};

export interface EvidenceInput {
  icdCode: string;
  clinicalNote: string;
  benefitState: BenefitState;
  conditionName: string;
  diagnosisDate?: string;
  diagnosticTreatments?: TreatmentItem[];
  /** @deprecated use diagnosticTreatments */
  hasLabResults?: boolean;
  /** @deprecated use diagnosticTreatments */
  hasImaging?: boolean;
  /** @deprecated use diagnosisDate */
  hasDiagnosisDate?: boolean;
  medicationsFormularyAligned?: boolean;
}

export const computeEvidenceCompleteness = (input: EvidenceInput): EvidenceCompleteness => {
  const derived = input.diagnosticTreatments
    ? deriveEvidenceFromDiagnostics(input.diagnosticTreatments)
    : null;

  const icdConfirmed = Boolean(input.icdCode?.trim());
  const diagnosisDateRecorded = Boolean(
    input.diagnosisDate?.trim() || input.hasDiagnosisDate
  );
  const labResultsAttached = derived
    ? derived.hasLabResults
    : Boolean(input.hasLabResults);
  const imagingAttached = derived
    ? derived.hasImaging
    : Boolean(input.hasImaging);
  const clinicalNotesIncluded = Boolean(input.clinicalNote?.trim().length > 40);
  const pmbCdlConditionMatch = Boolean(input.conditionName?.trim());
  const medicineFormularyAligned = input.medicationsFormularyAligned ?? true;

  const checks = [
    { key: 'icdConfirmed', label: 'ICD-10 code confirmed', ok: icdConfirmed },
    { key: 'diagnosisDate', label: 'Date of diagnosis recorded', ok: diagnosisDateRecorded },
    {
      key: 'labResults',
      label: 'Lab / procedure results or uploads attached (e.g. pathology, EEG, PDF)',
      ok: labResultsAttached,
    },
    { key: 'imaging', label: 'Imaging reports or scans uploaded (if applicable)', ok: imagingAttached },
    { key: 'clinicalNotes', label: 'Clinical notes included', ok: clinicalNotesIncluded },
    { key: 'pmbMatch', label: 'PMB CDL condition match', ok: pmbCdlConditionMatch },
    { key: 'formulary', label: 'Medicines align with chronic formulary', ok: medicineFormularyAligned },
  ];

  const completed = checks.filter((c) => c.ok).length;
  const score = Math.round((completed / checks.length) * 100);
  const missingItems = checks.filter((c) => !c.ok).map((c) => c.label);

  return {
    icdConfirmed,
    diagnosisDateRecorded,
    labResultsAttached,
    imagingAttached,
    clinicalNotesIncluded,
    pmbCdlConditionMatch,
    medicineFormularyAligned,
    score,
    missingItems,
  };
};

/** Re-apply funding metadata when benefit state changes (e.g. after CIB approval) */
export const reconcileMedicationsForBenefitState = (
  medications: SelectedMedication[],
  condition: string,
  plan: MedicalPlan,
  benefitState: BenefitState
): SelectedMedication[] => {
  const catalogue = DataService.getMedicinesForCondition(condition);
  return medications.map((med) => {
    const match = catalogue.find(
      (m) =>
        (med.catalogueLabel && m.medicineNameAndStrength === med.catalogueLabel) ||
        m.medicineNameAndStrength === med.medicineNameAndStrength
    );
    if (!match) return med;
    const coverage = buildCoverageDecision(match, plan, benefitState);
    return {
      ...med,
      formularyStatus: coverage.formularyStatus,
      coverageDecision: coverage.coverageDecision,
      copayRisk: coverage.copayRisk,
      coverageNote: coverage.coverageNote,
      cdaCapAmount: coverage.cdaCapAmount,
      fundingSource: coverage.fundingSource,
      isDiseaseModifying: coverage.isDiseaseModifying,
      fundingLagWarning: coverage.fundingLagWarning,
      cibFundingNote: coverage.cibFundingNote,
    };
  });
};

export const buildDefaultCibRecord = (
  conditionName: string,
  icd10: string,
  diagnosisDate: string,
  submittedMedicine?: string
): CibRecord => ({
  conditionName,
  icd10,
  diagnosisDate,
  submissionDate: new Date().toISOString().slice(0, 10),
  benefitState: 'pending_cib_review',
  formularyAligned: true,
  submittedMedicine,
});
