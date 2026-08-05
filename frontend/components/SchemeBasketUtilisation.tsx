'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { DataService } from '@/lib/dataService';
import { getBasketDisplayTitle } from '@/lib/ongoingBasketRules';
import { getTreatmentUsageSummary } from '@/lib/ongoingTreatmentUsage';
import { normalizeTreatmentCode } from '@/lib/investigationOrders';
import type { PatientCase, TreatmentItem } from '@/types';

interface SchemeBasketUtilisationProps {
  condition: string;
  patientId: string;
  patientCases: PatientCase[];
  currentCaseId?: string | null;
  ongoingTreatments?: TreatmentItem[];
  className?: string;
}

const SchemeBasketUtilisation = ({
  condition,
  patientId,
  patientCases,
  currentCaseId = null,
  ongoingTreatments = [],
  className = '',
}: SchemeBasketUtilisationProps) => {
  const [basketReady, setBasketReady] = useState(false);

  useEffect(() => {
    void DataService.initialize().then(() => setBasketReady(true));
  }, []);

  const summaries = useMemo(() => {
    if (!basketReady || !condition.trim()) return [];
    const items = DataService.getOngoingBasketForCondition(condition).filter(
      // 2712 is bundled into EEG recording (2711) on the visit — don't double-list it.
      (item) => normalizeTreatmentCode(item.ongoingManagementBasket.code) !== '2712'
    );
    return items.map((item) => {
      const summary = getTreatmentUsageSummary(
        item,
        patientId,
        condition,
        patientCases,
        currentCaseId,
        ongoingTreatments
      );
      return {
        ...summary,
        displayTitle: getBasketDisplayTitle(
          item.ongoingManagementBasket.description,
          item.ongoingManagementBasket.code
        ),
      };
    });
  }, [basketReady, condition, patientId, patientCases, currentCaseId, ongoingTreatments]);

  if (!condition.trim() || summaries.length === 0) return null;

  const totalRemaining = summaries.reduce((sum, s) => sum + Math.max(0, s.remaining), 0);
  const totalMax = summaries.reduce((sum, s) => sum + s.maxCovered, 0);

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 ${className}`.trim()}>
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-4 h-4 text-slate-500" />
        <p className="text-sm font-semibold text-slate-900">Scheme basket this year</p>
      </div>
      <p className="text-xs text-slate-600 mb-3">
        {totalRemaining} of {totalMax} covered monitoring sessions remaining. Updates when
        completed ongoing management claims are saved.
      </p>
      <ul className="space-y-1.5">
        {summaries.map((s) => (
          <li key={s.treatmentKey} className="flex justify-between text-xs text-slate-600">
            <span className="truncate pr-2">{s.displayTitle}</span>
            <span className="shrink-0 font-medium">
              {Math.max(0, s.remaining)}/{s.maxCovered} left
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SchemeBasketUtilisation;
