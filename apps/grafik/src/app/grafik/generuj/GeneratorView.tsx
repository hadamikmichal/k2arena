"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyGenerate, previewGenerate, type GeneratePreview } from "../../actions";
import { dateRange, fmtDayShort, fmtHours, fmtMin, startOfWeek } from "@/lib/time";

type UserRow = { id: string; name: string; color: string; employment: string; submitted: boolean };

export function GeneratorView({ month, defaultFrom, monthEnd, existingShifts, users }: {
  month: string;
  defaultFrom: string;
  monthEnd: string;
  existingShifts: number;
  users: UserRow[];
}) {
  const router = useRouter();
  const [from, setFrom] = useState(defaultFrom);
  const [mode, setMode] = useState<"fill" | "replace">(existingShifts > 0 ? "fill" : "replace");
  const [assumeDefault, setAssumeDefault] = useState(true);
  const [includeRoutesetting, setIncludeRoutesetting] = useState(true);
  const [preview, setPreview] = useState<GeneratePreview | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const opts = { month, from, mode, assumeDefault, includeRoutesetting };
  const notSubmitted = users.filter((u) => !u.submitted);
  const color = (id: string) => users.find((u) => u.id === id)?.color ?? "#888";

  const run = () =>
    start(async () => {
      setSaveMsg(null);
      setPreview(await previewGenerate(opts));
    });
  const save = () =>
    start(async () => {
      const r = await applyGenerate(opts);
      if (r?.error) return setSaveMsg(r.error);
      router.push(`/grafik?tydzien=${startOfWeek(from)}`);
    });

  const issues = preview ? Object.entries(preview.issues).flatMap(([d, list]) => list.map((i) => ({ d, ...i }))) : [];
  const errors = issues.filter((i) => i.level === "error");
  const hours = preview
    ? users
        .map((u) => ({ u, min: preview.shifts.filter((s) => s.userId === u.id).reduce((a, s) => a + s.endMin - s.startMin, 0) }))
        .filter((x) => x.min > 0)
    : [];
  const monthName = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(new Date(`${month}-15`));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Generuj grafik – <span className="capitalize">{monthName}</span></h1>
        <form className="ml-auto flex items-center gap-2" action="/grafik/generuj">
          <input type="month" name="miesiac" defaultValue={month} className="input w-40" aria-label="Miesiąc" />
          <button className="btn">Zmień</button>
        </form>
      </div>

      <section className="card grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="from">Generuj od dnia</label>
              <input id="from" type="date" min={`${month}-01`} max={monthEnd} value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} className="input" />
            </div>
          </div>
          <fieldset className="space-y-2 text-sm">
            <legend className="label">Istniejące zmiany ({existingShifts} od wybranego dnia)</legend>
            <label className="flex gap-2">
              <input type="radio" name="mode" checked={mode === "fill"} onChange={() => { setMode("fill"); setPreview(null); }} />
              <span><b>Uzupełnij luki</b> – zostaw istniejące zmiany, dołóż tylko brakujące</span>
            </label>
            <label className="flex gap-2">
              <input type="radio" name="mode" checked={mode === "replace"} onChange={() => { setMode("replace"); setPreview(null); }} />
              <span><b>Ułóż od nowa</b> – usuń wszystkie zmiany od wybranego dnia do końca miesiąca</span>
            </label>
          </fieldset>
          <div className="space-y-2 text-sm">
            <label className="flex gap-2">
              <input type="checkbox" checked={includeRoutesetting} onChange={(e) => { setIncludeRoutesetting(e.target.checked); setPreview(null); }} />
              Planuj routesetting (dni i okno z Ustawień)
            </label>
            <label className="flex gap-2">
              <input type="checkbox" checked={assumeDefault} onChange={(e) => { setAssumeDefault(e.target.checked); setPreview(null); }} />
              <span>Kto nie zgłosił dyspozycyjności, jest dostępny cały dzień (domyślne ustawienie dyspozycyjności)</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={run} disabled={pending}>{pending && !preview ? "Liczenie…" : "Pokaż podgląd"}</button>
          </div>
        </div>
        <aside className="text-sm">
          <h2 className="mb-2 font-semibold">Dyspozycyjność na ten miesiąc</h2>
          <ul className="space-y-1">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: u.color }} />
                {u.name}
                <span className={`ml-auto badge ${u.submitted ? "" : ""}`} style={u.submitted ? { background: "var(--ok-bg)", color: "var(--ok)" } : undefined}>
                  {u.submitted ? "zgłoszona" : "brak"}
                </span>
              </li>
            ))}
          </ul>
          {notSubmitted.length > 0 && (
            <p className="mt-2 text-xs muted">
              {assumeDefault ? "Osoby bez zgłoszenia traktuję jako dostępne cały dzień." : "Osoby bez zgłoszenia nie dostaną dyżurów."}{" "}
              <Link className="underline" href={`/dyspozycyjnosc?miesiac=${month}`}>Zobacz zestawienie</Link>
            </p>
          )}
        </aside>
      </section>

      {preview?.error && <p className="alert-error">{preview.error}</p>}

      {preview && !preview.error && (
        <>
          <section className="card space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-semibold">Podgląd</h2>
              <span className="text-sm text-2">
                {preview.shifts.length} nowych zmian{preview.replaced ? `, zastąpi ${preview.replaced} istniejących` : ""}
              </span>
              {errors.length > 0 ? (
                <span className="alert-error py-1 text-sm">✕ Problemy z obsadą: {errors.length}</span>
              ) : (
                <span className="alert-ok py-1 text-sm">✓ Dyżur pokryty każdego dnia</span>
              )}
              <button className="btn btn-primary ml-auto" onClick={save} disabled={pending || preview.shifts.length === 0 && !preview.replaced}>
                {pending ? "Zapisywanie…" : "Zapisz grafik"}
              </button>
            </div>
            {saveMsg && <p className="alert-error">{saveMsg}</p>}
            {hours.length > 0 && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {hours.map(({ u, min }) => (
                  <span key={u.id} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: u.color }} />
                    {u.name}: <b className="tabular-nums">{fmtHours(min)}</b>
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="card overflow-x-auto p-0">
            <table className="table min-w-[720px]">
              <thead>
                <tr><th>Dzień</th><th>Nowe zmiany</th><th>Uwagi</th></tr>
              </thead>
              <tbody>
                {dateRange(from, monthEnd).map((d) => {
                  const list = preview.shifts.filter((s) => s.date === d).sort((a, b) => a.startMin - b.startMin);
                  const dayIssues = preview.issues[d] ?? [];
                  return (
                    <tr key={d}>
                      <td className="whitespace-nowrap align-top font-medium">{fmtDayShort(d)}</td>
                      <td className="align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {list.length === 0 && <span className="muted">—</span>}
                          {list.map((s, k) => (
                            <span key={k} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs" style={{ borderColor: color(s.userId), borderLeft: `4px solid ${s.type === "ROUTESETTING" ? "var(--series-rs)" : "var(--series-op)"}` }}>
                              <b>{s.userName.split(" ")[0]}</b> {fmtMin(s.startMin)}–{fmtMin(s.endMin)}{s.type === "ROUTESETTING" && " · RS"}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="align-top text-xs">
                        {dayIssues.map((i, k) => (
                          <div key={k} style={{ color: i.level === "error" ? "var(--err)" : "var(--warn)" }}>{i.level === "error" ? "✕" : "!"} {i.message}</div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
