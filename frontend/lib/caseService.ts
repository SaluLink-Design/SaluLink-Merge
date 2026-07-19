import { supabase } from './supabase';
import { PatientCase, TreatmentItem, SelectedMedication, DeliveryStatus } from '@/types';
import { normalizeSelectedMedication } from './medicationCoverage';

function mapMedicationRow(medication: Record<string, unknown>): SelectedMedication {
  return normalizeSelectedMedication({
    medicineClass: (medication.medicine_class as string) || '',
    activeIngredient: (medication.active_ingredient as string) || '',
    medicineNameAndStrength: (medication.medicine_name_and_strength as string) || '',
    cdaAmount: (medication.cda_amount as string) || '',
    formularyStatus: (medication.formulary_status as 'listed' | 'unlisted') ?? 'listed',
    cdaCapAmount: (medication.cda_cap_amount as number | null) ?? undefined,
    coverageDecision: medication.coverage_decision as SelectedMedication['coverageDecision'],
    copayRisk: medication.copay_risk as boolean | undefined,
    coverageNote: (medication.coverage_note as string) ?? undefined,
    unlistedClinicalRationale: (medication.unlisted_clinical_rationale as string) || undefined,
    note: (medication.note as string) || '',
    documentation: {
      notes: (medication.documentation_notes as string) || '',
      images: [],
    },
  });
}

export interface SaveCaseParams {
  /**
   * Local Zustand case id (now a real UUID — see createCaseId in
   * lib/patientPortfolio.ts). When provided, this is upserted as the
   * Supabase row's primary key so the local id and the DB id are the same
   * value from the first save onward — required for case_referrals.case_id
   * (and any other case-scoped feature) to ever resolve correctly.
   */
  caseId?: string;
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
  diagnosisDate?: string;
}

