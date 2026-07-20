'use client';

import { useState, useEffect } from 'react';
import { SelectedMedication, BenefitState, MedicationRenewNotes } from '@/types';
import { FileText, Plus, CheckCircle, Upload, AlertTriangle, ArrowLeft, SlidersHorizontal } from 'lucide-react';
import MedicationSelection from './MedicationSelection';
import FileUploadWithRename from './FileUploadWithRename';
import CurrentMedicationAdjustPanel from './CurrentMedicationAdjustPanel';
import {
  cloneMedications,
  medicationRegimenChanged,
} from '@/lib/medicationDoseAdjust';

export type MedicationReportMode = 'renew' | 'change' | 'standalone_renew';

/** Specialist treatment-plan branch after reviewing current meds + side effects */
export type TreatmentPlanDecision = 'continue' | 'adjust' | 'change';

export interface MedicationReportFormData {
  followUpNotes: string;
  newMedications?: SelectedMedication[];
  motivationLetter?: string;
  documentation?: { notes: string; images: string[] };
  renewConfirmed?: boolean;
  sideEffects?: string;
  adherence?: string;
  mode?: MedicationReportMode;
  /** Explicit specialist decision: keep current plan vs prescribe new */
  treatmentPlanDecision?: TreatmentPlanDecision | null;
}

interface MedicationReportProps {
  currentMedications: SelectedMedication[];
  medicationNote: string;
  condition: string;
  selectedPlan: any;
  benefitState?: BenefitState | null;
  embedMode?: boolean;
  followUpMode?: boolean;
  /** renew = GP repeat script; change = specialist treatment plan update */
  reportMode?: MedicationReportMode;
  initialFollowUpNotes?: string;
  initialRenewNotes?: MedicationRenewNotes;
  /** @deprecated Prefer explicit treatmentPlanDecision; ignored for specialist change flow */
  openNewMedicationOnMount?: boolean;
  onDataChange?: (data: MedicationReportFormData) => void;
  onSaveOnly: (followUpNotes: string, newMedications?: SelectedMedication[], motivationLetter?: string, documentation?: { notes: string; images: string[] }) => void;
  onSavePdfOnly: (followUpNotes: string, newMedications?: SelectedMedication[], motivationLetter?: string, documentation?: { notes: string; images: string[] }) => void;
  onSaveWithAttachments: (followUpNotes: string, newMedications?: SelectedMedication[], motivationLetter?: string, documentation?: { notes: string; images: string[] }) => void;
}

