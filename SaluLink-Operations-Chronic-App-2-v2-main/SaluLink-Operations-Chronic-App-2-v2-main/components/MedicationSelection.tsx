'use client';

import { useState, useEffect } from 'react';
import { Pill, Check, X, TriangleAlert as AlertTriangle, Search } from 'lucide-react';
import { MedicineItem, SelectedMedication, MedicalPlan } from '@/types';
import { DataService } from '@/lib/dataService';

interface MedicationSelectionProps {
  condition: string;
  selectedPlan: MedicalPlan;
  medications: SelectedMedication[];
  onAddMedication: (medication: SelectedMedication) => void;
  onRemoveMedication: (index: number) => void;
  onSetPlan: (plan: MedicalPlan) => void;
  excludedMedications?: SelectedMedication[];
}

const MedicationSelection = ({
  condition,
  selectedPlan,
  medications,
  onAddMedication,
  onRemoveMedication,
  onSetPlan,
  excludedMedications = []
}: MedicationSelectionProps) => {
  const [availableMedications, setAvailableMedications] = useState<MedicineItem[]>([]);
  const [medicineClasses, setMedicineClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [view, setView] = useState<'classes' | 'medications'>('classes');

  const plans: MedicalPlan[] = ['Core', 'Priority', 'Saver', 'Executive', 'Comprehensive'];

  const isDiabetesCondition = condition === 'Diabetes mellitus Type 1' || condition === 'Diabetes mellitus Type 2';

  const insulinClasses = [
    'Anti-diabetic agents: Fast-acting Insulins',
    'Anti-diabetic agents: Intermediate-acting or long-acting combined with fast-acting Insulins (Biphasic)',
    'Anti-diabetic agents: Long-acting Insulins'
  ];

  const getInsulinLimit = () => {
    if (['Executive', 'Comprehensive'].includes(selectedPlan)) {
      return 720;
    }
    return 700;
  };

  const parseAmount = (cdaString: string): number => {
    const match = cdaString.match(/R\s*([\d,]+(?:\.\d{2})?)/);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ''));
    }
    return 0;
  };

  const calculateInsulinTotal = (medsToInclude: SelectedMedication[] = medications): number => {
    const allMeds = [...medsToInclude, ...excludedMedications];
    return allMeds
      .filter(med => insulinClasses.includes(med.medicineClass))
      .reduce((sum, med) => sum + parseAmount(med.cdaAmount), 0);
  };

  const isWarningEntry = (medicine: MedicineItem): boolean => {
    return medicine.medicineClass?.includes('***') ||
           medicine.medicineClass?.includes('Please note') ||
           medicine.activeIngredient?.includes('***') ||
           (!medicine.medicineNameAndStrength || medicine.medicineNameAndStrength.trim() === '');
  };

  useEffect(() => {
    const medicines = DataService.getMedicinesForCondition(condition);
    const filteredMedicines = medicines.filter(m => !isWarningEntry(m));
    setAvailableMedications(filteredMedicines);

    const classes = DataService.getUniqueMedicineClasses(condition);
    const filteredClasses = classes.filter(cls => !cls.includes('***') && !cls.includes('Please note'));
    setMedicineClasses(filteredClasses);
  }, [condition]);

  const filteredMedications = availableMedications.filter(medicine => {
    const matchesClass = !selectedClass || medicine.medicineClass === selectedClass;

    const matchesSearch = !searchTerm ||
      medicine.medicineNameAndStrength?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      medicine.activeIngredient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      medicine.medicineClass?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesClass && matchesSearch;
  });

  const getCdaForPlan = (medicine: MedicineItem): string => {
    if (['Core', 'Priority', 'Saver'].includes(selectedPlan)) {
      return medicine.cdaCore;
    }
    return medicine.cdaExecutive || medicine.cdaCore;
  };

  const handleSelectMedication = (medicine: MedicineItem) => {
    const isAlreadySelected = medications.some(
      m => m.medicineNameAndStrength === medicine.medicineNameAndStrength
    );

    const isExcluded = excludedMedications.some(
      m => m.medicineNameAndStrength === medicine.medicineNameAndStrength
    );

    if (isAlreadySelected || isExcluded) return;

    const isAllowed = DataService.isMedicationAllowedForPlan(medicine, selectedPlan);
    if (!isAllowed && medicine.planRestriction) {
      const { type, plans, originalText } = medicine.planRestriction;
      let message = '';
      
      if (type === 'only') {
        message = `⚠️ Plan Coverage Alert\n\nThis medication is not covered by the ${selectedPlan} plan.\n\n${originalText}\n\nThis medication is only available on: ${plans.join(', ')} plans.\n\nPlease either:\n• Select a different medication, OR\n• Change the patient's plan to one of the allowed plans`;
      } else if (type === 'not_available') {
        message = `⚠️ Plan Coverage Alert\n\nThis medication is not available on the ${selectedPlan} plan.\n\n${originalText}\n\nPlease either:\n• Select a different medication, OR\n• Change the patient's plan to access this medication`;
      }
      
      alert(message);
      return;
    }

    const newMedication: SelectedMedication = {
      medicineClass: medicine.medicineClass,
      activeIngredient: medicine.activeIngredient,
      medicineNameAndStrength: medicine.medicineNameAndStrength,
      cdaAmount: getCdaForPlan(medicine)
    };

    if (isDiabetesCondition && insulinClasses.includes(medicine.medicineClass)) {
      const currentInsulinTotal = calculateInsulinTotal();
      const medicationCost = parseAmount(newMedication.cdaAmount);
      const newTotal = currentInsulinTotal + medicationCost;
      const limit = getInsulinLimit();

      if (newTotal > limit) {
        alert(`Cannot add this insulin medication. It would exceed the monthly insulin limit of R${limit}. Current total: R${currentInsulinTotal.toFixed(2)}, This medication: R${medicationCost.toFixed(2)}, New total would be: R${newTotal.toFixed(2)}`);
        return;
      }
    }

    onAddMedication(newMedication);
  };

  const getClassStats = (cls: string) => {
    const classMeds = availableMedications.filter(m => m.medicineClass === cls);
    const total = classMeds.length;
    const available = classMeds.filter(m => DataService.isMedicationAllowedForPlan(m, selectedPlan)).length;
    const notCovered = total - available;
    const pct = total > 0 ? Math.round((available / total) * 100) : 0;
    return { total, available, notCovered, pct };
  };

  const allClassesStats = (() => {
    const total = availableMedications.length;
    const available = availableMedications.filter(m => DataService.isMedicationAllowedForPlan(m, selectedPlan)).length;
    return { total, available };
  })();

  const handleClassClick = (cls: string | null) => {
    setSelectedClass(cls);
    setSearchTerm('');
    setView('medications');
  };

  const handleBackToClasses = () => {
    setView('classes');
    setSelectedClass(null);
    setSearchTerm('');
  };

  return (
    <div className="space-y-6">
      {/* Plan Filter */}
      <div className="card">
        <h3 className="font-semibold text-lg mb-4">Medical Scheme Plan</h3>
        <div className="flex flex-wrap gap-2">
          {plans.map(plan => (
            <button
              key={plan}
              onClick={() => onSetPlan(plan)}
              className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                selectedPlan === plan ? 'brand-pill-active' : 'brand-pill-inactive'
              }`}
            >
              {plan}
            </button>
          ))}
        </div>
      </div>

      {/* Insulin Limit Warning for Diabetes */}
      {isDiabetesCondition && (
        <div className="card brand-info-box border-2">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">Insulin Monthly Limit</h3>
              <p className="text-sm text-blue-800 mb-3">
                Please note that an overall monthly limit applies to Insulins across the different Insulin classes.
                The overall monthly limit for KeyCare, Smart, Priority, Core and Saver plans is <strong>R700</strong>.
                The overall monthly limit for Executive and Comprehensive plans is <strong>R720</strong>.
              </p>
              <div className="bg-white rounded-lg p-3 border border-blue-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Current Insulin Total:</span>
                  <span className="text-lg font-bold text-blue-700">R{calculateInsulinTotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Plan Limit ({selectedPlan}):</span>
                  <span className="text-lg font-bold text-gray-900">R{getInsulinLimit().toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-blue-100">
                  <span className="text-sm font-medium text-gray-700">Remaining:</span>
                  <span className={`text-lg font-bold ${
                    (getInsulinLimit() - calculateInsulinTotal()) > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    R{(getInsulinLimit() - calculateInsulinTotal()).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Medicine Selection */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="brand-icon">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Medication Selection</h2>
            <p className="text-sm text-slate-500">
              Select medications for <span className="font-medium text-violet-600">{condition}</span>
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              className="input-field pl-10"
              placeholder="Search by medication name, active ingredient, or class..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value) setView('medications');
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Class Browser */}
        {view === 'classes' && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Filter by Medicine Class</p>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {/* All Classes card */}
              <button
                onClick={() => handleClassClick(null)}
                className="w-full text-left p-4 brand-card-selected hover:opacity-95 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">All Classes</p>
                    <p className="text-sm text-gray-500 mt-0.5">{allClassesStats.total} total medications</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{allClassesStats.available} available</p>
                  </div>
                </div>
              </button>

              {/* Individual class cards */}
              {medicineClasses.map(cls => {
                const { total, available, notCovered, pct } = getClassStats(cls);
                return (
                  <button
                    key={cls}
                    onClick={() => handleClassClick(cls)}
                    className="w-full text-left p-4 brand-card"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 pr-4">
                        <p className="font-semibold text-gray-900 leading-snug">{cls}</p>
                        <p className="text-sm text-gray-500 mt-1">{available} available</p>
                        {notCovered > 0 && (
                          <p className="text-sm text-orange-500 mt-0.5">{notCovered} not covered by {selectedPlan}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold text-gray-900">{pct}%</p>
                        <p className="text-xs text-gray-500">covered</p>
                      </div>
                    </div>
                    {notCovered > 0 && (
                      <div className="brand-progress-track mt-2">
                        <div className="brand-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Medication List for selected class */}
        {view === 'medications' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleBackToClasses}
                className="flex items-center gap-1 text-sm font-semibold brand-gradient-text hover:opacity-80"
              >
                <X className="w-4 h-4" />
                Back to classes
              </button>
              {selectedClass && (
                <span className="text-sm text-gray-500">/ {selectedClass}</span>
              )}
            </div>

            {(searchTerm || selectedClass) && (
              <div className="mb-3 brand-info-box">
                <p className="text-sm text-violet-800">
                  <strong>{filteredMedications.length}</strong> medication{filteredMedications.length !== 1 ? 's' : ''} found
                  {searchTerm && <span> matching &ldquo;<strong>{searchTerm}</strong>&rdquo;</span>}
                  {selectedClass && !searchTerm && <span> in <strong>{selectedClass}</strong></span>}
                </p>
              </div>
            )}

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filteredMedications.length === 0 && (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium mb-2">No medications found</p>
                  <p className="text-sm text-gray-500">Try adjusting your search criteria</p>
                </div>
              )}
              {filteredMedications.map((medicine, index) => {
                const isSelected = medications.some(
                  m => m.medicineNameAndStrength === medicine.medicineNameAndStrength
                );
                const isExcluded = excludedMedications.some(
                  m => m.medicineNameAndStrength === medicine.medicineNameAndStrength
                );
                const cdaAmount = getCdaForPlan(medicine);

                const isInsulin = isDiabetesCondition && insulinClasses.includes(medicine.medicineClass);
                const medicationCost = parseAmount(cdaAmount);
                const currentInsulinTotal = calculateInsulinTotal();
                const wouldExceedLimit = isInsulin && (currentInsulinTotal + medicationCost > getInsulinLimit());

                const isAllowedForPlan = DataService.isMedicationAllowedForPlan(medicine, selectedPlan);
                const isRestricted = !isAllowedForPlan;
                const isDisabled = isSelected || isExcluded || wouldExceedLimit || isRestricted;

                return (
                  <button
                    key={index}
                    onClick={() => handleSelectMedication(medicine)}
                    disabled={isDisabled}
                    className={`w-full text-left p-4 transition-all ${
                      isSelected
                        ? 'brand-card-selected cursor-not-allowed'
                        : isExcluded
                        ? 'border-2 border-violet-200 bg-violet-50/40 cursor-not-allowed'
                        : isRestricted
                        ? 'border-2 border-orange-200 bg-orange-50 cursor-not-allowed opacity-75'
                        : wouldExceedLimit
                        ? 'border-2 border-red-200 bg-red-50 cursor-not-allowed opacity-60'
                        : 'brand-card'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-semibold text-gray-900">
                            {medicine.medicineNameAndStrength}
                          </h4>
                          {isSelected && (
                            <span className="brand-badge-selected">Selected</span>
                          )}
                          {isExcluded && (
                            <span className="brand-badge">Already Prescribed</span>
                          )}
                          {isRestricted && medicine.planRestriction && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Not Covered
                            </span>
                          )}
                          {wouldExceedLimit && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">Exceeds Limit</span>
                          )}
                        </div>
                        <div className="space-y-0.5 text-sm">
                          <p className="text-gray-500">
                            <span className="font-medium text-gray-700">Class:</span> {medicine.medicineClass}
                          </p>
                          <p className="text-gray-500">
                            <span className="font-medium text-gray-700">Active Ingredient:</span> {medicine.activeIngredient}
                          </p>
                          <p className="text-violet-600 font-semibold mt-1">
                            CDA Amount: {cdaAmount}
                          </p>
                          {isRestricted && medicine.planRestriction && (
                            <p className="text-orange-600 text-xs mt-1">
                              {medicine.planRestriction.type === 'only'
                                ? `Available on: ${medicine.planRestriction.plans.join(', ')} plans only`
                                : `Not available on: ${medicine.planRestriction.plans.join(', ')} plan(s)`
                              }
                            </p>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="ml-4 brand-check">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                      {isRestricted && !isSelected && (
                        <div className="ml-4 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <X className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Medications */}
      {medications.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-lg mb-4">Selected Medications ({medications.length})</h3>
          <div className="space-y-3">
            {medications.map((med, index) => (
              <div key={index} className="p-4 brand-card-selected">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{med.medicineNameAndStrength}</p>
                    <p className="text-sm text-gray-600">{med.activeIngredient}</p>
                    <p className="text-sm text-violet-600 font-semibold">CDA: {med.cdaAmount}</p>
                  </div>
                  <button
                    onClick={() => onRemoveMedication(index)}
                    className="text-red-600 hover:text-red-700 p-2"
                    aria-label={`Remove ${med.medicineNameAndStrength}`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationSelection;
