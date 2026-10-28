"use client";

import { useState } from "react";
import { fmtHours } from "@/lib/time";

type Row = { name: string; color: string; operatorMin: number; routesettingMin: number; sectionMin: number };

const SERIES = [
  { key: "operatorMin", label: "Dyżur", color: "var(--series-op)" },
  { key: "routesettingMin", label: "Routesetting", color: "var(--series-rs)" },
  { key: "sectionMin", label: "Sekcje", color: "var(--series-sec)" },
] as const;

/** Poziomy wykres skumulowany: godziny pracy per instruktor wg rodzaju. */
export function HoursChart({ rows }: { rows: Row[] }) {
  const [hover, setHover] = useState<{ row: number; x: number; y: number } | null>(null);
  const totals = rows.map((r) => r.operatorMin + r.routesettingMin + r.sectionMin);
  const max = Math.max(60, ...totals);
  if (rows.length === 0) return <p className="text-sm muted">Brak danych w wybranym okresie.</p>;

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-2">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div
            key={r.name}
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: "minmax(90px, 160px) 1fr 56px" }}
            onMouseMove={(e) => {
              const box = e.currentTarget.parentElement!.getBoundingClientRect();
              setHover({ row: i, x: e.clientX - box.left, y: e.clientY - box.top });
            }}
          >
            <div className="truncate text-sm text-2">{r.name}</div>
            <div className="flex h-5 gap-[2px]" style={{ width: `${(totals[i] / max) * 100}%`, minWidth: totals[i] ? 4 : 0 }}>
              {SERIES.map((s, k) => {
                const v = r[s.key];
                if (!v) return null;
                const isLast = SERIES.slice(k + 1).every((x) => !r[x.key]);
                return (
                  <div
                    key={s.key}
                    style={{
                      flexGrow: v,
                      flexBasis: 0,
                      background: s.color,
                      borderRadius: isLast ? "0 4px 4px 0" : 0,
                      opacity: hover && hover.row !== i ? 0.45 : 1,
                    }}
                  />
                );
              })}
            </div>
            <div className="text-right text-sm tabular-nums">{fmtHours(totals[i])}</div>
          </div>
        ))}
      </div>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border px-3 py-2 text-xs shadow-md"
          style={{ left: Math.min(hover.x + 12, 9999), top: hover.y + 12, background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="mb-1 font-semibold">{rows[hover.row].name}</div>
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
              <span className="text-2">{s.label}</span>
              <span className="ml-auto pl-3 tabular-nums">{fmtHours(rows[hover.row][s.key])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
