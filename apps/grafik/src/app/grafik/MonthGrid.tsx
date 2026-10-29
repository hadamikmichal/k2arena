"use client";

import Link from "next/link";
import { fmtMin, WEEKDAYS } from "@/lib/time";
import { typeColor, type BoardData } from "./board";

/** Widok miesiąca: kalendarz, w każdym dniu dyżury/routesetting, liczba sekcji i znacznik problemów. */
export function MonthGrid({ days, today, userById, shifts, sessions, issues, onShift, onNewShift, month }: BoardData & { month: string }) {
  return (
    <div className="card overflow-x-auto p-0">
      <div className="grid min-w-[760px]" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} className="border-b px-2 py-2 text-xs font-medium text-2" style={{ borderColor: "var(--border)", borderLeftWidth: i ? 1 : 0, color: i >= 5 ? "var(--accent)" : undefined }}>
            {w}
          </div>
        ))}
        {days.map((d, i) => {
          const inMonth = d.startsWith(month);
          const dayShifts = shifts.filter((s) => s.date === d).sort((a, b) => a.startMin - b.startMin);
          const daySessions = sessions.filter((s) => s.date === d && s.status !== "CANCELLED");
          const errors = issues[d]?.filter((x) => x.level === "error").length ?? 0;
          const warnings = (issues[d]?.length ?? 0) - errors;
          return (
            <div
              key={d}
              className="min-h-32 cursor-copy border-b p-1.5"
              style={{
                borderColor: "var(--border)",
                borderLeftWidth: i % 7 ? 1 : 0,
                background: d === today ? "var(--surface-2)" : undefined,
                opacity: inMonth ? 1 : 0.45,
                boxShadow: inMonth && errors ? "inset 0 0 0 2px var(--err)" : undefined,
              }}
              onClick={(e) => e.target === e.currentTarget && onNewShift({ date: d })}
              title="Kliknij puste miejsce, aby dodać zmianę"
            >
              <div className="mb-1 flex items-center gap-1">
                <Link href={`/grafik?widok=dzien&data=${d}`} className="rounded px-1 text-sm font-semibold hover:bg-[var(--surface-2)] hover:underline" title="Widok dnia">
                  {Number(d.slice(8))}
                </Link>
                {inMonth && errors > 0 && <span className="text-[11px] font-semibold" style={{ color: "var(--err)" }} title={issues[d].filter((x) => x.level === "error").map((x) => x.message).join("\n")}>✕ {errors}</span>}
                {inMonth && warnings > 0 && <span className="text-[11px] font-semibold" style={{ color: "var(--warn)" }} title={issues[d].filter((x) => x.level !== "error").map((x) => x.message).join("\n")}>! {warnings}</span>}
              </div>
              <div className="space-y-0.5">
                {dayShifts.map((s) => {
                  const u = userById.get(s.userId);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onShift(s)}
                      className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight hover:bg-[var(--surface-2)]"
                      style={{ borderLeft: `3px solid ${typeColor("shift", s.type)}` }}
                      title={`${u?.name} · ${fmtMin(s.startMin)}–${fmtMin(s.endMin)}${s.type === "ROUTESETTING" ? " · routesetting" : ""}`}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: u?.color ?? "#888" }} />
                      <span className="truncate font-medium">{u?.name.split(" ")[0]}</span>
                      <span className="ml-auto shrink-0 tabular-nums text-2">{s.startMin / 60 | 0}–{Math.ceil(s.endMin / 60)}</span>
                    </button>
                  );
                })}
                {daySessions.length > 0 && (
                  <Link
                    href={`/grafik?widok=dzien&data=${d}`}
                    className="block rounded px-1 py-0.5 text-[11px] text-2 hover:bg-[var(--surface-2)]"
                    style={{ borderLeft: `3px dashed ${typeColor("session")}` }}
                    title={daySessions.map((s) => `${fmtMin(s.startMin)} ${s.name} – ${userById.get(s.userId)?.name}`).join("\n")}
                  >
                    Sekcje: {daySessions.length}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
