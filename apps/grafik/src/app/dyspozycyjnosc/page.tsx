import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getRules } from "@/lib/settings";
import { loadAvailability } from "@/lib/planning";
import { dateRange, fmtMin, isoWeekday, monthBounds, todayWarsaw, WEEKDAYS } from "@/lib/time";
import { AvailabilityForm } from "./AvailabilityForm";

const isMonth = (s?: string) => !!s && /^\d{4}-\d{2}$/.test(s);

function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

export default async function DyspozycyjnoscPage({ searchParams }: { searchParams: Promise<{ miesiac?: string; osoba?: string }> }) {
  const session = await requireUser();
  const sp = await searchParams;
  const isAdmin = session.role === "ADMIN";
  // Domyślnie następny miesiąc – dyspozycyjność zgłasza się z wyprzedzeniem.
  const month = isMonth(sp.miesiac) ? sp.miesiac! : shiftMonth(todayWarsaw().slice(0, 7), 1);
  const { from, to } = monthBounds(month);
  const days = dateRange(from, to);
  const [rules, users, { availability, submissions }] = await Promise.all([
    getRules(),
    prisma.user.findMany({ where: { role: "INSTRUCTOR", active: true }, orderBy: [{ employment: "asc" }, { name: "asc" }] }),
    loadAvailability(month),
  ]);
  const submittedBy = new Map(submissions.map((s) => [s.userId, s]));
  const editId = isAdmin ? sp.osoba : session.sub;
  const editUser = users.find((u) => u.id === editId);
  const monthName = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(new Date(`${month}-15`));
  const q = (m: string, osoba?: string) => `/dyspozycyjnosc?miesiac=${m}${osoba ? `&osoba=${osoba}` : ""}`;

  /** „Cały dzień” = godziny otwarcia; stali w dni routesettingu od początku okna routesettingu. */
  const fullDay = (employment: string) =>
    Object.fromEntries(
      days.map((d) => {
        const wd = isoWeekday(d);
        const open = rules.opening[wd - 1];
        const start = employment === "STALY" && rules.routesettingDays.includes(wd) ? Math.min(open.startMin, rules.routesettingWindow.startMin) : open.startMin;
        return [d, { startMin: start, endMin: open.endMin }];
      }),
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-semibold">Dyspozycyjność</h1>
        <Link className="btn" href={q(shiftMonth(month, -1), sp.osoba)} aria-label="Poprzedni miesiąc">←</Link>
        <span className="min-w-36 text-center font-medium capitalize">{monthName}</span>
        <Link className="btn" href={q(shiftMonth(month, 1), sp.osoba)} aria-label="Następny miesiąc">→</Link>
        {isAdmin && (
          <Link className="btn btn-primary ml-auto" href={`/grafik/generuj?miesiac=${month}`}>Generuj grafik na ten miesiąc</Link>
        )}
      </div>

      {isAdmin && (
        <section className="card overflow-x-auto p-0">
          <table className="table min-w-[900px] text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10" style={{ background: "var(--surface)" }}>Instruktor</th>
                {days.map((d) => (
                  <th key={d} className="px-1 text-center" style={{ color: isoWeekday(d) >= 6 ? "var(--accent)" : undefined }}>
                    {WEEKDAYS[isoWeekday(d) - 1]}<br />{d.slice(8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const sub = submittedBy.get(u.id);
                return (
                  <tr key={u.id} style={{ background: u.id === editId ? "var(--surface-2)" : undefined }}>
                    <td className="sticky left-0 z-10 whitespace-nowrap" style={{ background: "var(--surface)" }}>
                      <Link href={q(month, u.id)} className="font-medium hover:underline">
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: u.color }} />
                        {u.name}
                      </Link>
                      <div className="muted">{sub ? `zgłoszone ${sub.submittedAt.toLocaleDateString("pl-PL")}` : "brak zgłoszenia"}</div>
                    </td>
                    {days.map((d) => {
                      const iv = availability[u.id]?.[d]?.[0];
                      return (
                        <td key={d} className="px-0.5 text-center tabular-nums" title={iv ? `${fmtMin(iv.startMin)}–${fmtMin(iv.endMin)}` : sub ? "niedostępny" : "brak zgłoszenia"}>
                          {iv ? (
                            <span className="block rounded px-0.5 py-1" style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>
                              {iv.startMin / 60 | 0}–{iv.endMin / 60 | 0}
                            </span>
                          ) : sub ? (
                            <span className="muted">✕</span>
                          ) : (
                            <span className="muted">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs muted">
            Zielone = dostępny (godziny), ✕ = niedostępny, · = instruktor jeszcze nie zgłosił dyspozycyjności. Kliknij nazwisko, aby wpisać lub poprawić dyspozycyjność za instruktora.
          </p>
        </section>
      )}

      {editUser ? (
        <section className="card">
          <h2 className="mb-1 font-semibold">{isAdmin ? `Dyspozycyjność: ${editUser.name}` : "Moja dyspozycyjność"}</h2>
          <p className="mb-4 text-sm muted">
            Zaznacz dni i godziny, w których możesz pracować w tym miesiącu. Dni bez zaznaczenia oznaczają brak dostępności.
            {submittedBy.get(editUser.id) && ` Ostatnia zmiana: ${submittedBy.get(editUser.id)!.submittedAt.toLocaleString("pl-PL")}.`}
          </p>
          <AvailabilityForm
            key={`${editUser.id}-${month}`}
            month={month}
            userId={isAdmin ? editUser.id : undefined}
            days={days}
            fullDay={fullDay(editUser.employment)}
            staffDays={editUser.employment === "STALY" ? rules.staffDays : [1, 2, 3, 4, 5, 6, 7].filter((d) => !rules.staffDays.includes(d))}
            initial={Object.fromEntries(Object.entries(availability[editUser.id] ?? {}).map(([d, list]) => [d, list[0]]))}
            note={submittedBy.get(editUser.id)?.note ?? ""}
            locked={!isAdmin && month < todayWarsaw().slice(0, 7)}
          />
        </section>
      ) : (
        isAdmin && <p className="text-sm muted">Wybierz instruktora z tabeli, aby wpisać jego dyspozycyjność.</p>
      )}
    </div>
  );
}
