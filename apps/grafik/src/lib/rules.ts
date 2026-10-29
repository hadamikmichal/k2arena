// Silnik reguł grafiku – czyste funkcje bez dostępu do bazy (łatwe do testowania).
import { fmtMin, isoWeekday, WEEKDAYS_LONG } from "./time.ts";

export type Interval = { startMin: number; endMin: number };

export type Rules = {
  /** Godziny otwarcia ściany; indeks 0 = poniedziałek */
  opening: Interval[];
  /** Dni routesettingu (1 = pn) i okno czasowe */
  routesettingDays: number[];
  routesettingWindow: Interval;
  /** Minimalny łączny czas pracy instruktora w danym dniu (minuty) */
  minDailyMin: number;
  /** Maks. liczba instruktorów pracujących jednocześnie; indeks 0 = poniedziałek */
  maxConcurrent: number[];
  /** Minimalna liczba operatorów na dyżurze w godzinach otwarcia */
  minOperators: number;
  /** Dni dla instruktorów stałych (1 = pn); w pozostałe – zleceniobiorcy */
  staffDays: number[];
  /** Generator: docelowa i maksymalna długość dyżuru, długość bloku routesettingu (minuty) */
  shiftTargetMin: number;
  shiftMaxMin: number;
  routesettingLenMin: number;
};

const WEEKDAY_OPEN = { startMin: 10 * 60, endMin: 22 * 60 };
const WEEKEND_OPEN = { startMin: 9 * 60, endMin: 21 * 60 };

export const DEFAULT_RULES: Rules = {
  opening: [WEEKDAY_OPEN, WEEKDAY_OPEN, WEEKDAY_OPEN, WEEKDAY_OPEN, WEEKDAY_OPEN, WEEKEND_OPEN, WEEKEND_OPEN],
  routesettingDays: [1, 2, 3],
  routesettingWindow: { startMin: 8 * 60, endMin: 14 * 60 },
  minDailyMin: 4 * 60,
  maxConcurrent: [3, 3, 3, 2, 2, 2, 2],
  minOperators: 1,
  staffDays: [1, 2, 3, 4, 5],
  shiftTargetMin: 6 * 60,
  shiftMaxMin: 9 * 60,
  routesettingLenMin: 4 * 60,
};

export type ShiftLike = Interval & {
  id?: string;
  userId: string;
  userName?: string;
  employment?: string;
  date: string;
  type: "OPERATOR" | "ROUTESETTING" | string;
};

export type SessionLike = Interval & {
  id?: string;
  userId: string;
  userName?: string;
  employment?: string;
  date: string;
  name: string;
  status: string;
};

export type Issue = {
  level: "error" | "warning";
  date: string;
  message: string;
  userId?: string;
  refId?: string;
  /** Dla luk w dyżurze – przedział bez operatora */
  gap?: Interval;
};

export const overlaps = (a: Interval, b: Interval) => a.startMin < b.endMin && b.startMin < a.endMin;

/** Odejmuje przedziały `cut` od przedziału `base`. */
export function subtract(base: Interval, cut: Interval[]): Interval[] {
  let parts: Interval[] = [base];
  for (const c of cut) {
    parts = parts.flatMap((p) => {
      if (!overlaps(p, c)) return [p];
      const out: Interval[] = [];
      if (c.startMin > p.startMin) out.push({ startMin: p.startMin, endMin: c.startMin });
      if (c.endMin < p.endMin) out.push({ startMin: c.endMin, endMin: p.endMin });
      return out;
    });
  }
  return parts;
}

/** Zwraca przedziały w `window`, w których liczba nakładających się przedziałów < `min`. */
export function findUnderCoverage(window: Interval, intervals: Interval[], min: number): Interval[] {
  const points = new Set<number>([window.startMin, window.endMin]);
  for (const i of intervals) {
    if (i.startMin > window.startMin && i.startMin < window.endMin) points.add(i.startMin);
    if (i.endMin > window.startMin && i.endMin < window.endMin) points.add(i.endMin);
  }
  const sorted = [...points].sort((a, b) => a - b);
  const gaps: Interval[] = [];
  for (let k = 0; k < sorted.length - 1; k++) {
    const seg = { startMin: sorted[k], endMin: sorted[k + 1] };
    const count = intervals.filter((i) => i.startMin <= seg.startMin && i.endMin >= seg.endMin).length;
    if (count < min) {
      const last = gaps[gaps.length - 1];
      if (last && last.endMin === seg.startMin) last.endMin = seg.endMin;
      else gaps.push(seg);
    }
  }
  return gaps;
}

