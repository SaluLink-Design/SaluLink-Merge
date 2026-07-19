'use client';

import { useState, useEffect } from 'react';
import { SelectedMedication, BenefitState, MedicationRenewNotes } from '@/types';
import { FileText, Plus, CheckCircle, Upload, AlertTriangle } from 'lucide-react';
import MedicationSelection from './MedicationSelection';
import FileUploadWithRename from './FileUploadWithRename';

export type MedicationReportMode = 'renew' | 'change' | 'standalone_renew';

export interface MedicationReportFormData {
  followUpNotes: string;
  newMedications?: SelectedMedication[];
  motivationLetter?: string;
  documentation?: { notes: string; images: string[] };
  renewConfirmed?: boolean;
  sideEffects?: string;
  adherence?: string;
  mode?: MedicationReportMode;
}

interface MedicationReportProps {
  currentMedications: SelectedMedication[];
  medicationNote: string;
  condition: string;
  selectedPlan: any;
  benefitState?: BenefitState | null;
  embedMode?: boolean;
  followUpMode?: boolean;
  /** renew = GP repeat script; change = specialist or legacy change flow */
  reportMode?: MedicationReportMode;
  initialFollowUpNotes?: string;
  initialRenewNotes?: MedicationRenewNotes;
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
  const [addingNew, setAddingNew] = useState(
    openNewMedicationOnMount && !isRenewMode && (reportMode === 'change' || !isFollowUpFlow)
  );
  const [showChangeWarning, setShowChangeWarning] = useState(false);
  const [newMedications, setNewMedications] = useState<SelectedMedication[]>([]);
  const [motivationLetter, setMotivationLetter] = useState('');
  const [documentationNotes, setDocumentationNotes] = useState('');
  const [documentationImages, setDocumentationImages] = useState<string[]>([]);

  useEffect(() => {
    if (!isFollowUpFlow) setFollowUpNotes(initialFollowUpNotes);
  }, [initialFollowUpNotes, isFollowUpFlow]);

  useEffect(() => {
    if (openNewMedicationOnMount && reportMode === 'change') setAddingNew(true);
  }, [openNewMedicationOnMount, reportMode]);

  const handleAddNewMedication = (medication: SelectedMedication) => {
    setNewMedications([...newMedications, medication]);
  };

  const handleRemoveNewMedication = (index: number) => {
    setNewMedications(newMedications.filter((_, i) => i !== index));
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
    newMedications,
    motivationLetter,
    documentationNotes,
    documentationImages,
    embedMode,
    isFollowUpFlow,
    isRenewMode,
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
    return validateUnlistedRationale();
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
                  ? 'Repeat script on the current treatment plan'
                  : 'Review and update medication status'}
              </p>
            </div>
          </div>
        )}

        {isRenewMode && isFollowUpFlow && (
          <p className="text-sm text-slate-600 mb-4">
            Confirm renewal of the neurologist-approved regimen. Document side effects or adherence
            issues here — for a treatment change, go back and choose Escalate for treatment change.
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

        <div className="mb-6">
          <h3 className="font-semibold text-lg text-slate-900 mb-3">
            {isRenewMode ? 'Current medications (renewing)' : isFollowUpFlow || addingNew ? 'Previous Medication(s)' : 'Current Medications'}
          </h3>
          <div className="space-y-2">
            {currentMedications.length === 0 ? (
              <p className="text-sm text-slate-500">No current medications on file.</p>
            ) : (
              currentMedications.map((med, index) => (
                <div
                  key={index}
                  className={`p-3 ${isFollowUpFlow || addingNew || isRenewMode ? 'bg-slate-50 border border-slate-200 rounded-xl' : 'brand-card-selected'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{med.activeIngredient || 'Unknown ingredient'}</p>
                    {renderCoverageBadge(med.formularyStatus)}
                  </div>
                  <p className="text-sm text-slate-500">Brand: {med.medicineNameAndStrength}</p>
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

            {isFollowUpFlow || addingNew ? (
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
