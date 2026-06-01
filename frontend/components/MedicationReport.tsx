'use client';

import { useState } from 'react';
import { SelectedMedication, BenefitState } from '@/types';
import { FileText, Plus, CheckCircle, Upload } from 'lucide-react';
import MedicationSelection from './MedicationSelection';
import FileUploadWithRename from './FileUploadWithRename';

interface MedicationReportProps {
  currentMedications: SelectedMedication[];
  medicationNote: string;
  condition: string;
  selectedPlan: any;
  benefitState?: BenefitState | null;
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
  onSaveOnly,
  onSavePdfOnly,
  onSaveWithAttachments
}: MedicationReportProps) => {
  const renderCoverageBadge = (status: SelectedMedication['formularyStatus']) => (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        status === 'listed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {status === 'listed' ? 'Fully covered (formulary)' : 'Cap-limited (unlisted)'}
    </span>
  );

  const [followUpNotes, setFollowUpNotes] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newMedications, setNewMedications] = useState<SelectedMedication[]>([]);
  const [motivationLetter, setMotivationLetter] = useState('');
  const [documentationNotes, setDocumentationNotes] = useState('');
  const [documentationImages, setDocumentationImages] = useState<string[]>([]);
  
  const handleAddNewMedication = (medication: SelectedMedication) => {
    setNewMedications([...newMedications, medication]);
  };
  
  const handleRemoveNewMedication = (index: number) => {
    setNewMedications(newMedications.filter((_, i) => i !== index));
  };
  
  const getReportPayload = () => {
    const documentation = documentationNotes || documentationImages.length > 0
      ? { notes: documentationNotes, images: documentationImages }
      : undefined;

    return {
      documentation,
      followUpNotes,
      newMedications: newMedications.length > 0 ? newMedications : undefined,
      motivationLetter: newMedications.length > 0 ? motivationLetter : undefined,
    };
  };

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

  const handleSaveOnly = () => {
    if (!validateUnlistedRationale()) return;
    const { documentation, followUpNotes, newMedications, motivationLetter } = getReportPayload();
    onSaveOnly(followUpNotes, newMedications, motivationLetter, documentation);
  };

  const handleSavePdfOnly = () => {
    if (!validateUnlistedRationale()) return;
    const { documentation, followUpNotes, newMedications, motivationLetter } = getReportPayload();

    onSavePdfOnly(followUpNotes, newMedications, motivationLetter, documentation);
  };

  const handleSaveWithAttachments = () => {
    if (!validateUnlistedRationale()) return;
    const { documentation, followUpNotes, newMedications, motivationLetter } = getReportPayload();

    onSaveWithAttachments(
      followUpNotes,
      newMedications,
      motivationLetter,
      documentation
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="brand-icon">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Medication Report</h2>
            <p className="text-sm text-slate-500">Review and update medication status</p>
          </div>
        </div>
        
        {/* Current Medications */}
        <div className="mb-6">
          <h3 className="font-semibold text-lg text-slate-900 mb-3">Current Medications</h3>
          <div className="space-y-2">
            {currentMedications.map((med, index) => (
              <div key={index} className="p-3 brand-card-selected">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{med.activeIngredient || 'Unknown ingredient'}</p>
                  {renderCoverageBadge(med.formularyStatus)}
                </div>
                <p className="text-sm text-slate-500">Brand: {med.medicineNameAndStrength}</p>
                <p className="text-xs text-slate-500 mt-0.5">Class: {med.medicineClass}</p>
                <p className="text-sm text-violet-600 font-semibold">CDA: {med.cdaAmount}</p>
                <p className="text-xs text-slate-600 mt-1">{med.coverageNote}</p>
                {med.copayRisk && (
                  <p className="text-xs text-amber-700 mt-1">
                    Co-pay risk: patient may pay above CDA cap.
                  </p>
                )}
                {med.unlistedClinicalRationale && (
                  <p className="text-xs text-slate-500 mt-1">
                    Clinical rationale: {med.unlistedClinicalRationale}
                  </p>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-3 brand-info-box">
            <p className="text-sm font-medium text-violet-700 mb-1">Registration Note:</p>
            <p className="text-sm text-violet-600">{medicationNote || 'No note provided'}</p>
          </div>
        </div>
        
        {/* Follow-up Notes */}
        <div className="mb-6">
          <label className="label">Follow-up Results & Effectiveness</label>
          <textarea
            className="textarea-field"
            rows={4}
            placeholder="Enter follow-up notes on medication effectiveness, patient response, side effects, etc..."
            value={followUpNotes}
            onChange={(e) => setFollowUpNotes(e.target.value)}
          />
        </div>

        {/* Documentation Section */}
        <div className="mb-6">
          <h3 className="font-semibold text-lg text-slate-900 mb-3">Supporting Documentation</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Documentation Notes</label>
              <textarea
                className="textarea-field"
                rows={3}
                placeholder="Enter any additional notes for documentation (lab results, observations, etc.)..."
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
        
        {/* Add New Medication */}
        {!addingNew ? (
          <button
            onClick={() => setAddingNew(true)}
            className="btn-secondary w-full flex items-center justify-center gap-2 mb-2"
          >
            <Plus className="w-5 h-5" />
            Prescribe New Medication
          </button>
        ) : (
          <div className="space-y-4">
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
              <label className="label">Motivation Letter for Medication Change</label>
              <textarea
                className="textarea-field"
                rows={4}
                placeholder="Explain the reason for medication change or escalation..."
                value={motivationLetter}
                onChange={(e) => setMotivationLetter(e.target.value)}
              />
            </div>
            
            <button
              type="button"
              onClick={() => setAddingNew(false)}
              className="btn-secondary text-sm"
            >
              Cancel New Medication
            </button>
          </div>
        )}
        
        {/* Save Buttons */}
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
      </div>
    </div>
  );
};

export default MedicationReport;

