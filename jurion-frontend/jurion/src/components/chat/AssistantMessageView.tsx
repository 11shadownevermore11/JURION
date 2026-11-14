import { useMemo, useState } from "react";
import {
  Ban,
  BadgeCheck,
  Check,
  CircleAlert,
  CircleHelp,
  CircleSlash,
  Copy,
  FileSearch,
  LoaderCircle,
  MessageSquareReply,
  Printer,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import type { AssistantMessage, UserMessage } from "../../api/types";
import { numberCitations, segmentAnswer } from "../../lib/claims";
import { formatTime, plural } from "../../lib/format";
import { OUTCOME_META } from "../../lib/outcome";
import { answerToPlainText, printReport } from "../../lib/report";
import { useQuoteVerification, type QuoteStatus } from "../../hooks/useQuoteVerification";
import { useApp } from "../../state/AppContext";
import { LogoMark } from "../brand/Logo";
import { IconButton } from "../ui/Button";

type Props = {
  message: AssistantMessage;
  question: UserMessage | null;
  asOf: string | null;
  conversationTitle: string;
  onReply?: () => void;
  canReply: boolean;
};

const OUTCOME_ICON = {
  answered: BadgeCheck,
  partially_answered: CircleAlert,
  needs_clarification: CircleHelp,
  insufficient_evidence: FileSearch,
  invalid_premise: TriangleAlert,
  out_of_scope: CircleSlash,
  disallowed: Ban,
} as const;

function StatusIcon({ s }: { s: QuoteStatus | undefined }) {
  if (s === "match") return <Check size={13} aria-label="Цитата найдена в источнике" className="vq vq--ok" />;
  if (s === "mismatch") return <ShieldAlert size={13} aria-label="Цитата не совпадает с источником" className="vq vq--bad" />;
  if (s === "unavailable") return <CircleAlert size={13} aria-label="Источник недоступен для сверки" className="vq vq--warn" />;
  return <LoaderCircle size={13} aria-label="Сверяем цитату" className="vq spin" />;
}

export function AssistantMessageView({ message, question, asOf, conversationTitle, onReply, canReply }: Props) {
  const { openSource, source, toast } = useApp();
  const { answer } = message;
  const meta = OUTCOME_META[answer.outcome];
  const Icon = OUTCOME_ICON[answer.outcome];
  const [hoverClaim, setHoverClaim] = useState<string | null>(null);

  const numbered = useMemo(() => numberCitations(answer), [answer]);
  const { segments } = useMemo(() => segmentAnswer(message.text, answer), [message.text, answer]);
  const { status, summary } = useQuoteVerification(answer.snapshot_id, numbered);

  const byClaim = useMemo(() => {
    const m = new Map<string, typeof numbered>();
    numbered.forEach((c) => m.set(c.claimId, [...(m.get(c.claimId) ?? []), c]));
    return m;
  }, [numbered]);

  const docCount = new Set(numbered.map((c) => c.label.split(",")[0])).size;
  const activeChunk = source?.snapshotId === answer.snapshot_id ? source.citation.chunk_id : null;

  const open = (c: (typeof numbered)[number]) =>
    openSource({ snapshotId: answer.snapshot_id, citation: c, claimText: c.claimText, index: c.n });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answerToPlainText({ question, answer: message, asOfDate: asOf, conversationTitle }));
      toast("Ответ с основаниями скопирован", "ok");
    } catch {
      toast("Не удалось скопировать: браузер запретил доступ к буферу обмена", "bad");
    }
  };

  // Уточнение показываем один раз: если оно уже есть в тексте, отдельный блок не нужен.
  const clarification =
    answer.clarification_question && !message.text.includes(answer.clarification_question) ? answer.clarification_question : null;

  return (
    <article className={`msg msg--assistant tone-${meta.tone}`} aria-label={`Ответ ассистента: ${meta.label}`}>
      <div className="msg__avatar" aria-hidden>
        <LogoMark size={28} />
      </div>
      <div className="msg__body">
        <header className="answer-head">
          <span className={`outcome outcome--${meta.tone}`} title={meta.hint}>
            <Icon size={14} aria-hidden />
            {meta.label}
          </span>
          <time className="msg__time" dateTime={message.created_at}>
            {formatTime(message.created_at)}
          </time>
        </header>

        <p className="answer-text pre-wrap">
          {segments.map((seg, i) => {
            if (!seg.claimId) return <span key={i}>{seg.text}</span>;
            const cites = byClaim.get(seg.claimId) ?? [];
            return (
              <span
                key={i}
                className={`claim-inline ${hoverClaim === seg.claimId ? "is-hover" : ""}`}
                onMouseEnter={() => setHoverClaim(seg.claimId)}
                onMouseLeave={() => setHoverClaim(null)}
              >
                {seg.text}
                {cites.map((c) => (
                  <button
                    key={c.n}
                    type="button"
                    className={`cite-sup ${activeChunk === c.chunk_id ? "is-active" : ""}`}
                    onClick={() => open(c)}
                    aria-label={`Основание ${c.n}: ${c.label}`}
                  >
                    {c.n}
                  </button>
                ))}
              </span>
            );
          })}
        </p>

        {clarification && (
          <div className="callout callout--info">
            <CircleHelp size={16} aria-hidden />
            <div>
              <p className="callout__title">{clarification}</p>
              {canReply && onReply && (
                <button type="button" className="link-btn" onClick={onReply}>
                  <MessageSquareReply size={14} aria-hidden /> Ответить в этом чате
                </button>
              )}
            </div>
          </div>
        )}

        {answer.claims.length > 0 && (
          <section className="evidence" aria-label="Основания">
            <header className="evidence__head">
              <h3>Основания</h3>
              <span className="evidence__count tnum">
                {numbered.length} {plural(numbered.length, "положение", "положения", "положений")} из {docCount}{" "}
                {plural(docCount, "документа", "документов", "документов")}
              </span>
            </header>
            <ol className="evidence__list">
              {answer.claims.map((claim) => {
                const cites = byClaim.get(claim.id) ?? [];
                return (
                  <li
                    key={claim.id}
                    className={`evidence__claim ${hoverClaim === claim.id ? "is-hover" : ""}`}
                    onMouseEnter={() => setHoverClaim(claim.id)}
                    onMouseLeave={() => setHoverClaim(null)}
                  >
                    <p className="evidence__claim-text">{claim.text}</p>
                    {cites.length === 0 ? (
                      <p className="evidence__none">Вывод без ссылки на положение</p>
                    ) : (
                      cites.map((c) => (
                        <button
                          key={c.n}
                          type="button"
                          className={`cite-card ${activeChunk === c.chunk_id ? "is-active" : ""}`}
                          onClick={() => open(c)}
                        >
                          <span className="cite-card__n tnum">{c.n}</span>
                          <span className="cite-card__main">
                            <span className="cite-card__label">
                              {c.label}
                              <StatusIcon s={status[c.n - 1]} />
                            </span>
                            <q className="cite-card__quote">{c.quote}</q>
                          </span>
                        </button>
                      ))
                    )}
                  </li>
                );
              })}
            </ol>
            {numbered.length > 0 && (
              <p className={`verify-line ${summary.mismatched ? "is-bad" : summary.done ? "is-ok" : ""}`} aria-live="polite">
                {!summary.done ? (
                  <>
                    <LoaderCircle size={14} className="spin" aria-hidden /> Сверяем цитаты с текстом источников
                  </>
                ) : summary.mismatched ? (
                  <>
                    <ShieldAlert size={14} aria-hidden /> {summary.mismatched}{" "}
                    {plural(summary.mismatched, "цитата не совпадает", "цитаты не совпадают", "цитат не совпадают")} с источником —
                    проверьте вручную
                  </>
                ) : (
                  <>
                    <BadgeCheck size={14} aria-hidden /> Все цитаты дословно найдены в источниках ({summary.matched} из {summary.total})
                    {summary.unavailable ? `, ${summary.unavailable} недоступно для сверки` : ""}
                  </>
                )}
              </p>
            )}
          </section>
        )}

        {answer.missing_information.length > 0 && (
          <section className="missing" aria-label="Чего не хватает">
            <h3>
              <FileSearch size={15} aria-hidden /> Чего не хватает для полного ответа
            </h3>
            <ul>
              {answer.missing_information.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </section>
        )}

        <footer className="msg__actions">
          <IconButton label="Скопировать ответ с основаниями" size="sm" onClick={copy}>
            <Copy size={15} />
          </IconButton>
          <IconButton
            label="Печать справки или сохранение в PDF"
            size="sm"
            onClick={() => printReport({ question, answer: message, asOfDate: asOf, conversationTitle })}
          >
            <Printer size={15} />
          </IconButton>
          <span className="msg__snapshot" title="Снимок базы знаний, по которому сформирован ответ">
            Снимок базы {answer.snapshot_id}
          </span>
        </footer>
      </div>
    </article>
  );
}