/** Maksymalna liczba jednocześnie nakładających się przedziałów i kiedy występuje. */
export function peakConcurrency(intervals: Interval[]): { count: number; at: Interval | null } {
  const points = [...new Set(intervals.flatMap((i) => [i.startMin, i.endMin]))].sort((a, b) => a - b);
  let best = 0;
  let at: Interval | null = null;
  for (let k = 0; k < points.length - 1; k++) {
    const seg = { startMin: points[k], endMin: points[k + 1] };
    const count = intervals.filter((i) => i.startMin <= seg.startMin && i.endMin >= seg.endMin).length;
    if (count > best) {
      best = count;
      at = seg;
    } else if (count === best && at && at.endMin === seg.startMin) {
      at.endMin = seg.endMin;
    }
  }
  return { count: best, at };
}

/** Scala nakładające się przedziały (np. czas pracy jednej osoby). */
export function merge(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.startMin - b.startMin);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.startMin <= last.endMin) last.endMin = Math.max(last.endMin, i.endMin);
    else out.push({ ...i });
  }
  return out;
}

const span = (i: Interval) => `${fmtMin(i.startMin)}–${fmtMin(i.endMin)}`;
const total = (list: Interval[]) => list.reduce((s, i) => s + i.endMin - i.startMin, 0);