const MedicationReport = ({
  currentMedications,
  medicationNote,
  condition,
  selectedPlan,
  benefitState,
  embedMode = false,
  followUpMode = false,
  reportMode = 'standalone_renew',
  initialFollowUpNotes = '',
  initialRenewNotes,
  openNewMedicationOnMount = false,
  onDataChange,
  onSaveOnly,
  onSavePdfOnly,
  onSaveWithAttachments,
}: MedicationReportProps) => {
  const isFollowUpFlow = followUpMode || embedMode;
  const isRenewMode = reportMode === 'renew' || reportMode === 'standalone_renew';
  const isSpecialistChangeMode = reportMode === 'change';

  const renderCoverageBadge = (status: SelectedMedication['formularyStatus']) => (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        status === 'listed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {status === 'listed' ? 'Fully covered (formulary)' : 'Cap-limited (unlisted)'}
    </span>
  );

  const [followUpNotes, setFollowUpNotes] = useState(initialFollowUpNotes);
  const [sideEffects, setSideEffects] = useState(initialRenewNotes?.sideEffects ?? '');
  const [adherence, setAdherence] = useState(initialRenewNotes?.adherence ?? '');
  const [renewConfirmed, setRenewConfirmed] = useState(false);
  const [treatmentPlanDecision, setTreatmentPlanDecision] = useState<TreatmentPlanDecision | null>(
    null
  );
  const [addingNew, setAddingNew] = useState(
    !isSpecialistChangeMode &&
      openNewMedicationOnMount &&
      !isRenewMode &&
      (reportMode === 'change' || !isFollowUpFlow)
  );
  const [showChangeWarning, setShowChangeWarning] = useState(false);
  const [newMedications, setNewMedications] = useState<SelectedMedication[]>([]);
  const [adjustedMedications, setAdjustedMedications] = useState<SelectedMedication[]>([]);
  const [motivationLetter, setMotivationLetter] = useState('');
  const [documentationNotes, setDocumentationNotes] = useState('');
  const [documentationImages, setDocumentationImages] = useState<string[]>([]);

  const hasSelectedNewMeds = newMedications.length > 0;
  const hasAdjustedRegimen =
    treatmentPlanDecision === 'adjust' &&
    medicationRegimenChanged(currentMedications, adjustedMedications);
  // Once change/adjust is in progress (or new meds exist), baseline is previous
  const showAsPrevious =
    treatmentPlanDecision === 'change' || hasSelectedNewMeds || hasAdjustedRegimen;

  useEffect(() => {
    if (!isFollowUpFlow) setFollowUpNotes(initialFollowUpNotes);
  }, [initialFollowUpNotes, isFollowUpFlow]);

  // Legacy non-specialist change flows only — specialist change never auto-opens picker
  useEffect(() => {
    if (openNewMedicationOnMount && reportMode === 'change' && !isFollowUpFlow) {
      setAddingNew(true);
    }
  }, [openNewMedicationOnMount, reportMode, isFollowUpFlow]);

  const handleAddNewMedication = (medication: SelectedMedication) => {
    setNewMedications([...newMedications, medication]);
  };

  const handleRemoveNewMedication = (index: number) => {
    setNewMedications(newMedications.filter((_, i) => i !== index));
  };

  const handleUpdateNewMedicationSection12 = (
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
  ) => {
    setNewMedications((prev) =>
      prev.map((med, i) => (i === index ? { ...med, ...fields } : med))
    );
  };

  const buildRenewNotesText = () => {
    const lines: string[] = [];
    if (adherence.trim()) lines.push(`Adherence: ${adherence.trim()}`);
    if (sideEffects.trim()) lines.push(`Side effects / tolerability: ${sideEffects.trim()}`);
    return lines.join('\n');
  };

  const getReportPayload = (): MedicationReportFormData => {
    const documentation =
      !isFollowUpFlow && (documentationNotes || documentationImages.length > 0)
        ? { notes: documentationNotes, images: documentationImages }
        : undefined;

    if (isRenewMode) {
      const renewNotes = buildRenewNotesText();
      const combinedFollowUpNotes = isFollowUpFlow
        ? renewNotes
        : [followUpNotes.trim(), renewNotes].filter(Boolean).join('\n\n');
      return {
        mode: reportMode,
        followUpNotes: combinedFollowUpNotes,
        sideEffects,
        adherence,
        renewConfirmed,
        newMedications: currentMedications.length > 0 ? currentMedications : undefined,
      };
    }

    if (isSpecialistChangeMode) {
      const reportNotes = buildRenewNotesText();
      const continuing = treatmentPlanDecision === 'continue';
      const adjusting = treatmentPlanDecision === 'adjust';
      return {
        mode: reportMode,
        followUpNotes: reportNotes,
        sideEffects,
        adherence,
        treatmentPlanDecision,
        renewConfirmed: continuing ? true : undefined,
        newMedications:
          treatmentPlanDecision === 'change' && newMedications.length > 0
            ? newMedications
            : adjusting && hasAdjustedRegimen
              ? adjustedMedications
              : undefined,
        motivationLetter:
          treatmentPlanDecision === 'change' || adjusting
            ? motivationLetter || undefined
            : undefined,
        documentation,
      };
    }

    return {
      mode: reportMode,
      documentation,
      followUpNotes: isFollowUpFlow ? '' : followUpNotes,
      newMedications: newMedications.length > 0 ? newMedications : undefined,
      motivationLetter: isFollowUpFlow
        ? motivationLetter || undefined
        : newMedications.length > 0
          ? motivationLetter
          : undefined,
    };
  };

  useEffect(() => {
    if (embedMode && onDataChange) {
      onDataChange(getReportPayload());
    }
  }, [
    followUpNotes,
    sideEffects,
    adherence,
    renewConfirmed,
    treatmentPlanDecision,
    newMedications,
    adjustedMedications,
    motivationLetter,
    documentationNotes,
    documentationImages,
    embedMode,
    isFollowUpFlow,
    isRenewMode,
    isSpecialistChangeMode,
    reportMode,
    currentMedications,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateUnlistedRationale = (meds?: SelectedMedication[]) => {
    const list = meds ?? newMedications;
    const missingRationale = list.filter(
      (med) => med.formularyStatus === 'unlisted' && !med.unlistedClinicalRationale?.trim()
    );
    if (missingRationale.length > 0) {
      alert('Clinical rationale is required for unlisted medications before saving.');
      return false;
    }
    return true;
  };

  const validateBeforeSave = (): boolean => {
    if (isRenewMode) {
      if (!renewConfirmed) {
        alert('Confirm renewal of the current medication plan before saving.');
        return false;
      }
      if (currentMedications.length === 0) {
        alert('No medications on file to renew — check the patient portfolio or escalate to neurologist.');
        return false;
      }
    }
    if (isSpecialistChangeMode) {
      if (!treatmentPlanDecision) {
        alert('Choose whether to continue unchanged, adjust dose, or change medication.');
        return false;
      }
      if (treatmentPlanDecision === 'change') {
        if (newMedications.length === 0) {
          alert('Select the updated medication for this specialist review.');
          return false;
        }
        if (!motivationLetter.trim()) {
          alert('Document clinical motivation for the treatment plan update.');
          return false;
        }
      }
      if (treatmentPlanDecision === 'adjust') {
        if (currentMedications.length === 0) {
          alert('No medications on file to adjust — check Patient Records or change therapy.');
          return false;
        }
        if (!hasAdjustedRegimen) {
          alert('Update strength, dosage, or instructions — or choose Continue unchanged instead.');
          return false;
        }
        if (!motivationLetter.trim()) {
          alert('Briefly document the clinical reason for the dose adjustment.');
          return false;
        }
      }
    }
    return validateUnlistedRationale(
      isSpecialistChangeMode && treatmentPlanDecision === 'continue'
        ? currentMedications
        : isSpecialistChangeMode && treatmentPlanDecision === 'adjust'
          ? adjustedMedications
          : undefined
    );
  };

  const handleSaveOnly = () => {
    if (!validateBeforeSave()) return;
    const { documentation, followUpNotes: notes, newMedications: meds, motivationLetter: mot } =
      getReportPayload();
    onSaveOnly(notes, meds, mot, documentation);
  };

  const handleSavePdfOnly = () => {
    if (!validateBeforeSave()) return;
    const { documentation, followUpNotes: notes, newMedications: meds, motivationLetter: mot } =
      getReportPayload();
    onSavePdfOnly(notes, meds, mot, documentation);
  };

  const handleSaveWithAttachments = () => {
    if (!validateBeforeSave()) return;
    const { documentation, followUpNotes: notes, newMedications: meds, motivationLetter: mot } =
      getReportPayload();
    onSaveWithAttachments(notes, meds, mot, documentation);
  };

  const handlePrescribeNewClick = () => {
    if (reportMode === 'standalone_renew') {
      setShowChangeWarning(true);
      return;
    }
    setAddingNew(true);
  };

  const handleChooseContinue = () => {
    setTreatmentPlanDecision('continue');
    setAddingNew(false);
    setNewMedications([]);
    setAdjustedMedications([]);
    setMotivationLetter('');
  };

  const handleChooseAdjust = () => {
    setTreatmentPlanDecision('adjust');
    setAddingNew(false);
    setNewMedications([]);
    setAdjustedMedications(cloneMedications(currentMedications));
    setMotivationLetter('');
  };

  const handleChooseChange = () => {
    setTreatmentPlanDecision('change');
    setAddingNew(true);
    setAdjustedMedications([]);
  };

  const handleBackToDecision = () => {
    setTreatmentPlanDecision(null);
    setAddingNew(false);
    setNewMedications([]);
    setAdjustedMedications([]);
    setMotivationLetter('');
  };

  const medicationListHeading = (() => {
    if (isRenewMode) return 'Current medications (renewing)';
    if (showAsPrevious) return 'Previous Medication(s)';
    return 'Current Medication(s)';
  })();

  return (
    <div className="space-y-6">
      <div className={isFollowUpFlow ? '' : 'card'}>
        {!isFollowUpFlow && (
          <div className="flex items-center gap-3 mb-6">
            <div className="brand-icon">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Medication Report</h2>
              <p className="text-sm text-slate-500">
                {isRenewMode
                  ? 'Repeat script from the current prescribed medication on the patient record'
                  : 'Review and update medication status'}
              </p>
            </div>
          </div>
        )}

        {isRenewMode && isFollowUpFlow && (
          <p className="text-sm text-slate-600 mb-4">
            Current prescribed medications are pulled from Patient Records. Confirm renewal of that
            regimen here. For a treatment change, go back and choose Escalate for treatment change.
          </p>
        )}

        {isSpecialistChangeMode && isFollowUpFlow && (
          <p className="text-sm text-slate-600 mb-4">
            Review the current prescribed medications, document side effects and adherence reported
            by the patient, then continue unchanged, adjust dose/strength, or change therapy.
          </p>
        )}

        {showChangeWarning && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900">Major changes need neurologist sign-off</p>
              <p className="text-amber-800/90 mt-1 text-xs leading-relaxed">
                GPs renew scripts on the approved plan. To change drug class or dose, start a Patient
                Follow-Up Visit and choose Escalate for treatment change — that opens a neurologist
                referral instead of swapping formulary here.
              </p>
              <button
                type="button"
                onClick={() => setShowChangeWarning(false)}
                className="mt-2 text-xs font-semibold text-amber-900 underline"
              >
                Dismiss — continue with renew only
              </button>
            </div>
          </div>
        )}

        {!(isSpecialistChangeMode && treatmentPlanDecision === 'adjust') && (
        <div className="mb-6">
          <h3 className="font-semibold text-lg text-slate-900 mb-3">{medicationListHeading}</h3>
          <div className="space-y-2">
              {currentMedications.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No current prescribed medications found. Open Patient Records to confirm and save the
                  medication list first.
                </p>
              ) : (
                currentMedications.map((med, index) => (
                  <div
                    key={index}
                    className={`p-3 ${
                      isFollowUpFlow || showAsPrevious || isRenewMode
                        ? 'bg-slate-50 border border-slate-200 rounded-xl'
                        : 'brand-card-selected'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{med.activeIngredient || 'Unknown ingredient'}</p>
                      {renderCoverageBadge(med.formularyStatus)}
                    </div>
                    <p className="text-sm text-slate-500">Brand: {med.medicineNameAndStrength}</p>
                    {med.selectedStrength && (
                      <p className="text-xs text-slate-500">Strength: {med.selectedStrength}</p>
                    )}
                    {med.dosage && (
                      <p className="text-xs text-slate-500">Dosage: {med.dosage}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">Class: {med.medicineClass}</p>
                  </div>
              ))
            )}
          </div>

          {!isFollowUpFlow && (
            <div className="mt-3 brand-info-box">
              <p className="text-sm font-medium text-violet-700 mb-1">Registration Note:</p>
              <p className="text-sm text-violet-600">{medicationNote || 'No note provided'}</p>
            </div>
          )}
        </div>
        )}

        {isRenewMode ? (
          <div className="space-y-4">
            <div>
              <label className="label">Medication adherence</label>
              <textarea
                className="textarea-field"
                rows={2}
                placeholder="Is the patient taking medication as prescribed? Any missed doses or barriers?"
                value={adherence}
                onChange={(e) => setAdherence(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Side effects / tolerability</label>
              <textarea
                className="textarea-field"
                rows={2}
                placeholder="Any adverse effects, tolerability issues, or new symptoms since last script?"
                value={sideEffects}
                onChange={(e) => setSideEffects(e.target.value)}
              />
            </div>
            {!isFollowUpFlow && (
              <div>
                <label className="label">Follow-up notes</label>
                <textarea
                  className="textarea-field"
                  rows={3}
                  placeholder="Additional notes for this medication report…"
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                />
              </div>
            )}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={renewConfirmed}
                onChange={(e) => setRenewConfirmed(e.target.checked)}
                className="mt-1 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">
                I confirm renewal of the current chronic medication plan for this visit.
              </span>
            </label>
          </div>
        ) : isSpecialistChangeMode ? (
          <div className="space-y-4">
            <div>
              <label className="label">Medication adherence</label>
              <textarea
                className="textarea-field"
                rows={2}
                placeholder="Is the patient taking medication as prescribed? Any missed doses or barriers?"
                value={adherence}
                onChange={(e) => setAdherence(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Side effects / tolerability</label>
              <textarea
                className="textarea-field"
                rows={2}
                placeholder="Any adverse effects, tolerability issues, or new symptoms reported by the patient?"
                value={sideEffects}
                onChange={(e) => setSideEffects(e.target.value)}
              />
            </div>

            {!treatmentPlanDecision && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-900">Treatment plan decision</p>
                <p className="text-xs text-slate-500">
                  After reviewing side effects, choose whether this visit continues unchanged, adjusts
                  dose/strength, or switches therapy.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleChooseContinue}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Continue unchanged
                  </button>
                  <button
                    type="button"
                    onClick={handleChooseAdjust}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Adjust dose
                  </button>
                  <button
                    type="button"
                    onClick={handleChooseChange}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Change medication
                  </button>
                </div>
              </div>
            )}

            {treatmentPlanDecision === 'continue' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Continuing unchanged</p>
                    <p className="text-xs text-emerald-800/90 mt-1">
                      Same drug, strength, and instructions. Side effects and adherence will be saved
                      with the visit summary.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBackToDecision}
                    className="text-xs font-semibold text-emerald-900 underline shrink-0"
                  >
                    Change decision
                  </button>
                </div>
              </div>
            )}

            {treatmentPlanDecision === 'adjust' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-lg text-slate-900">Adjust dose / instructions</h3>
                  <button
                    type="button"
                    onClick={handleBackToDecision}
                    className="text-xs font-semibold text-slate-600 underline flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Change decision
                  </button>
                </div>
                {showAsPrevious && currentMedications.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Previous regimen
                    </p>
                    {currentMedications.map((med, index) => (
                      <p key={index} className="text-sm text-slate-700">
                        {med.medicineNameAndStrength}
                        {med.dosage ? ` · ${med.dosage}` : ''}
                      </p>
                    ))}
                  </div>
                )}
                <CurrentMedicationAdjustPanel
                  condition={condition}
                  medications={adjustedMedications}
                  onChange={setAdjustedMedications}
                />
                <div>
                  <label className="label">Clinical rationale for dose adjustment</label>
                  <textarea
                    className="textarea-field"
                    rows={3}
                    placeholder="Why are you adjusting dose or instructions? e.g. breakthrough symptoms, tolerability…"
                    value={motivationLetter}
                    onChange={(e) => setMotivationLetter(e.target.value)}
                  />
                </div>
              </div>
            )}

            {treatmentPlanDecision === 'change' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-lg text-slate-900">New Medication Prescribed</h3>
                    {currentMedications.length > 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        Replacing previous regimen
                        {hasSelectedNewMeds
                          ? ` with ${newMedications.length} new medicine${
                              newMedications.length === 1 ? '' : 's'
                            }`
                          : ' — select strength and dosage below'}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleBackToDecision}
                    className="text-xs font-semibold text-slate-600 underline flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Change decision
                  </button>
                </div>
                <MedicationSelection
                  condition={condition}
                  selectedPlan={selectedPlan}
                  benefitState={benefitState}
                  medications={newMedications}
                  onAddMedication={handleAddNewMedication}
                  onRemoveMedication={handleRemoveNewMedication}
                  onSetPlan={() => {}}
                  excludedMedications={currentMedications}
                  showSection12Fields
                  showPatientInstructions
                  onUpdateSection12={handleUpdateNewMedicationSection12}
                />
                <div>
                  <label className="label">Clinical motivation for medication change</label>
                  <textarea
                    className="textarea-field"
                    rows={4}
                    placeholder="Why are you changing medication? Include clinical reasoning for the scheme…"
                    value={motivationLetter}
                    onChange={(e) => setMotivationLetter(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {!isFollowUpFlow && (
              <>
                <div className="mb-6">
                  <label className="label">Follow-up Results &amp; Effectiveness</label>
                  <textarea
                    className="textarea-field"
                    rows={4}
                    placeholder="Enter follow-up notes on medication effectiveness, patient response, side effects, etc..."
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                  />
                </div>
                <div className="mb-6">
                  <h3 className="font-semibold text-lg text-slate-900 mb-3">Supporting Documentation</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="label">Documentation Notes</label>
                      <textarea
                        className="textarea-field"
                        rows={3}
                        placeholder="Enter any additional notes for documentation..."
                        value={documentationNotes}
                        onChange={(e) => setDocumentationNotes(e.target.value)}
                      />
                    </div>
                    <FileUploadWithRename
                      images={documentationImages}
                      onImagesChange={setDocumentationImages}
                      maxFiles={10}
                    />
                  </div>
                </div>
              </>
            )}

            {addingNew ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-slate-900">New Medication Prescribed</h3>
                <MedicationSelection
                  condition={condition}
                  selectedPlan={selectedPlan}
                  benefitState={benefitState}
                  medications={newMedications}
                  onAddMedication={handleAddNewMedication}
                  onRemoveMedication={handleRemoveNewMedication}
                  onSetPlan={() => {}}
                  excludedMedications={currentMedications}
                  showSection12Fields
                  showPatientInstructions
                  onUpdateSection12={handleUpdateNewMedicationSection12}
                />
                <div>
                  <label className="label">Clinical motivation for medication change</label>
                  <textarea
                    className="textarea-field"
                    rows={4}
                    placeholder="Why are you changing medication? Include clinical reasoning for the scheme…"
                    value={motivationLetter}
                    onChange={(e) => setMotivationLetter(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePrescribeNewClick}
                className="btn-secondary w-full flex items-center justify-center gap-2 mb-2"
              >
                <Plus className="w-5 h-5" />
                Prescribe New Medication
              </button>
            )}
          </>
        )}

        {!embedMode && (
          <div className="mt-6 flex flex-wrap gap-3 justify-end">
            <button type="button" onClick={handleSavePdfOnly} className="btn-secondary flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Save &amp; Export PDF Only
            </button>
            <button type="button" onClick={handleSaveWithAttachments} className="btn-secondary flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Save &amp; Export with Attachments (ZIP)
            </button>
            <button type="button" onClick={handleSaveOnly} className="btn-primary flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Confirm and Save Claim
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicationReport;
