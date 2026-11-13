// Клиентская сверка цитат: проверяем, что цитата из ответа дословно
// присутствует во фрагменте источника, который вернул сервер.
// Это независимая от модели проверка: если модель исказила формулировку,
// пользователь увидит расхождение.

export type VerifyStatus = "match" | "mismatch";

export function normalizeForCompare(s: string) {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»„“”"']/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*([.,;:!?)])/g, "$1")
    .trim();
}

export function verifyQuote(quote: string, sourceText: string): VerifyStatus {
  const q = normalizeForCompare(quote).replace(/^[".…]+|[".…]+$/g, "");
  if (!q) return "mismatch";
  return normalizeForCompare(sourceText).includes(q) ? "match" : "mismatch";
}

/**
 * Находит цитату в тексте источника и возвращает диапазоны для подсветки.
 * Работает по нормализованному тексту с картой позиций на исходный.
 */
export function findQuoteRange(text: string, quote: string): [number, number] | null {
  const map: number[] = [];
  let norm = "";
  let prevSpace = false;
  for (let i = 0; i < text.length; i++) {
    let ch = text[i].toLowerCase();
    if (ch === "ё") ch = "е";
    if (/[«»„“”"']/.test(ch)) ch = '"';
    if (/\s/.test(ch)) {
      if (prevSpace) continue;
      ch = " ";
      prevSpace = true;
    } else prevSpace = false;
    norm += ch;
    map.push(i);
  }
  const q = quote
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»„“”"']/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[".…]+|[".…]+$/g, "");
  const at = norm.indexOf(q);
  if (at < 0 || !q) return null;
  const start = map[at];
  const end = map[at + q.length - 1] + 1;
  return [start, end];
}
