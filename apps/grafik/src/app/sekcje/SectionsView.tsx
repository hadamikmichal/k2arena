"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endSeries, saveSeries } from "../actions";
import { Modal } from "@/components/Modal";
import { SessionForm } from "@/components/SessionForm";
import type { SessionDTO, UserOpt } from "@/components/types";
import { addDays, fmtDate, fmtDayShort, fmtMin, WEEKDAYS_LONG } from "@/lib/time";

type SeriesDTO = {
  id: string; name: string; kind: string; userId: string; weekday: number; startMin: number; endMin: number;
  validFrom: string; validTo: string; active: boolean; count: number;
};

const STATUS: Record<string, string> = { PLANNED: "zaplanowane", DONE: "odbyte", CANCELLED: "odwołane" };

export function SectionsView({ today, users, series, upcoming }: { today: string; users: UserOpt[]; series: SeriesDTO[]; upcoming: SessionDTO[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<{ type: "series"; series?: SeriesDTO } | { type: "session"; session?: SessionDTO } | null>(null);
  const close = useCallback(() => {
    setModal(null);
    router.refresh();
  }, [router]);
  const [ending, startEnding] = useTransition();
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? "?";
  const userColor = (id: string) => users.find((u) => u.id === id)?.color ?? "#888";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Sekcje wspinaczkowe</h1>
        <div className="ml-auto flex gap-2">
          <button className="btn" onClick={() => setModal({ type: "session", session: undefined })}>+ Zajęcia jednorazowe</button>
          <button className="btn btn-primary" onClick={() => setModal({ type: "series" })}>+ Nowa sekcja</button>
        </div>
      </div>

      <section className="card overflow-x-auto p-0">
        <table className="table min-w-[720px]">
          <thead>
            <tr><th>Sekcja</th><th>Termin</th><th>Prowadzący</th><th>Okres</th><th className="text-right">Zajęć</th><th /></tr>
          </thead>
          <tbody>
            {series.length === 0 && (
              <tr><td colSpan={6} className="muted">Brak sekcji – dodaj pierwszą.</td></tr>
            )}
            {series.map((s) => (
              <tr key={s.id} style={{ opacity: s.active ? 1 : 0.55 }}>
                <td>
                  <div className="font-medium">{s.name}</div>
                  <span className="badge">{s.kind === "DZIECI" ? "dzieci" : "dorośli"}</span>
                  {!s.active && <span className="badge ml-1">zakończona</span>}
                </td>
                <td>{WEEKDAYS_LONG[s.weekday - 1]}, {fmtMin(s.startMin)}–{fmtMin(s.endMin)}</td>
                <td><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: userColor(s.userId) }} />{userName(s.userId)}</td>
                <td className="whitespace-nowrap">{fmtDate(s.validFrom)} – {fmtDate(s.validTo)}</td>
                <td className="text-right tabular-nums">{s.count}</td>
                <td className="whitespace-nowrap text-right">
                  {s.active && (
                    <>
                      <button className="btn mr-1" onClick={() => setModal({ type: "series", series: s })}>Edytuj</button>
                      <button
                        className="btn btn-danger"
                        disabled={ending}
                        onClick={() => confirm(`Zakończyć sekcję „${s.name}”? Przyszłe zajęcia zostaną usunięte, historia zostaje w statystykach.`) && startEnding(async () => { await endSeries(s.id); router.refresh(); })}
                      >
                        Zakończ
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Najbliższe 4 tygodnie</h2>
        <p className="mb-3 text-sm muted">Kliknij zajęcia, aby wpisać zastępstwo, odwołać lub oznaczyć jako odbyte.</p>
        <div className="card overflow-x-auto p-0">
          <table className="table min-w-[640px]">
            <thead>
              <tr><th>Dzień</th><th>Godziny</th><th>Sekcja</th><th>Prowadzący</th><th>Status</th></tr>
            </thead>
            <tbody>
              {upcoming.length === 0 && <tr><td colSpan={5} className="muted">Brak zaplanowanych zajęć.</td></tr>}
              {upcoming.map((s) => (
                <tr key={s.id} className="cursor-pointer hover:bg-[var(--surface-2)]" onClick={() => setModal({ type: "session", session: s })}>
                  <td className="whitespace-nowrap">{fmtDayShort(s.date)}{s.date === today && <span className="badge ml-1">dziś</span>}</td>
                  <td className="tabular-nums">{fmtMin(s.startMin)}–{fmtMin(s.endMin)}</td>
                  <td>{s.name}{!s.seriesId && <span className="badge ml-1">jednorazowe</span>}</td>
                  <td><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: userColor(s.userId) }} />{userName(s.userId)}{s.note && <span className="muted"> · {s.note}</span>}</td>
                  <td>{STATUS[s.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={modal?.type === "series"} onClose={() => setModal(null)} title={modal?.type === "series" && modal.series ? "Edycja sekcji" : "Nowa sekcja cykliczna"}>
        {modal?.type === "series" && <SeriesForm series={modal.series} users={users} today={today} onDone={close} />}
      </Modal>
      <Modal open={modal?.type === "session"} onClose={() => setModal(null)} title={modal?.type === "session" && modal.session ? "Zajęcia sekcji" : "Zajęcia jednorazowe"}>
        {modal?.type === "session" && <SessionForm session={modal.session} defaults={{ date: today }} users={users} onDone={close} />}
      </Modal>
    </div>
  );
}

function SeriesForm({ series, users, today, onDone }: { series?: SeriesDTO; users: UserOpt[]; today: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveSeries, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-3">
      {series && <input type="hidden" name="id" value={series.id} />}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="label">Nazwa</label>
          <input name="name" defaultValue={series?.name} placeholder="np. Dzieci 7–10 lat" className="input" required />
        </div>
        <div>
          <label className="label">Grupa</label>
          <select name="kind" defaultValue={series?.kind ?? "DZIECI"} className="input">
            <option value="DZIECI">Dzieci</option>
            <option value="DOROSLI">Dorośli</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Prowadzący</label>
        <select name="userId" defaultValue={series?.userId ?? ""} className="input" required>
          <option value="" disabled>— wybierz —</option>
          {users.filter((u) => u.active !== false).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label">Dzień tygodnia</label>
          <select name="weekday" defaultValue={series?.weekday ?? 1} className="input">
            {WEEKDAYS_LONG.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Od</label>
          <input type="time" name="start" step={900} defaultValue={series ? fmtMin(series.startMin) : "17:00"} className="input" required />
        </div>
        <div>
          <label className="label">Do</label>
          <input type="time" name="end" step={900} defaultValue={series ? fmtMin(series.endMin) : "18:30"} className="input" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Obowiązuje od</label>
          <input type="date" name="validFrom" defaultValue={series?.validFrom ?? today} className="input" required />
        </div>
        <div>
          <label className="label">do</label>
          <input type="date" name="validTo" defaultValue={series?.validTo ?? addDays(today, 120)} className="input" required />
        </div>
      </div>
      {series && (
        <p className="text-xs muted">Zapis przegeneruje przyszłe zaplanowane zajęcia (pojedyncze zastępstwa w przyszłości zostaną nadpisane). Przeszłe zajęcia nie zmieniają się.</p>
      )}
      {state?.error && <p className="alert-error">{state.error}</p>}
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz"}</button>
      </div>
    </form>
  );
}
