import { PatientCase, TreatmentBasketItem, TreatmentItem } from '@/types';

export const getTreatmentKey = (code: string, description: string) =>
  `${code.trim()}|${description.trim()}`;

export const getMaxCoveredFromBasketItem = (item: TreatmentBasketItem): number => {
  const coverageValue = item.ongoingManagementBasket.covered?.trim();
  return coverageValue && !Number.isNaN(parseInt(coverageValue, 10))
    ? parseInt(coverageValue, 10)
    : 1;
};

const caseUsesTreatment = (
  caseData: PatientCase,
  treatmentKey: string,
  condition: string
): number => {
  if (caseData.condition.toLowerCase() !== condition.toLowerCase()) return 0;

  return caseData.ongoingTreatments
    .filter((t) => getTreatmentKey(t.code, t.description) === treatmentKey)
    .reduce((sum, t) => sum + (t.timesCompleted || 0), 0);
};

/** Sum timesCompleted from saved claims for this patient/treatment in the current year */
export const getHistoricalTreatmentUsage = (
  patientId: string,
  condition: string,
  treatmentKey: string,
  cases: PatientCase[],
  options?: { excludeCaseId?: string | null; year?: number }
): number => {
  const year = options?.year ?? new Date().getFullYear();

  return cases.reduce((total, caseData) => {
    if (caseData.patientId !== patientId) return total;
    if (options?.excludeCaseId && caseData.id === options.excludeCaseId) return total;

    const caseDate = new Date(caseData.updatedAt || caseData.createdAt);
    if (caseDate.getFullYear() !== year) return total;

    const isOngoingClaim =
      caseData.claimType === 'ongoing-management' || caseData.ongoingTreatments.length > 0;
    if (!isOngoingClaim) return total;

    return total + caseUsesTreatment(caseData, treatmentKey, condition);
  }, 0);
};

export const hasClinicalAppealForTreatment = (
  patientId: string,
  treatmentKey: string,
  cases: PatientCase[],
  year: number = new Date().getFullYear()
): boolean =>
  cases.some(
    (caseData) =>
      caseData.patientId === patientId &&
      caseData.clinicalAppeals?.some((appeal) => {
        const appealYear = new Date(appeal.createdAt).getFullYear();
        return (
          appealYear === year &&
          getTreatmentKey(appeal.treatmentCode, appeal.treatmentDescription) === treatmentKey
        );
      })
  );

export interface TreatmentUsageSummary {
  treatmentKey: string;
  maxCovered: number;
  usedHistorical: number;
  usedInCurrentClaim: number;
  totalUsed: number;
  remaining: number;
  isExhausted: boolean;
}

export const getTreatmentUsageSummary = (
  item: TreatmentBasketItem,
  patientId: string,
  condition: string,
  cases: PatientCase[],
  currentCaseId: string | null,
  currentTreatments: TreatmentItem[]
): TreatmentUsageSummary => {
  const code = item.ongoingManagementBasket.code;
  const description = item.ongoingManagementBasket.description;
  const treatmentKey = getTreatmentKey(code, description);
  const maxCovered = getMaxCoveredFromBasketItem(item);

  const usedHistorical = getHistoricalTreatmentUsage(
    patientId,
    condition,
    treatmentKey,
    cases,
    { excludeCaseId: currentCaseId }
  );

  const usedInCurrentClaim = currentTreatments
    .filter((t) => getTreatmentKey(t.code, t.description) === treatmentKey)
    .reduce((sum, t) => sum + (t.timesCompleted || 0), 0);

  const totalUsed = usedHistorical + usedInCurrentClaim;
  const remaining = Math.max(0, maxCovered - usedHistorical);

  return {
    treatmentKey,
    maxCovered,
    usedHistorical,
    usedInCurrentClaim,
    totalUsed,
    remaining,
    isExhausted: usedHistorical >= maxCovered,
  };
};
