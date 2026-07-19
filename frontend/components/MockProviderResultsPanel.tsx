'use client';

import { FlaskConical } from 'lucide-react';
import type { InvestigationOrder } from '@/types';
import { canMockExternalProvider } from '@/lib/investigationOrders';

interface MockProviderResultsPanelProps {
  orders: InvestigationOrder[];
  onSimulateResults: (orderId: string) => void;
}

const MockProviderResultsPanel = ({ orders, onSimulateResults }: MockProviderResultsPanelProps) => {
  if (!canMockExternalProvider()) return null;

  const pending = orders.filter((o) => o.status === 'ordered');
  if (pending.length === 0) return null;

  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="w-4 h-4 text-amber-700" />
        <p className="text-sm font-semibold text-amber-900">Simulated external provider (MVP)</p>
      </div>
      <p className="text-xs text-amber-800 mb-3">
        In production, the assigned provider uploads results. For now, simulate results returning to
        the practice.
      </p>
      <ul className="space-y-2">
        {pending.map((order) => (
          <li
            key={order.id}
            className="flex items-center justify-between gap-3 text-sm bg-white rounded-lg border border-amber-200 px-3 py-2"
          >
            <span className="text-slate-700">{order.label}</span>
            <button
              type="button"
              onClick={() => onSimulateResults(order.id)}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 shrink-0"
            >
              Simulate results received
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MockProviderResultsPanel;
