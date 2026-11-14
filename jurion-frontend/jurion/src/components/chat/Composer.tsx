import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, CalendarClock, LoaderCircle, X } from "lucide-react";
import type { SendResult } from "../../hooks/useChat";
import { formatEventDate, todayYmd } from "../../lib/format";
import { Popover } from "../ui/Popover";

const MAX = 8000;

export type ComposerHandle = { focus: () => void; setText: (t: string) => void };

type Props = {
  onSend: (text: string, asOf: string | null) => Promise<SendResult>;
  busy: boolean;
  disabled?: boolean;
  compact?: boolean;
  asOf: string | null;
  onAsOfChange: (v: string | null) => void;
  placeholder?: string;
  onNotice: (t: string) => void;
};

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { onSend, busy, disabled, compact, asOf, onAsOfChange, placeholder, onNotice },
  ref,
) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => ta.current?.focus(),
    setText: (t: string) => {
      setText(t);
      requestAnimationFrame(() => {
        ta.current?.focus();
        ta.current?.setSelectionRange(t.length, t.length);
      });
    },
  }));

  // Автовысота поля.
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, compact ? 140 : 220) + "px";
  }, [text, compact]);

  const trimmedLen = text.trim().length;
  const tooLong = trimmedLen > MAX;
  const canSend = trimmedLen > 0 && !tooLong && !busy && !disabled && !submitting;

  const submit = async () => {
    if (!trimmedLen) {
      setError("Введите вопрос.");
      return;
    }
    if (tooLong) {
      setError(`Сократите вопрос до ${MAX.toLocaleString("ru-RU")} символов.`);
      return;
    }
    if (!canSend) return;
    const value = text;
    setError(null);
    setSubmitting(true);
    setText("");
    const res = await onSend(value, asOf);
    setSubmitting(false);
    if (!res.ok) {
      setText(res.restoreText);
      if (res.fieldError) setError(res.fieldError);
      if (res.notice) onNotice(res.notice);
    }
    ta.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className={`composer ${compact ? "composer--compact" : ""} ${error ? "has-error" : ""}`}>
      <label htmlFor={compact ? "q-widget" : "q-main"} className="sr-only">
        Вопрос ассистенту
      </label>
      <textarea
        id={compact ? "q-widget" : "q-main"}
        ref={ta}
        rows={1}
        value={text}
        placeholder={placeholder ?? "Спросите о договоре, регламенте или норме…"}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={onKeyDown}
        aria-invalid={!!error || tooLong}
        aria-describedby="composer-hint"
        disabled={disabled}
      />
      <div className="composer__bar">
        <Popover
          id={compact ? "asof-pop-w" : "asof-pop"}
          label="Редакция документов на дату"
          side="top"
          trigger={({ open, toggle, id }) => (
            <button
              type="button"
              className={`chip ${asOf ? "chip--set" : ""}`}
              onClick={toggle}
              aria-expanded={open}
              aria-controls={id}
              title="Ответ будет дан по редакции документов, действовавшей на выбранную дату"
            >
              <CalendarClock size={14} aria-hidden />
              {asOf ? `Редакция на ${formatEventDate(asOf)}` : "Редакция на дату"}
            </button>
          )}
        >
          {(close) => (
            <div className="asof-pop">
              <p className="asof-pop__title">Дата события</p>
              <p className="asof-pop__hint">
                Ассистент учтёт редакцию договоров и изменения по допсоглашениям на эту дату.
              </p>
              <input
                type="date"
                className="input"
                value={asOf ?? ""}
                max="2100-12-31"
                min="1990-01-01"
                onChange={(e) => onAsOfChange(e.target.value || null)}
                aria-label="Дата события"
              />
              <div className="asof-pop__actions">
                <button type="button" className="link-btn" onClick={() => onAsOfChange(todayYmd())}>
                  Сегодня
                </button>
                {asOf && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      onAsOfChange(null);
                      close();
                    }}
                  >
                    Без даты
                  </button>
                )}
                <button type="button" className="btn btn--primary btn--sm" onClick={close}>
                  <span>Готово</span>
                </button>
              </div>
            </div>
          )}
        </Popover>
        {asOf && (
          <button type="button" className="chip-clear" onClick={() => onAsOfChange(null)} aria-label="Убрать дату редакции">
            <X size={13} />
          </button>
        )}

        <span id="composer-hint" className={`composer__hint ${tooLong ? "is-bad" : ""}`}>
          {error ? (
            <span className="composer__error" role="alert">
              {error}
            </span>
          ) : trimmedLen > MAX - 1000 ? (
            <span className="tnum">
              {trimmedLen.toLocaleString("ru-RU")} / {MAX.toLocaleString("ru-RU")}
            </span>
          ) : busy ? (
            "Ответ готовится…"
          ) : compact ? null : (
            <>Enter — отправить, Shift+Enter — новая строка</>
          )}
        </span>

        <button type="button" className="send-btn" onClick={() => void submit()} disabled={!canSend} aria-label="Отправить вопрос">
          {submitting || busy ? <LoaderCircle size={18} className="spin" aria-hidden /> : <ArrowUp size={18} aria-hidden />}
        </button>
      </div>
    </div>
  );
});
