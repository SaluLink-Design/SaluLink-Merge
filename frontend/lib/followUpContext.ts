import {
  ClinicalReviewStatus,
  EMPTY_FOLLOW_UP_VISIT_ACTIONS,
  FollowUpVisitActions,
  MedicationMode,
  MedicationRenewNotes,
  PatientCase,
  ProgressReview,
  TreatmentDecision,
} from '@/types';
import { formatMedicationRenewNotes } from '@/lib/sharedCare';

/** Plain-text summary of progress review for medication report / referral context */
export const formatProgressReviewSummary = (review: ProgressReview): string => {
  const lines: string[] = [];
  if (review.symptoms.trim()) lines.push(`Symptoms: ${review.symptoms.trim()}`);
  if (review.medicationAdherence.trim()) {
    lines.push(`Medication adherence: ${review.medicationAdherence.trim()}`);
  }
  if (review.sideEffects.trim()) lines.push(`Side effects: ${review.sideEffects.trim()}`);
  if (review.qualityOfLife.trim()) lines.push(`Quality of life: ${review.qualityOfLife.trim()}`);
  if (review.patientReportedConcerns.trim()) {
    lines.push(`Patient concerns: ${review.patientReportedConcerns.trim()}`);
  }
  return lines.join('\n');
};

export const hasFollowUpVisitActionsSelected = (actions: FollowUpVisitActions): boolean =>
  actions.continueOnly || actions.medication || actions.monitoring || actions.referral;

/** Derive legacy exclusive decision from multi-select visit actions + medication mode */
export const deriveTreatmentDecisionFromVisitActions = (
  actions: FollowUpVisitActions,
  medicationMode?: MedicationMode | null
): TreatmentDecision => {
  if (actions.medication && medicationMode === 'escalate_change') return { decision: 'refer' };
  if (actions.medication && medicationMode === 'renew') return { decision: 'continue' };
  if (actions.referral) return { decision: 'refer' };
  return { decision: 'continue' };
};

export const normalizeFollowUpVisitActions = (
  actions?: FollowUpVisitActions | null
): FollowUpVisitActions => ({
  ...EMPTY_FOLLOW_UP_VISIT_ACTIONS,
  ...(actions ?? {}),
});

/** Seed medication-report notes from visit context + optional renew notes */
export const buildVisitContextNotes = (
  clinicalNote: string,
  clinicalReview: ClinicalReviewStatus | null,
  renewNotes?: MedicationRenewNotes
): string => {
  const lines: string[] = [];
  if (clinicalNote.trim()) lines.push(clinicalNote.trim());
  if (clinicalReview) {
    lines.push(`Condition control: ${clinicalReview}`);
  }
  if (renewNotes) {
    const renewSummary = formatMedicationRenewNotes(renewNotes);
    if (renewSummary) lines.push(renewSummary);
  }
  return lines.join('\n\n');
};

/** Original diagnostic clinical note from the patient's earliest diagnostic claim */
export const getDiagnosticClinicalNoteFromPortfolio = (cases: PatientCase[]): string => {
  const diagnosticCases = cases
    .filter(
      (c) =>
        c.claimType === 'diagnostic' ||
        (c.diagnosticTreatments?.length ?? 0) > 0 ||
        Boolean(c.icdCode?.trim())
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return diagnosticCases[0]?.clinicalNote?.trim() ?? '';
};

export const normalizeTreatmentDecision = (
  decision?: TreatmentDecision | null
): TreatmentDecision | undefined => {
  if (!decision) return undefined;
  const raw = decision.decision as string;
  const mapped: TreatmentDecision['decision'] =
    raw === 'modify' || raw === 'add' ? 'change' : (raw as TreatmentDecision['decision']);
  return { decision: mapped };
};

/** Merge clinical note and condition control for Authi ongoing assessment */
export const buildFollowUpAssessmentNote = (
  clinicalNote: string,
  progressReview: ProgressReview,
  clinicalReview?: ClinicalReviewStatus | null
): string => {
  const sections: string[] = [];

  if (clinicalNote.trim()) {
    sections.push(`Follow-up clinical note:\n${clinicalNote.trim()}`);
  }

  if (clinicalReview) {
    sections.push(`Condition control: ${clinicalReview}`);
  }

  const progressSummary = formatProgressReviewSummary(progressReview);
  if (progressSummary) {
    sections.push(`Progress review:\n${progressSummary}`);
  }

  return sections.join('\n\n') || 'Ongoing management visit.';
};

export const hasProgressReviewContent = (review: ProgressReview): boolean =>
  Object.values(review).some((v) => v.trim().length > 0);
