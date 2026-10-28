"use client";

import Link from "next/link";
import { useActionState, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { copyWeek } from "../actions";
import { Modal } from "@/components/Modal";
import { ShiftForm } from "@/components/ShiftForm";
import { SessionForm } from "@/components/SessionForm";
import type { SessionDTO, ShiftDTO, UserOpt } from "@/components/types";
import type { Interval, Issue } from "@/lib/rules";
import { fmtDayShort, fmtHours, fmtMin, isoWeekNumber, weekDates } from "@/lib/time";

const DAY_START = 8 * 60;
const DAY_END = 22 * 60;
const PX_PER_MIN = 0.8; // 48 px na godzinę
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60);

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

const TYPE_TAG: Record<string, string> = { OPERATOR: "Dyżur", ROUTESETTING: "Routesetting" };

export function WeekBoard(props: {
  monday: string;
  prevWeek: string;
  nextWeek: string;
  today: string;
  users: UserOpt[];
  shifts: ShiftDTO[];
  sessions: SessionDTO[];
  issues: Record<string, Issue[]>;
  opening: Interval[];
}) {
  const { monday, users, shifts, sessions, issues, opening, today } = props;
  const router = useRouter();
  const days = weekDates(monday);
  const userById = new Map(users.map((u) => [u.id, u]));
  const [modal, setModal] = useState<
    | { type: "shift"; shift?: ShiftDTO; defaults?: Partial<ShiftDTO> }
    | { type: "session"; session?: SessionDTO; defaults?: Partial<SessionDTO> }
    | { type: "copy" }
    | null
  >(null);
  const close = useCallback(() => {
    setModal(null);
    router.refresh();
  }, [router]);
  const [copyState, copyAction, copying] = useActionState(copyWeek, null);

  const allIssues = days.flatMap((d) => issues[d]);
  const errors = allIssues.filter((i) => i.level === "error").length;
  const warnings = allIssues.length - errors;

  // Podsumowanie tygodnia per instruktor
  const weekly = users
    .map((u) => {
      const own = shifts.filter((s) => s.userId === u.id);
      const secs = sessions.filter((s) => s.userId === u.id && s.status !== "CANCELLED");
      return {
        u,
        op: own.filter((s) => s.type === "OPERATOR").reduce((a, s) => a + s.endMin - s.startMin, 0),
        rs: own.filter((s) => s.type === "ROUTESETTING").reduce((a, s) => a + s.endMin - s.startMin, 0),
        sec: secs.length,
      };
    })
    .filter((w) => w.op || w.rs || w.sec);

  function onColumnClick(e: React.MouseEvent<HTMLDivElement>, date: string) {
    if (e.target !== e.currentTarget) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const start = Math.max(DAY_START, Math.min(DAY_END - 240, DAY_START + Math.floor(y / PX_PER_MIN / 60) * 60));
    setModal({ type: "shift", defaults: { date, startMin: start, endMin: Math.min(start + 360, DAY_END) } });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-semibold">
          Tydzień {isoWeekNumber(monday)} <span className="text-base font-normal muted">· {fmtDayShort(days[0])} – {fmtDayShort(days[6])}</span>
        </h1>
        <Link className="btn" href={`/grafik?tydzien=${props.prevWeek}`} aria-label="Poprzedni tydzień">←</Link>
        <Link className="btn" href="/grafik">Dziś</Link>
        <Link className="btn" href={`/grafik?tydzien=${props.nextWeek}`} aria-label="Następny tydzień">→</Link>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn" onClick={() => setModal({ type: "copy" })}>Kopiuj poprzedni tydzień</button>
          <button className="btn" onClick={() => setModal({ type: "session", defaults: { date: days[0] } })}>+ Zajęcia sekcji</button>
          <button className="btn btn-primary" onClick={() => setModal({ type: "shift", defaults: { date: days[0] } })}>+ Zmiana</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-2">
        <Legend swatch="var(--series-op)" label="Dyżur operatora" />
        <Legend swatch="var(--series-rs)" label="Routesetting" />
        <Legend swatch="var(--series-sec)" label="Sekcja" dashed />
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: "var(--err-bg)", outline: "1px solid var(--err)" }} />brak operatora</span>
        <span className="ml-auto">
          {errors === 0 && warnings === 0 ? (
            <span className="alert-ok py-1">✓ Grafik spełnia wszystkie reguły</span>
          ) : (
            <>
              {errors > 0 && <span className="alert-error mr-2 py-1">✕ {plural(errors, "błąd", "błędy", "błędów")}</span>}
              {warnings > 0 && <span className="alert-warn py-1">! {plural(warnings, "ostrzeżenie", "ostrzeżenia", "ostrzeżeń")}</span>}
            </>
          )}
        </span>
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="grid min-w-[980px]" style={{ gridTemplateColumns: "48px repeat(7, minmax(0, 1fr))" }}>
          <div className="border-b" style={{ borderColor: "var(--border)" }} />
          {days.map((d) => {
            const n = issues[d].length;
            const hasErr = issues[d].some((i) => i.level === "error");
            return (
              <div key={d} className="border-b border-l px-2 py-2 text-sm" style={{ borderColor: "var(--border)", background: d === today ? "var(--surface-2)" : undefined }}>
                <div className="font-semibold">{fmtDayShort(d)}</div>
                <div className="text-xs muted">
                  {fmtMin(opening[days.indexOf(d)].startMin)}–{fmtMin(opening[days.indexOf(d)].endMin)}
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

          {days.map((d, i) => {
            const open = opening[i];
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
                  const color = u?.color ?? "#888";
                  const isSession = b.kind === "session";
                  const cancelled = isSession && b.item.status === "CANCELLED";
                  const typeColor = isSession ? "var(--series-sec)" : b.item.type === "ROUTESETTING" ? "var(--series-rs)" : "var(--series-op)";
                  const top = (Math.max(b.item.startMin, DAY_START) - DAY_START) * PX_PER_MIN;
                  const height = (Math.min(b.item.endMin, DAY_END) - Math.max(b.item.startMin, DAY_START)) * PX_PER_MIN;
                  const width = 100 / b.lanes;
                  return (
                    <button
                      key={b.item.id}
                      type="button"
                      onClick={() => setModal(b.kind === "shift" ? { type: "shift", shift: b.item } : { type: "session", session: b.item })}
                      className="absolute overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm hover:z-10 hover:shadow-md"
                      style={{
                        top: top + 1,
                        height: height - 2,
                        left: `calc(${b.lane * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                        background: `color-mix(in srgb, ${color} 16%, var(--surface))`,
                        border: `1px ${isSession ? "dashed" : "solid"} ${color}`,
                        borderLeft: `4px solid ${typeColor}`,
                        opacity: cancelled ? 0.45 : 1,
                        textDecoration: cancelled ? "line-through" : undefined,
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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Uwagi do grafiku</h2>
          {allIssues.length === 0 ? (
            <p className="text-sm muted">Brak – dyżur pokryty w godzinach otwarcia, limity zachowane.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {days.flatMap((d) =>
                issues[d].map((iss, k) => (
                  <li key={d + k} className={iss.level === "error" ? "alert-error" : "alert-warn"}>
                    <span className="font-medium">{fmtDayShort(d)}:</span> {iss.message}
                  </li>
                )),
              )}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Podsumowanie tygodnia</h2>
          {weekly.length === 0 ? (
            <p className="text-sm muted">Brak zaplanowanej pracy w tym tygodniu.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Instruktor</th><th className="text-right">Dyżur</th><th className="text-right">Routesetting</th><th className="text-right">Sekcje</th></tr>
              </thead>
              <tbody>
                {weekly.map((w) => (
                  <tr key={w.u.id}>
                    <td><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: w.u.color }} />{w.u.name}</td>
                    <td className="text-right tabular-nums">{fmtHours(w.op)}</td>
                    <td className="text-right tabular-nums">{fmtHours(w.rs)}</td>
                    <td className="text-right tabular-nums">{w.sec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <Modal open={modal?.type === "shift"} onClose={() => setModal(null)} title={modal?.type === "shift" && modal.shift ? "Edycja zmiany" : "Nowa zmiana"}>
        {modal?.type === "shift" && <ShiftForm shift={modal.shift} defaults={modal.defaults} users={users} onDone={close} />}
      </Modal>
      <Modal open={modal?.type === "session"} onClose={() => setModal(null)} title={modal?.type === "session" && modal.session ? "Zajęcia sekcji" : "Nowe zajęcia (jednorazowe)"}>
        {modal?.type === "session" && <SessionForm session={modal.session} defaults={modal.defaults} users={users} onDone={close} />}
      </Modal>
      <Modal open={modal?.type === "copy"} onClose={() => setModal(null)} title="Kopiuj poprzedni tydzień">
        <form action={copyAction} className="space-y-3">
          <input type="hidden" name="from" value={props.prevWeek} />
          <input type="hidden" name="to" value={monday} />
          <p className="text-sm text-2">
            Skopiuje dyżury i routesetting z tygodnia {fmtDayShort(props.prevWeek)} do bieżącego. Sekcje są generowane automatycznie z harmonogramu sekcji.
          </p>
          {copyState?.error && <p className="alert-error">{copyState.error}</p>}
          {copyState?.message && <p className="alert-ok">{copyState.message}</p>}
          <div className="flex justify-end gap-2">
            {copyState?.ok ? (
              <button type="button" className="btn btn-primary" onClick={close}>Gotowe</button>
            ) : (
              <button className="btn btn-primary" disabled={copying}>{copying ? "Kopiowanie…" : "Kopiuj"}</button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  const word = n === 1 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  return `${n} ${word}`;
}

function Legend({ swatch, label, dashed }: { swatch: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-sm" style={{ borderLeft: `4px solid ${swatch}`, outline: `1px ${dashed ? "dashed" : "solid"} var(--border)` }} />
      {label}
    </span>
  );
}
