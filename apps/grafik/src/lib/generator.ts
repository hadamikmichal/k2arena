// Automatyczne układanie grafiku – czysta funkcja (bez bazy), łatwa do testowania.
//
// Dla każdego dnia, od rana:
//  1. routesetting (pn–śr) – jeden instruktor stały w oknie routesettingu (nigdy instruktor sekcji),
//  2. dyżur operatora – zachłannie: bierze najwcześniejszy niepokryty moment i wybiera instruktora,
//     który jest wtedy dostępny, nie przekroczy limitu osób naraz i da najwięcej pokrycia.
//     Prowadzący sekcję nie liczy się w jej trakcie jako operator (tak jak w walidacji).
// Ranking kandydatów: pokrycie luki, typ zatrudnienia pasujący do dnia, bycie i tak na miejscu
// (prowadzi sekcję), wyrównanie godzin w miesiącu.
import { merge, validateDay, type Interval, type Issue, type Rules, type SessionLike, type ShiftLike } from "./rules.ts";
import { fmtMin, isoWeekday } from "./time.ts";
import { canTakeShift, fitsDay } from "./employment.ts";

const SLOT = 15;

export type GenUser = { id: string; name: string; employment: string };

export type GenInput = {
  dates: string[];
  rules: Rules;
  users: GenUser[];
  sessions: SessionLike[];
  /** Zmiany, które zostają (tryb „uzupełnij”); generator dokłada do nich brakujące */
  existing: ShiftLike[];
  /** Zgłoszona dyspozycyjność: userId → data → przedziały */
  availability: Record<string, Record<string, Interval[]>>;
  /** Kto złożył zgłoszenie na ten miesiąc (brak dnia w zgłoszeniu = niedostępny) */
  submitted: Set<string>;
  /** Brak zgłoszenia = dostępny cały dzień (jak domyślnie w formularzu dyspozycyjności) */
  assumeDefault: boolean;
  includeRoutesetting: boolean;
};

export type GenResult = {
  shifts: ShiftLike[];
  issues: Record<string, Issue[]>;
};

const len = (i: Interval) => i.endMin - i.startMin;
const covers = (i: Interval, t: number) => i.startMin <= t && i.endMin > t;

