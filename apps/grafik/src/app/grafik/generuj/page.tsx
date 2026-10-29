import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { monthBounds, todayWarsaw } from "@/lib/time";
import { GeneratorView } from "./GeneratorView";

export default async function GenerujPage({ searchParams }: { searchParams: Promise<{ miesiac?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayWarsaw();
  const month = sp.miesiac && /^\d{4}-\d{2}$/.test(sp.miesiac) ? sp.miesiac : today.slice(0, 7);
  const { from, to } = monthBounds(month);
  const [users, submissions, shiftCount] = await Promise.all([
    prisma.user.findMany({ where: { role: "INSTRUCTOR", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true, employment: true } }),
    prisma.availabilitySubmission.findMany({ where: { month }, select: { userId: true } }),
    prisma.shift.count({ where: { date: { gte: from > today ? from : today, lte: to } } }),
  ]);
  const submitted = new Set(submissions.map((s) => s.userId));
  return (
    <GeneratorView
      month={month}
      defaultFrom={from > today ? from : today <= to ? today : from}
      monthEnd={to}
      existingShifts={shiftCount}
      users={users.map((u) => ({ ...u, submitted: submitted.has(u.id) }))}
    />
  );
}
