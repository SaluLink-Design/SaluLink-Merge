import type {
  FollowUpVisitActions,
  MedicationMode,
  MedicationRenewNotes,
  PatientCase,
  TreatmentDecision,
} from '@/types';

/** Suggest neurologist referral specialty from condition name (Epilepsy-first heuristic) */
export const suggestNeurologistSpecialty = (condition: string, icdCode?: string): string => {
  const lower = condition.toLowerCase();
  if (lower.includes('epilep') || icdCode?.startsWith('G40')) return 'Neurologist';
  if (lower.includes('multiple sclerosis') || icdCode?.startsWith('G35')) return 'Neurologist';
  if (lower.includes('parkinson') || icdCode?.startsWith('G20')) return 'Neurologist';
  return 'Neurologist';
};

export const formatMedicationRenewNotes = (notes: MedicationRenewNotes): string => {
  const lines: string[] = [];
  if (notes.adherence.trim()) lines.push(`Adherence: ${notes.adherence.trim()}`);
  if (notes.sideEffects.trim()) lines.push(`Side effects / tolerability: ${notes.sideEffects.trim()}`);
  return lines.join('\n');
};

export const buildRenewFollowUpNotes = (
  clinicalNote: string,
  clinicalReview: string | null | undefined,
  renewNotes: MedicationRenewNotes
): string => {
  const sections: string[] = [];
  if (clinicalNote.trim()) sections.push(clinicalNote.trim());
  if (clinicalReview) sections.push(`Condition control: ${clinicalReview}`);
  const renewSummary = formatMedicationRenewNotes(renewNotes);
  if (renewSummary) sections.push(renewSummary);
  return sections.join('\n\n');
};

export interface SharedCareSummaryLabels {
  visitActions: string[];
}

export const getSharedCareSummaryLabels = (
  actions: FollowUpVisitActions,
  medicationMode: MedicationMode | null | undefined,
  treatmentDecision?: TreatmentDecision | null
): SharedCareSummaryLabels => {
  const visitActions: string[] = [];
  if (actions.continueOnly) {
    visitActions.push('Continue current plan');
    return { visitActions };
  }
  if (actions.medication) {
    if (medicationMode === 'escalate_change') {
      visitActions.push('Escalated to neurologist for treatment change');
    } else if (medicationMode === 'renew') {
      visitActions.push('Script renewed');
    } else if (treatmentDecision?.decision === 'adjust') {
      visitActions.push('Dose / instructions adjusted');
    } else if (treatmentDecision?.decision === 'change') {
      visitActions.push('Treatment plan updated');
    } else if (treatmentDecision?.decision === 'continue') {
      visitActions.push('Current plan continued');
    } else {
      visitActions.push('Treatment plan reviewed');
    }
  }
  if (actions.monitoring) visitActions.push('Monitoring documented');
  if (actions.referral) visitActions.push('Escalated to neurologist');
  return { visitActions };
};

/** Latest completed specialist review with medications for GP notice */
export const getLatestSpecialistTreatmentUpdate = (
  cases: PatientCase[],
  medicalPatientId: string
): PatientCase | null => {
  const key = medicalPatientId.trim().toLowerCase();
  const specialistReviews = cases
    .filter(
      (c) =>
        c.claimType === 'specialist-review' &&
        c.status === 'completed' &&
        c.patientId.trim().toLowerCase() === key &&
        (c.medications?.length ?? 0) > 0
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return specialistReviews[0] ?? null;
};
