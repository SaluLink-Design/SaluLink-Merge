'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  CheckCircle2,
  Loader2,
  Upload,
  Stethoscope,
  FileText,
  Pill,
  Send,
} from 'lucide-react';
import type { MedicalPlan, SelectedMedication } from '@/types';
import {
  submitSpecialistRegistration,
  updateReferralOwnership,
  type InboundReferralSummary,
} from '@/lib/caseService';
import { fundingSourceLabel } from '@/lib/benefitState';
import { DataService } from '@/lib/dataService';
import { splitReferralNotesAndFindings } from '@/lib/medicationReportSummary';
import IcdCodeSelection from '@/components/IcdCodeSelection';
import MedicationSelection from '@/components/MedicationSelection';

type Phase = 'overview' | 'findings' | 'icd' | 'medication' | 'review' | 'done';

const PHASES: Phase[] = ['overview', 'findings', 'icd', 'medication', 'review'];

const phaseLabel: Record<Phase, string> = {
  overview: 'Case overview',
  findings: 'Investigation findings',
  icd: 'ICD-10 code & date',
  medication: 'Medication',
  review: 'Review & submit',
  done: 'Complete',
};

interface SpecialistCaseWorkspaceProps {
  referral: InboundReferralSummary;
  practiceLabel?: string;
  onClose: () => void;
  onCompleted: () => void;
}

