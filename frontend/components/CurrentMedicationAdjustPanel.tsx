'use client';

import { useEffect, useState } from 'react';
import { SelectedMedication } from '@/types';
import { DataService } from '@/lib/dataService';
import {
  getStrengthOptionsForMed,
  loadCatalogueMedicinesForCondition,
  updateMedicationStrength,
} from '@/lib/medicationDoseAdjust';

interface CurrentMedicationAdjustPanelProps {
  condition: string;
  medications: SelectedMedication[];
  onChange: (medications: SelectedMedication[]) => void;
}

const CurrentMedicationAdjustPanel = ({
  condition,
  medications,
  onChange,
}: CurrentMedicationAdjustPanelProps) => {
  const [catalogueReady, setCatalogueReady] = useState(false);

  useEffect(() => {
    void DataService.initialize().then(() => setCatalogueReady(true));
  }, []);

  const catalogueMedicines = catalogueReady
    ? loadCatalogueMedicinesForCondition(condition)
    : [];

  const updateMed = (index: number, fields: Partial<SelectedMedication>) => {
    onChange(medications.map((med, i) => (i === index ? { ...med, ...fields } : med)));
  };

  const handleStrengthChange = (index: number, med: SelectedMedication, strength: string) => {
    if (!strength) return;
    updateMed(index, updateMedicationStrength(med, strength));
  };

  return (
    <div className="space-y-3">
      {medications.map((med, index) => {
        const strengthOptions = getStrengthOptionsForMed(med, catalogueMedicines);
        const hasStrengthPicker = strengthOptions.length > 1;

        return (
          <div key={index} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
            <p className="font-medium text-slate-900">{med.activeIngredient || 'Unknown ingredient'}</p>
            <p className="text-sm text-slate-600 mt-0.5">
              {med.brandName || med.medicineNameAndStrength}
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Strength / formulation</label>
                {hasStrengthPicker ? (
                  <select
                    className="input-field text-sm w-full"
                    value={med.selectedStrength || ''}
                    onChange={(e) => handleStrengthChange(index, med, e.target.value)}
                  >
                    <option value="" disabled>
                      Choose strength…
                    </option>
                    {strengthOptions.map((strength) => (
                      <option key={strength} value={strength}>
                        {strength}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="input-field text-sm"
                    value={med.selectedStrength || med.medicineNameAndStrength}
                    onChange={(e) =>
                      updateMed(index, {
                        selectedStrength: e.target.value,
                        medicineNameAndStrength: e.target.value,
                      })
                    }
                    placeholder="e.g. 200mg"
                  />
                )}
              </div>
              <div>
                <label className="label text-xs">Dosage schedule</label>
                <input
                  type="text"
                  className="input-field text-sm"
                  placeholder="e.g. 1 tablet twice daily"
                  value={med.dosage ?? ''}
                  onChange={(e) => updateMed(index, { dosage: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label text-xs">Patient instructions</label>
                <textarea
                  className="textarea-field text-sm"
                  rows={2}
                  placeholder="e.g. Take with food, avoid alcohol, do not stop abruptly…"
                  value={med.note ?? ''}
                  onChange={(e) => updateMed(index, { note: e.target.value })}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CurrentMedicationAdjustPanel;
