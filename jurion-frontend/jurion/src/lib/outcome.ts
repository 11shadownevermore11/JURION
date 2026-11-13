import type { Outcome } from "../api/types";

export type Tone = "ok" | "warn" | "info" | "bad" | "neutral";

export const OUTCOME_META: Record<Outcome, { label: string; tone: Tone; hint: string }> = {
  answered: { label: "Ответ подтверждён", tone: "ok", hint: "Каждый вывод опирается на положения из базы знаний." },
  partially_answered: { label: "Частичный ответ", tone: "warn", hint: "Подтверждена только часть ответа. Ниже — чего не хватает." },
  needs_clarification: { label: "Нужно уточнение", tone: "info", hint: "Ответьте на вопрос ассистента в этом же чате." },
  insufficient_evidence: { label: "Недостаточно данных", tone: "warn", hint: "В базе нет сведений или редакции документа для достоверного ответа." },
  invalid_premise: { label: "Предпосылка неверна", tone: "bad", hint: "Утверждение в вопросе не подтверждается документами." },
  out_of_scope: { label: "Вне тематики", tone: "neutral", hint: "Ассистент отвечает только на юридические вопросы по базе знаний." },
  disallowed: { label: "Обоснованный отказ", tone: "bad", hint: "Запрос противоречит правилам работы или закону." },
};