export async function saveCaseToDatabase(params: SaveCaseParams) {
  try {
    const {
      caseId: explicitCaseId,
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
      diagnosisDate,
    } = params;

    const status = isFinalSave
      ? 'completed'
      : ongoingTreatments.length > 0
      ? 'ongoing'
      : diagnosticTreatments.length > 0
      ? 'diagnostic'
      : 'draft';

    if (!workspaceId) {
      return {
        success: false,
        error: 'Practice workspace is not ready. Cannot save case without workspace scope.',
      };
    }

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
      workspace_id: workspaceId,
    };
    if (createdBy) insertPayload.created_by = createdBy;
    if (deliveryStatus) insertPayload.delivery_status = deliveryStatus;
    if (doctorApproved !== undefined) insertPayload.doctor_approved = doctorApproved;
    if (diagnosisDate) insertPayload.diagnosis_date = diagnosisDate;

    let caseData: Record<string, any> | null = null;
    let caseError: { message: string } | null = null;

    if (explicitCaseId) {
      // Referral recipients can update the shared case, but must never move
      // ownership from the GP's workspace to their own workspace during an
      // upsert. Preserve the existing owner whenever this row already exists.
      const { data: existingCase } = await supabase
        .from('cases')
        .select('workspace_id')
        .eq('id', explicitCaseId)
        .maybeSingle();
      if (existingCase?.workspace_id) {
        insertPayload.workspace_id = existingCase.workspace_id;
      }

      // Upsert so repeat saves of the same in-progress case update one row
      // instead of creating duplicates, and the id is pinned to the value
      // already held in local state (and shared via referral links).
      ({ data: caseData, error: caseError } = await supabase
        .from('cases')
        .upsert({ id: explicitCaseId, ...insertPayload }, { onConflict: 'id' })
        .select()
        .maybeSingle());
    } else {
      ({ data: caseData, error: caseError } = await supabase
        .from('cases')
        .insert(insertPayload)
        .select()
        .maybeSingle());
    }

    if (caseError) {
      throw new Error(`Failed to save case: ${caseError.message}`);
    }

    if (!caseData) {
      throw new Error('Case was not created');
    }

    const caseId = caseData.id;

    // Upserts replace the whole row but child tables are append-only inserts
    // below, so clear out prior children first to avoid duplicating them on
    // every intermediate save of the same case.
    if (explicitCaseId) {
      await Promise.all([
        supabase.from('case_diagnostic_treatments').delete().eq('case_id', caseId),
        supabase.from('case_ongoing_treatments').delete().eq('case_id', caseId),
        supabase.from('case_medications').delete().eq('case_id', caseId),
      ]);
    }

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
      (medicationData || []).map((medication: Record<string, unknown>) => mapMedicationRow(medication));

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

// ---------------------------------------------------------------------------
// Referral persistence
// ---------------------------------------------------------------------------

export type CareOwnership = 'pending_decision' | 'gp_retained' | 'specialist_accepted';

export interface SaveReferralParams {
  caseId: string;
  specialistType: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  notes: string;
  careOwnership?: CareOwnership;
  /**
   * Set when the specialist was selected from the directory
   * (search_specialist_directory) rather than typed as free text. Delivers the
   * referral directly into that workspace's ReferralInbox at creation instead
   * of waiting for a token to be shared and accepted.
   */
  targetWorkspaceId?: string;
}

export interface SaveReferralResult {
  success: boolean;
  referralId?: string;
  /** Shareable token — send this to the specialist's own account to grant them scoped access to this one case. */
  referralToken?: string;
  error?: string;
}

export async function saveReferralToDatabase(
  params: SaveReferralParams
): Promise<SaveReferralResult> {
  try {
    const {
      caseId,
      specialistType,
      urgency,
      notes,
      careOwnership = 'pending_decision',
      targetWorkspaceId,
    } = params;

    const { data, error } = await supabase
      .rpc('create_case_referral', {
        p_case_id: caseId,
        p_specialist_type: specialistType,
        p_urgency: urgency,
        p_notes: notes,
        p_care_ownership: careOwnership,
        p_target_workspace_id: targetWorkspaceId ?? null,
      })
      .maybeSingle();

    if (error) throw new Error(`Failed to save referral: ${error.message}`);
    if (!data) throw new Error('Referral was not created');
    const referralRow = data as { referral_id: string; referral_token: string };

    // Once sent, this is active coordinated care — never a draft claim.
    // Do not downgrade a case that has already progressed or completed.
    const { error: caseStatusError } = await supabase
      .from('cases')
      .update({
        status: 'ongoing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', caseId)
      .in('status', ['new', 'draft']);
    if (caseStatusError) {
      console.error('Referral created but case status could not be advanced:', caseStatusError.message);
    }

    return {
      success: true,
      referralId: referralRow.referral_id,
      referralToken: referralRow.referral_token,
    };
  } catch (error) {
    console.error('Error saving referral:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/** Builds the link a GP sends to the specialist to accept the referral into their own workspace. */
export function buildReferralUrl(token: string): string {
  if (typeof window === 'undefined') {
    return `/referrals?token=${token}`;
  }
  return `${window.location.origin}/referrals?token=${token}`;
}

export interface AcceptCaseReferralResult {
  success: boolean;
  caseId?: string;
  error?: string;
}

/**
 * Called from the SPECIALIST's own logged-in account/workspace. Binds their
 * workspace as the referral's target_workspace_id, which is what RLS checks
 * (is_case_referral_recipient) to grant them scoped access to this one case —
 * without joining the GP's workspace.
 */
export async function acceptCaseReferral(token: string): Promise<AcceptCaseReferralResult> {
  try {
    const { data, error } = await supabase.rpc('accept_case_referral', { p_token: token });
    if (error) throw new Error(error.message);
    return { success: true, caseId: data as string };
  } catch (error) {
    console.error('Error accepting referral:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export interface InboundReferralSummary {
  referralId: string;
  caseId: string;
  specialistType: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  notes: string;
  careOwnership: CareOwnership;
  specialistOutcomeNote: string;
  createdAt: string;
  patientName: string;
  patientId: string;
  conditionName: string;
  icdCode: string;
  icdDescription: string;
  clinicalNote: string;
  plan: string;
  /** Medications the GP already had on the case (may be empty for undiagnosed referrals). */
  gpMedications: SelectedMedication[];
  registrationCompletedAt: string | null;
  registrationCompletedBy: string | null;
  tokenStatus: 'pending' | 'accepted' | 'revoked';
  acceptedAt: string | null;
  openedAt: string | null;
  referringWorkspaceId: string | null;
  targetWorkspaceId: string | null;
}

const CASE_REFERRAL_SELECT =
  'id, case_id, specialist_type, urgency, notes, care_ownership, specialist_outcome_note, created_at, token_status, accepted_at, opened_at, referring_workspace_id, target_workspace_id, registration_completed_at, registration_completed_by, cases(patient_name, patient_id, condition_name, icd_code, icd_description, clinical_note, plan)';

function mapInboundReferralRow(row: Record<string, any>): InboundReferralSummary {
  const caseRow = (row.cases ?? {}) as Record<string, any>;
  return {
    referralId: row.id,
    caseId: row.case_id,
    specialistType: row.specialist_type ?? '',
    urgency: row.urgency ?? 'routine',
    notes: row.notes ?? '',
    careOwnership: row.care_ownership ?? 'pending_decision',
    specialistOutcomeNote: row.specialist_outcome_note ?? '',
    createdAt: row.created_at,
    patientName: caseRow.patient_name ?? '',
    patientId: caseRow.patient_id ?? '',
    conditionName: caseRow.condition_name ?? '',
    icdCode: caseRow.icd_code ?? '',
    icdDescription: caseRow.icd_description ?? '',
    clinicalNote: caseRow.clinical_note ?? '',
    plan: caseRow.plan ?? 'Core',
    gpMedications: [],
    registrationCompletedAt: row.registration_completed_at ?? null,
    registrationCompletedBy: row.registration_completed_by ?? null,
    tokenStatus: row.token_status ?? 'pending',
    acceptedAt: row.accepted_at ?? null,
    openedAt: row.opened_at ?? null,
    referringWorkspaceId: row.referring_workspace_id ?? null,
    targetWorkspaceId: row.target_workspace_id ?? null,
  };
}

export function getReferralProgress(
  referral: InboundReferralSummary
): 'sent' | 'delivered' | 'opened' | 'completed' {
  if (referral.registrationCompletedAt) return 'completed';
  if (referral.openedAt) return 'opened';
  if (referral.targetWorkspaceId || referral.tokenStatus === 'accepted') return 'delivered';
  return 'sent';
}

async function hydrateReferralMedications(
  referrals: InboundReferralSummary[]
): Promise<InboundReferralSummary[]> {
  if (referrals.length === 0) return referrals;
  const caseIds = Array.from(new Set(referrals.map((r) => r.caseId).filter(Boolean)));
  if (caseIds.length === 0) return referrals;

  const { data, error } = await supabase
    .from('case_medications')
    .select(
      'case_id, medicine_name_and_strength, active_ingredient, cda_amount, formulary_status, coverage_decision, copay_risk, coverage_note, medicine_class'
    )
    .in('case_id', caseIds);

  // Do not fail referral loading if medication read is blocked by RLS.
  if (error) {
    console.warn('Could not hydrate referral medications:', error.message);
    return referrals;
  }

  const medsByCaseId = new Map<string, SelectedMedication[]>();
  for (const row of data ?? []) {
    const caseId = row.case_id as string;
    const med: SelectedMedication = {
      medicineClass: row.medicine_class ?? '',
      activeIngredient: row.active_ingredient ?? '',
      medicineNameAndStrength: row.medicine_name_and_strength ?? '',
      cdaAmount: row.cda_amount ?? '',
      formularyStatus: row.formulary_status ?? 'listed',
      coverageDecision: row.coverage_decision ?? 'full_cover',
      copayRisk: row.copay_risk ?? false,
      coverageNote: row.coverage_note ?? '',
    };
    medsByCaseId.set(caseId, [...(medsByCaseId.get(caseId) ?? []), med]);
  }

  return referrals.map((referral) => ({
    ...referral,
    gpMedications: medsByCaseId.get(referral.caseId) ?? [],
  }));
}

/** Referrals a specialist's workspace has accepted (or been sent, once accepted) — their "inbox". */
export async function fetchInboundReferrals(
  workspaceId: string
): Promise<{ success: boolean; referrals: InboundReferralSummary[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('case_referrals')
      .select(CASE_REFERRAL_SELECT)
      .eq('target_workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch inbound referrals: ${error.message}`);

    const baseReferrals = (data || []).map(mapInboundReferralRow);
    const referrals = await hydrateReferralMedications(baseReferrals);
    return { success: true, referrals };
  } catch (error) {
    console.error('Error fetching inbound referrals:', error);
    return {
      success: false,
      referrals: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/** Referrals a GP's workspace has sent out, with current handover status — their "sent" tab. */
export async function fetchOutboundReferrals(
  workspaceId: string
): Promise<{ success: boolean; referrals: InboundReferralSummary[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('case_referrals')
      .select(CASE_REFERRAL_SELECT)
      .eq('referring_workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch outbound referrals: ${error.message}`);

    const baseReferrals = (data || []).map(mapInboundReferralRow);
    const referrals = await hydrateReferralMedications(baseReferrals);
    return { success: true, referrals };
  } catch (error) {
    console.error('Error fetching outbound referrals:', error);
    return {
      success: false,
      referrals: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function fetchActionableInboundReferralCount(workspaceId: string): Promise<number> {
  const { count, error } = await supabase
    .from('case_referrals')
    .select('id', { count: 'exact', head: true })
    .eq('target_workspace_id', workspaceId)
    .is('opened_at', null)
    .is('registration_completed_at', null);

  if (error) {
    console.error('Could not count new referrals:', error.message);
    return 0;
  }
  return count ?? 0;
}

export async function markReferralOpened(
  referralId: string
): Promise<{ success: boolean; openedAt?: string; error?: string }> {
  const { data, error } = await supabase.rpc('mark_referral_opened', {
    p_referral_id: referralId,
  });
  if (error) {
    console.error('Could not mark referral opened:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true, openedAt: data as string };
}

/**
 * The GP-side handoff signal (Phase 3): does this case already have a
 * specialist-completed registration? Reads case_referrals directly rather
 * than the local Zustand chronicCases store, which has no knowledge of
 * anything written from the specialist's separate workspace/session.
 */
export interface CaseRegistrationHandoff {
  isRegistered: boolean;
  registrationCompletedAt: string | null;
  icdCode: string;
  icdDescription: string;
  diagnosisDate: string | null;
  careOwnership: CareOwnership;
  medications: SelectedMedication[];
}

async function fetchMedicationsForCases(caseIds: string[]): Promise<Map<string, SelectedMedication[]>> {
  const ids = Array.from(new Set(caseIds.filter(Boolean)));
  const medsByCaseId = new Map<string, SelectedMedication[]>();
  if (ids.length === 0) return medsByCaseId;

  const { data, error } = await supabase.from('case_medications').select('*').in('case_id', ids);
  if (error) {
    console.warn('Could not fetch handoff medications:', error.message);
    return medsByCaseId;
  }

  for (const row of data ?? []) {
    const caseId = row.case_id as string;
    medsByCaseId.set(caseId, [...(medsByCaseId.get(caseId) ?? []), mapMedicationRow(row)]);
  }

  return medsByCaseId;
}

export async function fetchCaseRegistrationHandoff(
  caseId: string
): Promise<{ success: boolean; handoff?: CaseRegistrationHandoff; error?: string }> {
  try {
    const [{ data: referralRows, error: referralError }, { data: caseRow, error: caseError }] = await Promise.all([
      supabase
        .from('case_referrals')
        .select('care_ownership, registration_completed_at')
        .eq('case_id', caseId)
        .not('registration_completed_at', 'is', null)
        .order('registration_completed_at', { ascending: false })
        .limit(1),
      supabase.from('cases').select('icd_code, icd_description, diagnosis_date').eq('id', caseId).maybeSingle(),
    ]);

    if (referralError) throw new Error(`Failed to fetch referral status: ${referralError.message}`);
    if (caseError) throw new Error(`Failed to fetch case: ${caseError.message}`);

    const referral = referralRows?.[0];
    if (!referral) {
      return {
        success: true,
        handoff: {
          isRegistered: false,
          registrationCompletedAt: null,
          icdCode: '',
          icdDescription: '',
          diagnosisDate: null,
          careOwnership: 'pending_decision',
          medications: [],
        },
      };
    }

    const medsByCaseId = await fetchMedicationsForCases([caseId]);
    const medications = medsByCaseId.get(caseId) ?? [];

    return {
      success: true,
      handoff: {
        isRegistered: true,
        registrationCompletedAt: referral.registration_completed_at,
        icdCode: caseRow?.icd_code ?? '',
        icdDescription: caseRow?.icd_description ?? '',
        diagnosisDate: caseRow?.diagnosis_date ?? null,
        careOwnership: referral.care_ownership ?? 'specialist_accepted',
        medications,
      },
    };
  } catch (error) {
    console.error('Error fetching case registration handoff:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Bulk version of fetchCaseRegistrationHandoff — lets the GP dashboard check
 * every referred-out case in one round trip on load, instead of only finding
 * out a specialist finished when the GP happens to reopen that exact case.
 * Only returns entries for cases that actually have a completed registration;
 * cases with nothing to report are simply absent from the result map.
 */
export async function fetchCaseRegistrationHandoffsBulk(
  caseIds: string[]
): Promise<{ success: boolean; handoffs: Record<string, CaseRegistrationHandoff>; error?: string }> {
  try {
    const ids = Array.from(new Set(caseIds.filter(Boolean)));
    if (ids.length === 0) return { success: true, handoffs: {} };

    const [{ data: referralRows, error: referralError }, { data: caseRows, error: caseError }] = await Promise.all([
      supabase
        .from('case_referrals')
        .select('case_id, care_ownership, registration_completed_at')
        .in('case_id', ids)
        .not('registration_completed_at', 'is', null)
        .order('registration_completed_at', { ascending: false }),
      supabase.from('cases').select('id, icd_code, icd_description, diagnosis_date').in('id', ids),
    ]);

    if (referralError) throw new Error(`Failed to fetch referral statuses: ${referralError.message}`);
    if (caseError) throw new Error(`Failed to fetch cases: ${caseError.message}`);

    const caseById = new Map((caseRows ?? []).map((c) => [c.id, c]));
    const registeredCaseIds = Array.from(
      new Set((referralRows ?? []).map((referral) => referral.case_id as string))
    );
    const medsByCaseId = await fetchMedicationsForCases(registeredCaseIds);
    const handoffs: Record<string, CaseRegistrationHandoff> = {};

    for (const referral of referralRows ?? []) {
      // Rows are ordered by registration_completed_at desc, so the first hit
      // per case_id is the latest — skip any later (older) duplicates.
      if (handoffs[referral.case_id]) continue;
      const caseRow = caseById.get(referral.case_id);
      handoffs[referral.case_id] = {
        isRegistered: true,
        registrationCompletedAt: referral.registration_completed_at,
        icdCode: caseRow?.icd_code ?? '',
        icdDescription: caseRow?.icd_description ?? '',
        diagnosisDate: caseRow?.diagnosis_date ?? null,
        careOwnership: referral.care_ownership ?? 'specialist_accepted',
        medications: medsByCaseId.get(referral.case_id) ?? [],
      };
    }

    return { success: true, handoffs };
  } catch (error) {
    console.error('Error fetching bulk case registration handoffs:', error);
    return {
      success: false,
      handoffs: {},
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export interface SubmitSpecialistRegistrationParams {
  caseId: string;
  referralId: string;
  conditionName: string;
  icdCode: string;
  icdDescription: string;
  diagnosisDate: string;
  medications: SelectedMedication[];
}

/**
 * Called from the specialist's own account once they've confirmed ICD-10,
 * diagnosis date, and medication for a case they accepted via referral.
 * Writes directly to the shared `cases` row and `case_medications` — both
 * already covered by the referral-recipient RLS policies — then stamps
 * case_referrals.registration_completed_at so the GP can detect the handoff.
 */
export async function submitSpecialistRegistration(
  params: SubmitSpecialistRegistrationParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const { caseId, referralId, conditionName, icdCode, icdDescription, diagnosisDate, medications } = params;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const { error: caseUpdateError } = await supabase
      .from('cases')
      .update({
        condition_name: conditionName,
        icd_code: icdCode,
        icd_description: icdDescription,
        diagnosis_date: diagnosisDate,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', caseId);

    if (caseUpdateError) throw new Error(`Failed to update case: ${caseUpdateError.message}`);

    await supabase.from('case_medications').delete().eq('case_id', caseId);

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

      let { error: medicationError } = await supabase.from('case_medications').insert(medicationRecords);

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

      if (medicationError) throw new Error(`Failed to save medications: ${medicationError.message}`);
    }

    const { error: referralUpdateError } = await supabase
      .from('case_referrals')
      .update({
        registration_completed_at: new Date().toISOString(),
        registration_completed_by: userId ?? null,
      })
      .eq('id', referralId);

    if (referralUpdateError) throw new Error(`Failed to record registration completion: ${referralUpdateError.message}`);

    return { success: true };
  } catch (error) {
    console.error('Error submitting specialist registration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export interface UpdateReferralOwnershipParams {
  referralId: string;
  careOwnership: 'gp_retained' | 'specialist_accepted';
  specialistOutcomeNote?: string;
}

export async function updateReferralOwnership(
  params: UpdateReferralOwnershipParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const { referralId, careOwnership, specialistOutcomeNote = '' } = params;

    const { error } = await supabase
      .from('case_referrals')
      .update({
        care_ownership: careOwnership,
        specialist_outcome_note: specialistOutcomeNote,
        ownership_decided_at: new Date().toISOString(),
      })
      .eq('id', referralId);

    if (error) throw new Error(`Failed to update referral ownership: ${error.message}`);

    return { success: true };
  } catch (error) {
    console.error('Error updating referral ownership:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function getReferralsByCaseId(
  caseId: string
): Promise<{ success: boolean; referrals: any[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('case_referrals')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch referrals: ${error.message}`);

    return { success: true, referrals: data || [] };
  } catch (error) {
    console.error('Error fetching referrals:', error);
    return {
      success: false,
      referrals: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function getAllCases(workspaceId?: string) {
  try {
    if (!workspaceId) {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Failed to fetch cases: ${error.message}`);
      return { success: true, cases: data || [] };
    }

    // A referred case remains owned by the referring GP's workspace. The
    // specialist receives scoped access through case_referrals, so filtering
    // only by cases.workspace_id incorrectly hides every referred patient from
    // the specialist's workspace. Load both sets and merge by case id.
    const [ownedResult, inboundResult, outboundResult] = await Promise.all([
      supabase
        .from('cases')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
      supabase
        .from('case_referrals')
        .select('case_id')
        .eq('target_workspace_id', workspaceId),
      supabase
        .from('case_referrals')
        .select('case_id')
        .eq('referring_workspace_id', workspaceId),
    ]);

    if (ownedResult.error) {
      throw new Error(`Failed to fetch workspace cases: ${ownedResult.error.message}`);
    }
    if (inboundResult.error) {
      throw new Error(`Failed to fetch referred cases: ${inboundResult.error.message}`);
    }
    if (outboundResult.error) {
      throw new Error(`Failed to fetch sent referrals: ${outboundResult.error.message}`);
    }

    const referredCaseIds = Array.from(
      new Set((inboundResult.data ?? []).map((row) => row.case_id).filter(Boolean))
    ) as string[];
    const activeReferralCaseIds = new Set<string>([
      ...referredCaseIds,
      ...((outboundResult.data ?? []).map((row) => row.case_id).filter(Boolean) as string[]),
    ]);

    let referredCases: Record<string, any>[] = [];
    if (referredCaseIds.length > 0) {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .in('id', referredCaseIds);
      if (error) throw new Error(`Failed to fetch referred patient cases: ${error.message}`);
      referredCases = data ?? [];
    }

    const byId = new Map<string, Record<string, any>>();
    for (const row of [...(ownedResult.data ?? []), ...referredCases]) {
      byId.set(
        row.id,
        activeReferralCaseIds.has(row.id) && (row.status === 'new' || row.status === 'draft')
          ? { ...row, status: 'ongoing' }
          : row
      );
    }
    const cases = Array.from(byId.values()).sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    );

    return {
      success: true,
      cases,
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
