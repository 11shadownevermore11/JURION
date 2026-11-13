// Дата редакции, выбранная пользователем при отправке, в контракте не
// возвращается в истории. Храним её локально, чтобы показывать у реплики.
const KEY = "jurion.asOf.v1";

function read(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function rememberAsOf(messageId: string, ymd: string) {
  const all = read();
  all[messageId] = ymd;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* игнорируем переполнение */
  }
}

export function recallAsOf(messageId: string): string | null {
  return read()[messageId] ?? null;
}
