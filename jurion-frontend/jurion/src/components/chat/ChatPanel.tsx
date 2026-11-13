import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ChevronUp, CircleAlert, Pencil, RotateCw } from "lucide-react";
import type { Conversation, Message, UserMessage } from "../../api/types";
import { useChat } from "../../hooks/useChat";
import { recallAsOf } from "../../lib/localNotes";
import { useApp } from "../../state/AppContext";
import { Button } from "../ui/Button";
import { AssistantMessageView } from "./AssistantMessageView";
import { Composer, type ComposerHandle } from "./Composer";
import { EmptyState, type Suggestion } from "./EmptyState";
import { RunFailed, Thinking } from "./RunStatus";
import { UserMessageView } from "./UserMessageView";

type Props = {
  conversationId: string | null;
  compact?: boolean;
  header: (p: { title: string; conversation: Conversation | null }) => ReactNode;
  onConversationCreated: (c: Conversation) => void;
  onActivity: () => void;
  /** Внешний запрос сфокусировать поле ввода (например, по горячей клавише). */
  focusSignal?: number;
  /** Подставить текст в поле ввода (контекстный вопрос из рабочей системы). */
  prefill?: { text: string; n: number } | null;
};

export function ChatPanel({ conversationId, compact, header, onConversationCreated, onActivity, focusSignal, prefill }: Props) {
  const { session, toast } = useApp();
  const kb = session.status === "ready" ? session.kb : null;
  const chat = useChat({
    conversationId,
    knowledgeBaseId: kb?.id ?? null,
    onConversationCreated,
    onActivity,
    onNotice: toast,
  });
  const [asOf, setAsOf] = useState<string | null>(null);
  const composer = useRef<ComposerHandle>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    if (focusSignal) composer.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    if (prefill) composer.current?.setText(prefill.text);
  }, [prefill]);

  useEffect(() => {
    setAsOf(null);
    stick.current = true;
  }, [conversationId]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stick.current = nearBottom;
    setShowJump(!nearBottom);
  };

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // При новых репликах держим ленту внизу, если пользователь не прокрутил вверх.
  useLayoutEffect(() => {
    if (stick.current) scrollToBottom();
  }, [chat.messages.length, chat.pending, chat.run?.state, chat.historyStatus, scrollToBottom]);

  const send = useCallback(
    async (text: string, date: string | null) => {
      stick.current = true;
      return chat.send(text, date);
    },
    [chat],
  );

  const pick = (s: Suggestion) => {
    if (s.asOf) setAsOf(s.asOf);
    void send(s.question, s.asOf ?? asOf);
  };

  const title = chat.conversation?.title ?? (conversationId ? "" : "Новый диалог");
  const last = chat.messages[chat.messages.length - 1];
  const empty = chat.historyStatus === "ready" && chat.messages.length === 0 && !chat.pending;

  const findQuestion = (idx: number): UserMessage | null => {
    for (let i = idx - 1; i >= 0; i--) if (chat.messages[i].role === "user") return chat.messages[i] as UserMessage;
    return null;
  };

  const runUserId = chat.run?.user_message.id;

  const renderMessage = (m: Message, idx: number) => {
    if (m.role === "user") {
      return (
        <UserMessageView key={m.id} text={m.text} createdAt={m.created_at} asOf={recallAsOf(m.id)}>
          {chat.run?.state === "failed" && runUserId === m.id && (
            <RunFailed run={chat.run} onRetry={() => void chat.retry()} retrying={chat.retrying} />
          )}
        </UserMessageView>
      );
    }
    const q = findQuestion(idx);
    return (
      <AssistantMessageView
        key={m.id}
        message={m}
        question={q}
        asOf={q ? recallAsOf(q.id) : null}
        conversationTitle={title || "Диалог"}
        canReply={m === last && !chat.busy}
        onReply={() => composer.current?.focus()}
      />
    );
  };

  return (
    <section className={`chat ${compact ? "chat--compact" : ""}`} aria-label="Чат с ассистентом">
      {header({ title, conversation: chat.conversation })}

      <div className="chat__scroll scroll" ref={scroller} onScroll={onScroll}>
        <div className="chat__column">
          {chat.historyStatus === "loading" && (
            <div className="skeleton-list" aria-label="Загрузка истории" role="status">
              <div className="sk sk--right" />
              <div className="sk sk--left" />
              <div className="sk sk--right sk--short" />
              <div className="sk sk--left sk--tall" />
            </div>
          )}

          {chat.historyStatus === "error" && (
            <div className="state-block" role="alert">
              <CircleAlert size={20} aria-hidden />
              <p className="state-block__title">Не удалось открыть диалог</p>
              <p>{chat.historyError}</p>
              <Button variant="primary" icon={<RotateCw size={15} />} onClick={chat.reload}>
                Загрузить снова
              </Button>
            </div>
          )}

          {empty && kb && <EmptyState onPick={pick} compact={compact} kbTitle={kb.title} />}

          {chat.historyStatus === "ready" && chat.hasOlder && (
            <div className="older">
              <Button size="sm" variant="ghost" icon={<ChevronUp size={14} />} onClick={() => void chat.loadOlder()} loading={chat.loadingOlder}>
                Показать более ранние сообщения
              </Button>
            </div>
          )}

          {chat.historyStatus === "ready" && chat.messages.map(renderMessage)}

          {chat.pending && (
            <UserMessageView
              text={chat.pending.text}
              createdAt={chat.pending.createdAt}
              asOf={chat.pending.asOf}
              state={chat.pending.status === "error" ? "error" : "sending"}
            >
              {chat.pending.status === "error" && chat.pending.error && (
                <div className="run-error" role="alert">
                  <CircleAlert size={16} aria-hidden />
                  <div className="run-error__text">
                    <p className="run-error__title">{chat.pending.error.title}</p>
                    <p>{chat.pending.error.detail}</p>
                  </div>
                  <div className="run-error__actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Pencil size={14} />}
                      onClick={() => composer.current?.setText(chat.discardPending())}
                    >
                      Изменить
                    </Button>
                    <Button size="sm" variant="primary" icon={<RotateCw size={14} />} onClick={chat.resendPending}>
                      Отправить снова
                    </Button>
                  </div>
                </div>
              )}
            </UserMessageView>
          )}

          {chat.run?.state === "running" && <Thinking since={chat.run.user_message.created_at} trouble={chat.pollTrouble} />}
        </div>
      </div>

      {showJump && (
        <button
          type="button"
          className="jump"
          onClick={() => {
            stick.current = true;
            scrollToBottom(true);
          }}
          aria-label="К последнему сообщению"
        >
          <ArrowDown size={16} />
        </button>
      )}

      <div className="chat__composer">
        <div className="chat__column">
          <Composer
            ref={composer}
            onSend={send}
            busy={chat.busy}
            disabled={!kb || chat.historyStatus === "loading" || chat.historyStatus === "error"}
            compact={compact}
            asOf={asOf}
            onAsOfChange={setAsOf}
            onNotice={(t) => toast(t, "info")}
            placeholder={
              last?.role === "assistant" && last.answer.outcome === "needs_clarification"
                ? "Ответьте на уточняющий вопрос…"
                : undefined
            }
          />
          {!compact && (
            <p className="disclaimer">
              JURION отвечает только по базе знаний и может ошибаться. Перед использованием выводов откройте основания.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
