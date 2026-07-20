'use client';

import { FlaskConical } from 'lucide-react';
import type { InvestigationOrder } from '@/types';
import { canMockExternalProvider, normalizeTreatmentCode } from '@/lib/investigationOrders';

interface MockProviderResultsPanelProps {
  orders: InvestigationOrder[];
  onSimulateResults: (orderId: string) => void;
}

const providerLabel = (order: InvestigationOrder): string => {
  const code = normalizeTreatmentCode(order.treatmentCode);
  if (code === '4081' || order.assigneeRole === 'pathologist') {
    return 'pathology laboratory';
  }
  if (code === '2711' || order.assigneeRole === 'clinical_technologist') {
    return 'neurodiagnostic / clinical technologist';
  }
  if (order.assigneeRole) {
    return order.assigneeRole.replace(/_/g, ' ');
  }
  return 'external provider';
};

const MockProviderResultsPanel = ({ orders, onSimulateResults }: MockProviderResultsPanelProps) => {
  if (!canMockExternalProvider()) return null;

  const pending = orders.filter((o) => o.status === 'ordered');
  if (pending.length === 0) return null;

  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="w-4 h-4 text-amber-700" />
        <p className="text-sm font-semibold text-amber-900">Simulate external result return (demo)</p>
      </div>
      <p className="text-xs text-amber-800 mb-3">
        You are not performing this test. In production the assigned provider returns results to the
        practice. Use this only to demo the lab/provider callback.
      </p>
      <ul className="space-y-2">
        {pending.map((order) => (
          <li
            key={order.id}
            className="flex items-center justify-between gap-3 text-sm bg-white rounded-lg border border-amber-200 px-3 py-2"
          >
            <div className="min-w-0">
              <span className="text-slate-700 block truncate">{order.label}</span>
              <span className="text-[11px] text-slate-500">Awaiting {providerLabel(order)}</span>
            </div>
            <button
              type="button"
              onClick={() => onSimulateResults(order.id)}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 shrink-0"
            >
              {normalizeTreatmentCode(order.treatmentCode) === '4081' ||
              order.assigneeRole === 'pathologist'
                ? 'Simulate pathology return'
                : 'Simulate results received'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MockProviderResultsPanel;
