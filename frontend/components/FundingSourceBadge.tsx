'use client';

import { FundingSource } from '@/types';
import { fundingSourceShortLabel } from '@/lib/benefitState';

const STYLES: Record<FundingSource, string> = {
  'day-to-day': 'bg-slate-100 text-slate-700 border-slate-200',
  msa: 'bg-violet-50 text-violet-800 border-violet-200',
  pmb_pending: 'bg-amber-50 text-amber-800 border-amber-200',
  chronic_benefit: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

interface FundingSourceBadgeProps {
  source: FundingSource;
  compact?: boolean;
}

const FundingSourceBadge = ({ source, compact }: FundingSourceBadgeProps) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STYLES[source]}`}
    title={fundingSourceShortLabel[source]}
  >
    {compact ? fundingSourceShortLabel[source] : `Funding: ${fundingSourceShortLabel[source]}`}
  </span>
);

export default FundingSourceBadge;