export function generateSchedule(input: GenInput): GenResult {
  const { rules, users } = input;
  const byId = new Map(users.map((u) => [u.id, u]));
  const activeSessions = input.sessions.filter((s) => s.status !== "CANCELLED");
  const created: ShiftLike[] = [];
  const issues: Record<string, Issue[]> = {};

  // Godziny w miesiącu – do wyrównywania obciążenia.
  const monthMin = new Map<string, number>();
  const addMin = (uid: string, m: number) => monthMin.set(uid, (monthMin.get(uid) ?? 0) + m);
  for (const s of input.existing) addMin(s.userId, len(s));
  for (const s of activeSessions) addMin(s.userId, len(s));

  for (const date of input.dates) {
    const wd = isoWeekday(date);
    const open = rules.opening[wd - 1];
    const max = rules.maxConcurrent[wd - 1];
    const staffDay = rules.staffDays.includes(wd);
    const isRsDay = rules.routesettingDays.includes(wd);
    const daySessions = activeSessions.filter((s) => s.date === date);
    const dayShifts: ShiftLike[] = input.existing.filter((s) => s.date === date);

    const availability = (u: GenUser): Interval[] => {
      if (input.submitted.has(u.id)) return input.availability[u.id]?.[date] ?? [];
      if (!input.assumeDefault) return [];
      const start = isRsDay && u.employment === "STALY" ? Math.min(open.startMin, rules.routesettingWindow.startMin) : open.startMin;
      return [{ startMin: start, endMin: open.endMin }];
    };
    const inSection = (uid: string, t: number) => daySessions.some((s) => s.userId === uid && covers(s, t));
    const working = (t: number) =>
      new Set([...dayShifts, ...daySessions].filter((x) => covers(x, t)).map((x) => x.userId));
    const cover = (t: number) =>
      dayShifts.filter((s) => s.type === "OPERATOR" && covers(s, t) && !inSection(s.userId, t)).length;
    const ownShiftAt = (uid: string, t: number) => dayShifts.some((s) => s.userId === uid && covers(s, t));
    /** Przycina koniec przedziału do pierwszego momentu, w którym osoba kolidowałaby z limitem lub własną zmianą. */
    const fitEnd = (uid: string, start: number, end: number) => {
      for (let t = start; t < end; t += SLOT) {
        const w = working(t);
        if (ownShiftAt(uid, t) || (!w.has(uid) && w.size >= max)) return t;
      }
      return end;
    };
    const dayWork = (uid: string, extra: Interval) =>
      merge([...[...dayShifts, ...daySessions].filter((x) => x.userId === uid), extra]).reduce((a, i) => a + len(i), 0);
    const fairness = (uid: string) => (monthMin.get(uid) ?? 0) * 0.02;
    const add = (s: ShiftLike) => {
      dayShifts.push(s);
      created.push(s);
      addMin(s.userId, len(s));
    };

    // 1. Routesetting
    if (input.includeRoutesetting && isRsDay && !dayShifts.some((s) => s.type === "ROUTESETTING")) {
      const w = rules.routesettingWindow;
      const iv = { startMin: w.startMin, endMin: Math.min(w.endMin, w.startMin + rules.routesettingLenMin) };
      const best = users
        .filter((u) => canTakeShift(u.employment, "ROUTESETTING", staffDay))
        .filter((u) => availability(u).some((a) => a.startMin <= iv.startMin && a.endMin >= iv.endMin))
        .filter((u) => fitEnd(u.id, iv.startMin, iv.endMin) === iv.endMin)
        .map((u) => ({ u, score: (u.employment === "STALY" ? 500 : 0) - fairness(u.id) }))
        .sort((a, b) => b.score - a.score || a.u.name.localeCompare(b.u.name))[0];
      if (best) add({ userId: best.u.id, userName: best.u.name, employment: best.u.employment, date, ...iv, type: "ROUTESETTING" });
    }

    // 2. Dyżury operatora
    const skipped = new Set<number>();
    for (let guard = 0; guard < 400; guard++) {
      let t = -1;
      for (let x = open.startMin; x < open.endMin; x += SLOT) {
        if (!skipped.has(x) && cover(x) < rules.minOperators) {
          t = x;
          break;
        }
      }
      if (t < 0) break;

      let best: { u: GenUser; iv: Interval; score: number } | null = null;
      for (const u of users) {
        if (!canTakeShift(u.employment, "OPERATOR", staffDay)) continue;
        if (dayShifts.some((s) => s.userId === u.id && s.type === "OPERATOR")) continue;
        const a = availability(u).find((x) => covers(x, t));
        if (!a) continue;
        let end = Math.min(a.endMin, open.endMin, t + rules.shiftTargetMin);
        // Nie zostawiaj krótkiej końcówki dnia, której nikt nie weźmie (krótsza niż minimum).
        const tail = open.endMin - end;
        if (tail > 0 && tail < rules.minDailyMin && a.endMin >= open.endMin && open.endMin - t <= rules.shiftMaxMin) end = open.endMin;
        end = fitEnd(u.id, t, end);
        const iv = { startMin: t, endMin: end };
        if (end <= t || dayWork(u.id, iv) < rules.minDailyMin) continue;
        let gain = 0;
        for (let x = t; x < end; x += SLOT) if (cover(x) < rules.minOperators && !inSection(u.id, x)) gain += SLOT;
        if (gain === 0) continue;
        const score =
          gain +
          (fitsDay(u.employment, staffDay) ? 240 : -240) +
          (daySessions.some((s) => s.userId === u.id) ? 120 : 0) -
          (dayShifts.some((s) => s.userId === u.id) ? 200 : 0) -
          fairness(u.id);
        if (!best || score > best.score || (score === best.score && u.name.localeCompare(best.u.name) < 0)) best = { u, iv, score };
      }
      if (!best) {
        skipped.add(t);
        continue;
      }
      add({ userId: best.u.id, userName: best.u.name, employment: best.u.employment, date, ...best.iv, type: "OPERATOR" });
    }

    // Walidacja dnia + ostrzeżenia o dyspozycyjności prowadzących sekcje.
    const named = (s: ShiftLike) => ({ ...s, userName: byId.get(s.userId)?.name, employment: byId.get(s.userId)?.employment });
    issues[date] = validateDay(
      date,
      dayShifts.map(named),
      daySessions.map((s) => ({ ...s, userName: byId.get(s.userId)?.name, employment: byId.get(s.userId)?.employment })),
      rules,
    );
    for (const s of daySessions) {
      const u = byId.get(s.userId);
      if (!u || !input.submitted.has(u.id)) continue;
      if (!availability(u).some((a) => a.startMin <= s.startMin && a.endMin >= s.endMin)) {
        issues[date].push({
          level: "warning", date, userId: u.id,
          message: `${u.name}: prowadzi sekcję „${s.name}” ${fmtMin(s.startMin)}–${fmtMin(s.endMin)}, a nie zgłosił(a) wtedy dyspozycyjności`,
        });
      }
    }
  }

  return { shifts: created, issues };
}

