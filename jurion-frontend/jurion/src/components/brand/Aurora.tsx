import { useId } from "react";

/**
 * «Аврора» с обложки ПСБ: размытая волна от фиолетового к оранжевому.
 * Медленно дрейфует; при prefers-reduced-motion стоит на месте.
 */
export function Aurora({ className = "", intensity = 1 }: { className?: string; intensity?: number }) {
  const id = useId().replace(/:/g, "");
  const g = `aurora-g-${id}`;
  const f = `aurora-f-${id}`;
  return (
    <div className={`aurora ${className}`} aria-hidden style={{ opacity: intensity }}>
      <svg viewBox="0 0 1200 400" preserveAspectRatio="none">
        <defs>
          <linearGradient id={g} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#8d87ff" />
            <stop offset="0.35" stopColor="#b49cff" />
            <stop offset="0.62" stopColor="#ffb08a" />
            <stop offset="1" stopColor="#ff6200" />
          </linearGradient>
          <filter id={f} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>
        <g filter={`url(#${f})`}>
          <path className="aurora__wave aurora__wave--a" d="M-100 250 C 200 120, 520 330, 820 230 S 1200 120, 1320 180 L 1320 300 C 1100 260, 900 380, 620 340 S 150 260, -100 360 Z" fill={`url(#${g})`} />
          <path className="aurora__wave aurora__wave--b" d="M-100 300 C 260 210, 560 360, 860 290 S 1180 220, 1320 250 L 1320 330 C 1050 320, 860 400, 600 380 S 160 330, -100 390 Z" fill={`url(#${g})`} opacity="0.7" />
        </g>
      </svg>
    </div>
  );
}
