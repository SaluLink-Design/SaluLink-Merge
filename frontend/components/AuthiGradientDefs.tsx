/** Shared SVG gradient defs for Authi-stroked icons (Lucide stroke="url(#…)"). */
export default function AuthiGradientDefs() {
  return (
    <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden>
      <defs>
        <linearGradient id="authi-stroke-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38b6ff" />
          <stop offset="28%" stopColor="#4f9fff" />
          <stop offset="58%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
    </svg>
  );
}
