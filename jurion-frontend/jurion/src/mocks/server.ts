// Мок-сервер внутри браузера. Перехватывает fetch для /api/v1 и отвечает
// строго по контракту api.md. Состояние хранится в localStorage, поэтому
// перезагрузка страницы во время ожидания ответа восстанавливается так же,
// как с настоящим бэкендом.
import type { AnswerRun, ApiError, AssistantMessage, Conversation, Message, UserMessage } from "../api/types";
import { CHUNKS, DOCUMENTS, SNAPSHOT_ID, chunkText, findChunk, findDocument } from "./knowledgeBase";
import { pickScenario, type Scenario } from "./scenarios";

const STORE_KEY = "jurion.mock.v1";
export const FAIL_NEXT_KEY = "jurion.mock.failNext";
const KB = { id: "kb_psb", title: "База знаний ПСБ" };

type StoredRun = {
  run_id: string;
  conversation_id: string;
  user_message_id: string;
  ready_at: number;
  state: "running" | "completed" | "failed";
  fail: "MODEL_UNAVAILABLE" | "ANSWER_TIMEOUT" | null;
  as_of: string | null;
  assistant_message_id: string | null;
  error: ApiError | null;
};

type Store = {
  seq: number;
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  runs: StoredRun[];
  /** Idempotency-Key → { тело запроса, run_id или ответ ретрая } */
  idem: Record<string, { body: string; run_id: string }>;
  /** Заранее вычисленные ответы для runs */
  pending: Record<string, Scenario>;
};

function emptyStore(): Store {
  return { seq: 1, conversations: [], messages: {}, runs: [], idem: {}, pending: {} };
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...emptyStore(), ...(JSON.parse(raw) as Store) };
  } catch {
    /* повреждённое хранилище — начинаем заново */
  }
  return emptyStore();
}

function save(s: Store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* переполнение хранилища не должно ломать демо */
  }
}

