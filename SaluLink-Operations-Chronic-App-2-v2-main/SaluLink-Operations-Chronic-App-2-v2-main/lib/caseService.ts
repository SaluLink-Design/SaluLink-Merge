import { supabase } from './supabase';
import { PatientCase, TreatmentItem, SelectedMedication } from '@/types';

export interface SaveCaseParams {
  patientName: string;
  patientId: string;
  patientEmail?: string;
  patientPhone?: string;
  medicalAidNumber?: string;
  clinicalNote: string;
  conditionName: string;
  icdCode: string;
  icdDescription: string;
  diagnosticTreatments: TreatmentItem[];
  ongoingTreatments: TreatmentItem[];
  medications: SelectedMedication[];
  medicationNote: string;
  plan: string;
  isFinalSave?: boolean;
}

export async function saveCaseToDatabase(params: SaveCaseParams) {
  try {
    const {
      patientName,
      patientId,
      patientEmail,
      patientPhone,
      medicalAidNumber,
      clinicalNote,
      conditionName,
      icdCode,
      icdDescription,
      diagnosticTreatments,
      ongoingTreatments,
      medications,
      medicationNote,
      plan,
      isFinalSave,
    } = params;

    const status = isFinalSave
      ? 'completed'
      : ongoingTreatments.length > 0
      ? 'ongoing'
      : diagnosticTreatments.length > 0
      ? 'diagnostic'
      : 'draft';

    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .insert({
        patient_name: patientName,
        patient_id: patientId,
        patient_email: patientEmail,
        patient_phone: patientPhone,
        medical_aid_number: medicalAidNumber,
        clinical_note: clinicalNote,
        condition_name: conditionName,
        icd_code: icdCode,
        icd_description: icdDescription,
        medication_note: medicationNote,
        plan: plan,
        status: status,
      })
      .select()
      .maybeSingle();

    if (caseError) {
      throw new Error(`Failed to save case: ${caseError.message}`);
    }

    if (!caseData) {
      throw new Error('Case was not created');
    }

    const caseId = caseData.id;

    if (diagnosticTreatments.length > 0) {
      const diagnosticRecords = diagnosticTreatments.map((treatment) => ({
        case_id: caseId,
        description: treatment.description,
        code: treatment.code,
        max_covered: treatment.maxCovered,
        times_completed: treatment.timesCompleted,
        documentation_notes: treatment.documentation?.notes || '',
      }));

      const { error: diagnosticError } = await supabase
        .from('case_diagnostic_treatments')
        .insert(diagnosticRecords);

      if (diagnosticError) {
        throw new Error(`Failed to save diagnostic treatments: ${diagnosticError.message}`);
      }
    }

    if (ongoingTreatments.length > 0) {
      const ongoingRecords = ongoingTreatments.map((treatment) => ({
        case_id: caseId,
        description: treatment.description,
        code: treatment.code,
        max_covered: treatment.maxCovered,
        times_completed: treatment.timesCompleted,
        documentation_notes: treatment.documentation?.notes || '',
      }));

      const { error: ongoingError } = await supabase
        .from('case_ongoing_treatments')
        .insert(ongoingRecords);

      if (ongoingError) {
        throw new Error(`Failed to save ongoing treatments: ${ongoingError.message}`);
      }
    }

    if (medications.length > 0) {
      const medicationRecords = medications.map((medication) => ({
        case_id: caseId,
        medicine_class: medication.medicineClass,
        active_ingredient: medication.activeIngredient,
        medicine_name_and_strength: medication.medicineNameAndStrength,
        cda_amount: medication.cdaAmount,
        note: medication.note || '',
        documentation_notes: medication.documentation?.notes || '',
      }));

      const { error: medicationError } = await supabase
        .from('case_medications')
        .insert(medicationRecords);

      if (medicationError) {
        throw new Error(`Failed to save medications: ${medicationError.message}`);
      }
    }

    return {
      success: true,
      caseId: caseId,
      message: 'Case saved successfully',
    };
  } catch (error) {
    console.error('Error saving case:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function getCaseById(caseId: string) {
  try {
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .maybeSingle();

    if (caseError) {
      throw new Error(`Failed to fetch case: ${caseError.message}`);
    }

    if (!caseData) {
      throw new Error('Case not found');
    }

    const { data: diagnosticData } = await supabase
      .from('case_diagnostic_treatments')
      .select('*')
      .eq('case_id', caseId);

    const { data: ongoingData } = await supabase
      .from('case_ongoing_treatments')
      .select('*')
      .eq('case_id', caseId);

    const { data: medicationData } = await supabase
      .from('case_medications')
      .select('*')
      .eq('case_id', caseId);

    return {
      success: true,
      case: caseData,
      diagnosticTreatments: diagnosticData || [],
      ongoingTreatments: ongoingData || [],
      medications: medicationData || [],
    };
  } catch (error) {
    console.error('Error fetching case:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function getAllCases() {
  try {
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch cases: ${error.message}`);
    }

    return {
      success: true,
      cases: data || [],
    };
  } catch (error) {
    console.error('Error fetching cases:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      cases: [],
    };
  }
}
