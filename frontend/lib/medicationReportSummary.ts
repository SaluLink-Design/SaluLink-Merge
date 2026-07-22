import type { ClinicalReviewStatus, MedicationRenewNotes, SelectedMedication } from '@/types';
import { formatMedicationRenewNotes } from '@/lib/sharedCare';

export const MED_REPORT_FINDINGS_MARKER = '---\nMedication report (this visit)';

export interface MedicationReportSummaryInput {
  clinicalReview?: ClinicalReviewStatus | null;
  clinicalReviewBasis?: string;
  medicationRenewNotes: MedicationRenewNotes;
  medications: SelectedMedication[];
  clinicalNote?: string;
  intent?: 'refer_change' | 'renew';
}

/** Structured text block for specialist handoff (kept out of the GP typing field). */
export const formatMedicationReportFindings = (input: MedicationReportSummaryInput): string => {
  const lines: string[] = [];
  if (input.intent === 'refer_change') {
    lines.push('Intent: GP requests neurologist review for medication change.');
  } else if (input.intent === 'renew') {
    lines.push('Intent: GP renewing current chronic medication plan.');
  }
  if (input.clinicalReview) {
    const basis = input.clinicalReviewBasis?.trim();
    lines.push(
      basis
        ? `Clinical assessment: ${input.clinicalReview} — ${basis}`
        : `Clinical assessment: ${input.clinicalReview}.`
    );
  }
  const renewSummary = formatMedicationRenewNotes(input.medicationRenewNotes);
  if (renewSummary) lines.push(renewSummary);
  if (input.medications.length > 0) {
    lines.push(
      `Current medications:\n${input.medications
        .map(
          (m) =>
            `• ${m.medicineNameAndStrength || m.brandName || 'Medication'}${
              m.activeIngredient ? ` (${m.activeIngredient})` : ''
            }`
        )
        .join('\n')}`
    );
  }
  return lines.filter(Boolean).join('\n\n');
};

/** Compose specialist referral notes: GP message first, findings appendix second. */
export const composeReferralNotesWithFindings = (
  gpMessage: string,
  findings: string
): string => {
  const message = gpMessage.trim();
  const block = findings.trim();
  if (!block) return message;
  if (!message) return `${MED_REPORT_FINDINGS_MARKER}\n${block}`;
  return `${message}\n\n${MED_REPORT_FINDINGS_MARKER}\n${block}`;
};

/** Split stored referral notes into GP message vs medication-report findings. */
export const splitReferralNotesAndFindings = (
  notes: string
): { referralMessage: string; medicationFindings: string } => {
  const raw = notes ?? '';
  const marker = MED_REPORT_FINDINGS_MARKER;
  const idx = raw.indexOf(marker);
  if (idx < 0) {
    return { referralMessage: raw.trim(), medicationFindings: '' };
  }
  return {
    referralMessage: raw.slice(0, idx).trim(),
    medicationFindings: raw.slice(idx + marker.length).trim(),
  };
};
