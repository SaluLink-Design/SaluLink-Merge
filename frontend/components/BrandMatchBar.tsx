'use client';

interface BrandMatchBarProps {
  percent: number;
  showLabel?: boolean;
  className?: string;
}

const BrandMatchBar = ({ percent, showLabel = true, className = '' }: BrandMatchBarProps) => {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div className={`flex flex-col gap-1 min-w-[100px] ${className}`}>
      {showLabel && (
        <span className="text-xs font-semibold text-violet-700 tabular-nums">{clamped}% match</span>
      )}
      <div className="brand-progress-track">
        <div className="brand-progress-fill transition-all duration-300" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
};

export default BrandMatchBar;
