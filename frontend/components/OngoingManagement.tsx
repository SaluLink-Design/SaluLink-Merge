'use client';

import { useState, useEffect } from 'react';
import { Upload, Repeat, X, FileText, Download, Check, CheckCircle, ChevronDown, ChevronUp, Scale, Activity, TrendingUp, TrendingDown, AlertTriangle, Loader2, BarChart3, Zap } from 'lucide-react';
import { ClinicalAppeal, PatientCase, TreatmentBasketItem, TreatmentItem } from '@/types';
import { DataService } from '@/lib/dataService';
import {
  getMaxCoveredFromBasketItem,
  getTreatmentKey,
  getTreatmentUsageSummary,
  hasClinicalAppealForTreatment,
} from '@/lib/ongoingTreatmentUsage';
import FileUploadWithRename from './FileUploadWithRename';

interface OngoingAssessmentResult {
  stability_signal: {
    signal: string;
    confidence: number;
    explanation: string;
  };
  basket_utilisation_pct: number;
  basket_headroom: number;
  basket_status: string;
  monitoring_due: string[];
  formulary_drift_detected: boolean;
  formulary_drift_note: string;
  escalation_recommended: boolean;
  recommendations: string[];
}

const STABILITY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  controlled: {
    label: 'Condition Controlled',
    icon: <TrendingUp className="w-4 h-4" />,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  deteriorating: {
    label: 'Deteriorating — Review Needed',
    icon: <TrendingDown className="w-4 h-4" />,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  escalation_needed: {
    label: 'Escalation Recommended',
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  insufficient_data: {
    label: 'Insufficient Data',
    icon: <Activity className="w-4 h-4" />,
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  },
};

interface OngoingManagementProps {
  condition: string;
  patientId: string;
  patientCases: PatientCase[];
  currentCaseId: string | null;
  treatments: TreatmentItem[];
  /** Clinical note text — used for Workflow B AI stability assessment */
  clinicalNote?: string;
  onAddTreatment: (treatment: TreatmentItem) => void;
  onUpdateTreatment: (index: number, treatment: Partial<TreatmentItem>) => void;
  onRemoveTreatment: (index: number) => void;
  onExportSingleTreatment: (index: number) => void;
  onSubmitClinicalAppeal: (appeal: Omit<ClinicalAppeal, 'createdAt'>) => void;
  onSaveOnly: () => void;
  onSavePdfOnly: () => void;
  onSaveWithAttachments: () => void;
}

const OngoingManagement = ({
  condition,
  patientId,
  patientCases,
  currentCaseId,
  treatments,
  clinicalNote = '',
  onAddTreatment,
  onUpdateTreatment,
  onRemoveTreatment,
  onExportSingleTreatment,
  onSubmitClinicalAppeal,
  onSaveOnly,
  onSavePdfOnly,
  onSaveWithAttachments,
}: OngoingManagementProps) => {
  const [basketItems, setBasketItems] = useState<TreatmentBasketItem[]>([]);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [appealTargetKey, setAppealTargetKey] = useState<string | null>(null);
  const [appealRationale, setAppealRationale] = useState('');
  const [appealImages, setAppealImages] = useState<string[]>([]);

  // Workflow B cyclical dashboard state
  const [assessment, setAssessment] = useState<OngoingAssessmentResult | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const [dashboardExpanded, setDashboardExpanded] = useState(true);

  useEffect(() => {
    setBasketItems(DataService.getOngoingBasketForCondition(condition));
  }, [condition]);

  // Trigger AI assessment when clinical note or basket usage changes
  useEffect(() => {
    if (!condition) return;
    const totalAllowed = basketItems.reduce((sum, item) => {
      const n = parseInt(item.ongoingManagementBasket.covered ?? '1', 10);
      return sum + (Number.isNaN(n) ? 1 : n);
    }, 0);
    const totalUsed = treatments.reduce((sum, t) => sum + (t.timesCompleted || 0), 0);
    const currentMeds: string[] = [];

    const timer = setTimeout(async () => {
      if (!condition.trim()) return;
      setIsAssessing(true);
      try {
        const response = await fetch('/api/ongoing-assessment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clinical_note: clinicalNote || 'Ongoing management visit.',
            condition_name: condition,
            icd_code: '',
            basket_items_used: totalUsed,
            basket_total_allowed: totalAllowed,
            current_medications: currentMeds,
            benefit_state: 'approved_chronic',
          }),
        });
        if (response.ok) {
          const data = await response.json();
          setAssessment(data);
        }
      } catch {
        // Derive locally when backend unavailable
        const pct = totalAllowed > 0 ? Math.round((totalUsed / totalAllowed) * 100) : 0;
        setAssessment({
          stability_signal: { signal: 'insufficient_data', confidence: 0.5, explanation: 'Backend unavailable — add a clinical note to enable AI stability assessment.' },
          basket_utilisation_pct: pct,
          basket_headroom: Math.max(0, totalAllowed - totalUsed),
          basket_status: pct >= 100 ? 'exhausted' : pct >= 75 ? 'approaching_limit' : 'within_limits',
          monitoring_due: [],
          formulary_drift_detected: false,
          formulary_drift_note: '',
          escalation_recommended: false,
          recommendations: [],
        });
      } finally {
        setIsAssessing(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [condition, clinicalNote, treatments.length, basketItems.length]);  // eslint-disable-line react-hooks/exhaustive-deps

  const getItemIndex = (item: TreatmentBasketItem) =>
    treatments.findIndex((t) => t.description === item.ongoingManagementBasket.description);

  const isItemSelected = (item: TreatmentBasketItem) => getItemIndex(item) !== -1;

  const getItemTreatment = (item: TreatmentBasketItem) =>
    treatments.find((t) => t.description === item.ongoingManagementBasket.description);

  const getUsage = (item: TreatmentBasketItem) =>
    getTreatmentUsageSummary(item, patientId, condition, patientCases, currentCaseId, treatments);

  const canUseViaAppeal = (item: TreatmentBasketItem) => {
    const key = getTreatmentKey(
      item.ongoingManagementBasket.code,
      item.ongoingManagementBasket.description
    );
    return hasClinicalAppealForTreatment(patientId, key, patientCases);
  };

  const resetAppealForm = () => {
    setAppealTargetKey(null);
    setAppealRationale('');
    setAppealImages([]);
  };

  const handleSubmitAppeal = (item: TreatmentBasketItem) => {
    if (!appealRationale.trim()) {
      alert('Please provide clinical evidence for the appeal.');
      return;
    }

    onSubmitClinicalAppeal({
      treatmentCode: item.ongoingManagementBasket.code,
      treatmentDescription: item.ongoingManagementBasket.description,
      rationale: appealRationale.trim(),
      images: appealImages,
    });

    resetAppealForm();
    alert('Clinical appeal recorded. You may now document this treatment beyond the baseline basket.');
  };

  const handleClickItem = (item: TreatmentBasketItem) => {
    const desc = item.ongoingManagementBasket.description;
    const usage = getUsage(item);
    const isSelected = isItemSelected(item);

    if (isSelected) {
      setExpandedItem((prev) => (prev === desc ? null : desc));
      return;
    }

    if (usage.isExhausted && !canUseViaAppeal(item)) {
      setAppealTargetKey(usage.treatmentKey);
      return;
    }

    if (usage.remaining <= 0 && !canUseViaAppeal(item)) {
      setAppealTargetKey(usage.treatmentKey);
      return;
    }

    const maxCovered = getMaxCoveredFromBasketItem(item);
    onAddTreatment({
      description: desc,
      code: item.ongoingManagementBasket.code,
      maxCovered,
      timesCompleted: 1,
      viaClinicalAppeal: usage.isExhausted && canUseViaAppeal(item),
      documentation: { notes: '', images: [] },
    });
    setExpandedItem(desc);
  };

  const handleRemoveItem = (e: React.MouseEvent, item: TreatmentBasketItem) => {
    e.stopPropagation();
    const idx = getItemIndex(item);
    if (idx !== -1) onRemoveTreatment(idx);
    if (expandedItem === item.ongoingManagementBasket.description) setExpandedItem(null);
  };

  const handleExportItem = (e: React.MouseEvent, item: TreatmentBasketItem) => {
    e.stopPropagation();
    const idx = getItemIndex(item);
    if (idx !== -1) onExportSingleTreatment(idx);
  };

  const renderUsageLabel = (item: TreatmentBasketItem) => {
    const usage = getUsage(item);
    const exhausted = usage.isExhausted && !isItemSelected(item) && !canUseViaAppeal(item);

    return (
      <span
        className={
          exhausted
            ? 'font-semibold text-amber-700'
            : usage.totalUsed >= usage.maxCovered
              ? 'font-semibold text-slate-700'
              : 'font-semibold text-slate-700'
        }
      >
        {usage.totalUsed}/{usage.maxCovered} uses
        {exhausted && <span className="ml-1 font-normal text-amber-600">(limit reached)</span>}
      </span>
    );
  };

  const stabilityConfig = assessment ? STABILITY_CONFIG[assessment.stability_signal.signal] ?? STABILITY_CONFIG.insufficient_data : null;

  return (
    <div className="space-y-6">

      {/* ------------------------------------------------------------------ */}
      {/* Cyclical Dashboard — Workflow B evidence maintenance loop            */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setDashboardExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl authi-gradient flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-slate-900 text-sm">Management Cycle Dashboard</p>
              <p className="text-xs text-slate-500">Stability · Basket usage · Monitoring schedule · {new Date().getFullYear()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAssessing && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
            {!isAssessing && stabilityConfig && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${stabilityConfig.color} ${stabilityConfig.bg} ${stabilityConfig.border}`}>
                {stabilityConfig.icon}
                {stabilityConfig.label}
              </span>
            )}
            {dashboardExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {dashboardExpanded && (
          <div className="px-5 pb-5 border-t border-slate-100 space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Stability signal */}
              <div className={`rounded-xl border px-3.5 py-3 ${stabilityConfig ? `${stabilityConfig.bg} ${stabilityConfig.border}` : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Condition Stability</p>
                {stabilityConfig ? (
                  <>
                    <p className={`text-sm font-semibold ${stabilityConfig.color} flex items-center gap-1`}>
                      {stabilityConfig.icon}
                      {stabilityConfig.label}
                    </p>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {assessment?.stability_signal.explanation}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Enter a clinical note to assess stability</p>
                )}
              </div>

              {/* Basket utilisation */}
              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Annual Basket</p>
                {assessment ? (
                  <>
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-2xl font-bold text-slate-900">{assessment.basket_utilisation_pct}%</span>
                      <span className="text-xs text-slate-500 mb-0.5">utilised</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          assessment.basket_status === 'exhausted' ? 'bg-red-400' :
                          assessment.basket_status === 'approaching_limit' ? 'bg-amber-400' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(assessment.basket_utilisation_pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      {assessment.basket_headroom} use{assessment.basket_headroom !== 1 ? 's' : ''} remaining this cycle
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Select basket items to track usage</p>
                )}
              </div>

              {/* Monitoring schedule */}
              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Monitoring Due</p>
                {assessment?.monitoring_due && assessment.monitoring_due.length > 0 ? (
                  <ul className="space-y-1">
                    {assessment.monitoring_due.slice(0, 3).map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">
                    {assessment ? 'No overdue monitoring detected' : 'Monitoring schedule will appear here'}
                  </p>
                )}
              </div>
            </div>

            {/* Escalation alert */}
            {assessment?.escalation_recommended && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <Zap className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Escalation Recommended</p>
                  <p className="text-xs text-red-600 mt-0.5">{assessment.stability_signal.explanation}</p>
                </div>
              </div>
            )}

            {/* Formulary drift */}
            {assessment?.formulary_drift_detected && (
              <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-700">Formulary Drift Detected</p>
                  <p className="text-xs text-amber-600 mt-0.5">{assessment.formulary_drift_note}</p>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {assessment?.recommendations && assessment.recommendations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cycle Recommendations</p>
                {assessment.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                    <Activity className="w-3.5 h-3.5 shrink-0 text-blue-400 mt-0.5" />
                    {rec}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Basket selection list                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="brand-icon">
            <Repeat className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Ongoing Management Basket</h2>
            <p className="text-sm text-slate-500">
              Select and document ongoing monitoring — usage is tracked per patient for the calendar year
            </p>
          </div>
          {treatments.length > 0 && (
            <span className="ml-auto brand-badge-selected inline-flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              {treatments.length} selected
            </span>
          )}
        </div>

        {basketItems.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            No ongoing management items available for this condition.
          </p>
        ) : (
          <div className="space-y-3">
            {basketItems.map((item, idx) => {
              const isSelected = isItemSelected(item);
              const treatment = getItemTreatment(item);
              const treatmentIndex = getItemIndex(item);
              const usage = getUsage(item);
              const treatmentKey = usage.treatmentKey;
              const isExpanded =
                expandedItem === item.ongoingManagementBasket.description && isSelected;
              const exhausted = usage.isExhausted && !isSelected && !canUseViaAppeal(item);
              const showAppealPanel = appealTargetKey === treatmentKey && exhausted;
              const appealGranted = canUseViaAppeal(item);

              const sessionCap = treatment?.viaClinicalAppeal
                ? usage.maxCovered + 5
                : Math.max(1, usage.remaining);

              return (
                <div
                  key={idx}
                  className={`transition-all duration-200 ${
                    isSelected
                      ? 'brand-card-selected'
                      : exhausted
                        ? 'brand-card opacity-90'
                        : 'brand-card'
                  }`}
                >
                  <button
                    type="button"
                    className={`w-full text-left px-4 py-3.5 ${exhausted ? 'cursor-default' : ''}`}
                    onClick={() => !exhausted && handleClickItem(item)}
                    disabled={exhausted && !showAppealPanel}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-semibold text-slate-900 leading-snug">
                            {item.ongoingManagementBasket.description}
                          </h4>
                          {isSelected && (
                            <span className="brand-badge-selected inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> Selected
                            </span>
                          )}
                          {treatment?.viaClinicalAppeal && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                              <Scale className="w-3 h-3" />
                              Appeal
                            </span>
                          )}
                          {appealGranted && !isSelected && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Appeal approved
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                          <span>
                            Code:{' '}
                            <span className="font-mono text-slate-400">
                              {item.ongoingManagementBasket.code}
                            </span>
                          </span>
                          <span>{renderUsageLabel(item)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isSelected ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => handleExportItem(e, item)}
                              className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
                              title="Export this treatment as ZIP"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleRemoveItem(e, item)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remove"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <div className="brand-check">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </>
                        ) : exhausted ? (
                          <span className="text-xs font-medium text-amber-700 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200">
                            Unavailable
                          </span>
                        ) : (
                          <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                        )}
                      </div>
                    </div>
                  </button>

                  {exhausted && (
                    <div className="px-4 pb-4 border-t border-amber-200/60 bg-amber-50/40">
                      <p className="pt-3 text-sm text-slate-600">
                        This treatment has used all covered sessions for {new Date().getFullYear()}.
                        File a clinical appeal with supporting evidence if care must exceed the baseline
                        basket.
                      </p>
                      {!showAppealPanel ? (
                        <button
                          type="button"
                          onClick={() => setAppealTargetKey(treatmentKey)}
                          className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold authi-gradient text-white hover:opacity-90 transition"
                        >
                          <Scale className="w-4 h-4" />
                          Clinical Appeal
                        </button>
                      ) : (
                        <div className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Clinical evidence &amp; rationale
                            </label>
                            <textarea
                              rows={4}
                              value={appealRationale}
                              onChange={(e) => setAppealRationale(e.target.value)}
                              placeholder="e.g. severe inflammation markers, medication adjustments, or clinical justification for care beyond the standard baseline basket…"
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder-slate-400 resize-none"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Supporting documents
                            </label>
                            <FileUploadWithRename
                              images={appealImages}
                              onImagesChange={setAppealImages}
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleSubmitAppeal(item)}
                              className="btn-primary text-sm"
                            >
                              Submit Clinical Appeal
                            </button>
                            <button
                              type="button"
                              onClick={resetAppealForm}
                              className="btn-secondary text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isSelected && !isExpanded && treatment && (
                    <button
                      type="button"
                      className="w-full px-4 pb-3 text-left border-t border-violet-200/60"
                      onClick={() => setExpandedItem(item.ongoingManagementBasket.description)}
                      title="Expand findings"
                    >
                      <p className="pt-2.5 text-sm text-slate-500 italic">
                        {treatment.documentation.notes
                          ? treatment.documentation.notes.length > 70
                            ? treatment.documentation.notes.substring(0, 70) + '…'
                            : treatment.documentation.notes
                          : 'Tap to add findings & documents'}
                      </p>
                    </button>
                  )}

                  {isSelected && isExpanded && treatment && (
                    <div
                      className="px-4 pb-5 border-t border-violet-200/60"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="pt-4 space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Uses this claim
                          </label>
                          <div className="flex items-center gap-3 flex-wrap">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateTreatment(treatmentIndex, {
                                  timesCompleted: Math.max(1, treatment.timesCompleted - 1),
                                })
                              }
                              disabled={treatment.timesCompleted <= 1}
                              className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-700 disabled:opacity-40"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-lg font-semibold text-slate-900">
                              {treatment.timesCompleted}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateTreatment(treatmentIndex, {
                                  timesCompleted: treatment.timesCompleted + 1,
                                })
                              }
                              disabled={treatment.timesCompleted >= sessionCap}
                              className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-700 disabled:opacity-40"
                            >
                              +
                            </button>
                            <span className="text-sm text-slate-500">
                              <span className="font-semibold text-slate-700">
                                {usage.totalUsed}/{usage.maxCovered}
                              </span>{' '}
                              uses this year
                              {treatment.viaClinicalAppeal && (
                                <span className="ml-2 text-amber-700">(beyond baseline via appeal)</span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Findings &amp; Results
                          </label>
                          <textarea
                            rows={4}
                            placeholder="Enter findings, results and clinical notes…"
                            value={treatment.documentation.notes}
                            onChange={(e) =>
                              onUpdateTreatment(treatmentIndex, {
                                documentation: {
                                  ...treatment.documentation,
                                  notes: e.target.value,
                                },
                              })
                            }
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white text-slate-900 placeholder-slate-400"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Upload Documents
                          </label>
                          <FileUploadWithRename
                            images={treatment.documentation.images}
                            onImagesChange={(images) =>
                              onUpdateTreatment(treatmentIndex, {
                                documentation: { ...treatment.documentation, images },
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3 justify-end">
          <button onClick={onSavePdfOnly} className="btn-secondary flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Save &amp; Export PDF Only
          </button>
          <button onClick={onSaveWithAttachments} className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Save &amp; Export with Attachments (ZIP)
          </button>
          <button
            onClick={onSaveOnly}
            disabled={treatments.length === 0}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            Confirm and Save Claim
          </button>
        </div>
      </div>
    </div>
  );
};

export default OngoingManagement;
