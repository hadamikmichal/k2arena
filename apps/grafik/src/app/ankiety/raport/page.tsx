import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { CATEGORIES, FORM_STATUS_LABEL, FORM_STATUSES, SKILL_QUESTIONS } from "@/lib/clientForm";
import { loadForms, parseRange } from "@/lib/formData";
import { computeFormStats } from "@/lib/formStats";
import { fmtDate, monthBounds, todayWarsaw } from "@/lib/time";

const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

// Raport ankiet klientów: statystyki za okres + pobieranie (CSV, Excel) i wydruk wszystkich ankiet z okresu.
export default async function RaportPage({ searchParams }: { searchParams: Promise<{ od?: string; do?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayWarsaw();
  const range = parseRange(sp.od, sp.do) ?? monthBounds(today.slice(0, 7));
  const { from, to } = range;
  const s = computeFormStats(await loadForms(range));
  const q = `od=${from}&do=${to}`;
  const presets = [
    { label: "Ten miesiąc", ...monthBounds(today.slice(0, 7)) },
    { label: "Poprzedni miesiąc", ...monthBounds(prevMonth(today.slice(0, 7))) },
    { label: "Ten rok", from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/ankiety" className="btn" aria-label="Wróć do ankiet">←</Link>
        <h1 className="mr-2 page-title">Raport ankiet</h1>
        <span className="font-medium">{fmtDate(from)} – {fmtDate(to)}</span>
        <form className="ml-auto flex flex-wrap items-end gap-2" action="/ankiety/raport">
          <div>
            <label className="label" htmlFor="od">Od</label>
            <input id="od" type="date" name="od" defaultValue={from} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="do">Do</label>
            <input id="do" type="date" name="do" defaultValue={to} className="input" />
          </div>
          <button className="btn">Pokaż</button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {presets.map((p) => (
          <Link key={p.label} href={`/ankiety/raport?od=${p.from}&do=${p.to}`} className="badge" aria-current={p.from === from && p.to === to ? "page" : undefined}>
            {p.label}
          </Link>
        ))}
      </div>

      <section className="card space-y-3">
        <h2 className="section-title">Pobierz i wydrukuj</h2>
        <p className="text-sm muted">
          Pełne dane z okresu, łącznie z treścią zaakceptowanych oświadczeń (wydruk), datą i godziną wysłania, adresem IP
          i przeglądarką – jako dowód złożenia oświadczeń. Zawiera dane osobowe: przechowuj zgodnie z RODO.
        </p>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-primary" href={`/api/ankiety/eksport?${q}&format=xlsx`}>Excel (ankiety + statystyki)</a>
          <a className="btn" href={`/api/ankiety/eksport?${q}&format=csv&typ=ankiety`}>CSV – ankiety</a>
          <a className="btn" href={`/api/ankiety/eksport?${q}&format=csv&typ=statystyki`}>CSV – statystyki</a>
          <a className="btn" href={`/ankiety/druk?${q}`} target="_blank" rel="noopener">Drukuj ankiety ({s.total})</a>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Ankiety wypełnione" value={s.total} />
        <Tile label="Do weryfikacji (wszystkie TAK)" value={s.verify} sub={pct(s.verify, s.total)} />
        <Tile label="Do szkolenia (choć jedno NIE)" value={s.training} sub={pct(s.training, s.total)} />
        <Tile label="Zatwierdzone przez instruktora" value={s.byStatus.ZAKONCZONE ?? 0} sub={pct(s.byStatus.ZAKONCZONE ?? 0, s.total)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatTable
          title="Obecny status"
          rows={FORM_STATUSES.map((k) => [FORM_STATUS_LABEL[k], s.byStatus[k] ?? 0, pct(s.byStatus[k] ?? 0, s.total)])}
        />
        <StatTable title="Odpowiedzi NIE" rows={SKILL_QUESTIONS.map((q) => [q.label, s.noByQuestion[q.key], pct(s.noByQuestion[q.key], s.total)])} />
        <StatTable
          title="Nadane kategorie"
          note="Udział wśród zatwierdzonych; klient może mieć kilka kategorii."
          rows={CATEGORIES.map((c) => [c.label, s.categories[c.code], pct(s.categories[c.code], s.byStatus.ZAKONCZONE ?? 0)])}
        />
        <StatTable
          title="Klienci"
          rows={[
            ["Niepełnoletni w dniu wypełnienia", s.minorClients, pct(s.minorClients, s.total)],
            ["Ankiety z osobami małoletnimi pod opieką", s.withMinors, pct(s.withMinors, s.total)],
            ["Osoby małoletnie pod opieką (łącznie)", s.minorsUnderCare, ""],
          ]}
        />
        <StatTable
          title="Wg miesiąca"
          head={["Miesiąc", "Razem", "Weryfikacja / szkolenie"]}
          rows={s.byMonth.map((m) => [m.month, m.total, `${m.verify} / ${m.training}`])}
        />
        <StatTable title="Zatwierdzenia wg instruktora" rows={s.byReviewer.map((r) => [r.name, r.count, pct(r.count, s.byStatus.ZAKONCZONE ?? 0)])} />
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs muted">{sub}</div>}
    </div>
  );
}

function StatTable({ title, rows, head, note }: { title: string; rows: (string | number)[][]; head?: string[]; note?: string }) {
  return (
    <section className="card p-0">
      <h2 className="section-title px-3 pt-3">{title}</h2>
      {note && <p className="px-3 text-xs muted">{note}</p>}
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-sm muted">Brak danych w tym okresie.</p>
      ) : (
        <table className="table mt-2">
          {head && (
            <thead>
              <tr>{head.map((h, i) => <th key={h} className={i ? "text-right" : undefined}>{h}</th>)}</tr>
            </thead>
          )}
          <tbody>
            {rows.map((r) => (
              <tr key={String(r[0])}>
                {r.map((c, i) => <td key={i} className={i ? "text-right tabular-nums" : undefined}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
