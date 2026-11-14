import { useId } from "react";

type Props = { compact?: boolean; className?: string };

/** Знак JURION: литера «J» на авроре ПСБ, точка — «точка опоры», подтверждающее положение. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="logo-mark">
      <defs>
        <linearGradient id={`jm-${id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#8d87ff" />
          <stop offset="0.55" stopColor="#c59cf0" />
          <stop offset="1" stopColor="#ff6200" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#jm-${id})`} />
      <path d="M19 7v12.5a5.5 5.5 0 0 1-11 0" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="23.6" cy="8.6" r="2.6" fill="#001f74" />
    </svg>
  );
}

export function Logo({ compact, className = "" }: Props) {
  return (
    <div className={`logo ${className}`}>
      <LogoMark size={34} />
      {!compact && (
        <div className="logo__text">
          <span className="logo__word">JURION</span>
          <span className="logo__sub">Юридический интеллект нового поколения</span>
        </div>
      )}
    </div>
  );
}
