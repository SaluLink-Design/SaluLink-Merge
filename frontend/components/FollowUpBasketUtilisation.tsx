'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { DataService } from '@/lib/dataService';
import { getTreatmentUsageSummary } from '@/lib/ongoingTreatmentUsage';
import type { PatientCase, TreatmentItem } from '@/types';

interface FollowUpBasketUtilisationProps {
  condition: string;
  patientId: string;
  patientCases: PatientCase[];
  currentCaseId: string | null;
  ongoingTreatments: TreatmentItem[];
}

const FollowUpBasketUtilisation = ({
  condition,
  patientId,
  patientCases,
  currentCaseId,
  ongoingTreatments,
}: FollowUpBasketUtilisationProps) => {
  const [basketReady, setBasketReady] = useState(false);

  useEffect(() => {
    void DataService.initialize().then(() => setBasketReady(true));
  }, []);

  const summaries = useMemo(() => {
    if (!basketReady || !condition.trim()) return [];
    const items = DataService.getOngoingBasketForCondition(condition);
    return items.map((item) =>
      getTreatmentUsageSummary(
        item,
        patientId,
        condition,
        patientCases,
        currentCaseId,
        ongoingTreatments
      )
    );
  }, [basketReady, condition, patientId, patientCases, currentCaseId, ongoingTreatments]);

  if (!condition.trim() || summaries.length === 0) return null;

  const totalRemaining = summaries.reduce((sum, s) => sum + Math.max(0, s.remaining), 0);
  const totalMax = summaries.reduce((sum, s) => sum + s.maxCovered, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-4 h-4 text-slate-500" />
        <p className="text-sm font-semibold text-slate-900">Scheme basket this year</p>
      </div>
      <p className="text-xs text-slate-600 mb-3">
        {totalRemaining} of {totalMax} covered monitoring sessions remaining across basket items.
      </p>
      <ul className="space-y-1.5">
        {summaries.slice(0, 4).map((s) => (
          <li key={s.treatmentKey} className="flex justify-between text-xs text-slate-600">
            <span className="truncate pr-2">{s.treatmentKey.split('|')[1] ?? s.treatmentKey}</span>
            <span className="shrink-0 font-medium">
              {Math.max(0, s.remaining)}/{s.maxCovered} left
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FollowUpBasketUtilisation;
