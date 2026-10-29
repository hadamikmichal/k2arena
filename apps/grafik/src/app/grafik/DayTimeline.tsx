"use client";

import { fmtHours, fmtMin } from "@/lib/time";
import { EMPLOYMENT_SHORT } from "@/lib/employment";
import { blockStyle, DAY_END, DAY_START, HOURS, TYPE_TAG, weekdayIndex, type BoardData } from "./board";

const SPAN = DAY_END - DAY_START;
const pct = (min: number) => `${((Math.min(Math.max(min, DAY_START), DAY_END) - DAY_START) / SPAN) * 100}%`;
const width = (a: number, b: number) => `${((Math.min(b, DAY_END) - Math.max(a, DAY_START)) / SPAN) * 100}%`;

/** Widok jednego dnia: oś czasu w poziomie, wiersz na instruktora + pasek pokrycia dyżuru. */
export function DayTimeline({ days, userById, shifts, sessions, issues, opening, onShift, onSession, onNewShift }: BoardData) {
  const date = days[0];
  const open = opening[weekdayIndex(date)];
  const dayShifts = shifts.filter((s) => s.date === date);
  const daySessions = sessions.filter((s) => s.date === date);
  const gaps = issues[date].flatMap((x) => (x.gap ? [x.gap] : []));

  // Najpierw osoby pracujące tego dnia (wg godziny rozpoczęcia), potem pozostali aktywni – do szybkiego dopisania.
  const firstStart = (uid: string) => Math.min(...[...dayShifts, ...daySessions].filter((x) => x.userId === uid).map((x) => x.startMin));
  const users = [...userById.values()];
  const working = users.filter((u) => Number.isFinite(firstStart(u.id))).sort((a, b) => firstStart(a.id) - firstStart(b.id));
  const others = users.filter((u) => u.active !== false && !working.includes(u));

  function onRowClick(e: React.MouseEvent<HTMLDivElement>, userId: string) {
    if (e.target !== e.currentTarget) return;
    const box = e.currentTarget.getBoundingClientRect();
    const min = DAY_START + ((e.clientX - box.left) / box.width) * SPAN;
    const start = Math.max(DAY_START, Math.min(DAY_END - 240, Math.floor(min / 60) * 60));
    onNewShift({ date, userId, startMin: start, endMin: Math.min(start + 360, DAY_END) });
  }

  const background = (
    <>
      <div className="pointer-events-none absolute inset-y-0 left-0" style={{ width: width(DAY_START, open.startMin), background: "var(--surface-2)" }} />
      <div className="pointer-events-none absolute inset-y-0 right-0" style={{ width: width(open.endMin, DAY_END), background: "var(--surface-2)" }} />
      {HOURS.slice(1, -1).map((h) => (
        <div key={h} className="pointer-events-none absolute inset-y-0 border-l" style={{ left: pct(h), borderColor: "var(--border)", opacity: 0.6 }} />
      ))}
    </>
  );

  const renderRow = (uid: string, faded?: boolean) => {
    const u = userById.get(uid)!;
    const mine = dayShifts.filter((s) => s.userId === uid);
    const mySessions = daySessions.filter((s) => s.userId === uid);
    const total = mine.reduce((a, s) => a + s.endMin - s.startMin, 0);
    return (
      <div key={uid} className="grid border-t" style={{ gridTemplateColumns: "minmax(110px, 160px) 1fr", borderColor: "var(--border)", opacity: faded ? 0.6 : 1 }}>
        <div className="flex flex-col justify-center px-3 py-1.5 text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: u.color }} />
            <span className="truncate">{u.name}</span>
          </span>
          <span className="text-xs muted">
            {EMPLOYMENT_SHORT[u.employment]}
            {total > 0 && ` · ${fmtHours(total)}`}
            {mySessions.length > 0 && ` · sekcje: ${mySessions.filter((s) => s.status !== "CANCELLED").length}`}
          </span>
        </div>
        <div className="relative h-14 cursor-copy" onClick={(e) => onRowClick(e, uid)} title={`Kliknij, aby dodać zmianę: ${u.name}`}>
          {background}
          {mine.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onShift(s)}
              className="absolute top-1.5 h-11 overflow-hidden rounded-md px-1.5 text-left text-[11px] leading-tight shadow-sm hover:shadow-md"
              style={{ left: pct(s.startMin), width: width(s.startMin, s.endMin), ...blockStyle(u.color, "shift", s.type) }}
              title={`${u.name} · ${TYPE_TAG[s.type]} · ${fmtMin(s.startMin)}–${fmtMin(s.endMin)}`}
            >
              <div className="truncate pt-0.5 font-semibold">{TYPE_TAG[s.type]}</div>
              <div className="truncate text-2">{fmtMin(s.startMin)}–{fmtMin(s.endMin)}</div>
            </button>
          ))}
          {/* Sekcje rysowane na wierzchu, niżej – widać, że w tym czasie osoba prowadzi zajęcia, a nie dyżur */}
          {mySessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSession(s)}
              className="absolute bottom-1 z-10 h-7 overflow-hidden rounded-md px-1.5 text-left text-[11px] leading-7 shadow-sm hover:shadow-md"
              style={{ left: pct(s.startMin), width: width(s.startMin, s.endMin), ...blockStyle(u.color, "session", undefined, s.status === "CANCELLED"), background: "var(--surface)" }}
              title={`${u.name} · Sekcja: ${s.name} · ${fmtMin(s.startMin)}–${fmtMin(s.endMin)}`}
            >
              <span className="truncate">{s.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="card overflow-x-auto p-0">
      <div className="min-w-[760px]">
        {/* oś godzin */}
        <div className="grid" style={{ gridTemplateColumns: "minmax(110px, 160px) 1fr" }}>
          <div className="px-3 py-2 text-xs muted">Otwarte {fmtMin(open.startMin)}–{fmtMin(open.endMin)}</div>
          <div className="relative h-8">
            {HOURS.map((h) => (
              <span key={h} className="absolute top-2 -translate-x-1/2 text-[11px] muted" style={{ left: pct(h) }}>
                {h > DAY_START && h < DAY_END && fmtMin(h)}
              </span>
            ))}
          </div>
        </div>

        {/* pokrycie dyżuru */}
        <div className="grid border-t" style={{ gridTemplateColumns: "minmax(110px, 160px) 1fr", borderColor: "var(--border)" }}>
          <div className="px-3 py-1.5 text-xs font-medium text-2">Operator na dyżurze</div>
          <div className="relative h-8">
            {background}
            <div className="absolute inset-y-2" style={{ left: pct(open.startMin), width: width(open.startMin, open.endMin), background: "var(--ok-bg)", borderRadius: 4 }} />
            {gaps.map((g, k) => (
              <div
                key={k}
                className="absolute inset-y-2 grid place-items-center text-[10px] font-semibold"
                style={{ left: pct(g.startMin), width: width(g.startMin, g.endMin), background: "var(--err-bg)", outline: "1px solid var(--err)", color: "var(--err)", borderRadius: 4 }}
                title={`Brak operatora ${fmtMin(g.startMin)}–${fmtMin(g.endMin)}`}
              >
                brak
              </div>
            ))}
          </div>
        </div>

        {working.map((u) => renderRow(u.id))}
        {working.length === 0 && <div className="border-t px-3 py-4 text-sm muted" style={{ borderColor: "var(--border)" }}>Nikt nie ma jeszcze pracy w tym dniu – kliknij wiersz instruktora poniżej, aby dodać zmianę.</div>}
        {others.length > 0 && (
          <>
            <div className="border-t px-3 py-1.5 text-xs font-medium muted" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>Pozostali instruktorzy – kliknij oś, aby dodać zmianę</div>
            {others.map((u) => renderRow(u.id, true))}
          </>
        )}
      </div>
    </div>
  );
}
