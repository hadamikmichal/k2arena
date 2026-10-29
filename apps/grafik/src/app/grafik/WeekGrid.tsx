"use client";

import Link from "next/link";
import type { SessionDTO, ShiftDTO } from "@/components/types";
import { fmtDayShort, fmtMin } from "@/lib/time";
import { blockStyle, DAY_END, DAY_START, HOURS, TYPE_TAG, weekdayIndex, type BoardData } from "./board";

const PX_PER_MIN = 0.8; // 48 px na godzinę

type Block =
  | { kind: "shift"; item: ShiftDTO; lane: number; lanes: number }
  | { kind: "session"; item: SessionDTO; lane: number; lanes: number };

/** Rozkłada nakładające się bloki na równoległe kolumny (lanes). */
function layout(shifts: ShiftDTO[], sessions: SessionDTO[]): Block[] {
  const items = [
    ...shifts.map((s) => ({ kind: "shift" as const, item: s })),
    ...sessions.map((s) => ({ kind: "session" as const, item: s })),
  ].sort((a, b) => a.item.startMin - b.item.startMin || b.item.endMin - a.item.endMin);
  // Grupy (klastry) wzajemnie nakładających się bloków dzielą szerokość tylko między sobą.
  const out: Block[] = [];
  let cluster: Block[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const b of cluster) out.push({ ...b, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };
  for (const b of items) {
    if (b.item.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= b.item.startMin);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = b.item.endMin;
    clusterEnd = Math.max(clusterEnd, b.item.endMin);
    cluster.push({ ...b, lane, lanes: 0 } as Block);
  }
  flush();
  return out;
}

export function WeekGrid({ days, today, userById, shifts, sessions, issues, opening, onShift, onSession, onNewShift }: BoardData) {
  function onColumnClick(e: React.MouseEvent<HTMLDivElement>, date: string) {
    if (e.target !== e.currentTarget) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const start = Math.max(DAY_START, Math.min(DAY_END - 240, DAY_START + Math.floor(y / PX_PER_MIN / 60) * 60));
    onNewShift({ date, startMin: start, endMin: Math.min(start + 360, DAY_END) });
  }

  return (
    <div className="card overflow-x-auto p-0">
      <div className="grid min-w-[980px]" style={{ gridTemplateColumns: "48px repeat(7, minmax(0, 1fr))" }}>
        <div className="border-b" style={{ borderColor: "var(--border)" }} />
        {days.map((d) => {
          const n = issues[d].length;
          const hasErr = issues[d].some((i) => i.level === "error");
          const open = opening[weekdayIndex(d)];
          return (
            <div key={d} className="border-b border-l px-2 py-2 text-sm" style={{ borderColor: "var(--border)", background: d === today ? "var(--surface-2)" : undefined }}>
              <Link href={`/grafik?widok=dzien&data=${d}`} className="font-semibold hover:underline" title="Widok dnia">{fmtDayShort(d)}</Link>
              <div className="text-xs muted">
                {fmtMin(open.startMin)}–{fmtMin(open.endMin)}
                {n > 0 && <span className="ml-1.5" style={{ color: hasErr ? "var(--err)" : "var(--warn)" }}>{hasErr ? "✕" : "!"} {n}</span>}
              </div>
            </div>
          );
        })}

        {/* oś godzin */}
        <div className="relative" style={{ height: (DAY_END - DAY_START) * PX_PER_MIN }}>
          {HOURS.map((h) => (
            <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[11px] muted" style={{ top: (h - DAY_START) * PX_PER_MIN }}>
              {h < DAY_END && fmtMin(h)}
            </div>
          ))}
        </div>

        {days.map((d) => {
          const open = opening[weekdayIndex(d)];
          const blocks = layout(shifts.filter((s) => s.date === d), sessions.filter((s) => s.date === d));
          const gaps = issues[d].flatMap((x) => (x.gap ? [x.gap] : []));
          return (
            <div
              key={d}
              className="relative cursor-copy border-l"
              style={{ borderColor: "var(--border)", height: (DAY_END - DAY_START) * PX_PER_MIN }}
              onClick={(e) => onColumnClick(e, d)}
              title="Kliknij, aby dodać zmianę"
            >
              {/* poza godzinami otwarcia */}
              <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: (open.startMin - DAY_START) * PX_PER_MIN, background: "var(--surface-2)" }} />
              <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ top: (open.endMin - DAY_START) * PX_PER_MIN, background: "var(--surface-2)" }} />
              {HOURS.slice(1, -1).map((h) => (
                <div key={h} className="pointer-events-none absolute inset-x-0 border-t" style={{ top: (h - DAY_START) * PX_PER_MIN, borderColor: "var(--border)", opacity: 0.6 }} />
              ))}
              {gaps.map((g, k) => (
                <div key={k} className="pointer-events-none absolute inset-x-0" style={{ top: (g.startMin - DAY_START) * PX_PER_MIN, height: (g.endMin - g.startMin) * PX_PER_MIN, background: "var(--err-bg)", borderLeft: "3px solid var(--err)" }} />
              ))}
              {blocks.map((b) => {
                const u = userById.get(b.item.userId);
                const isSession = b.kind === "session";
                const cancelled = isSession && b.item.status === "CANCELLED";
                const top = (Math.max(b.item.startMin, DAY_START) - DAY_START) * PX_PER_MIN;
                const height = (Math.min(b.item.endMin, DAY_END) - Math.max(b.item.startMin, DAY_START)) * PX_PER_MIN;
                const width = 100 / b.lanes;
                return (
                  <button
                    key={b.item.id}
                    type="button"
                    onClick={() => (b.kind === "shift" ? onShift(b.item) : onSession(b.item))}
                    className="absolute overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm hover:z-10 hover:shadow-md"
                    style={{
                      top: top + 1,
                      height: height - 2,
                      left: `calc(${b.lane * width}% + 2px)`,
                      width: `calc(${width}% - 4px)`,
                      ...blockStyle(u?.color ?? "#888", b.kind, isSession ? undefined : b.item.type, cancelled),
                    }}
                    title={`${u?.name} · ${isSession ? `Sekcja: ${b.item.name}` : TYPE_TAG[b.item.type]} · ${fmtMin(b.item.startMin)}–${fmtMin(b.item.endMin)}`}
                  >
                    <div className="truncate font-semibold">{u?.name.split(" ")[0]}</div>
                    <div className="truncate text-2">{fmtMin(b.item.startMin)}–{fmtMin(b.item.endMin)}</div>
                    <div className="truncate text-2">{isSession ? b.item.name : TYPE_TAG[b.item.type]}</div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
