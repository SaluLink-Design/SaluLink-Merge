import { PatientCase, TreatmentBasketItem } from '@/types';

/**
 * Scheme text for "number of specialists we cover each year" is sometimes a clean
 * integer (e.g. "3") and sometimes free text split by specialist type
 * (e.g. "1 (Ophthalmologist) 4 (Other Specialist)"). Only the clean-integer case is
 * handled here — conditions with composite text return null (no known single limit)
 * rather than guessing.
 */
export const getMaxSpecialistVisitsForCondition = (
  items: TreatmentBasketItem[]
): number | null => {
  for (const item of items) {
    const raw = item.specialistVisitsCovered?.trim();
    if (!raw) continue;
    if (/^\d+$/.test(raw)) {
      return parseInt(raw, 10);
    }
    // Composite / non-numeric scheme text — do not attempt to parse a single limit.
    return null;
  }
  return null;
};

/**
 * Completed specialist-review visits for this patient/condition in a given calendar
 * year. Resets Jan 1 — matches the existing ongoing-basket usage pattern. Only counts
 * visits completed inside SaluLink; a referral alone does not consume a visit.
 */
export const getHistoricalSpecialistVisitUsage = (
  patientId: string,
  condition: string,
  cases: PatientCase[],
  options?: { excludeCaseId?: string | null; year?: number }
): number => {
  const year = options?.year ?? new Date().getFullYear();
  const targetCondition = condition.trim().toLowerCase();

  return cases.filter((c) => {
    if (c.patientId !== patientId) return false;
    if (options?.excludeCaseId && c.id === options.excludeCaseId) return false;
    if (c.claimType !== 'specialist-review') return false;
    if (c.status !== 'completed') return false;
    if ((c.condition ?? '').trim().toLowerCase() !== targetCondition) return false;

    const caseDate = new Date(c.updatedAt || c.createdAt);
    return caseDate.getFullYear() === year;
  }).length;
};

export interface SpecialistVisitUsageSummary {
  /** null = scheme text for this condition could not be reduced to a single number */
  maxCovered: number | null;
  usedHistorical: number;
  /** null when maxCovered is null — remaining is unknown, not unlimited */
  remaining: number | null;
  isExhausted: boolean;
}

export const getSpecialistVisitUsageSummary = (
  items: TreatmentBasketItem[],
  patientId: string,
  condition: string,
  cases: PatientCase[],
  options?: { excludeCaseId?: string | null; year?: number }
): SpecialistVisitUsageSummary => {
  const maxCovered = getMaxSpecialistVisitsForCondition(items);
  const usedHistorical = getHistoricalSpecialistVisitUsage(patientId, condition, cases, options);
  const remaining = maxCovered === null ? null : Math.max(0, maxCovered - usedHistorical);

  return {
    maxCovered,
    usedHistorical,
    remaining,
    isExhausted: maxCovered !== null && usedHistorical >= maxCovered,
  };
};
