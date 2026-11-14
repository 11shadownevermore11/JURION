import type { ButtonHTMLAttributes, ComponentPropsWithRef, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "evidence";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md";
  icon?: ReactNode;
  /** Элемент справа от подписи, например подсказка клавиш. */
  trailing?: ReactNode;
  loading?: boolean;
};

export function Button({ variant = "secondary", size = "md", icon, trailing, loading, children, className = "", disabled, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn btn--${variant} btn--${size} ${className}`}
    >
      {loading ? <LoaderCircle size={16} className="spin" aria-hidden /> : icon}
      {children && <span>{children}</span>}
      {trailing}
    </button>
  );
}

type IconButtonProps = ComponentPropsWithRef<"button"> & {
  label: string;
  active?: boolean;
  size?: "sm" | "md";
};

export function IconButton({ label, active, size = "md", className = "", children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={`icon-btn icon-btn--${size} ${active ? "is-active" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
