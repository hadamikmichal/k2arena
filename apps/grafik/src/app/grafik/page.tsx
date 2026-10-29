import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getRules } from "@/lib/settings";
import { validateDay, type Issue } from "@/lib/rules";
import { addDays, startOfWeek, todayWarsaw, weekDates } from "@/lib/time";
import { WeekBoard } from "./WeekBoard";

export default async function GrafikPage({ searchParams }: { searchParams: Promise<{ tydzien?: string }> }) {
  await requireAdmin();
  const { tydzien } = await searchParams;
  const monday = startOfWeek(tydzien && /^\d{4}-\d{2}-\d{2}$/.test(tydzien) ? tydzien : todayWarsaw());
  const days = weekDates(monday);
  const range = { gte: days[0], lte: days[6] };

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
    <WeekBoard
      monday={monday}
      prevWeek={addDays(monday, -7)}
      nextWeek={addDays(monday, 7)}
      today={todayWarsaw()}
      users={users.map((u) => ({ id: u.id, name: u.name, color: u.color, employment: u.employment, active: u.active }))}
      shifts={shifts.map(({ id, userId, date, startMin, endMin, type, note }) => ({ id, userId, date, startMin, endMin, type, note }))}
      sessions={sessions.map(({ id, seriesId, userId, name, kind, date, startMin, endMin, status, note }) => ({ id, seriesId, userId, name, kind, date, startMin, endMin, status, note }))}
      issues={issues}
      opening={rules.opening}
    />
  );
}
