// Automatyczne układanie grafiku – czysta funkcja (bez bazy), łatwa do testowania.
//
// Faza 1 – dla każdego dnia, od rana:
//  1. routesetting (pn–śr) – jeden instruktor stały/UoP w oknie routesettingu (nigdy instruktor sekcji),
//  2. dyżur operatora – zachłannie: bierze najwcześniejszy niepokryty moment i wybiera instruktora,
//     który jest wtedy dostępny, nie przekroczy limitu osób naraz i da najwięcej pokrycia.
//     Prowadzący sekcję nie liczy się w jej trakcie jako operator (tak jak w walidacji).
//     Ranking kandydatów: pokrycie luki, typ zatrudnienia pasujący do dnia, bycie i tak na miejscu
//     (prowadzi sekcję), wyrównanie godzin w miesiącu, zaległość względem normy UoP.
// Faza 2 – instruktorom UoP, którym wciąż brakuje do miesięcznej normy, dokłada dodatkowe dyżury
//   w dni robocze, w które są dostępni i w których nie przekroczy to limitu osób naraz.
// Faza 3 – walidacja każdego dnia i stan normy UoP.
import { merge, validateDay, type Interval, type Issue, type Rules, type SessionLike, type ShiftLike } from "./rules.ts";
import { fmtMin, isoWeekday, monthBounds } from "./time.ts";
import { canTakeShift, fitsDay, isStaff } from "./employment.ts";
import { normStatus, workedMinutes, type NormStatus } from "./norm.ts";

const SLOT = 15;

export type GenUser = { id: string; name: string; employment: string };

export type GenInput = {
  dates: string[];
  rules: Rules;
  users: GenUser[];
  sessions: SessionLike[];
  /** Zmiany, które zostają (tryb „uzupełnij”); generator dokłada do nich brakujące */
  existing: ShiftLike[];
  /** Praca w tym miesiącu przed pierwszym generowanym dniem – liczy się do normy UoP */
  prior?: (ShiftLike | SessionLike)[];
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
  /** Stan normy instruktorów UoP po wygenerowaniu (cały miesiąc) */
  norm: NormStatus[];
};

const len = (i: Interval) => i.endMin - i.startMin;
const covers = (i: Interval, t: number) => i.startMin <= t && i.endMin > t;