export function resetMockData() {
  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem(FAIL_NEXT_KEY);
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function nextId(s: Store, prefix: string) {
  s.seq += 1;
  return `${prefix}_${s.seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function err(status: number, error: ApiError, headers: Record<string, string> = {}) {
  return json(status, { error }, headers);
}

const notFound = (what: string) => err(404, { code: "NOT_FOUND", message: `${what} не найден.`, retryable: false });

function makeTitle(text: string) {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > 56 ? one.slice(0, 55).trimEnd() + "…" : one;
}

function nextSeq(msgs: Message[]) {
  return msgs.reduce((m, x) => Math.max(m, x.seq), 0) + 1;
}

function buildAssistant(s: Store, run: StoredRun, sc: Scenario): AssistantMessage {
  let claimN = 0;
  const msgs = s.messages[run.conversation_id] ?? [];
  return {
    id: nextId(s, "msg"),
    seq: nextSeq(msgs),
    role: "assistant",
    text: sc.text,
    created_at: nowIso(),
    answer: {
      outcome: sc.outcome,
      snapshot_id: SNAPSHOT_ID,
      claims: sc.claims.map((c) => ({
        id: `claim_${String(++claimN).padStart(2, "0")}`,
        text: c.text,
        citations: c.cites.map((ct) => ({
          chunk_id: ct.chunkId,
          label: findChunk(ct.chunkId)!.label,
          quote: ct.quote,
        })),
      })),
      missing_information: sc.missing,
      clarification_question: sc.clarification,
    },
  };
}

/** Доводит попытку до конечного состояния, если её время пришло. */
function settle(s: Store, run: StoredRun) {
  if (run.state !== "running" || Date.now() < run.ready_at) return;
  if (run.fail) {
    run.state = "failed";
    run.error =
      run.fail === "MODEL_UNAVAILABLE"
        ? { code: "MODEL_UNAVAILABLE", message: "Языковая модель временно недоступна.", retryable: true, run_id: run.run_id }
        : { code: "ANSWER_TIMEOUT", message: "Ответ не сформирован за отведённое время.", retryable: true, run_id: run.run_id };
    delete s.pending[run.run_id];
    return;
  }
  const sc = s.pending[run.run_id];
  if (!sc) return;
  const am = buildAssistant(s, run, sc);
  (s.messages[run.conversation_id] ??= []).push(am);
  run.state = "completed";
  run.assistant_message_id = am.id;
  delete s.pending[run.run_id];
  const conv = s.conversations.find((c) => c.id === run.conversation_id);
  if (conv) conv.updated_at = nowIso();
}

function toRun(s: Store, run: StoredRun): AnswerRun {
  const msgs = s.messages[run.conversation_id] ?? [];
  const user = msgs.find((m) => m.id === run.user_message_id) as UserMessage;
  const base = { run_id: run.run_id, conversation_id: run.conversation_id, user_message: user };
  if (run.state === "completed") {
    const am = msgs.find((m) => m.id === run.assistant_message_id) as AssistantMessage;
    return { ...base, state: "completed", assistant_message: am, error: null };
  }
  if (run.state === "failed") return { ...base, state: "failed", assistant_message: null, error: run.error! };
  return { ...base, state: "running", assistant_message: null, error: null };
}

function latestRun(s: Store, conversationId: string) {
  const list = s.runs.filter((r) => r.conversation_id === conversationId);
  return list[list.length - 1] ?? null;
}

function clarifiedFrom(msgs: Message[]): string | null {
  const last = msgs[msgs.length - 1];
  if (last && last.role === "assistant" && last.answer.outcome === "needs_clarification") {
    const prevUser = [...msgs].reverse().find((m) => m.role === "user");
    return prevUser?.text ?? null;
  }
  return null;
}

function scheduleRun(
  s: Store,
  conversationId: string,
  userMessage: UserMessage,
  scenario: Scenario,
  fail: StoredRun["fail"],
  asOf: string | null,
): StoredRun {
  const delay = scenario.instant && !fail ? 0 : (scenario.delayMs ?? 2400) + Math.round(Math.random() * 600);
  const run: StoredRun = {
    run_id: nextId(s, "run"),
    conversation_id: conversationId,
    user_message_id: userMessage.id,
    ready_at: Date.now() + delay,
    state: "running",
    fail,
    as_of: asOf,
    assistant_message_id: null,
    error: null,
  };
  s.runs.push(run);
  s.pending[run.run_id] = scenario;
  return run;
}

function respondWithRun(s: Store, run: StoredRun) {
  settle(s, run);
  save(s);
  const body = toRun(s, run);
  if (run.state === "completed") return json(200, body);
  if (run.state === "failed") return err(run.error!.code === "ANSWER_TIMEOUT" ? 504 : 503, run.error!);
  return json(202, body);
}

async function handle(method: string, url: URL, headers: Headers, bodyText: string | null): Promise<Response> {
  const s = load();
  const path = url.pathname.replace(/^\/api\/v1/, "");
  let m: RegExpMatchArray | null;

  // Ленивое доведение всех попыток до актуального состояния.
  s.runs.forEach((r) => settle(s, r));

  if (method === "GET" && path === "/knowledge-bases") {
    save(s);
    return json(200, { items: [KB] });
  }

  if (path === "/conversations") {
    if (method === "POST") {
      let kbId: unknown;
      try {
        kbId = JSON.parse(bodyText || "{}").knowledge_base_id;
      } catch {
        kbId = undefined;
      }
      if (kbId !== KB.id) {
        return err(422, {
          code: "VALIDATION_ERROR",
          message: "Не указана база знаний.",
          retryable: false,
          field_errors: [{ field: "knowledge_base_id", message: "Выберите базу знаний." }],
        });
      }
      const ts = nowIso();
      const conv: Conversation = { id: nextId(s, "conv"), knowledge_base_id: KB.id, title: "Новый диалог", created_at: ts, updated_at: ts };
      s.conversations.push(conv);
      s.messages[conv.id] = [];
      save(s);
      return json(201, conv);
    }
    const limit = Math.min(Number(url.searchParams.get("limit") || 20), 50);
    const offset = Number(url.searchParams.get("cursor") || 0);
    const sorted = [...s.conversations].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const items = sorted.slice(offset, offset + limit);
    save(s);
    return json(200, { items, next_cursor: offset + limit < sorted.length ? String(offset + limit) : null });
  }

  if ((m = path.match(/^\/conversations\/([^/]+)\/messages$/))) {
    const convId = decodeURIComponent(m[1]);
    const conv = s.conversations.find((c) => c.id === convId);
    if (!conv) return notFound("Диалог");
    const msgs = (s.messages[convId] ??= []);

    if (method === "GET") {
      const limit = Math.min(Number(url.searchParams.get("limit") || 30), 100);
      const before = url.searchParams.get("before_seq");
      const pool = msgs.filter((x) => (before ? x.seq < Number(before) : true)).sort((a, b) => a.seq - b.seq);
      const items = pool.slice(-limit);
      const latest = latestRun(s, convId);
      save(s);
      return json(200, {
        conversation: conv,
        items,
        next_before_seq: pool.length > items.length ? items[0].seq : null,
        latest_run_id: latest?.run_id ?? null,
      });
    }

    // POST — отправка вопроса
    const key = headers.get("Idempotency-Key");
    if (!key) {
      return err(422, { code: "VALIDATION_ERROR", message: "Нужен заголовок Idempotency-Key.", retryable: false });
    }
    const prior = s.idem[key];
    if (prior) {
      if (prior.body !== bodyText) {
        return err(409, { code: "IDEMPOTENCY_CONFLICT", message: "Ключ уже использован для другого запроса.", retryable: false });
      }
      const run = s.runs.find((r) => r.run_id === prior.run_id)!;
      return respondWithRun(s, run);
    }

    let body: { text?: unknown; as_of_date?: unknown };
    try {
      body = JSON.parse(bodyText || "{}");
    } catch {
      body = {};
    }
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const fieldErrors: { field: string; message: string }[] = [];
    if (text.length < 1) fieldErrors.push({ field: "text", message: "Введите вопрос." });
    if (text.length > 8000) fieldErrors.push({ field: "text", message: "Вопрос длиннее 8 000 символов." });
    if (body.as_of_date !== undefined && (typeof body.as_of_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.as_of_date))) {
      fieldErrors.push({ field: "as_of_date", message: "Дата должна быть в формате ГГГГ-ММ-ДД." });
    }
    if (fieldErrors.length) {
      return err(422, { code: "VALIDATION_ERROR", message: "Проверьте введённые данные.", retryable: false, field_errors: fieldErrors });
    }

    const active = s.runs.find((r) => r.conversation_id === convId && r.state === "running");
    if (active) {
      return err(409, { code: "RUN_IN_PROGRESS", message: "Предыдущий вопрос ещё обрабатывается.", retryable: false, run_id: active.run_id });
    }

    const user: UserMessage = { id: nextId(s, "msg"), seq: nextSeq(msgs), role: "user", text, created_at: nowIso() };
    const asOf = typeof body.as_of_date === "string" ? body.as_of_date : null;
    const scenario = pickScenario({
      text,
      asOfDate: asOf,
      clarifiedFrom: clarifiedFrom(msgs),
    });
    msgs.push(user);
    if (msgs.filter((x) => x.role === "user").length === 1) conv.title = makeTitle(text);
    conv.updated_at = nowIso();

    let fail: StoredRun["fail"] = null;
    if (localStorage.getItem(FAIL_NEXT_KEY) === "1" || /#сбой/i.test(text)) {
      fail = "MODEL_UNAVAILABLE";
      localStorage.removeItem(FAIL_NEXT_KEY);
    } else if (/#таймаут/i.test(text)) {
      fail = "ANSWER_TIMEOUT";
    }

    const run = scheduleRun(s, convId, user, scenario, fail, asOf);
    // Таймаут возвращается сразу ответом 504 с run_id.
    if (fail === "ANSWER_TIMEOUT") run.ready_at = Date.now();
    s.idem[key] = { body: bodyText ?? "", run_id: run.run_id };
    return respondWithRun(s, run);
  }

  if (method === "GET" && (m = path.match(/^\/runs\/([^/]+)$/))) {
    const run = s.runs.find((r) => r.run_id === decodeURIComponent(m![1]));
    if (!run) return notFound("Запрос");
    save(s);
    return json(200, toRun(s, run));
  }

  if (method === "POST" && (m = path.match(/^\/runs\/([^/]+)\/retry$/))) {
    const key = headers.get("Idempotency-Key");
    if (!key) return err(422, { code: "VALIDATION_ERROR", message: "Нужен заголовок Idempotency-Key.", retryable: false });
    const prior = s.idem[key];
    if (prior) return respondWithRun(s, s.runs.find((r) => r.run_id === prior.run_id)!);

    const run = s.runs.find((r) => r.run_id === decodeURIComponent(m![1]));
    if (!run) return notFound("Запрос");
    const latest = latestRun(s, run.conversation_id);
    const msgs = s.messages[run.conversation_id] ?? [];
    const lastMsg = msgs[msgs.length - 1];
    if (run.state !== "failed" || !run.error?.retryable || latest?.run_id !== run.run_id || lastMsg?.id !== run.user_message_id) {
      return err(409, { code: "RETRY_NOT_AVAILABLE", message: "Повтор для этой попытки недоступен.", retryable: false });
    }
    const user = msgs.find((x) => x.id === run.user_message_id) as UserMessage;
    const before = msgs.filter((x) => x.seq < user.seq);
    const scenario = pickScenario({ text: user.text, asOfDate: run.as_of, clarifiedFrom: clarifiedFrom(before) });
    const next = scheduleRun(s, run.conversation_id, user, scenario, null, run.as_of);
    s.idem[key] = { body: "", run_id: next.run_id };
    return respondWithRun(s, next);
  }

  if (method === "GET" && (m = path.match(/^\/sources\/([^/]+)\/chunks\/([^/]+)$/))) {
    const [snap, chunkId] = [decodeURIComponent(m[1]), decodeURIComponent(m[2])];
    const chunk = findChunk(chunkId);
    const doc = chunk ? findDocument(chunk.fileId) : null;
    if (snap !== SNAPSHOT_ID || !chunk || !doc) return notFound("Фрагмент источника");
    return json(200, {
      chunk_id: chunk.chunkId,
      snapshot_id: SNAPSHOT_ID,
      document_title: doc.title,
      version_label: doc.versionLabel,
      provision_label: chunk.provision,
      text: chunkText(chunk),
      line_start: chunk.lineStart,
      line_end: chunk.lineEnd,
      file: {
        id: doc.fileId,
        name: doc.fileName,
        media_type: "text/plain",
        url: `/api/v1/sources/${SNAPSHOT_ID}/files/${doc.fileId}`,
      },
    });
  }

  if (method === "GET" && (m = path.match(/^\/sources\/([^/]+)\/files\/([^/]+)$/))) {
    const doc = findDocument(decodeURIComponent(m[2]));
    if (decodeURIComponent(m[1]) !== SNAPSHOT_ID || !doc) return notFound("Файл источника");
    return new Response(doc.lines.join("\n"), { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  return notFound("Ресурс");
}

let installed = false;

export function installMockServer() {
  if (installed) return;
  installed = true;
  // Проверка целостности демо-данных при старте.
  if (CHUNKS.some((c) => !findDocument(c.fileId)) || DOCUMENTS.length === 0) {
    console.warn("[JURION mock] Некорректные демо-данные базы знаний");
  }
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : null;
    const url = new URL(req ? req.url : String(input), window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/v1/")) {
      return realFetch(input, init);
    }
    const method = (init?.method ?? req?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers ?? req?.headers);
    const body = typeof init?.body === "string" ? init.body : null;
    // Небольшая сетевая задержка, чтобы состояния загрузки были видны.
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 180));
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return handle(method, url, headers, body);
  };
}
