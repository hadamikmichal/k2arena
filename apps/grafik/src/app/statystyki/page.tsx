import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { computeStats } from "@/lib/stats";
import { fmtDate, fmtHours, monthBounds, todayWarsaw } from "@/lib/time";
import { HoursChart } from "@/components/HoursChart";
import { EMPLOYMENT_SHORT } from "@/lib/employment";

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export default async function StatystykiPage({ searchParams }: { searchParams: Promise<{ od?: string; do?: string; miesiac?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const month = sp.miesiac && /^\d{4}-\d{2}$/.test(sp.miesiac) ? sp.miesiac : todayWarsaw().slice(0, 7);
  const custom = isDate(sp.od) && isDate(sp.do);
  const { from, to } = custom ? { from: sp.od!, to: sp.do! } : monthBounds(month);
  const stats = await computeStats(from, to);
  const sum = (k: "operatorMin" | "routesettingMin" | "sectionMin" | "totalMin" | "sectionsDone" | "sectionsPlanned" | "sectionsCancelled" | "daysWorked") =>
    stats.reduce((a, s) => a + s[k], 0);
  const monthName = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(new Date(`${month}-15`));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-semibold">Statystyki</h1>
        {!custom && (
          <>
            <Link className="btn" href={`/statystyki?miesiac=${shiftMonth(month, -1)}`} aria-label="Poprzedni miesiąc">←</Link>
            <span className="min-w-36 text-center font-medium capitalize">{monthName}</span>
            <Link className="btn" href={`/statystyki?miesiac=${shiftMonth(month, 1)}`} aria-label="Następny miesiąc">→</Link>
          </>
        )}
        {custom && <span className="font-medium">{fmtDate(from)} – {fmtDate(to)}</span>}
        <form className="ml-auto flex flex-wrap items-end gap-2" action="/statystyki">
          <div>
            <label className="label" htmlFor="od">Od</label>
            <input id="od" type="date" name="od" defaultValue={from} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="do">Do</label>
            <input id="do" type="date" name="do" defaultValue={to} className="input" />
          </div>
          <button className="btn">Pokaż</button>
          <a className="btn" href={`/api/statystyki?od=${from}&do=${to}`}>Eksport CSV</a>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Łącznie godzin pracy" value={fmtHours(sum("totalMin"))} />
        <Tile label="Godziny dyżuru" value={fmtHours(sum("operatorMin"))} />
        <Tile label="Godziny routesettingu" value={fmtHours(sum("routesettingMin"))} />
        <Tile label="Zajęcia sekcji" value={String(sum("sectionsDone") + sum("sectionsPlanned"))} sub={sum("sectionsCancelled") ? `+ ${sum("sectionsCancelled")} odwołanych` : undefined} />
      </div>

      <section className="card">
        <h2 className="mb-1 font-semibold">Godziny wg instruktora</h2>
        <p className="mb-4 text-sm muted">Podział na rodzaj pracy w okresie {fmtDate(from)} – {fmtDate(to)}. Sekcja prowadzona w trakcie dyżuru liczy się w obu kategoriach.</p>
        <HoursChart
          rows={stats.map((s) => ({ name: s.name, color: s.color, operatorMin: s.operatorMin, routesettingMin: s.routesettingMin, sectionMin: s.sectionMin }))}
        />
      </section>

      <section className="card overflow-x-auto p-0">
        <table className="table min-w-[860px]">
          <thead>
            <tr>
              <th>Instruktor</th>
              <th className="text-right">Dni pracy</th>
              <th className="text-right">Dyżur</th>
              <th className="text-right">Routesetting</th>
              <th className="text-right">Sekcje (h)</th>
              <th className="text-right">Razem*</th>
              <th className="text-right">Sekcje odbyte</th>
              <th className="text-right">Zaplanowane</th>
              <th className="text-right">Odwołane</th>
              <th>Sekcje wg grupy</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.userId}>
                <td className="whitespace-nowrap">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.name}
                  <span className="badge ml-2">{EMPLOYMENT_SHORT[s.employment]}</span>
                </td>
                <td className="text-right tabular-nums">{s.daysWorked}</td>
                <td className="text-right tabular-nums">{fmtHours(s.operatorMin)}</td>
                <td className="text-right tabular-nums">{fmtHours(s.routesettingMin)}</td>
                <td className="text-right tabular-nums">{fmtHours(s.sectionMin)}</td>
                <td className="text-right font-semibold tabular-nums">{fmtHours(s.totalMin)}</td>
                <td className="text-right tabular-nums">{s.sectionsDone}</td>
                <td className="text-right tabular-nums">{s.sectionsPlanned}</td>
                <td className="text-right tabular-nums">{s.sectionsCancelled}</td>
                <td className="text-xs text-2">
                  {Object.entries(s.sectionsByName).map(([n, c]) => `${n}: ${c}`).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-3 py-2 text-xs muted">* Razem = łączny czas obecności w pracy; sekcja prowadzona w trakcie dyżuru nie jest liczona podwójnie.</p>
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs muted">{sub}</div>}
    </div>
  );
}
