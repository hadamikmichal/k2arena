// Pomocnicze funkcje dat/godzin. Daty to "YYYY-MM-DD" w czasie lokalnym (Europe/Warsaw),
// godziny to minuty od północy – dzięki temu nie ma problemów ze strefami i zmianą czasu.

export const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];
export const WEEKDAYS_LONG = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmtHours(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? `${h} h` : `${h.toFixed(1).replace(".", ",")} h`;
}

function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + n);
  return format(d);
}

/** 1 = poniedziałek ... 7 = niedziela */
export function isoWeekday(date: string): number {
  const wd = parse(date).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function startOfWeek(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function todayWarsaw(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());
}

export function fmtDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

export function fmtDayShort(date: string): string {
  const [, m, d] = date.split("-");
  return `${WEEKDAYS[isoWeekday(date) - 1]} ${d}.${m}`;
}

export function monthBounds(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

export function isoWeekNumber(date: string): number {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + 4 - isoWeekday(date));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
