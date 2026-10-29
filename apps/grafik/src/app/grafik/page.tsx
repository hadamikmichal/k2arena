import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getRules } from "@/lib/settings";
import { validateDay, type Issue } from "@/lib/rules";
import { addDays, dateRange, monthBounds, startOfWeek, todayWarsaw, weekDates } from "@/lib/time";
import { ScheduleBoard, type View } from "./ScheduleBoard";

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const VIEWS: Record<string, View> = { dzien: "day", tydzien: "week", miesiac: "month" };

function shiftMonth(date: string, n: number): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}

export default async function GrafikPage({ searchParams }: { searchParams: Promise<{ widok?: string; data?: string; tydzien?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayWarsaw();
  const view = VIEWS[sp.widok ?? ""] ?? "week";
  // ?tydzien= zostaje dla zgodności ze starszymi linkami
  const anchor = isDate(sp.data) ? sp.data! : isDate(sp.tydzien) ? sp.tydzien! : today;

  // days = dni wyświetlane; focus = dni, których dotyczą uwagi i podsumowanie
  let days: string[];
  let focus: string[];
  let prev: string;
  let next: string;
  if (view === "day") {
    days = focus = [anchor];
    prev = addDays(anchor, -1);
    next = addDays(anchor, 1);
  } else if (view === "month") {
    const { from, to } = monthBounds(anchor.slice(0, 7));
    days = dateRange(startOfWeek(from), addDays(startOfWeek(to), 6));
    focus = dateRange(from, to);
    prev = shiftMonth(anchor, -1);
    next = shiftMonth(anchor, 1);
  } else {
    days = focus = weekDates(startOfWeek(anchor));
    prev = addDays(days[0], -7);
    next = addDays(days[0], 7);
  }
  const range = { gte: days[0], lte: days[days.length - 1] };

  const [users, shifts, sessions, rules] = await Promise.all([
    prisma.user.findMany({ where: { role: "INSTRUCTOR" }, orderBy: [{ employment: "asc" }, { name: "asc" }] }),
    prisma.shift.findMany({ where: { date: range }, orderBy: { startMin: "asc" } }),
    prisma.sectionSession.findMany({ where: { date: range }, orderBy: { startMin: "asc" } }),
    getRules(),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));

  const issues: Record<string, Issue[]> = {};
  for (const d of days) {
    issues[d] = validateDay(
      d,
      shifts.filter((s) => s.date === d).map((s) => ({ ...s, userName: byId.get(s.userId)?.name, employment: byId.get(s.userId)?.employment })),
      sessions.filter((s) => s.date === d).map((s) => ({ ...s, userName: byId.get(s.userId)?.name, employment: byId.get(s.userId)?.employment })),
      rules,
    );
  }

  return (
    <ScheduleBoard
      view={view}
      anchor={anchor}
      days={days}
      focus={focus}
      prev={prev}
      next={next}
      today={today}
      users={users.map((u) => ({ id: u.id, name: u.name, color: u.color, employment: u.employment, active: u.active }))}
      shifts={shifts.map(({ id, userId, date, startMin, endMin, type, note }) => ({ id, userId, date, startMin, endMin, type, note }))}
      sessions={sessions.map(({ id, seriesId, userId, name, kind, date, startMin, endMin, status, note }) => ({ id, seriesId, userId, name, kind, date, startMin, endMin, status, note }))}
      issues={issues}
      opening={rules.opening}
    />
  );
}
