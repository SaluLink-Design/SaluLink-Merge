import { DataService } from '@/lib/dataService';
import { formatMedicineLabel, parseMedicineLabel } from '@/lib/medicineStrength';
import type { MedicineItem, SelectedMedication } from '@/types';

export const cloneMedications = (meds: SelectedMedication[]): SelectedMedication[] =>
  meds.map((med) => ({ ...med }));

export const getStrengthOptionsForMed = (
  med: SelectedMedication,
  catalogueMedicines: MedicineItem[]
): string[] => {
  if (med.catalogueLabel) {
    return parseMedicineLabel(med.catalogueLabel).strengths;
  }
  const match = catalogueMedicines.find(
    (item) =>
      item.medicineNameAndStrength === med.medicineNameAndStrength ||
      parseMedicineLabel(item.medicineNameAndStrength).brandName === med.brandName ||
      item.activeIngredient === med.activeIngredient
  );
  return match ? parseMedicineLabel(match.medicineNameAndStrength).strengths : [];
};

export const updateMedicationStrength = (
  med: SelectedMedication,
  strength: string
): SelectedMedication => {
  const brandName =
    med.brandName ||
    parseMedicineLabel(med.catalogueLabel || med.medicineNameAndStrength).brandName;
  return {
    ...med,
    selectedStrength: strength,
    medicineNameAndStrength: formatMedicineLabel(brandName, strength),
  };
};

export const medicationRegimenChanged = (
  baseline: SelectedMedication[],
  updated: SelectedMedication[]
): boolean => {
  if (baseline.length !== updated.length) return true;
  return baseline.some((base, index) => {
    const next = updated[index];
    if (!next) return true;
    return (
      base.medicineNameAndStrength !== next.medicineNameAndStrength ||
      base.selectedStrength !== next.selectedStrength ||
      (base.dosage ?? '') !== (next.dosage ?? '') ||
      (base.note ?? '') !== (next.note ?? '')
    );
  });
};

export const loadCatalogueMedicinesForCondition = (condition: string): MedicineItem[] => {
  const medicines = DataService.getMedicinesForCondition(condition);
  return medicines.filter(
    (m) =>
      !m.medicineClass?.includes('***') &&
      !m.medicineClass?.includes('Please note') &&
      !m.activeIngredient?.includes('***') &&
      Boolean(m.medicineNameAndStrength?.trim())
  );
};
