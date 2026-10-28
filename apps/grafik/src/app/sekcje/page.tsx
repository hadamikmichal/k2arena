import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { addDays, todayWarsaw } from "@/lib/time";
import { SectionsView } from "./SectionsView";

export default async function SekcjePage() {
  await requireAdmin();
  const today = todayWarsaw();
  const [users, series, upcoming] = await Promise.all([
    prisma.user.findMany({ where: { role: "INSTRUCTOR" }, orderBy: { name: "asc" } }),
    prisma.sectionSeries.findMany({
      orderBy: [{ active: "desc" }, { weekday: "asc" }, { startMin: "asc" }],
      include: { _count: { select: { sessions: true } } },
    }),
    prisma.sectionSession.findMany({
      where: { date: { gte: today, lte: addDays(today, 27) } },
      orderBy: [{ date: "asc" }, { startMin: "asc" }],
    }),
  ]);
  return (
    <SectionsView
      today={today}
      users={users.map((u) => ({ id: u.id, name: u.name, color: u.color, employment: u.employment, active: u.active }))}
      series={series.map((s) => ({
        id: s.id, name: s.name, kind: s.kind, userId: s.userId, weekday: s.weekday, startMin: s.startMin, endMin: s.endMin,
        validFrom: s.validFrom, validTo: s.validTo, active: s.active, count: s._count.sessions,
      }))}
      upcoming={upcoming.map(({ id, seriesId, userId, name, kind, date, startMin, endMin, status, note }) => ({ id, seriesId, userId, name, kind, date, startMin, endMin, status, note }))}
    />
  );
}
