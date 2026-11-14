import { useEffect, useState } from "react";
import { CircleAlert, RotateCw, WifiOff } from "lucide-react";
import type { AnswerRun } from "../../api/types";
import { describeError, HttpError } from "../../api/client";
import terminal from "../../assets/brand/terminal.webp";
import { LogoMark } from "../brand/Logo";
import { Button } from "../ui/Button";

export function Thinking({ since, trouble }: { since: string; trouble: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const sec = Math.max(0, Math.round((now - new Date(since).getTime()) / 1000));
  return (
    <div className="msg msg--assistant thinking" role="status" aria-live="polite">
      <div className="msg__avatar" aria-hidden>
        <LogoMark size={28} />
      </div>
      <div className="msg__body">
        <div className="thinking__card">
        <img className="thinking__terminal" src={terminal} alt="" width={56} height={43} />
        <div className="thinking__main">
        <div className="thinking__row">
          <span>{trouble ? "Нет связи с сервером — продолжаем ждать ответ" : "Ищу положения в базе знаний и готовлю ответ"}</span>
          {trouble ? <WifiOff size={14} aria-hidden /> : <span className="thinking__time tnum">{sec} с</span>}
        </div>
        <span className="thinking__bar" aria-hidden />
        <p className="thinking__note">Историю и источники можно просматривать, пока ответ готовится.</p>
        </div>
        </div>
      </div>
    </div>
  );
}

export function RunFailed({ run, onRetry, retrying }: { run: Extract<AnswerRun, { state: "failed" }>; onRetry: () => void; retrying: boolean }) {
  const d = describeError(new HttpError(500, run.error, null));
  return (
    <div className="run-error" role="alert">
      <CircleAlert size={16} aria-hidden />
      <div className="run-error__text">
        <p className="run-error__title">{d.title}</p>
        <p>{run.error.retryable ? `${d.detail} Вопрос сохранён — можно повторить.` : `${d.detail} Задайте вопрос заново.`}</p>
      </div>
      {run.error.retryable && (
        <Button size="sm" variant="primary" icon={<RotateCw size={14} />} onClick={onRetry} loading={retrying}>
          Повторить
        </Button>
      )}
    </div>
  );
}
