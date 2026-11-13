const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const longFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

/** UTC-время из API → локальное «ЧЧ:ММ». */
export function formatTime(iso: string) {
  return timeFmt.format(new Date(iso));
}

/** UTC-время из API → «ДД.ММ.ГГГГ, ЧЧ:ММ». */
export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${dateFmt.format(d)}, ${timeFmt.format(d)}`;
}

/** Дата события YYYY-MM-DD (без часового пояса) → «ДД.ММ.ГГГГ». */
export function formatEventDate(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

export function formatEventDateLong(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return longFmt.format(new Date(y, m - 1, d));
}

export function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type DayGroup = "Сегодня" | "Вчера" | "За неделю" | "Ранее";

export function dayGroup(iso: string, now = new Date()): DayGroup {
  const d = new Date(iso);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= start) return "Сегодня";
  if (t >= start - 86_400_000) return "Вчера";
  if (t >= start - 6 * 86_400_000) return "За неделю";
  return "Ранее";
}

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