/** Waliduje jeden dzień grafiku. */
export function validateDay(
  date: string,
  shifts: ShiftLike[],
  sessions: SessionLike[],
  rules: Rules = DEFAULT_RULES,
): Issue[] {
  const issues: Issue[] = [];
  const wd = isoWeekday(date);
  const open = rules.opening[wd - 1];
  const activeSessions = sessions.filter((s) => s.status !== "CANCELLED");
  const name = (s: { userName?: string; userId: string }) => s.userName ?? s.userId;

  for (const s of shifts) {
    if (s.endMin <= s.startMin) {
      issues.push({ level: "error", date, refId: s.id, userId: s.userId, message: `${name(s)}: koniec zmiany przed początkiem` });
      continue;
    }
    if (s.type === "OPERATOR" && (s.startMin < open.startMin || s.endMin > open.endMin)) {
      issues.push({
        level: "warning", date, refId: s.id, userId: s.userId,
        message: `${name(s)}: dyżur ${span(s)} wykracza poza godziny otwarcia (${span(open)})`,
      });
    }
    if (s.type === "ROUTESETTING") {
      if (!rules.routesettingDays.includes(wd)) {
        issues.push({
          level: "warning", date, refId: s.id, userId: s.userId,
          message: `${name(s)}: routesetting w ${WEEKDAYS_LONG[wd - 1].toLowerCase()} – planowo tylko pn–śr`,
        });
      }
      const w = rules.routesettingWindow;
      if (s.startMin < w.startMin || s.endMin > w.endMin) {
        issues.push({
          level: "error", date, refId: s.id, userId: s.userId,
          message: `${name(s)}: routesetting ${span(s)} poza oknem ${span(w)}`,
        });
      }
    }
    if (s.employment === "SEKCJA") {
      const staffDay = rules.staffDays.includes(wd);
      if (s.type === "ROUTESETTING") {
        issues.push({ level: "warning", date, refId: s.id, userId: s.userId, message: `${name(s)}: instruktor sekcji nie robi routesettingu` });
      } else if (staffDay) {
        issues.push({ level: "warning", date, refId: s.id, userId: s.userId, message: `${name(s)}: instruktor sekcji może być operatorem tylko w weekend` });
      }
    } else if (s.employment) {
      const staffDay = rules.staffDays.includes(wd);
      if (staffDay && s.employment !== "STALY") {
        issues.push({ level: "warning", date, refId: s.id, userId: s.userId, message: `${name(s)}: zleceniobiorca w dzień roboczy (dni stałych instruktorów)` });
      }
      if (!staffDay && s.employment === "STALY") {
        issues.push({ level: "warning", date, refId: s.id, userId: s.userId, message: `${name(s)}: instruktor stały w weekend` });
      }
    }
  }

  // Kolizje tej samej osoby: zmiana vs zmiana, oraz routesetting vs sekcja.
  const byUser = new Map<string, { shifts: ShiftLike[]; sessions: SessionLike[] }>();
  for (const s of shifts) {
    const e = byUser.get(s.userId) ?? { shifts: [], sessions: [] };
    e.shifts.push(s);
    byUser.set(s.userId, e);
  }
  for (const s of activeSessions) {
    const e = byUser.get(s.userId) ?? { shifts: [], sessions: [] };
    e.sessions.push(s);
    byUser.set(s.userId, e);
  }
  for (const [userId, e] of byUser) {
    const who = name(e.shifts[0] ?? e.sessions[0]);
    for (let i = 0; i < e.shifts.length; i++) {
      for (let j = i + 1; j < e.shifts.length; j++) {
        if (overlaps(e.shifts[i], e.shifts[j])) {
          issues.push({ level: "error", date, userId, refId: e.shifts[j].id, message: `${who}: nakładające się zmiany ${span(e.shifts[i])} i ${span(e.shifts[j])}` });
        }
      }
      for (const sess of e.sessions) {
        if (e.shifts[i].type === "ROUTESETTING" && overlaps(e.shifts[i], sess)) {
          issues.push({ level: "error", date, userId, refId: sess.id, message: `${who}: sekcja „${sess.name}” w trakcie routesettingu` });
        }
      }
    }
    for (let i = 0; i < e.sessions.length; i++) {
      for (let j = i + 1; j < e.sessions.length; j++) {
        if (overlaps(e.sessions[i], e.sessions[j])) {
          issues.push({ level: "error", date, userId, refId: e.sessions[j].id, message: `${who}: dwie sekcje w tym samym czasie (${e.sessions[i].name}, ${e.sessions[j].name})` });
        }
      }
    }
    // Minimum godzin pracy w dniu (dyżur + routesetting + sekcje, bez podwójnego liczenia).
    const worked = total(merge([...e.shifts, ...e.sessions]));
    // Instruktor sekcji przychodzi tylko na swoje zajęcia – minimum godzin go wtedy nie dotyczy.
    const sectionOnly = e.shifts.length === 0 && e.sessions.some((x) => x.employment === "SEKCJA");
    if (worked > 0 && worked < rules.minDailyMin && !sectionOnly) {
      issues.push({ level: "warning", date, userId, message: `${who}: tylko ${worked / 60} h pracy – minimum to ${rules.minDailyMin / 60} h` });
    }
  }

  // Pokrycie dyżuru: operator prowadzący w tym czasie sekcję nie liczy się jako dyżurny.
  const operatorCover = shifts
    .filter((s) => s.type === "OPERATOR")
    .flatMap((s) => subtract(s, activeSessions.filter((x) => x.userId === s.userId)));
  for (const gap of findUnderCoverage(open, operatorCover, rules.minOperators)) {
    const duringSection = activeSessions.some((s) => overlaps(s, gap));
    issues.push({
      level: "error", date, gap,
      message: `Brak operatora na dyżurze ${span(gap)}${duringSection ? " (instruktor prowadzi sekcję)" : ""}`,
    });
  }

  // Limit jednocześnie pracujących instruktorów.
  const max = rules.maxConcurrent[wd - 1];
  const perUser = [...byUser.values()].flatMap((e) => merge([...e.shifts, ...e.sessions]));
  const peak = peakConcurrency(perUser);
  if (peak.count > max) {
    issues.push({
      level: "warning", date,
      message: `${peak.count} instruktorów jednocześnie${peak.at ? ` (${span(peak.at)})` : ""} – limit w ten dzień to ${max}`,
    });
  }

  return issues;
}

export function sanitizeRules(input: Partial<Rules> | null | undefined): Rules {
  return { ...DEFAULT_RULES, ...(input ?? {}) };
}