export function generateSchedule(input: GenInput): GenResult {
  const { rules, users } = input;
  const byId = new Map(users.map((u) => [u.id, u]));
  const activeSessions = input.sessions.filter((s) => s.status !== "CANCELLED");
  const prior = (input.prior ?? []).filter((b) => !("status" in b) || b.status !== "CANCELLED");
  const created: ShiftLike[] = [];
  const issues: Record<string, Issue[]> = {};
  const isUop = (u: GenUser) => u.employment === "UOP";

  // Stan zmian per dzień (istniejące + dokładane)
  const shiftsByDate = new Map<string, ShiftLike[]>();
  for (const d of input.dates) shiftsByDate.set(d, input.existing.filter((s) => s.date === d));

  // Godziny w miesiącu – do wyrównywania obciążenia (przybliżone, sumą bloków).
  const monthMin = new Map<string, number>();
  const addMin = (uid: string, m: number) => monthMin.set(uid, (monthMin.get(uid) ?? 0) + m);
  for (const s of [...prior, ...input.existing, ...activeSessions]) addMin(s.userId, len(s));

  // Dokładny czas pracy (bez nakładek) – do normy UoP.
  const worked = (uid: string) =>
    workedMinutes([...prior, ...activeSessions, ...[...shiftsByDate.values()].flat()].filter((b) => b.userId === uid)).get(uid) ?? 0;
  const monthDays = input.dates.length ? Number(monthBounds(input.dates[0].slice(0, 7)).to.slice(8)) : 30;
  /** Czy instruktor UoP jest w tyle względem równego rozłożenia normy na dni miesiąca. */
  const behindNorm = (u: GenUser, date: string) =>
    isUop(u) && worked(u.id) < (rules.uopMonthlyMinMin * Number(date.slice(8))) / monthDays;

  function day(date: string) {
    const wd = isoWeekday(date);
    const open = rules.opening[wd - 1];
    const max = rules.maxConcurrent[wd - 1];
    const staffDay = rules.staffDays.includes(wd);
    const isRsDay = rules.routesettingDays.includes(wd);
    const daySessions = activeSessions.filter((s) => s.date === date);
    const dayShifts = shiftsByDate.get(date)!;

    const availability = (u: GenUser): Interval[] => {
      if (input.submitted.has(u.id)) return input.availability[u.id]?.[date] ?? [];
      if (!input.assumeDefault) return [];
      const start = isRsDay && isStaff(u.employment) ? Math.min(open.startMin, rules.routesettingWindow.startMin) : open.startMin;
      return [{ startMin: start, endMin: open.endMin }];
    };
    const inSection = (uid: string, t: number) => daySessions.some((s) => s.userId === uid && covers(s, t));
    const working = (t: number) => new Set([...dayShifts, ...daySessions].filter((x) => covers(x, t)).map((x) => x.userId));
    const cover = (t: number) => dayShifts.filter((s) => s.type === "OPERATOR" && covers(s, t) && !inSection(s.userId, t)).length;
    const ownShiftAt = (uid: string, t: number) => dayShifts.some((s) => s.userId === uid && covers(s, t));
    /** Przycina koniec przedziału do pierwszego momentu, w którym osoba kolidowałaby z limitem lub własną zmianą. */
    const fitEnd = (uid: string, start: number, end: number) => {
      for (let t = start; t < end; t += SLOT) {
        const w = working(t);
        if (ownShiftAt(uid, t) || (!w.has(uid) && w.size >= max)) return t;
      }
      return end;
    };
    const dayWork = (uid: string, extra?: Interval) =>
      merge([...[...dayShifts, ...daySessions].filter((x) => x.userId === uid), ...(extra ? [extra] : [])]).reduce((a, i) => a + len(i), 0);
    const add = (u: GenUser, iv: Interval, type: string) => {
      const s: ShiftLike = { userId: u.id, userName: u.name, employment: u.employment, date, ...iv, type };
      dayShifts.push(s);
      created.push(s);
      addMin(u.id, len(s));
    };
    return { wd, open, staffDay, isRsDay, daySessions, dayShifts, availability, inSection, cover, fitEnd, dayWork, add };
  }

  const fairness = (uid: string) => (monthMin.get(uid) ?? 0) * 0.02;

  // ---------- Faza 1: obsada dyżurów ----------
  for (const date of input.dates) {
    const d = day(date);

    if (input.includeRoutesetting && d.isRsDay && !d.dayShifts.some((s) => s.type === "ROUTESETTING")) {
      const w = rules.routesettingWindow;
      const iv = { startMin: w.startMin, endMin: Math.min(w.endMin, w.startMin + rules.routesettingLenMin) };
      const best = users
        .filter((u) => canTakeShift(u.employment, "ROUTESETTING", d.staffDay))
        .filter((u) => d.availability(u).some((a) => a.startMin <= iv.startMin && a.endMin >= iv.endMin))
        .filter((u) => d.fitEnd(u.id, iv.startMin, iv.endMin) === iv.endMin)
        .map((u) => ({ u, score: (isStaff(u.employment) ? 500 : 0) + (behindNorm(u, date) ? 100 : 0) - fairness(u.id) }))
        .sort((a, b) => b.score - a.score || a.u.name.localeCompare(b.u.name))[0];
      if (best) d.add(best.u, iv, "ROUTESETTING");
    }

    const skipped = new Set<number>();
    for (let guard = 0; guard < 400; guard++) {
      let t = -1;
      for (let x = d.open.startMin; x < d.open.endMin; x += SLOT) {
        if (!skipped.has(x) && d.cover(x) < rules.minOperators) {
          t = x;
          break;
        }
      }
      if (t < 0) break;

      let best: { u: GenUser; iv: Interval; score: number } | null = null;
      for (const u of users) {
        if (!canTakeShift(u.employment, "OPERATOR", d.staffDay)) continue;
        if (d.dayShifts.some((s) => s.userId === u.id && s.type === "OPERATOR")) continue;
        const a = d.availability(u).find((x) => covers(x, t));
        if (!a) continue;
        const target = isUop(u) ? rules.uopShiftMin : rules.shiftTargetMin;
        let end = Math.min(a.endMin, d.open.endMin, t + target);
        // Nie zostawiaj krótkiej końcówki dnia, której nikt nie weźmie (krótsza niż minimum).
        const tail = d.open.endMin - end;
        if (tail > 0 && tail < rules.minDailyMin && a.endMin >= d.open.endMin && d.open.endMin - t <= rules.shiftMaxMin) end = d.open.endMin;
        end = d.fitEnd(u.id, t, end);
        const iv = { startMin: t, endMin: end };
        if (end <= t || d.dayWork(u.id, iv) < rules.minDailyMin) continue;
        let gain = 0;
        for (let x = t; x < end; x += SLOT) if (d.cover(x) < rules.minOperators && !d.inSection(u.id, x)) gain += SLOT;
        if (gain === 0) continue;
        const score =
          gain +
          (fitsDay(u.employment, d.staffDay) ? 240 : -240) +
          (d.daySessions.some((s) => s.userId === u.id) ? 120 : 0) -
          (d.dayShifts.some((s) => s.userId === u.id) ? 200 : 0) +
          (behindNorm(u, date) ? 150 : 0) -
          fairness(u.id);
        if (!best || score > best.score || (score === best.score && u.name.localeCompare(best.u.name) < 0)) best = { u, iv, score };
      }
      if (!best) {
        skipped.add(t);
        continue;
      }
      d.add(best.u, best.iv, "OPERATOR");
    }
  }

  // ---------- Faza 2: dopełnianie normy UoP ----------
  const createdSet = new Set(created);
  for (const u of users.filter(isUop)) {
    // a) wydłuż krótsze dyżury utworzone przez generator do długości dyżuru UoP
    for (const date of input.dates) {
      if (worked(u.id) >= rules.uopMonthlyMinMin) break;
      const d = day(date);
      const s = d.dayShifts.find((x) => x.userId === u.id && x.type === "OPERATOR" && createdSet.has(x));
      if (!s) continue;
      const need = Math.min(rules.uopShiftMin - d.dayWork(u.id), rules.uopMonthlyMinMin - worked(u.id));
      if (need <= 0) continue;
      const avail = d.availability(u);
      const canSpan = (iv: Interval) => avail.some((a) => a.startMin <= iv.startMin && a.endMin >= iv.endMin);
      // później (wieczorem), potem wcześniej
      const later = Math.min(d.open.endMin, s.endMin + need);
      if (later > s.endMin && canSpan({ startMin: s.startMin, endMin: later }) && d.fitEnd(u.id, s.endMin, later) === later) {
        addMin(u.id, later - s.endMin);
        s.endMin = later;
      }
      const rest = Math.min(rules.uopShiftMin - d.dayWork(u.id), rules.uopMonthlyMinMin - worked(u.id));
      const earlier = Math.max(d.open.startMin, s.startMin - rest);
      if (rest > 0 && earlier < s.startMin && canSpan({ startMin: earlier, endMin: s.endMin }) && d.fitEnd(u.id, earlier, s.startMin) === s.startMin) {
        addMin(u.id, s.startMin - earlier);
        s.startMin = earlier;
      }
    }
    // b) dołóż dyżury w dni bez dyżuru operatora
    // Najpierw dni bez żadnej pracy, potem dni z krótką pracą (np. sam routesetting).
    const order = [...input.dates].sort((a, b) => day(a).dayWork(u.id) - day(b).dayWork(u.id));
    for (const date of order) {
      if (worked(u.id) >= rules.uopMonthlyMinMin) break;
      const d = day(date);
      if (!canTakeShift(u.employment, "OPERATOR", d.staffDay) || !fitsDay(u.employment, d.staffDay)) continue;
      if (d.dayShifts.some((s) => s.userId === u.id && s.type === "OPERATOR")) continue;
      const already = d.dayWork(u.id);
      const missing = rules.uopMonthlyMinMin - worked(u.id);
      const length = Math.min(rules.uopShiftMin - already, Math.max(missing, already ? SLOT : rules.minDailyMin));
      if (length <= 0) continue;
      // Okna od najpóźniejszego (wieczory są najbardziej obłożone), co godzinę wstecz.
      for (let start = d.open.endMin - length; start >= d.open.startMin; start -= 60) {
        const iv = { startMin: start, endMin: start + length };
        const okAvail = d.availability(u).some((a) => a.startMin <= iv.startMin && a.endMin >= iv.endMin);
        if (okAvail && d.fitEnd(u.id, iv.startMin, iv.endMin) === iv.endMin && d.dayWork(u.id, iv) >= rules.minDailyMin) {
          d.add(u, iv, "OPERATOR");
          break;
        }
      }
    }
  }

  // ---------- Faza 3: walidacja ----------
  for (const date of input.dates) {
    const d = day(date);
    issues[date] = validateDay(
      date,
      d.dayShifts.map((s) => ({ ...s, userName: byId.get(s.userId)?.name, employment: byId.get(s.userId)?.employment })),
      d.daySessions.map((s) => ({ ...s, userName: byId.get(s.userId)?.name, employment: byId.get(s.userId)?.employment })),
      rules,
    );
    for (const s of d.daySessions) {
      const u = byId.get(s.userId);
      if (!u || !input.submitted.has(u.id)) continue;
      if (!d.availability(u).some((a) => a.startMin <= s.startMin && a.endMin >= s.endMin)) {
        issues[date].push({
          level: "warning", date, userId: u.id,
          message: `${u.name}: prowadzi sekcję „${s.name}” ${fmtMin(s.startMin)}–${fmtMin(s.endMin)}, a nie zgłosił(a) wtedy dyspozycyjności`,
        });
      }
    }
  }

  const norm = normStatus(users, [...prior, ...activeSessions, ...[...shiftsByDate.values()].flat()], rules);
  return { shifts: created, issues, norm };
}
