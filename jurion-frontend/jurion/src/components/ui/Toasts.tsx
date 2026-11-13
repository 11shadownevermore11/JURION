import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { useApp } from "../../state/AppContext";

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          {t.tone === "ok" ? <CircleCheck size={16} aria-hidden /> : t.tone === "bad" ? <CircleAlert size={16} aria-hidden /> : <Info size={16} aria-hidden />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
