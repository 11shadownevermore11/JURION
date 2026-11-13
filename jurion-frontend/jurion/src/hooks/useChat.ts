import { useCallback, useEffect, useRef, useState } from "react";
import { api, describeError, HttpError, NetworkError } from "../api/client";
import type { AnswerRun, Conversation, Message } from "../api/types";
import { rememberAsOf } from "../lib/localNotes";
import { uuid } from "../lib/uuid";

export type PendingSend = {
  localId: string;
  text: string;
  asOf: string | null;
  /** Ключ идемпотентности: один и тот же для сетевых повторов этой отправки. */
  key: string;
  status: "sending" | "error";
  error?: { title: string; detail: string };
  createdAt: string;
};

export type SendResult = { ok: true } | { ok: false; restoreText: string; fieldError?: string; notice?: string };

type Options = {
  conversationId: string | null;
  knowledgeBaseId: string | null;
  onConversationCreated: (c: Conversation) => void;
  onActivity: () => void;
  onNotice: (text: string, tone?: "ok" | "bad" | "info") => void;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mergeMessages(prev: Message[], incoming: (Message | null | undefined)[]): Message[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) if (m) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.seq - b.seq);
}

export function useChat({ conversationId, knowledgeBaseId, onConversationCreated, onActivity, onNotice }: Options) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [nextBeforeSeq, setNextBeforeSeq] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [run, setRun] = useState<AnswerRun | null>(null);
  const [pollTrouble, setPollTrouble] = useState(false);
  const [pending, setPending] = useState<PendingSend | null>(null);
  const [retrying, setRetrying] = useState(false);

  const gen = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adoptedId = useRef<string | null>(null);
  const retryKeys = useRef(new Map<string, string>());
  const convIdRef = useRef(conversationId);
  convIdRef.current = conversationId;

  const cb = useRef({ onConversationCreated, onActivity, onNotice });
  cb.current = { onConversationCreated, onActivity, onNotice };

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
  }, []);

  // applyRun и poll ссылаются друг на друга — держим в ref.
  const applyRunRef = useRef<(r: AnswerRun, token: number) => void>(() => {});

  const poll = useCallback(
    (runId: string, token: number, delay = 1000) => {
      stopPolling();
      pollTimer.current = setTimeout(async () => {
        if (token !== gen.current) return;
        try {
          const r = await api.getRun(runId);
          if (token !== gen.current) return;
          setPollTrouble(false);
          applyRunRef.current(r, token);
        } catch (e) {
          if (token !== gen.current) return;
          if (e instanceof HttpError && e.status === 404) {
            setRun(null);
            cb.current.onNotice("Запрос больше недоступен. История обновлена.", "bad");
            return;
          }
          setPollTrouble(true);
          poll(runId, token, 2500);
        }
      }, delay);
    },
    [stopPolling],
  );

  applyRunRef.current = (r: AnswerRun, token: number) => {
    if (token !== gen.current) return;
    setMessages((prev) => mergeMessages(prev, [r.user_message, r.assistant_message]));
    if (r.state === "completed") {
      stopPolling();
      setRun(null);
      cb.current.onActivity();
    } else if (r.state === "running") {
      setRun(r);
      poll(r.run_id, token);
    } else {
      stopPolling();
      setRun(r);
    }
  };

  const loadHistory = useCallback(
    async (id: string) => {
      const token = ++gen.current;
      stopPolling();
      setHistoryStatus("loading");
      setHistoryError(null);
      try {
        const page = await api.getMessages(id);
        if (token !== gen.current) return;
        setConversation(page.conversation);
        setMessages(page.items);
        setNextBeforeSeq(page.next_before_seq);
        setHistoryStatus("ready");
        const last = page.items[page.items.length - 1];
        // Последняя реплика пользователя без ответа: восстанавливаем ожидание или кнопку повтора.
        if (page.latest_run_id && last?.role === "user") {
          const r = await api.getRun(page.latest_run_id);
          applyRunRef.current(r, token);
        }
      } catch (e) {
        if (token !== gen.current) return;
        setHistoryStatus("error");
        setHistoryError(describeError(e).detail);
      }
    },
    [stopPolling],
  );

  useEffect(() => {
    if (conversationId && conversationId === adoptedId.current) {
      // Диалог только что создан этой вкладкой при первой отправке — состояние уже актуально.
      adoptedId.current = null;
      return;
    }
    gen.current++;
    stopPolling();
    setRun(null);
    setPending(null);
    setPollTrouble(false);
    setMessages([]);
    setNextBeforeSeq(null);
    setConversation(null);
    if (conversationId) void loadHistory(conversationId);
    else setHistoryStatus("ready");
  }, [conversationId, loadHistory, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const submit = useCallback(async (p: PendingSend, convId: string): Promise<SendResult> => {
    const token = gen.current;
    const body = p.asOf ? { text: p.text, as_of_date: p.asOf } : { text: p.text };
    setPending({ ...p, status: "sending", error: undefined });

    for (let attempt = 0; ; attempt++) {
      try {
        const r = await api.sendMessage(convId, body, p.key);
        if (token !== gen.current) return { ok: true };
        setPending(null);
        if (p.asOf) rememberAsOf(r.user_message.id, p.asOf);
        applyRunRef.current(r, token);
        cb.current.onActivity();
        return { ok: true };
      } catch (e) {
        if (token !== gen.current) return { ok: true };
        // Обрыв соединения: повторяем тот же POST с тем же ключом и телом.
        if (e instanceof NetworkError && attempt < 2) {
          await sleep(900 * (attempt + 1));
          continue;
        }
        if (e instanceof HttpError) {
          const { code, run_id, field_errors } = e.error;
          if (code === "VALIDATION_ERROR") {
            setPending(null);
            return { ok: false, restoreText: p.text, fieldError: field_errors?.[0]?.message ?? e.error.message };
          }
          if (code === "RUN_IN_PROGRESS") {
            setPending(null);
            if (run_id) {
              try {
                applyRunRef.current(await api.getRun(run_id), token);
              } catch {
                /* опрос восстановится при следующем открытии */
              }
            }
            return { ok: false, restoreText: p.text, notice: "Предыдущий вопрос ещё обрабатывается. Текст сохранён." };
          }
          if ((e.status === 503 || e.status === 504) && run_id) {
            try {
              const r = await api.getRun(run_id);
              setPending(null);
              if (p.asOf) rememberAsOf(r.user_message.id, p.asOf);
              applyRunRef.current(r, token);
              cb.current.onActivity();
              return { ok: true };
            } catch {
              /* падаем в общий случай ниже */
            }
          }
        }
        setPending({ ...p, status: "error", error: describeError(e) });
        return { ok: true };
      }
    }
  }, []);

  const send = useCallback(
    async (text: string, asOf: string | null): Promise<SendResult> => {
      const trimmed = text.trim();
      if (!trimmed) return { ok: false, restoreText: text, fieldError: "Введите вопрос." };
      if (trimmed.length > 8000) return { ok: false, restoreText: text, fieldError: "Вопрос длиннее 8 000 символов." };

      let convId = convIdRef.current;
      if (!convId) {
        if (!knowledgeBaseId) return { ok: false, restoreText: text, notice: "База знаний ещё загружается." };
        try {
          const conv = await api.createConversation(knowledgeBaseId);
          convId = conv.id;
          adoptedId.current = conv.id;
          gen.current++;
          setConversation(conv);
          setHistoryStatus("ready");
          cb.current.onConversationCreated(conv);
        } catch (e) {
          const d = describeError(e);
          return { ok: false, restoreText: text, notice: `${d.title}. ${d.detail}` };
        }
      }
      const p: PendingSend = {
        localId: uuid(),
        text: trimmed,
        asOf,
        key: uuid(),
        status: "sending",
        createdAt: new Date().toISOString(),
      };
      return submit(p, convId);
    },
    [knowledgeBaseId, submit],
  );

  const resendPending = useCallback(() => {
    if (pending && convIdRef.current) void submit(pending, convIdRef.current);
  }, [pending, submit]);

  const discardPending = useCallback(() => {
    const t = pending?.text ?? "";
    setPending(null);
    return t;
  }, [pending]);

  const retry = useCallback(async () => {
    if (!run || run.state !== "failed" || !run.error.retryable) return;
    const token = gen.current;
    let key = retryKeys.current.get(run.run_id);
    if (!key) {
      key = uuid();
      retryKeys.current.set(run.run_id, key);
    }
    setRetrying(true);
    try {
      const r = await api.retryRun(run.run_id, key);
      applyRunRef.current(r, token);
    } catch (e) {
      if (token !== gen.current) return;
      if (e instanceof HttpError && e.error.code === "RETRY_NOT_AVAILABLE") {
        cb.current.onNotice("Повтор недоступен: попытка уже заменена. История обновлена.", "bad");
        if (convIdRef.current) void loadHistory(convIdRef.current);
      } else if (e instanceof HttpError && (e.status === 503 || e.status === 504) && e.error.run_id) {
        try {
          applyRunRef.current(await api.getRun(e.error.run_id), token);
        } catch {
          cb.current.onNotice("Не удалось получить состояние запроса. Повторите.", "bad");
        }
      } else {
        const d = describeError(e);
        cb.current.onNotice(`${d.title}. ${d.detail}`, "bad");
      }
    } finally {
      if (token === gen.current) setRetrying(false);
    }
  }, [run, loadHistory]);

  const loadOlder = useCallback(async () => {
    const id = convIdRef.current;
    if (!id || nextBeforeSeq == null || loadingOlder) return;
    const token = gen.current;
    setLoadingOlder(true);
    try {
      const page = await api.getMessages(id, nextBeforeSeq);
      if (token !== gen.current) return;
      setMessages((prev) => mergeMessages(prev, page.items));
      setNextBeforeSeq(page.next_before_seq);
    } catch (e) {
      cb.current.onNotice(describeError(e).detail, "bad");
    } finally {
      if (token === gen.current) setLoadingOlder(false);
    }
  }, [nextBeforeSeq, loadingOlder]);

  const reload = useCallback(() => {
    if (convIdRef.current) void loadHistory(convIdRef.current);
  }, [loadHistory]);

  const busy = pending?.status === "sending" || run?.state === "running";

  return {
    conversation,
    messages,
    historyStatus,
    historyError,
    hasOlder: nextBeforeSeq != null,
    loadingOlder,
    loadOlder,
    run,
    pollTrouble,
    pending,
    retrying,
    busy,
    send,
    resendPending,
    discardPending,
    retry,
    reload,
  };
}
