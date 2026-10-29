"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAvailability, type FormState } from "../actions";
import type { Interval } from "@/lib/rules";
import { fmtDayShort, fmtMin, isoWeekday, toMin } from "@/lib/time";

type Mode = "off" | "full" | "custom";
type Day = { mode: Mode; start: string; end: string };

export function AvailabilityForm(props: {
  month: string;
  userId?: string;
  days: string[];
  fullDay: Record<string, Interval>;
  /** Dni tygodnia „typowe” dla tej osoby (stali pn–pt, zlecenie sb–nd) – do szybkiego zaznaczania */
  staffDays: number[];
  initial: Record<string, Interval>;
  /** Czy osoba złożyła już zgłoszenie – bez niego wszystkie dni startują jako „Cały dzień” */
  submitted: boolean;
  note: string;
  locked: boolean;
}) {
  const { days, fullDay } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FormState>(null);
  const [note, setNote] = useState(props.note);
  const [state, setState] = useState<Record<string, Day>>(() =>
    Object.fromEntries(
      days.map((d) => {
        const iv = props.initial[d];
        const full = fullDay[d];
        if (!iv) return [d, { mode: props.submitted ? "off" : "full", start: fmtMin(full.startMin), end: fmtMin(full.endMin) }];
        const isFull = iv.startMin === full.startMin && iv.endMin === full.endMin;
        return [d, { mode: isFull ? "full" : "custom", start: fmtMin(iv.startMin), end: fmtMin(iv.endMin) }];
      }),
    ),
  );

  const set = (d: string, patch: Partial<Day>) => setState((s) => ({ ...s, [d]: { ...s[d], ...patch } }));
  const bulk = (pred: (d: string) => boolean, mode: Mode) =>
    setState((s) => Object.fromEntries(days.map((d) => [d, pred(d) ? { ...s[d], mode } : s[d]])));
  const off = days.filter((d) => state[d].mode === "off").length;

  function submit() {
    const payload = days
      .filter((d) => state[d].mode !== "off")
      .map((d) =>
        state[d].mode === "full"
          ? { date: d, ...fullDay[d] }
          : { date: d, startMin: toMin(state[d].start), endMin: toMin(state[d].end) },
      );
    start(async () => {
      const r = await saveAvailability({ month: props.month, userId: props.userId, note, days: payload });
      setResult(r);
      if (r?.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {!props.locked && (
        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" className="btn" onClick={() => bulk(() => true, "full")}>Cały miesiąc dostępny</button>
          <button
            type="button"
            className="btn"
            onClick={() => setState((s) => Object.fromEntries(days.map((d) => [d, { ...s[d], mode: props.staffDays.includes(isoWeekday(d)) ? "full" : "off" }])))}
          >
            Tylko moje dni ({props.staffDays.length === 5 ? "pn–pt" : "sb–nd"})
          </button>
          <button type="button" className="btn" onClick={() => bulk(() => true, "off")}>Cały miesiąc niedostępny</button>
        </div>
      )}

      <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
        {days.map((d) => {
          const v = state[d];
          const weekend = isoWeekday(d) >= 6;
          return (
            <div key={d} className="flex flex-wrap items-center gap-2 border-b py-1.5" style={{ borderColor: "var(--border)" }}>
              <span className="w-20 text-sm font-medium" style={{ color: weekend ? "var(--accent)" : undefined }}>{fmtDayShort(d)}</span>
              <div className="inline-flex overflow-hidden rounded-lg border text-xs" style={{ borderColor: "var(--border)" }} role="radiogroup" aria-label={`Dostępność ${fmtDayShort(d)}`}>
                {(
                  [
                    ["off", "Nie"],
                    ["full", "Cały dzień"],
                    ["custom", "Godziny"],
                  ] as [Mode, string][]
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={v.mode === m}
                    disabled={props.locked}
                    onClick={() => set(d, { mode: m })}
                    className="px-2.5 py-1"
                    style={{
                      background: v.mode === m ? (m === "off" ? "var(--surface-2)" : "var(--ok-bg)") : "var(--surface)",
                      color: v.mode === m ? (m === "off" ? "var(--text)" : "var(--ok)") : "var(--text-2)",
                      fontWeight: v.mode === m ? 600 : 400,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {v.mode === "full" && <span className="text-xs muted">{fmtMin(fullDay[d].startMin)}–{fmtMin(fullDay[d].endMin)}</span>}
              {v.mode === "custom" && (
                <span className="flex items-center gap-1">
                  <input type="time" step={900} value={v.start} onChange={(e) => set(d, { start: e.target.value })} className="input w-24 py-1" aria-label="Od" disabled={props.locked} />
                  –
                  <input type="time" step={900} value={v.end} onChange={(e) => set(d, { end: e.target.value })} className="input w-24 py-1" aria-label="Do" disabled={props.locked} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <label className="label" htmlFor="note">Uwagi (opcjonalnie)</label>
        <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} className="input" rows={2} placeholder="np. wolałbym dyżury popołudniowe" disabled={props.locked} />
      </div>
      {result?.error && <p className="alert-error">{result.error}</p>}
      {result?.message && <p className="alert-ok">{result.message}</p>}
      {props.locked ? (
        <p className="text-sm muted">Miniony miesiąc – zmiany może wprowadzić tylko administrator.</p>
      ) : (
        <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>
          {pending ? "Zapisywanie…" : `Zapisz dyspozycyjność${off ? ` (dni niedostępne: ${off})` : ""}`}
        </button>
      )}
    </div>
  );
}
