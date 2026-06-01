import Papa from 'papaparse'; // TODO: Ensure 'papaparse' is installed with `npm install papaparse` and typing with `npm install --save-dev @types/papaparse`
import type { ChronicCondition, MedicineItem, TreatmentBasketItem, MedicalPlan, MedicalScheme } from '@/types';
import { normalizeConditionName } from '@/lib/conditionNames';

// Parse CSV data from public folder
export class DataService {
  private static chronicConditions: ChronicCondition[] = [];
  private static medicines: MedicineItem[] = [];
  private static treatmentBasket: TreatmentBasketItem[] = [];
  private static initialized = false;
  static activeScheme: MedicalScheme = 'discovery';

  static isSchemeDataAvailable(): boolean {
    return this.activeScheme === 'discovery' && this.initialized;
  }

  static setActiveScheme(scheme: MedicalScheme) {
    this.activeScheme = scheme;
    if (scheme !== 'discovery') {
      this.initialized = false;
    }
  }

  /**
   * Parse plan restrictions from medication name/description
   * Examples:
   * - "(Only Executive and Comprehensive plans)" -> { type: 'only', plans: ['Executive', 'Comprehensive'] }
   * - "(Not available on KeyCare plans)" -> ignored in this app (no KeyCare plan option)
   */
  private static sanitizeMedicationLabel(medicineNameAndStrength: string): string {
    return medicineNameAndStrength
      .replace(/\s*\(Not\s+available\s+on\s+KeyCare\s+plans?\)\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static parsePlanRestriction(medicineNameAndStrength: string): MedicineItem['planRestriction'] {
    // Check for "Only ... plans" restriction
    const onlyMatch = medicineNameAndStrength.match(/\(Only\s+(.+?)\s+plans?\)/i);
    if (onlyMatch) {
      const planText = onlyMatch[1].toLowerCase();
      const plans: MedicalPlan[] = [];
      
      if (planText.includes('executive')) plans.push('Executive');
      if (planText.includes('comprehensive')) plans.push('Comprehensive');
      if (planText.includes('core')) plans.push('Core');
      if (planText.includes('priority')) plans.push('Priority');
      if (planText.includes('saver')) plans.push('Saver');
      
      return {
        type: 'only',
        plans,
        originalText: onlyMatch[0]
      };
    }
    
    // Check for "Not available on ... plans" restriction
    const notAvailableMatch = medicineNameAndStrength.match(/\(Not\s+available\s+on\s+(.+?)\s+plans?\)/i);
    if (notAvailableMatch) {
      const planText = notAvailableMatch[1].toLowerCase();
      const plans: MedicalPlan[] = [];
      
      // Ignore KeyCare restrictions since KeyCare is not a selectable plan in this app.
      if (planText.includes('core')) plans.push('Core');
      if (planText.includes('priority')) plans.push('Priority');
      if (planText.includes('saver')) plans.push('Saver');
      if (planText.includes('executive')) plans.push('Executive');
      if (planText.includes('comprehensive')) plans.push('Comprehensive');

      if (plans.length === 0) return undefined;
      
      return {
        type: 'not_available',
        plans,
        originalText: notAvailableMatch[0]
      };
    }
    
    return undefined;
  }

  /**
   * Check if a medication is allowed for a specific plan
   */
  static isMedicationAllowedForPlan(medicine: MedicineItem, plan: MedicalPlan): boolean {
    if (!medicine.planRestriction) return true;
    
    const { type, plans } = medicine.planRestriction;
    
    if (type === 'only') {
      // Medication is ONLY available on specific plans
      return plans.includes(plan);
    } else if (type === 'not_available') {
      // Medication is NOT available on specific plans
      return !plans.includes(plan);
    }
    
    return true;
  }

  static async initialize(scheme: MedicalScheme = this.activeScheme) {
    this.activeScheme = scheme;
    if (scheme !== 'discovery') {
      this.initialized = true;
      this.chronicConditions = [];
      this.medicines = [];
      this.treatmentBasket = [];
      return;
    }
    if (this.initialized) return;

    try {
      // Add cache busting timestamp to force fresh CSV loads
      const cacheBuster = `?v=${Date.now()}`;
      
      // Load Chronic Conditions
      const chronicResponse = await fetch(`/Chronic Conditions.csv${cacheBuster}`);
      const chronicText = await chronicResponse.text();
      const chronicParsed = Papa.parse<any>(chronicText, { header: true });
      
      this.chronicConditions = chronicParsed.data
        .filter(row => row['CHRONIC CONDITIONS'] && row['ICD-Code'])
        .map(row => ({
          condition: row['CHRONIC CONDITIONS'],
          icdCode: row['ICD-Code'],
          icdDescription: row['ICD-Code Description'] || '',
        }));

      // Load Medicine List
      const medicineResponse = await fetch(`/Medicine List.csv${cacheBuster}`);
      const medicineText = await medicineResponse.text();
      const medicineParsed = Papa.parse<any>(medicineText, { header: true });
      
      this.medicines = medicineParsed.data
        .filter(row => row['CHRONIC DISEASE LIST CONDITION'])
        .map(row => {
          const rawMedicineNameAndStrength = row['MEDICINE NAME AND STRENGTH'] || '';
          const medicineNameAndStrength = this.sanitizeMedicationLabel(rawMedicineNameAndStrength);
          return {
            condition: row['CHRONIC DISEASE LIST CONDITION'],
            cdaCore: row['CDA FOR CORE, PRIORITY AND SAVER PLANS'] || '',
            cdaExecutive: row['CDA FOR EXECUTIVE AND COMPREHENSIVE PLANS'] || '',
            medicineClass: row['MEDICINE CLASS'] || '',
            activeIngredient: row['ACTIVE INGREDIENT'] || '',
            medicineNameAndStrength,
            formularyStatus: 'listed',
            planRestriction: this.parsePlanRestriction(rawMedicineNameAndStrength),
          };
        });

      // Load Treatment Basket
      const basketResponse = await fetch(`/Treatment Basket.csv${cacheBuster}`);
      const basketText = await basketResponse.text();
      const basketParsed = Papa.parse<any>(basketText, { header: true, skipEmptyLines: true });
      
      // Process treatment basket with proper column mapping
      let currentCondition = '';
      this.treatmentBasket = basketParsed.data
        .slice(1) // Skip description row
        .map((row: any) => {
          // Forward fill condition
          if (row['CONDITION']) {
            currentCondition = row['CONDITION'];
          }

          const item = {
            condition: currentCondition,
            diagnosticBasket: {
              description: row['DIAGNOSTIC BASKET'] || '',
              code: row['DIAGNOSTIC BASKET_1'] || '',
              covered: row['DIAGNOSTIC BASKET_2'] || '',
            },
            ongoingManagementBasket: {
              description: row['ONGOING MANAGEMENT BASKET'] || '',
              code: row['ONGOING MANAGEMENT BASKET_1'] || '',
              covered: row['ONGOING MANAGEMENT BASKET_2'] || '',
            },
            specialists: row[''] || '',
          };

          return item;
        })
        .filter(item => item.condition);

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing data service:', error);
      throw error;
    }
  }

  static getChronicConditions(): ChronicCondition[] {
    return this.chronicConditions;
  }

  private static conditionKey(condition: string): string {
    return normalizeConditionName(condition).toLowerCase();
  }

  static getConditionsByName(name: string): ChronicCondition[] {
    const key = this.conditionKey(name);
    return this.chronicConditions.filter((c) => c.condition.toLowerCase().includes(key));
  }

  static getIcdCodesForCondition(condition: string): ChronicCondition[] {
    const key = this.conditionKey(condition);
    return this.chronicConditions.filter(c => c.condition.toLowerCase() === key);
  }

  static getMedicinesForCondition(condition: string): MedicineItem[] {
    const key = this.conditionKey(condition);
    return this.medicines.filter(m => m.condition.toLowerCase() === key);
  }

  static getDiagnosticBasketForCondition(condition: string): TreatmentBasketItem[] {
    const key = this.conditionKey(condition);
    const items = this.treatmentBasket.filter(t => t.condition.toLowerCase() === key);

    const uniqueItems = new Map<string, TreatmentBasketItem>();

    items.forEach(item => {
      const description = item.diagnosticBasket.description.trim();
      const code = item.diagnosticBasket.code.trim();

      if (description && code) {
        const key = `${description}|${code}`;

        if (!uniqueItems.has(key)) {
          uniqueItems.set(key, item);
        }
      }
    });

    return Array.from(uniqueItems.values());
  }

  static getOngoingBasketForCondition(condition: string): TreatmentBasketItem[] {
    const key = this.conditionKey(condition);
    const items = this.treatmentBasket.filter(t => t.condition.toLowerCase() === key);

    const uniqueItems = new Map<string, TreatmentBasketItem>();

    items.forEach(item => {
      const description = item.ongoingManagementBasket.description.trim();
      const code = item.ongoingManagementBasket.code.trim();

      if (description && code) {
        const key = `${description}|${code}`;

        if (!uniqueItems.has(key)) {
          uniqueItems.set(key, item);
        } else {
          const existing = uniqueItems.get(key);
          const existingCovered = parseInt(existing?.ongoingManagementBasket.covered || '0');
          const currentCovered = parseInt(item.ongoingManagementBasket.covered || '0');

          if (currentCovered > existingCovered) {
            uniqueItems.set(key, item);
          }
        }
      }
    });

    return Array.from(uniqueItems.values());
  }

  static getTreatmentBasketForCondition(condition: string): TreatmentBasketItem[] {
    const key = this.conditionKey(condition);
    const items = this.treatmentBasket.filter(t => t.condition.toLowerCase() === key);

    const uniqueItems = new Map<string, TreatmentBasketItem>();

    items.forEach(item => {
      const description = item.ongoingManagementBasket.description.trim();
      const code = item.ongoingManagementBasket.code.trim();

      if (description && code) {
        const key = `${description}|${code}`;

        if (!uniqueItems.has(key)) {
          uniqueItems.set(key, item);
        } else {
          const existing = uniqueItems.get(key);
          const existingCovered = parseInt(existing?.ongoingManagementBasket.covered || '0');
          const currentCovered = parseInt(item.ongoingManagementBasket.covered || '0');

          if (currentCovered > existingCovered) {
            uniqueItems.set(key, item);
          }
        }
      }
    });

    return Array.from(uniqueItems.values());
  }

  static getUniqueMedicineClasses(condition: string): string[] {
    const medicines = this.getMedicinesForCondition(condition);
    const classes = medicines.map(m => m.medicineClass).filter(Boolean);
    return Array.from(new Set(classes));
  }
}

