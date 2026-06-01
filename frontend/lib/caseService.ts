import { supabase } from './supabase';
import { PatientCase, TreatmentItem, SelectedMedication, DeliveryStatus } from '@/types';
import { normalizeSelectedMedication } from './medicationCoverage';

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
  workspaceId?: string;
  createdBy?: string;
  deliveryStatus?: DeliveryStatus;
  doctorApproved?: boolean;
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
      workspaceId,
      createdBy,
      deliveryStatus,
      doctorApproved,
    } = params;

    const status = isFinalSave
      ? 'completed'
      : ongoingTreatments.length > 0
      ? 'ongoing'
      : diagnosticTreatments.length > 0
      ? 'diagnostic'
      : 'draft';

    const insertPayload: Record<string, unknown> = {
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
    };

    if (workspaceId) insertPayload.workspace_id = workspaceId;
    if (createdBy) insertPayload.created_by = createdBy;
    if (deliveryStatus) insertPayload.delivery_status = deliveryStatus;
    if (doctorApproved !== undefined) insertPayload.doctor_approved = doctorApproved;

    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .insert(insertPayload)
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
      const normalizedMeds = medications.map((medication) => normalizeSelectedMedication(medication));
      const medicationRecords = normalizedMeds.map((medication) => ({
        case_id: caseId,
        medicine_class: medication.medicineClass,
        active_ingredient: medication.activeIngredient,
        medicine_name_and_strength: medication.medicineNameAndStrength,
        cda_amount: medication.cdaAmount,
        formulary_status: medication.formularyStatus,
        cda_cap_amount: medication.cdaCapAmount ?? null,
        coverage_decision: medication.coverageDecision,
        copay_risk: medication.copayRisk,
        coverage_note: medication.coverageNote,
        unlisted_clinical_rationale: medication.unlistedClinicalRationale || '',
        note: medication.note || '',
        documentation_notes: medication.documentation?.notes || '',
      }));

      let { error: medicationError } = await supabase
        .from('case_medications')
        .insert(medicationRecords);

      // Backward compatibility for databases without the new medication coverage columns.
      if (medicationError?.message?.toLowerCase().includes('column')) {
        const fallbackRecords = normalizedMeds.map((medication) => ({
          case_id: caseId,
          medicine_class: medication.medicineClass,
          active_ingredient: medication.activeIngredient,
          medicine_name_and_strength: medication.medicineNameAndStrength,
          cda_amount: medication.cdaAmount,
          note: medication.note || '',
          documentation_notes: medication.documentation?.notes || '',
        }));

        const fallback = await supabase.from('case_medications').insert(fallbackRecords);
        medicationError = fallback.error;
      }

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

    const normalizedMedications: SelectedMedication[] =
      (medicationData || []).map((medication: any) =>
        normalizeSelectedMedication({
          medicineClass: medication.medicine_class || '',
          activeIngredient: medication.active_ingredient || '',
          medicineNameAndStrength: medication.medicine_name_and_strength || '',
          cdaAmount: medication.cda_amount || '',
          formularyStatus: medication.formulary_status ?? 'listed',
          cdaCapAmount: medication.cda_cap_amount ?? undefined,
          coverageDecision: medication.coverage_decision ?? undefined,
          copayRisk: medication.copay_risk ?? undefined,
          coverageNote: medication.coverage_note ?? undefined,
          unlistedClinicalRationale: medication.unlisted_clinical_rationale || undefined,
          note: medication.note || '',
          documentation: {
            notes: medication.documentation_notes || '',
            images: [],
          },
        })
      );

    return {
      success: true,
      case: caseData,
      diagnosticTreatments: diagnosticData || [],
      ongoingTreatments: ongoingData || [],
      medications: normalizedMedications,
    };
  } catch (error) {
    console.error('Error fetching case:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function updateCaseDeliveryStatus(
  caseId: string,
  deliveryStatus: DeliveryStatus,
  doctorApproved?: boolean
) {
  const updates: Record<string, unknown> = {
    delivery_status: deliveryStatus,
    updated_at: new Date().toISOString(),
  };
  if (doctorApproved !== undefined) {
    updates.doctor_approved = doctorApproved;
  }

  const { error } = await supabase.from('cases').update(updates).eq('id', caseId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function getAllCases(workspaceId?: string) {
  try {
    let query = supabase.from('cases').select('*').order('created_at', { ascending: false });
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    const { data, error } = await query;

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
