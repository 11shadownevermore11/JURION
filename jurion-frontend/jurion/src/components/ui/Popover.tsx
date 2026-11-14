import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  trigger: (p: { open: boolean; toggle: () => void; id: string }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  side?: "top" | "bottom";
  id: string;
  label: string;
};

/** Небольшой поповер: закрывается по Esc и клику снаружи, возвращает фокус на триггер. */
export function Popover({ trigger, children, align = "start", side = "bottom", id, label }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        (root.current?.querySelector("[aria-controls]") as HTMLElement | null)?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) (root.current?.querySelector(`#${id} button, #${id} input, #${id} [tabindex]`) as HTMLElement | null)?.focus();
  }, [open, id]);

  return (
    <div className="popover-root" ref={root}>
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      {open && (
        <div id={id} role="dialog" aria-label={label} className={`popover popover--${align} popover--${side}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
