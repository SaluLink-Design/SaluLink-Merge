import { normalizeSelectedMedication } from '@/lib/medicationCoverage';
import type { SelectedMedication } from '@/types';

export const deduplicateMedications = (medications: SelectedMedication[]): SelectedMedication[] =>
  medications.map(normalizeSelectedMedication).reduce((acc: SelectedMedication[], current) => {
    const duplicate = acc.find(
      (item) => item.medicineNameAndStrength === current.medicineNameAndStrength
    );
    if (!duplicate) acc.push(current);
    return acc;
  }, []);

/** After a medication change, the active list is the new prescription — not baseline + new. */
export const resolveActiveMedicationsAfterChange = (
  baseline: SelectedMedication[],
  newMeds?: SelectedMedication[]
): SelectedMedication[] => {
  if (newMeds && newMeds.length > 0) {
    return deduplicateMedications(newMeds);
  }
  return baseline;
};
