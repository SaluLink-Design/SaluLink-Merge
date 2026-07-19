import { MedicalPlan, MedicineItem } from '@/types';
import { buildCoverageDecision } from '@/lib/medicationCoverage';

export interface IngredientMedicationGroup {
  key: string;
  ingredient: string;
  cdaAmount: string;
  brands: MedicineItem[];
  coverageSummary: 'all_listed' | 'all_unlisted' | 'mixed';
  availabilitySummary: 'all_available' | 'some_blocked' | 'none_available';
  availableCount: number;
  totalCount: number;
  availablePercent: number;
}

export const getCdaForPlan = (medicine: MedicineItem, selectedPlan: MedicalPlan): string => {
  if (selectedPlan === 'Core' || selectedPlan === 'Priority' || selectedPlan === 'Saver') {
    return medicine.cdaCore;
  }
  return medicine.cdaExecutive || medicine.cdaCore;
};

const normalizeIngredientKey = (ingredient: string) =>
  ingredient.trim().toLowerCase().replace(/\s+/g, ' ');

export const buildIngredientMedicationGroups = (
  medicines: MedicineItem[],
  selectedPlan: MedicalPlan
): IngredientMedicationGroup[] => {
  const byIngredient = new Map<string, MedicineItem[]>();

  medicines.forEach((medicine) => {
    const ingredient = medicine.activeIngredient?.trim() || 'Unknown ingredient';
    const key = normalizeIngredientKey(ingredient);
    if (!byIngredient.has(key)) {
      byIngredient.set(key, []);
    }
    byIngredient.get(key)!.push(medicine);
  });

  return Array.from(byIngredient.entries())
    .map(([key, brands]) => {
      const listedCount = brands.filter(
        (brand) => buildCoverageDecision(brand, selectedPlan).formularyStatus === 'listed'
      ).length;
      const coverageSummary: IngredientMedicationGroup['coverageSummary'] =
        listedCount === brands.length
          ? 'all_listed'
          : listedCount === 0
            ? 'all_unlisted'
            : 'mixed';
      const availableCount = brands.filter((brand) => {
        if (selectedPlan === 'Core' || selectedPlan === 'Priority' || selectedPlan === 'Saver' || selectedPlan === 'Executive' || selectedPlan === 'Comprehensive') {
          // availability is represented by plan restriction fields in CSV-derived medicine records
          if (!brand.planRestriction) return true;
          if (brand.planRestriction.type === 'only') {
            return brand.planRestriction.plans.includes(selectedPlan);
          }
          if (brand.planRestriction.type === 'not_available') {
            return !brand.planRestriction.plans.includes(selectedPlan);
          }
        }
        return true;
      }).length;
      const availabilitySummary: IngredientMedicationGroup['availabilitySummary'] =
        availableCount === brands.length
          ? 'all_available'
          : availableCount === 0
            ? 'none_available'
            : 'some_blocked';
      const availablePercent =
        brands.length > 0 ? Math.round((availableCount / brands.length) * 100) : 0;

      const preferredCda = getCdaForPlan(brands[0], selectedPlan);

      return {
        key,
        ingredient: brands[0].activeIngredient?.trim() || 'Unknown ingredient',
        cdaAmount: preferredCda,
        brands: [...brands].sort((a, b) =>
          (a.medicineNameAndStrength || '').localeCompare(b.medicineNameAndStrength || '')
        ),
        coverageSummary,
        availabilitySummary,
        availableCount,
        totalCount: brands.length,
        availablePercent,
      };
    })
    .sort((a, b) => a.ingredient.localeCompare(b.ingredient));
};
