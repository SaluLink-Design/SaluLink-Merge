'use client';

import { useState, useEffect, useMemo } from 'react';
import { Pill, Check, X, TriangleAlert as AlertTriangle, Search, ArrowLeft } from 'lucide-react';
import { MedicineItem, SelectedMedication, MedicalPlan, BenefitState } from '@/types';
import { DataService } from '@/lib/dataService';
import { buildCoverageDecision, parseCdaAmount } from '@/lib/medicationCoverage';
import { buildIngredientMedicationGroups, getCdaForPlan } from '@/lib/ingredientMedicationGroups';
import {
  formatMedicineLabel,
  parseMedicineLabel,
  resolveSelectedStrength,
} from '@/lib/medicineStrength';
import { fundingSourceLabel, isWorkflowA } from '@/lib/benefitState';
import FundingSourceBadge from '@/components/FundingSourceBadge';

interface MedicationSelectionProps {
  condition: string;
  selectedPlan: MedicalPlan;
  benefitState?: BenefitState | null;
  medications: SelectedMedication[];
  onAddMedication: (medication: SelectedMedication) => void;
  onRemoveMedication: (index: number) => void;
  onSetPlan?: (plan: MedicalPlan) => void;
  excludedMedications?: SelectedMedication[];
  showSection12Fields?: boolean;
  /** Referral-only: capture directions for the patient (stored on `note`). */
  showPatientInstructions?: boolean;
  onUpdateSection12?: (
    index: number,
    fields: Partial<
      Pick<
        SelectedMedication,
        | 'dosage'
        | 'durationUsed'
        | 'dateFirstDiagnosed'
        | 'selectedStrength'
        | 'medicineNameAndStrength'
        | 'note'
      >
    >
  ) => void;
}

