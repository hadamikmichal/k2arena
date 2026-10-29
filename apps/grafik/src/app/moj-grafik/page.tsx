import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computeStats } from "@/lib/stats";
import { SHIFT_LABEL } from "@/lib/calendar";
import { addDays, fmtDayShort, fmtHours, fmtMin, monthBounds, todayWarsaw } from "@/lib/time";
import { CopyButton } from "@/components/CopyButton";
import { AccountForms } from "./AccountForms";
import { getRules } from "@/lib/settings";

export default async function MojGrafikPage() {
  const session = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.sub } });
  const today = todayWarsaw();
  const until = addDays(today, 27);
  const where = { userId: user.id, date: { gte: today, lte: until } };
  const [shifts, sessions] = await Promise.all([
    prisma.shift.findMany({ where }),
    prisma.sectionSession.findMany({ where }),
  ]);
  const items = [
    ...shifts.map((s) => ({ id: s.id, date: s.date, startMin: s.startMin, endMin: s.endMin, label: SHIFT_LABEL[s.type] ?? s.type, cancelled: false, color: s.type === "ROUTESETTING" ? "var(--series-rs)" : "var(--series-op)", note: s.note })),
    ...sessions.map((s) => ({ id: s.id, date: s.date, startMin: s.startMin, endMin: s.endMin, label: `Sekcja: ${s.name}`, cancelled: s.status === "CANCELLED", color: "var(--series-sec)", note: s.note })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
  const byDate = Map.groupBy(items, (i) => i.date);

  const month = monthBounds(today.slice(0, 7));
  const [stats] = user.role === "INSTRUCTOR" ? await computeStats(month.from, month.to, user.id) : [];
  const rules = await getRules();
  const icalUrl = `${process.env.APP_URL ?? "http://localhost:3010"}/api/ical/${user.icalToken}`;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">{user.role === "ADMIN" ? "Konto" : "Mój grafik – najbliższe 4 tygodnie"}</h1>
        {user.role === "INSTRUCTOR" && byDate.size === 0 && <p className="card text-sm muted">Brak zaplanowanej pracy.</p>}
        {[...byDate].map(([date, list]) => (
          <div key={date} className="card">
            <div className="mb-2 font-semibold">
              {fmtDayShort(date)} {date === today && <span className="badge ml-1">dziś</span>}
            </div>
            <ul className="space-y-1.5">
              {list.map((i) => (
                <li key={i.id} className="flex items-center gap-3 text-sm" style={{ opacity: i.cancelled ? 0.5 : 1 }}>
                  <span className="h-8 w-1 rounded" style={{ background: i.color }} />
                  <span className="w-24 tabular-nums">{fmtMin(i.startMin)}–{fmtMin(i.endMin)}</span>
                  <span className={i.cancelled ? "line-through" : ""}>{i.label}</span>
                  {i.cancelled && <span className="badge">odwołane</span>}
                  {i.note && <span className="muted">· {i.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <aside className="space-y-4">
        {stats && (
          <section className="card">
            <h2 className="mb-3 font-semibold">Ten miesiąc</h2>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-2">Dni pracy</dt><dd className="text-right tabular-nums">{stats.daysWorked}</dd>
              <dt className="text-2">Dyżur</dt><dd className="text-right tabular-nums">{fmtHours(stats.operatorMin)}</dd>
              <dt className="text-2">Routesetting</dt><dd className="text-right tabular-nums">{fmtHours(stats.routesettingMin)}</dd>
              <dt className="text-2">Sekcje</dt><dd className="text-right tabular-nums">{stats.sectionsDone + stats.sectionsPlanned} ({fmtHours(stats.sectionMin)})</dd>
              <dt className="font-semibold">Razem</dt><dd className="text-right font-semibold tabular-nums">{fmtHours(stats.totalMin)}</dd>
            </dl>
            {user.employment === "UOP" && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-2">Norma UoP</span>
                  <span className="tabular-nums">{fmtHours(stats.totalMin)} / {fmtHours(rules.uopMonthlyMinMin)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }} role="progressbar" aria-valuenow={Math.round(stats.totalMin / 60)} aria-valuemax={rules.uopMonthlyMinMin / 60} aria-label="Postęp normy godzin">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (stats.totalMin / rules.uopMonthlyMinMin) * 100)}%`, background: stats.totalMin >= rules.uopMonthlyMinMin ? "var(--ok)" : "var(--series-op)" }} />
                </div>
                <p className="text-xs muted">Grafik na cały miesiąc (zaplanowane + przepracowane).</p>
              </div>
            )}
          </section>
        )}
        <section className="card space-y-2">
          <h2 className="font-semibold">Google Calendar</h2>
          <p className="text-sm text-2">
            {user.role === "ADMIN" ? "Ten link zawiera cały grafik." : "Twój osobisty grafik jako kalendarz."} W Google Calendar: <em>Inne kalendarze → + → Z adresu URL</em> i wklej link. Google odświeża go co kilka godzin.
          </p>
          <CopyButton text={icalUrl} label="Kopiuj link do kalendarza" />
        </section>
        <AccountForms userId={user.id} />
      </aside>
    </div>
  );
}
