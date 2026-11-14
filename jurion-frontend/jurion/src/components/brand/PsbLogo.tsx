import lockup from "../../assets/brand/psb-lockup.svg?raw";
import compact from "../../assets/brand/psb-logo.svg?raw";

/**
 * Логотип ПСБ, перенесённый в вектор из материалов кейса.
 * Белые элементы знака наследуют currentColor, поэтому логотип
 * работает и на тёмной «обложке», и на светлом фоне.
 */
export function PsbLogo({ variant = "lockup", className = "" }: { variant?: "lockup" | "compact"; className?: string }) {
  return (
    <span
      role="img"
      aria-label="ПСБ — банк сильной страны"
      className={`psb-logo psb-logo--${variant} ${className}`}
      dangerouslySetInnerHTML={{ __html: variant === "lockup" ? lockup : compact }}
    />
  );
}
