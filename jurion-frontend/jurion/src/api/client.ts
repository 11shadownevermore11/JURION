import type {
  AnswerRun,
  ApiError,
  Conversation,
  ConversationPage,
  KnowledgeBase,
  MessagePage,
  SendMessageBody,
  SourceChunk,
} from "./types";

export const API_BASE = "/api/v1";

/** Ответ вне 2xx с телом `{ error: ApiError }`. */
export class HttpError extends Error {
  readonly status: number;
  readonly error: ApiError;
  readonly retryAfterSec: number | null;

  constructor(status: number, error: ApiError, retryAfterSec: number | null) {
    super(error.message);
    this.name = "HttpError";
    this.status = status;
    this.error = error;
    this.retryAfterSec = retryAfterSec;
  }
}

/** Сетевой сбой: запрос мог дойти до сервера, а мог и нет. */
export class NetworkError extends Error {
  constructor(message = "Нет соединения с сервером") {
    super(message);
    this.name = "NetworkError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<{ status: number; data: T }> {
  try {
    return await rawRequest<T>(path, opts);
  } catch (e) {
    // Сессия истекла: инициализируем её заново и повторяем запрос один раз.
    // Повтор безопасен — отправки защищены Idempotency-Key.
    if (e instanceof HttpError && e.status === 401 && path !== "/knowledge-bases") {
      await rawRequest("/knowledge-bases");
      return rawRequest<T>(path, opts);
    }
    throw e;
  }
}

async function rawRequest<T>(path: string, opts: RequestOptions = {}): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new NetworkError();
  }

  if (res.ok) {
    const data = (await res.json()) as T;
    return { status: res.status, data };
  }

  let apiError: ApiError = {
    code: "UNKNOWN",
    message: "Техническая ошибка сервера",
    retryable: res.status >= 500,
  };
  try {
    const body = (await res.json()) as { error?: ApiError };
    if (body?.error?.code) apiError = body.error;
  } catch {
    /* тело не JSON — оставляем общее описание */
  }
  const ra = res.headers.get("Retry-After");
  const retryAfter = ra && /^\d+$/.test(ra) ? Number(ra) : null;
  throw new HttpError(res.status, apiError, retryAfter);
}

export const api = {
  async listKnowledgeBases(): Promise<KnowledgeBase[]> {
    const { data } = await request<{ items: KnowledgeBase[] }>("/knowledge-bases");
    return data.items;
  },

  async createConversation(knowledgeBaseId: string): Promise<Conversation> {
    const { data } = await request<Conversation>("/conversations", {
      method: "POST",
      body: { knowledge_base_id: knowledgeBaseId },
    });
    return data;
  },

  async listConversations(cursor?: string | null, limit = 20): Promise<ConversationPage> {
    const q = new URLSearchParams({ limit: String(limit) });
    if (cursor) q.set("cursor", cursor);
    const { data } = await request<ConversationPage>(`/conversations?${q}`);
    return data;
  },

  async getMessages(conversationId: string, beforeSeq?: number | null, limit = 30): Promise<MessagePage> {
    const q = new URLSearchParams({ limit: String(limit) });
    if (beforeSeq != null) q.set("before_seq", String(beforeSeq));
    const { data } = await request<MessagePage>(
      `/conversations/${encodeURIComponent(conversationId)}/messages?${q}`,
    );
    return data;
  },

  async sendMessage(conversationId: string, body: SendMessageBody, idempotencyKey: string): Promise<AnswerRun> {
    const { data } = await request<AnswerRun>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      body,
      idempotencyKey,
    });
    return data;
  },

  async getRun(runId: string, signal?: AbortSignal): Promise<AnswerRun> {
    const { data } = await request<AnswerRun>(`/runs/${encodeURIComponent(runId)}`, { signal });
    return data;
  },

  async retryRun(runId: string, idempotencyKey: string): Promise<AnswerRun> {
    const { data } = await request<AnswerRun>(`/runs/${encodeURIComponent(runId)}/retry`, {
      method: "POST",
      idempotencyKey,
    });
    return data;
  },

  async getChunk(snapshotId: string, chunkId: string): Promise<SourceChunk> {
    const { data } = await request<SourceChunk>(
      `/sources/${encodeURIComponent(snapshotId)}/chunks/${encodeURIComponent(chunkId)}`,
    );
    return data;
  },

  /** Оригинал источника. `url` берётся из `SourceChunk.file.url` как есть. */
  async getOriginalText(url: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(url, { credentials: "same-origin", headers: { Accept: "text/plain" } });
    } catch {
      throw new NetworkError();
    }
    if (!res.ok) {
      throw new HttpError(
        res.status,
        { code: res.status === 404 ? "NOT_FOUND" : "UNKNOWN", message: "Не удалось открыть оригинал", retryable: res.status >= 500 },
        null,
      );
    }
    return res.text();
  },
};

/** Человекочитаемое описание ошибки для интерфейса. */
export function describeError(e: unknown): { title: string; detail: string; code: string } {
  if (e instanceof HttpError) {
    const { code, message } = e.error;
    switch (code) {
      case "NOT_FOUND":
        return { code, title: "Не найдено", detail: message || "Чат, попытка или источник недоступны." };
      case "RATE_LIMITED":
        return {
          code,
          title: "Слишком много запросов",
          detail: e.retryAfterSec
            ? `Повторите через ${e.retryAfterSec} с.`
            : "Подождите немного и повторите.",
        };
      case "VALIDATION_ERROR":
        return { code, title: "Проверьте вопрос", detail: e.error.field_errors?.[0]?.message ?? message };
      case "IDEMPOTENCY_CONFLICT":
        return { code, title: "Ошибка отправки", detail: "Вопрос изменился при повторной отправке. Отправьте его заново." };
      case "RETRY_NOT_AVAILABLE":
        return { code, title: "Повтор недоступен", detail: "Попытка уже заменена или диалог продолжился. История обновлена." };
      case "MODEL_UNAVAILABLE":
        return { code, title: "Модель временно недоступна", detail: message };
      case "ANSWER_TIMEOUT":
        return { code, title: "Ответ не успел сформироваться", detail: message };
      default:
        return { code, title: "Техническая ошибка", detail: message };
    }
  }
  if (e instanceof NetworkError) {
    return { code: "NETWORK", title: "Нет соединения", detail: "Проверьте сеть. Введённый вопрос сохранён." };
  }
  return { code: "UNKNOWN", title: "Техническая ошибка", detail: "Что-то пошло не так. Введённый вопрос сохранён." };
}