const MedicationSelection = ({
  condition,
  selectedPlan,
  benefitState = 'unregistered',
  medications,
  onAddMedication,
  onRemoveMedication,
  excludedMedications = [],
  showSection12Fields = false,
  showPatientInstructions = false,
  onUpdateSection12,
}: MedicationSelectionProps) => {
  const resolvedBenefitState = benefitState ?? 'unregistered';
  const [availableMedications, setAvailableMedications] = useState<MedicineItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedIngredientKey, setSelectedIngredientKey] = useState<string | null>(null);

  const isDiabetesCondition =
    condition === 'Diabetes Mellitus Type 1' ||
    condition === 'Diabetes Mellitus Type 2' ||
    condition === 'Diabetes mellitus Type 1' ||
    condition === 'Diabetes mellitus Type 2';

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

  const calculateInsulinTotal = (medsToInclude: SelectedMedication[] = medications): number => {
    const allMeds = [...medsToInclude, ...excludedMedications];
    return allMeds
      .filter(med => insulinClasses.includes(med.medicineClass))
      .reduce((sum, med) => sum + (parseCdaAmount(med.cdaAmount) ?? 0), 0);
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
  }, [condition]);

  const ingredientGroups = useMemo(
    () => buildIngredientMedicationGroups(availableMedications, selectedPlan),
    [availableMedications, selectedPlan]
  );

  const filteredIngredientGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return ingredientGroups;

    return ingredientGroups.filter((group) => {
      if (group.ingredient.toLowerCase().includes(query)) return true;
      return group.brands.some((brand) =>
        `${brand.medicineNameAndStrength} ${brand.medicineClass} ${brand.activeIngredient}`
          .toLowerCase()
          .includes(query)
      );
    });
  }, [ingredientGroups, searchTerm]);

  const findMedicationIndex = (medicine: MedicineItem): number => {
    const parsed = parseMedicineLabel(medicine.medicineNameAndStrength);
    const byCatalogue = medications.findIndex((med) => med.catalogueLabel === parsed.catalogueLabel);
    if (byCatalogue >= 0) return byCatalogue;
    return medications.findIndex((med) => med.medicineNameAndStrength === medicine.medicineNameAndStrength);
  };

  const isMedicationSelected = (medicine: MedicineItem, strength?: string) => {
    const index = findMedicationIndex(medicine);
    if (index < 0) return false;
    if (!strength) return true;
    return medications[index].selectedStrength === strength;
  };

  const getSelectedStrengthForCatalogue = (catalogueLabel: string): string | undefined =>
    medications.find((med) => med.catalogueLabel === catalogueLabel)?.selectedStrength;

  const removeMedicationForBrand = (medicine: MedicineItem) => {
    const index = findMedicationIndex(medicine);
    if (index >= 0) onRemoveMedication(index);
  };

  const addMedicationWithStrength = (medicine: MedicineItem, strength: string) => {
    const parsed = parseMedicineLabel(medicine.medicineNameAndStrength);
    const resolvedStrength = strength || resolveSelectedStrength(parsed);
    const brandName = parsed.brandName;
    const displayLabel = resolvedStrength
      ? formatMedicineLabel(brandName, resolvedStrength)
      : brandName || medicine.medicineNameAndStrength;

    const isAlreadySelected = isMedicationSelected(medicine, resolvedStrength);
    const isExcluded = excludedMedications.some(
      (m) => m.medicineNameAndStrength === displayLabel || m.catalogueLabel === parsed.catalogueLabel
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

    const coverage = buildCoverageDecision(medicine, selectedPlan, resolvedBenefitState);
    let unlistedClinicalRationale: string | undefined;
    if (coverage.formularyStatus === 'unlisted') {
      const rationale = window.prompt(
        'This medication is unlisted and may trigger patient co-payment above CDA cap. Enter a brief clinical rationale to proceed:'
      );
      if (!rationale?.trim()) {
        alert('Clinical rationale is required for unlisted medications.');
        return;
      }
      unlistedClinicalRationale = rationale.trim();
    }

    const newMedication: SelectedMedication = {
      medicineClass: medicine.medicineClass,
      activeIngredient: medicine.activeIngredient,
      medicineNameAndStrength: displayLabel,
      brandName,
      selectedStrength: resolvedStrength || undefined,
      catalogueLabel: parsed.catalogueLabel,
      cdaAmount: getCdaForPlan(medicine, selectedPlan),
      ...coverage,
      unlistedClinicalRationale,
    };

    if (isDiabetesCondition && insulinClasses.includes(medicine.medicineClass)) {
      const currentInsulinTotal = calculateInsulinTotal();
      const medicationCost = parseCdaAmount(newMedication.cdaAmount) ?? 0;
      const newTotal = currentInsulinTotal + medicationCost;
      const limit = getInsulinLimit();

      if (newTotal > limit) {
        alert(`Cannot add this insulin medication. It would exceed the monthly insulin limit of R${limit}. Current total: R${currentInsulinTotal.toFixed(2)}, This medication: R${medicationCost.toFixed(2)}, New total would be: R${newTotal.toFixed(2)}`);
        return;
      }
    }

    onAddMedication(newMedication);
  };

  const getStrengthOptionsForMedication = (med: SelectedMedication): string[] => {
    if (med.catalogueLabel) {
      return parseMedicineLabel(med.catalogueLabel).strengths;
    }
    const match = availableMedications.find(
      (item) =>
        item.medicineNameAndStrength === med.medicineNameAndStrength ||
        parseMedicineLabel(item.medicineNameAndStrength).brandName === med.brandName
    );
    return match ? parseMedicineLabel(match.medicineNameAndStrength).strengths : [];
  };

  const handleSelectedStrengthChange = (
    index: number,
    med: SelectedMedication,
    strength: string
  ) => {
    if (!strength || !onUpdateSection12) return;
    const brandName =
      med.brandName ||
      parseMedicineLabel(med.catalogueLabel || med.medicineNameAndStrength).brandName;
    onUpdateSection12(index, {
      selectedStrength: strength,
      medicineNameAndStrength: formatMedicineLabel(brandName, strength),
    });
  };

  const handleBrandCardClick = (medicine: MedicineItem) => {
    const parsed = parseMedicineLabel(medicine.medicineNameAndStrength);
    const isSelected = isMedicationSelected(medicine);
    const isExcluded = excludedMedications.some(
      (m) =>
        m.catalogueLabel === parsed.catalogueLabel ||
        m.medicineNameAndStrength === medicine.medicineNameAndStrength
    );
    const isAllowedForPlan = DataService.isMedicationAllowedForPlan(medicine, selectedPlan);
    const isRestricted = !isAllowedForPlan;
    const isInsulin = isDiabetesCondition && insulinClasses.includes(medicine.medicineClass);
    if (isInsulin && !isSelected) {
      const medicationCost = parseCdaAmount(getCdaForPlan(medicine, selectedPlan)) ?? 0;
      if (calculateInsulinTotal() + medicationCost > getInsulinLimit()) {
        return;
      }
    }

    if (isExcluded || isRestricted) return;

    if (isSelected) {
      removeMedicationForBrand(medicine);
      return;
    }

    addMedicationWithStrength(medicine, resolveSelectedStrength(parsed));
  };

  const selectedIngredientGroup = useMemo(
    () => ingredientGroups.find((group) => group.key === selectedIngredientKey) ?? null,
    [ingredientGroups, selectedIngredientKey]
  );

  return (
    <div className="space-y-6">
      {isWorkflowA(resolvedBenefitState) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 font-medium">
            Current expected funding: day-to-day or MSA until CIB is approved.
          </p>
        </div>
      )}

      {/* Plan from intake — read-only; medications already filtered for this plan */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Medical scheme plan (from intake)</p>
        <p className="text-sm font-semibold text-slate-900 mt-1">{selectedPlan}</p>
        <p className="text-xs text-slate-500 mt-1">
          Medications below are filtered for coverage on this plan.
        </p>
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
                The overall monthly limit for Priority, Core and Saver plans is <strong>R700</strong>.
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
              placeholder="Search by active ingredient, brand name, or class..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

        {!selectedIngredientGroup ? (
          <>
            <div className="mb-3 brand-info-box">
              <p className="text-sm text-violet-800">
                <strong>{filteredIngredientGroups.length}</strong> ingredient
                {filteredIngredientGroups.length !== 1 ? 's' : ''} found
                {searchTerm && <span> matching &ldquo;<strong>{searchTerm}</strong>&rdquo;</span>}
              </p>
            </div>

            <div className="space-y-3 max-h-[540px] overflow-y-auto">
              {filteredIngredientGroups.length === 0 && (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium mb-2">No ingredients found</p>
                  <p className="text-sm text-gray-500">Try adjusting your search criteria</p>
                </div>
              )}

              {filteredIngredientGroups.map((group) => {
                const hasBlockedOptions = group.availabilitySummary !== 'all_available';
                const coverageBadgeClass = hasBlockedOptions
                  ? 'bg-violet-100 text-violet-700'
                  : group.coverageSummary === 'all_listed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : group.coverageSummary === 'all_unlisted'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-violet-100 text-violet-700';
                const coverageLabel = `${group.availablePercent}% available`;

                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setSelectedIngredientKey(group.key)}
                    className="w-full text-left p-4 brand-card hover:border-[#6366f1]/45"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-semibold text-gray-900">{group.ingredient}</h4>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${coverageBadgeClass}`}>
                            {coverageLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {group.brands.length} brand option{group.brands.length !== 1 ? 's' : ''}
                        </p>
                        {hasBlockedOptions && (
                          <p className="text-xs text-violet-700 mt-1">
                            {group.availableCount}/{group.totalCount} brands available on {selectedPlan}.
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIngredientKey(null);
                  }}
                  className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to ingredients
                </button>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">
                  {selectedIngredientGroup.ingredient}
                </h3>
              </div>
              <span className="text-xs text-slate-500 mt-1">
                {selectedIngredientGroup.brands.length} brand option
                {selectedIngredientGroup.brands.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {selectedIngredientGroup.brands.map((medicine, index) => {
                const parsed = parseMedicineLabel(medicine.medicineNameAndStrength);
                const selectedStrength = getSelectedStrengthForCatalogue(parsed.catalogueLabel);
                const isSelected = isMedicationSelected(medicine);
                const hasMultipleStrengths = parsed.strengths.length > 1;
                const isExcluded = excludedMedications.some(
                  (m) =>
                    m.catalogueLabel === parsed.catalogueLabel ||
                    m.medicineNameAndStrength === medicine.medicineNameAndStrength
                );
                const cdaAmount = getCdaForPlan(medicine, selectedPlan);
                const coverage = buildCoverageDecision(medicine, selectedPlan, resolvedBenefitState);
                const isInsulin =
                  isDiabetesCondition && insulinClasses.includes(medicine.medicineClass);
                const medicationCost = parseCdaAmount(cdaAmount) ?? 0;
                const currentInsulinTotal = calculateInsulinTotal();
                const wouldExceedLimit =
                  isInsulin && !isSelected && currentInsulinTotal + medicationCost > getInsulinLimit();
                const isAllowedForPlan = DataService.isMedicationAllowedForPlan(medicine, selectedPlan);
                const isRestricted = !isAllowedForPlan;
                const isDisabled = isExcluded || wouldExceedLimit || isRestricted;

                return (
                  <div
                    key={`${selectedIngredientGroup.key}-${medicine.medicineNameAndStrength}-${index}`}
                    className={`rounded-xl border transition-all ${
                      isSelected
                        ? 'border-emerald-200 bg-emerald-50'
                        : isExcluded
                          ? 'border-violet-200 bg-violet-50/40'
                          : isRestricted
                            ? 'border-orange-200 bg-orange-50 opacity-80'
                            : wouldExceedLimit
                              ? 'border-red-200 bg-red-50 opacity-80'
                              : 'border-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleBrandCardClick(medicine)}
                      disabled={isDisabled}
                      className={`w-full text-left p-3 rounded-xl transition-all ${
                        isDisabled
                          ? 'cursor-not-allowed'
                          : 'cursor-pointer hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-slate-900">{parsed.brandName}</p>
                            {parsed.strengths.length === 1 && (
                              <span className="text-xs text-slate-500">{parsed.strengths[0]}</span>
                            )}
                            {hasMultipleStrengths && !isSelected && (
                              <span className="text-xs text-slate-500">
                                {parsed.strengths.length} strengths
                              </span>
                            )}
                            {isSelected && (
                              <span className="brand-badge-selected">
                                {selectedStrength ? `Selected ${selectedStrength}` : 'Selected'}
                              </span>
                            )}
                            {isExcluded && (
                              <span className="brand-badge">Already Prescribed</span>
                            )}
                            {coverage.formularyStatus === 'unlisted' && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                                Cap-limited
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            Class: {medicine.medicineClass}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Ingredient: {medicine.activeIngredient}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {coverage.fundingSource && (
                              <FundingSourceBadge source={coverage.fundingSource} compact />
                            )}
                          </div>
                          {coverage.fundingLagWarning && (
                            <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                              {coverage.fundingLagWarning}
                            </p>
                          )}
                          {coverage.cibFundingNote && (
                            <p className="text-orange-700 text-xs mt-1">{coverage.cibFundingNote}</p>
                          )}
                          {coverage.copayRisk && (
                            <p className="text-amber-700 text-xs mt-1">
                              Co-pay risk: patient may pay above CDA cap.
                            </p>
                          )}
                          {isRestricted && medicine.planRestriction && (
                            <p className="text-orange-600 text-xs mt-1">
                              {medicine.planRestriction.type === 'only'
                                ? `Available on: ${medicine.planRestriction.plans.join(', ')} only`
                                : `Not available on: ${medicine.planRestriction.plans.join(', ')}`}
                            </p>
                          )}
                          {isRestricted && !medicine.planRestriction && (
                            <p className="text-orange-600 text-xs mt-1">
                              Not available on selected plan.
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 mt-1">
                          {isSelected && (
                            <div className="brand-check">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
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
                    <p className="font-medium text-gray-900">{med.activeIngredient || 'Unknown ingredient'}</p>
                    <p className="text-sm text-gray-600">
                      {med.brandName || med.medicineNameAndStrength}
                      {med.selectedStrength ? (
                        <span className="text-slate-800 font-medium"> · {med.selectedStrength}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Class: {med.medicineClass}</p>
                    <p className="text-xs text-slate-600 mt-1">{med.coverageNote}</p>
                    {med.fundingSource && (
                      <p className="text-xs text-slate-600 mt-1">
                        Expected funding: {fundingSourceLabel[med.fundingSource]}
                      </p>
                    )}
                    {med.fundingLagWarning && (
                      <p className="text-xs text-amber-700 mt-1">{med.fundingLagWarning}</p>
                    )}
                    {med.cibFundingNote && (
                      <p className="text-xs text-orange-700 mt-1">{med.cibFundingNote}</p>
                    )}
                    {med.copayRisk && (
                      <p className="text-xs text-amber-700 mt-1">
                        Co-pay risk if scheme payment exceeds cap.
                      </p>
                    )}
                    {med.unlistedClinicalRationale && (
                      <p className="text-xs text-slate-500 mt-1">
                        Rationale: {med.unlistedClinicalRationale}
                      </p>
                    )}
                    {showSection12Fields && onUpdateSection12 && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-200 pt-3">
                        {(() => {
                          const strengthOptions = getStrengthOptionsForMedication(med);
                          const hasStrengthPicker = strengthOptions.length > 1;

                          return (
                            <div>
                              <label
                                htmlFor={`dosage-${index}`}
                                className="block text-xs font-medium text-slate-600 mb-1"
                              >
                                Dosage
                              </label>
                              {hasStrengthPicker ? (
                                <select
                                  id={`dosage-${index}`}
                                  className="input-field text-sm w-full"
                                  value={med.selectedStrength || ''}
                                  onChange={(e) =>
                                    handleSelectedStrengthChange(index, med, e.target.value)
                                  }
                                >
                                  <option value="" disabled>
                                    Choose dosage…
                                  </option>
                                  {strengthOptions.map((strength) => (
                                    <option key={strength} value={strength}>
                                      {strength}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  id={`dosage-${index}`}
                                  type="text"
                                  className="input-field text-sm bg-slate-50"
                                  value={med.selectedStrength || strengthOptions[0] || '—'}
                                  readOnly
                                />
                              )}
                            </div>
                          );
                        })()}
                        <div>
                          <label
                            htmlFor={`duration-${index}`}
                            className="block text-xs font-medium text-slate-600 mb-1"
                          >
                            Duration used
                          </label>
                          <input
                            id={`duration-${index}`}
                            type="text"
                            className="input-field text-sm"
                            placeholder="e.g. 6 months"
                            value={med.durationUsed ?? ''}
                            onChange={(e) =>
                              onUpdateSection12(index, { durationUsed: e.target.value })
                            }
                          />
                        </div>
                        {showPatientInstructions && (
                          <div className="sm:col-span-2">
                            <label
                              htmlFor={`instructions-${index}`}
                              className="block text-xs font-medium text-slate-600 mb-1"
                            >
                              Patient instructions
                            </label>
                            <textarea
                              id={`instructions-${index}`}
                              className="textarea-field text-sm"
                              rows={2}
                              placeholder="e.g. Take with food, avoid alcohol, do not stop abruptly…"
                              value={med.note ?? ''}
                              onChange={(e) =>
                                onUpdateSection12(index, { note: e.target.value })
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mr-2 mt-1">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        med.formularyStatus === 'listed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {med.formularyStatus === 'listed' ? 'Listed' : 'Unlisted'}
                    </span>
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
