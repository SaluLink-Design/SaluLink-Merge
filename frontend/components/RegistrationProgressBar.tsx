'use client';

interface RegistrationProgressBarProps {
  percent: number;
  completed: number;
  total: number;
  compact?: boolean;
}

const RegistrationProgressBar = ({
  percent,
  completed,
  total,
  compact = false,
}: RegistrationProgressBarProps) => (
  <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
    <div className="flex items-center justify-between gap-3">
      <p className={`font-semibold text-slate-900 ${compact ? 'text-sm' : 'text-base'}`}>
        Registration Progress
      </p>
      <span className={`font-bold text-emerald-700 ${compact ? 'text-sm' : 'text-lg'}`}>
        {percent}% Complete
      </span>
    </div>
    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full rounded-full authi-gradient transition-all duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
    {!compact && total > 0 && (
      <p className="text-xs text-slate-500">
        {completed} of {total} requirements satisfied
      </p>
    )}
  </div>
);

export default RegistrationProgressBar;