const SpecialistCaseWorkspace = ({
  referral,
  practiceLabel = 'Specialist Practice',
  onClose,
  onCompleted,
}: SpecialistCaseWorkspaceProps) => {
  const [phase, setPhase] = useState<Phase>('overview');

  // Collected data across phases
  const [outcomeNote, setOutcomeNote] = useState('');
  const [icdCode, setIcdCode] = useState<string | null>(referral.icdCode || null);
  const [icdDescription, setIcdDescription] = useState(referral.icdDescription || '');
  const [diagnosisDate, setDiagnosisDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [medications, setMedications] = useState<SelectedMedication[]>([]);
  const [findingsFiles, setFindingsFiles] = useState<File[]>([]);
  const [dataInitError, setDataInitError] = useState<string | null>(null);
  const findingsFileInputRef = useRef<HTMLInputElement | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isAlreadyCompleted = Boolean(referral.registrationCompletedAt);

  const stepIndex = PHASES.indexOf(phase);

  const canProceedFromFindings = outcomeNote.trim().length > 0;
  const canProceedFromIcd = Boolean(icdCode);
  const canProceedFromMedication = medications.length > 0;

  const goNext = () => {
    const idx = PHASES.indexOf(phase);
    if (idx < PHASES.length - 1) setPhase(PHASES[idx + 1]);
  };

  const goBack = () => {
    const idx = PHASES.indexOf(phase);
    if (idx > 0) setPhase(PHASES[idx - 1]);
  };

  const handleUpdateMedicationSection12 = (
    index: number,
    fields: Partial<
      Pick<
        SelectedMedication,
        | 'dosage'
        | 'durationUsed'
        | 'selectedStrength'
        | 'medicineNameAndStrength'
        | 'note'
      >
    >
  ) => {
    setMedications((prev) =>
      prev.map((med, i) => (i === index ? { ...med, ...fields } : med))
    );
  };

  const handleFinish = () => {
    onCompleted();
  };

  useEffect(() => {
    let mounted = true;
    const initData = async () => {
      try {
        DataService.setActiveScheme('discovery');
        await DataService.initialize('discovery');
        if (mounted) setDataInitError(null);
      } catch (error) {
        if (mounted) {
          setDataInitError('Could not load ICD catalogue. Please refresh and try again.');
        }
      }
    };
    void initData();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async () => {
    if (!icdCode) return;
    setIsSubmitting(true);
    setSubmitError(null);

    // 1. Record the interpretation note against the referral. The specialist
    //    always completes and signs the CIB registration in this workflow —
    //    the GP resumes ongoing management once it lands on their dashboard.
    const ownershipResult = await updateReferralOwnership({
      referralId: referral.referralId,
      careOwnership: 'specialist_accepted',
      specialistOutcomeNote: outcomeNote.trim(),
    });

    if (!ownershipResult.success) {
      setSubmitError(ownershipResult.error ?? 'Failed to record referral outcome.');
      setIsSubmitting(false);
      return;
    }

    // 2. Submit the CIB registration.
    const regResult = await submitSpecialistRegistration({
      caseId: referral.caseId,
      referralId: referral.referralId,
      conditionName: referral.conditionName,
      icdCode,
      icdDescription,
      diagnosisDate,
      medications,
    });

    if (!regResult.success) {
      setSubmitError(regResult.error ?? 'Failed to submit CIB registration.');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setPhase('done');
  };

  // ─── Step renderers ───────────────────────────────────────────────────────

  const renderOverview = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900">Case overview</h3>
        <p className="text-sm text-slate-500 mt-1">
          Review the referring GP&apos;s notes before you begin your assessment.
        </p>
      </div>

      <div className="card space-y-5">
        <div>
          <h4 className="text-base font-semibold text-slate-900">
            {referral.patientName || 'Unnamed patient'}
          </h4>
          <p className="text-sm text-slate-500 mt-0.5">
            {referral.patientId || 'No ID on file'} · {referral.conditionName || 'Condition not set'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ['Referral type', referral.specialistType || 'Specialist'],
            ['Urgency', referral.urgency],
            ['Medical plan', referral.plan || 'Core'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5 capitalize">{value}</p>
            </div>
          ))}
        </div>

        {referral.clinicalNote && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
              GP&apos;s clinical note
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {referral.clinicalNote}
            </p>
          </div>
        )}

        {(() => {
          const { referralMessage, medicationFindings } = splitReferralNotesAndFindings(
            referral.notes ?? ''
          );
          return (
            <>
              {referralMessage && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                    Referral message from GP
                  </p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {referralMessage}
                  </p>
                </div>
              )}
              {medicationFindings && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 space-y-1">
                  <p className="text-xs uppercase tracking-widest text-violet-500 font-semibold">
                    Medication report findings
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {medicationFindings}
                  </p>
                </div>
              )}
              {!referralMessage && !medicationFindings && referral.notes && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                    Referral note
                  </p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {referral.notes}
                  </p>
                </div>
              )}
            </>
          );
        })()}

        {referral.gpMedications.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
              GP&apos;s existing medications
            </p>
            <ul className="space-y-1">
              {referral.gpMedications.map((m, i) => (
                <li key={i} className="text-sm text-slate-700">
                  <span className="font-medium">{m.medicineNameAndStrength}</span>
                  {m.activeIngredient ? ` (${m.activeIngredient})` : ''}
                  <span
                    className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.formularyStatus === 'unlisted'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {m.formularyStatus === 'unlisted' ? 'Cap-limited' : 'Fully covered'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {referral.gpMedications.length === 0 && (
          <p className="text-xs text-slate-400 italic">
            No medications on file from the referring GP — this is expected for undiagnosed referrals.
            You will prescribe on the next steps.
          </p>
        )}
      </div>

      {renderNav()}
    </div>
  );

  const renderFindings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900">EEG / Investigation findings</h3>
        <p className="text-sm text-slate-500 mt-1">
          Document your assessment of the results. This note forms the clinical evidence for the CIB
          application — be specific about findings, diagnosis status, and your management plan.
        </p>
      </div>

      <div className="card space-y-5">
        <div className="space-y-1">
          <label htmlFor="spc-findings" className="label">
            Findings, diagnosis status &amp; management plan
            <span className="text-red-500 ml-1">*</span>
          </label>
          <textarea
            id="spc-findings"
            className="textarea-field"
            rows={10}
            placeholder={`e.g. EEG confirms focal epileptiform discharges in the left temporal region consistent with focal epilepsy. Diagnosis of ${referral.conditionName || 'epilepsy'} established. Patient commenced on carbamazepine 200mg bd under neurology supervision. Annual review scheduled. Full EEG report filed.`}
            value={outcomeNote}
            onChange={(e) => setOutcomeNote(e.target.value)}
          />
          <p className="text-xs text-slate-400 mt-1">
            Vague notes delay Discovery Health CDL registration. Include the investigation modality,
            findings, confirmed diagnosis, and initial treatment plan.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">
            Findings attachments
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => findingsFileInputRef.current?.click()}
              className="btn-secondary inline-flex items-center gap-2 px-4 py-2"
            >
              <Upload className="w-4 h-4" />
              Upload findings
            </button>
            <p className="text-xs text-slate-500">
              Add EEG reports, interpretation PDFs, or investigation images.
            </p>
          </div>
          <input
            ref={findingsFileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            multiple
            className="hidden"
            aria-label="Upload investigation findings"
            title="Upload investigation findings"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length === 0) return;
              setFindingsFiles((prev) => [...prev, ...files]);
              event.currentTarget.value = '';
            }}
          />
          {findingsFiles.length > 0 && (
            <ul className="mt-3 space-y-1">
              {findingsFiles.map((file, idx) => (
                <li key={`${file.name}-${idx}`} className="text-xs text-slate-600">
                  {file.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {renderNav()}
    </div>
  );

  const renderIcd = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900">Confirm diagnosis</h3>
        <p className="text-sm text-slate-500 mt-1">
          Select the ICD-10 code that matches the confirmed diagnosis and enter the date the diagnosis
          was established.
        </p>
      </div>

      <IcdCodeSelection
        condition={referral.conditionName}
        selectedIcdCode={icdCode}
        onSelect={(code, description) => {
          setIcdCode(code);
          setIcdDescription(description);
        }}
      />
      {dataInitError && (
        <p className="text-sm text-rose-600">{dataInitError}</p>
      )}

      <div className="card">
        <label htmlFor="spc-diagnosis-date" className="label">
          Date diagnosis confirmed
        </label>
        <input
          id="spc-diagnosis-date"
          type="date"
          className="input-field"
          value={diagnosisDate}
          onChange={(e) => setDiagnosisDate(e.target.value)}
        />
      </div>

      {renderNav()}
    </div>
  );

  const renderMedication = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900">Prescribe medication</h3>
        <p className="text-sm text-slate-500 mt-1">
          Select the anti-epileptic / chronic medication(s) you are initiating. These will be
          registered against the patient&apos;s CIB chronic benefit.
        </p>
      </div>

      <MedicationSelection
        condition={referral.conditionName}
        selectedPlan={(referral.plan || 'Core') as MedicalPlan}
        benefitState="unregistered"
        medications={medications}
        onAddMedication={(med) => setMedications((prev) => [...prev, med])}
        onRemoveMedication={(idx) => setMedications((prev) => prev.filter((_, i) => i !== idx))}
        showSection12Fields
        showPatientInstructions
        onUpdateSection12={handleUpdateMedicationSection12}
      />

      {medications.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900 mb-2">Captured medicines</p>
          <ul className="space-y-2">
            {medications.map((med, i) => (
              <li key={i} className="text-sm text-slate-700 flex flex-wrap items-center gap-2">
                <span className="font-medium">{med.medicineNameAndStrength}</span>
                {med.selectedStrength && med.selectedStrength !== med.medicineNameAndStrength && (
                  <span className="text-slate-500">· {med.selectedStrength}</span>
                )}
                {med.durationUsed ? (
                  <span className="text-slate-500">· Duration: {med.durationUsed}</span>
                ) : null}
                {med.fundingSource && (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                    {fundingSourceLabel[med.fundingSource]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {renderNav()}
    </div>
  );

  const renderReview = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900">Review &amp; submit</h3>
        <p className="text-sm text-slate-500 mt-1">
          Confirm the diagnosis, findings, and medicines — then submit the CIB registration. The
          referring GP will see this on their dashboard and resumes ongoing management from there.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Stethoscope className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Confirmed diagnosis</h3>
        </div>
        <p className="font-medium text-slate-800">{referral.conditionName || '—'}</p>
        <p className="text-blue-600 font-mono font-semibold mt-1">{icdCode || '—'}</p>
        {icdDescription && <p className="text-sm text-slate-500">{icdDescription}</p>}
        {diagnosisDate && (
          <p className="text-xs text-slate-600 mt-2">Diagnosis date: {diagnosisDate}</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Investigation findings</h3>
        </div>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{outcomeNote.trim() || '—'}</p>
        {findingsFiles.length > 0 && (
          <ul className="mt-3 space-y-1">
            {findingsFiles.map((file, idx) => (
              <li key={`${file.name}-${idx}`} className="text-xs text-slate-500">
                {file.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {medications.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Pill className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Medicines for CIB ({medications.length})</h3>
          </div>
          <ul className="space-y-2">
            {medications.map((med, i) => (
              <li key={i} className="text-sm border border-slate-100 rounded-lg p-3 bg-white">
                <p className="font-medium text-slate-900">{med.medicineNameAndStrength}</p>
                <p className="text-xs text-slate-500">{med.activeIngredient}</p>
                {(med.dosage || med.durationUsed) && (
                  <p className="text-xs text-slate-600 mt-1">
                    {med.dosage && `Dosage: ${med.dosage}`}
                    {med.durationUsed && ` · Duration: ${med.durationUsed}`}
                  </p>
                )}
                {med.note && (
                  <p className="text-xs text-slate-600 mt-1">Patient instructions: {med.note}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {med.fundingSource && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                      {fundingSourceLabel[med.fundingSource]}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {submitError && <p className="text-sm text-rose-600">{submitError}</p>}

      {renderNav()}
    </div>
  );

  // ─── Success screen (stay mounted until user returns to inbox) ─────────────

  const renderDone = () => (
    <div className="space-y-6">
      <div className="card text-center space-y-4 py-8">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
        <div>
          <p className="text-lg font-semibold text-slate-900">CIB registration submitted</p>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            {referral.patientName}&apos;s {referral.conditionName || 'chronic condition'} registration
            has been recorded. The referring GP will see it on their dashboard and takes over ongoing
            management from here.
          </p>
        </div>
        <button type="button" onClick={handleFinish} className="btn-primary px-6 py-2.5">
          Back to referrals
        </button>
      </div>
    </div>
  );

  // ─── Navigation bar ───────────────────────────────────────────────────────

  const canGoNext: Record<Phase, boolean> = {
    overview: true,
    findings: canProceedFromFindings,
    icd: canProceedFromIcd,
    medication: canProceedFromMedication,
    review: Boolean(icdCode),
    done: false,
  };

  const renderNav = () => {
    const isFirst = phase === 'overview';
    const isLast = phase === 'review';

    return (
      <div className="flex justify-between">
        <button
          type="button"
          onClick={isFirst ? onClose : goBack}
          className="btn-secondary inline-flex items-center gap-2 px-4 py-2"
        >
          <ChevronLeft className="w-4 h-4" />
          {isFirst ? 'Back to referrals' : 'Back'}
        </button>

        {isLast ? (
          <button
            type="button"
            disabled={!icdCode || isSubmitting}
            onClick={handleSubmit}
            className="btn-primary inline-flex items-center gap-2 px-8 py-3 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {isSubmitting ? 'Submitting…' : 'Submit CIB registration'}
          </button>
        ) : (
          <button
            type="button"
            disabled={!canGoNext[phase]}
            onClick={goNext}
            className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 disabled:opacity-50"
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  // ─── Step indicator — mirrors the doctor workflow's numbered-circle steps ──

  const renderStepIndicator = () => (
    <div className="mb-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-x-auto">
      <div className="flex items-start min-w-[42rem]">
        {PHASES.map((p, i) => {
          const isPast = stepIndex > i;
          const isCurrent = stepIndex === i;
          return (
            <div key={p} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0 px-0.5">
                <div
                  className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${
                    isPast || isCurrent
                      ? 'authi-gradient text-white'
                      : 'bg-indigo-50 text-indigo-400'
                  }`}
                >
                  {isPast ? <CheckCircle className="w-5 h-5" /> : i + 1}
                </div>
                <span
                  className={`mt-2 w-full text-center text-[11px] sm:text-xs font-medium leading-tight min-h-[2.75rem] ${
                    isPast || isCurrent ? 'text-slate-900' : 'text-indigo-300'
                  }`}
                >
                  {phaseLabel[p]}
                </span>
              </div>
              {i < PHASES.length - 1 && (
                <div className="relative flex h-10 shrink-0 items-center flex-1 min-w-[0.75rem] max-w-[2.5rem] px-0.5">
                  <div
                    className={`h-1 w-full rounded-full ${isPast ? 'authi-gradient' : 'bg-slate-200'}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── Shared header — matches the doctor workflow header exactly ───────────

  const renderHeader = (subtitle: string) => (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-6 h-6 text-slate-500" />
            </button>
            <div>
              <p className="text-xl font-semibold text-slate-900 tracking-tight">
                {referral.patientName || 'Patient referral'}
              </p>
              <p className="text-sm text-slate-500">
                {referral.patientId || 'No ID on file'} · {subtitle}
              </p>
            </div>
          </div>
          {isAlreadyCompleted ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
              Registered
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 font-medium">
              {practiceLabel}
            </span>
          )}
        </div>
      </div>
    </header>
  );

  // ─── Already-completed guard ──────────────────────────────────────────────

  if (isAlreadyCompleted) {
    return (
      <div className="min-h-screen bg-white">
        {renderHeader(`${referral.conditionName || 'Condition not set'} · CIB registration`)}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-lg font-semibold text-slate-900">Registration already completed</p>
            <p className="text-sm text-slate-500">
              CIB registration for {referral.patientName} was submitted on{' '}
              {referral.registrationCompletedAt
                ? new Date(referral.registrationCompletedAt).toLocaleDateString('en-ZA')
                : '—'}
              . No further action is needed on this referral.
            </p>
            <button type="button" onClick={onClose} className="btn-secondary px-5 py-2 mt-2">
              Back to referrals
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      {renderHeader(`${referral.conditionName || 'Condition not set'} · CIB registration`)}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {phase !== 'done' && renderStepIndicator()}

        {phase === 'overview' && renderOverview()}
        {phase === 'findings' && renderFindings()}
        {phase === 'icd' && renderIcd()}
        {phase === 'medication' && renderMedication()}
        {phase === 'review' && renderReview()}
        {phase === 'done' && renderDone()}
      </main>
    </div>
  );
};

export default SpecialistCaseWorkspace;
