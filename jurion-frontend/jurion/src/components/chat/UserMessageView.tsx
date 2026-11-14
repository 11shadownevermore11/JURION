import { CalendarClock } from "lucide-react";
import type { ReactNode } from "react";
import { formatEventDate, formatTime } from "../../lib/format";

type Props = {
  text: string;
  createdAt: string;
  asOf: string | null;
  state?: "sent" | "sending" | "error";
  children?: ReactNode;
};

export function UserMessageView({ text, createdAt, asOf, state = "sent", children }: Props) {
  return (
    <article className={`msg msg--user is-${state}`} aria-label="Ваш вопрос">
      <div className="msg__body">
        <div className="bubble">
          <p className="pre-wrap">{text}</p>
        </div>
        <div className="msg__meta">
          {asOf && (
            <span className="asof-tag" title="Ответ дан по редакции документов на эту дату">
              <CalendarClock size={12} aria-hidden /> Редакция на {formatEventDate(asOf)}
            </span>
          )}
          <time dateTime={createdAt}>{state === "sending" ? "Отправка…" : formatTime(createdAt)}</time>
        </div>
        {children}
      </div>
    </article>
  );
}
