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
import { normMessage, type NormStatus } from "@/lib/norm";
import { addDays, fmtDate, fmtDayShort, fmtHours, isoWeekday, isoWeekNumber, WEEKDAYS_LONG } from "@/lib/time";
import type { BoardData } from "./board";
import { DayTimeline } from "./DayTimeline";
import { WeekGrid } from "./WeekGrid";
import { MonthGrid } from "./MonthGrid";

export type View = "day" | "week" | "month";

const SLUG: Record<View, string> = { day: "dzien", week: "tydzien", month: "miesiac" };
const VIEW_LABEL: Record<View, string> = { day: "Dzień", week: "Tydzień", month: "Miesiąc" };
const SUMMARY_LABEL: Record<View, string> = { day: "Podsumowanie dnia", week: "Podsumowanie tygodnia", month: "Podsumowanie miesiąca" };
const href = (view: View, date?: string) => `/grafik?widok=${SLUG[view]}${date ? `&data=${date}` : ""}`;

export function ScheduleBoard(props: {
  view: View;
  anchor: string;
  days: string[];
  focus: string[];
  prev: string;
  next: string;
  today: string;
  users: UserOpt[];
  shifts: ShiftDTO[];
  sessions: SessionDTO[];
  issues: Record<string, Issue[]>;
  opening: Interval[];
  norm: NormStatus[];
}) {
  const { view, anchor, days, focus, users, shifts, sessions, issues, today } = props;
  const router = useRouter();
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

  const focusSet = new Set(focus);
  const allIssues = focus.flatMap((d) => issues[d] ?? []);
  const normIssues = props.norm.filter((n) => n.missingMin > 0);
  const errors = allIssues.filter((i) => i.level === "error").length;
  const warnings = allIssues.length - errors + normIssues.length;
  const normById = new Map(props.norm.map((n) => [n.userId, n]));

  // Podsumowanie wyświetlanego okresu per instruktor
  const summary = users
    .map((u) => {
      const own = shifts.filter((s) => s.userId === u.id && focusSet.has(s.date));
      const secs = sessions.filter((s) => s.userId === u.id && s.status !== "CANCELLED" && focusSet.has(s.date));
      return {
        u,
        op: own.filter((s) => s.type === "OPERATOR").reduce((a, s) => a + s.endMin - s.startMin, 0),
        rs: own.filter((s) => s.type === "ROUTESETTING").reduce((a, s) => a + s.endMin - s.startMin, 0),
        sec: secs.length,
      };
    })
    .filter((w) => w.op || w.rs || w.sec);

  const data: BoardData = {
    days,
    today,
    userById,
    shifts,
    sessions,
    issues,
    opening: props.opening,
    onShift: (shift) => setModal({ type: "shift", shift }),
    onSession: (session) => setModal({ type: "session", session }),
    onNewShift: (defaults) => setModal({ type: "shift", defaults }),
  };

  const monthName = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(new Date(`${anchor.slice(0, 7)}-15`));
  const title =
    view === "day" ? (
      <>{WEEKDAYS_LONG[isoWeekday(anchor) - 1]} <span className="text-base font-normal muted">· {fmtDate(anchor)}</span></>
    ) : view === "week" ? (
      <>Tydzień {isoWeekNumber(days[0])} <span className="text-base font-normal muted">· {fmtDayShort(days[0])} – {fmtDayShort(days[6])}</span></>
    ) : (
      <span className="capitalize">{monthName}</span>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border text-sm" style={{ borderColor: "var(--border)" }} role="tablist" aria-label="Widok grafiku">
          {(["day", "week", "month"] as View[]).map((v) => (
            <Link
              key={v}
              href={href(v, anchor)}
              role="tab"
              aria-selected={v === view}
              className="px-3 py-1.5"
              style={{ background: v === view ? "var(--accent)" : "var(--surface)", color: v === view ? "var(--accent-ink)" : "var(--text-2)", fontWeight: v === view ? 600 : 400 }}
            >
              {VIEW_LABEL[v]}
            </Link>
          ))}
        </div>
        <Link className="btn" href={href(view, props.prev)} aria-label="Poprzedni okres">←</Link>
        <Link className="btn" href={href(view)}>Dziś</Link>
        <Link className="btn" href={href(view, props.next)} aria-label="Następny okres">→</Link>
        <h1 className="ml-1 text-xl font-semibold">{title}</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link className="btn" href={`/grafik/generuj?miesiac=${(view === "week" ? days[3] : anchor).slice(0, 7)}`}>Generuj miesiąc</Link>
          {view === "week" && <button className="btn" onClick={() => setModal({ type: "copy" })}>Kopiuj poprzedni tydzień</button>}
          <button className="btn" onClick={() => setModal({ type: "session", defaults: { date: view === "week" ? days[0] : anchor } })}>+ Zajęcia sekcji</button>
          <button className="btn btn-primary" onClick={() => setModal({ type: "shift", defaults: { date: view === "week" ? days[0] : anchor } })}>+ Zmiana</button>
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

      {view === "day" && <DayTimeline {...data} />}
      {view === "week" && <WeekGrid {...data} />}
      {view === "month" && <MonthGrid {...data} month={anchor.slice(0, 7)} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Uwagi do grafiku</h2>
          {normIssues.length > 0 && (
            <ul className="mb-1.5 space-y-1.5 text-sm">
              {normIssues.map((n) => <li key={n.userId} className="alert-warn">{normMessage(n)}</li>)}
            </ul>
          )}
          {allIssues.length === 0 ? (
            normIssues.length === 0 &&
            <p className="text-sm muted">Brak – dyżur pokryty w godzinach otwarcia, limity zachowane.</p>
          ) : (
            <ul className="max-h-96 space-y-1.5 overflow-y-auto text-sm">
              {focus.flatMap((d) =>
                (issues[d] ?? []).map((iss, k) => (
                  <li key={d + k} className={iss.level === "error" ? "alert-error" : "alert-warn"}>
                    {view !== "day" && (
                      <Link href={href("day", d)} className="font-medium hover:underline">{fmtDayShort(d)}:</Link>
                    )}{" "}
                    {iss.message}
                  </li>
                )),
              )}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">{SUMMARY_LABEL[view]}</h2>
          {summary.length === 0 ? (
            <p className="text-sm muted">Brak zaplanowanej pracy w tym okresie.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Instruktor</th><th className="text-right">Dyżur</th><th className="text-right">Routesetting</th><th className="text-right">Sekcje</th>{props.norm.length > 0 && <th className="text-right">Norma UoP</th>}</tr>
              </thead>
              <tbody>
                {summary.map((w) => (
                  <tr key={w.u.id}>
                    <td><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: w.u.color }} />{w.u.name}</td>
                    <td className="text-right tabular-nums">{fmtHours(w.op)}</td>
                    <td className="text-right tabular-nums">{fmtHours(w.rs)}</td>
                    <td className="text-right tabular-nums">{w.sec}</td>
                    {props.norm.length > 0 && (
                      <td className="text-right tabular-nums">
                        {normById.has(w.u.id) ? (
                          <span style={{ color: normById.get(w.u.id)!.missingMin ? "var(--warn)" : "var(--ok)" }}>
                            {fmtHours(normById.get(w.u.id)!.workedMin)} / {fmtHours(normById.get(w.u.id)!.targetMin)}
                          </span>
                        ) : <span className="muted">—</span>}
                      </td>
                    )}
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
      {view === "week" && (
        <Modal open={modal?.type === "copy"} onClose={() => setModal(null)} title="Kopiuj poprzedni tydzień">
          <form action={copyAction} className="space-y-3">
            <input type="hidden" name="from" value={addDays(days[0], -7)} />
            <input type="hidden" name="to" value={days[0]} />
            <p className="text-sm text-2">
              Skopiuje dyżury i routesetting z tygodnia {fmtDayShort(addDays(days[0], -7))} do bieżącego. Sekcje są generowane automatycznie z harmonogramu sekcji.
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
      )}
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
