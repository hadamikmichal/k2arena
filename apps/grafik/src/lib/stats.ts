import { prisma } from "./db";
import { merge } from "./rules";
import { todayWarsaw } from "./time";

export type InstructorStats = {
  userId: string;
  name: string;
  color: string;
  employment: string;
  daysWorked: number;
  operatorMin: number;
  routesettingMin: number;
  sectionMin: number;
  /** Łączny czas pracy (bez podwójnego liczenia sekcji prowadzonych w trakcie dyżuru) */
  totalMin: number;
  sectionsDone: number;
  sectionsPlanned: number;
  sectionsCancelled: number;
  sectionsByName: Record<string, number>;
};

export async function computeStats(from: string, to: string, userId?: string): Promise<InstructorStats[]> {
  const today = todayWarsaw();
  const where = { date: { gte: from, lte: to }, ...(userId ? { userId } : {}) };
  const [users, shifts, sessions] = await Promise.all([
    prisma.user.findMany({ where: { role: "INSTRUCTOR", ...(userId ? { id: userId } : {}) }, orderBy: { name: "asc" } }),
    prisma.shift.findMany({ where }),
    prisma.sectionSession.findMany({ where }),
  ]);

  return users
    .map((u) => {
      const myShifts = shifts.filter((s) => s.userId === u.id);
      const mySessions = sessions.filter((s) => s.userId === u.id);
      const active = mySessions.filter((s) => s.status !== "CANCELLED");
      const days = new Set([...myShifts.map((s) => s.date), ...active.map((s) => s.date)]);
      let totalMin = 0;
      for (const d of days) {
        const blocks = [...myShifts, ...active].filter((x) => x.date === d);
        totalMin += merge(blocks).reduce((acc, i) => acc + i.endMin - i.startMin, 0);
      }
      const dur = (list: { startMin: number; endMin: number }[]) => list.reduce((a, s) => a + s.endMin - s.startMin, 0);
      const sectionsByName: Record<string, number> = {};
      for (const s of active) sectionsByName[s.name] = (sectionsByName[s.name] ?? 0) + 1;
      return {
        userId: u.id,
        name: u.name,
        color: u.color,
        employment: u.employment,
        daysWorked: days.size,
        operatorMin: dur(myShifts.filter((s) => s.type === "OPERATOR")),
        routesettingMin: dur(myShifts.filter((s) => s.type === "ROUTESETTING")),
        sectionMin: dur(active),
        totalMin,
        sectionsDone: active.filter((s) => s.status === "DONE" || s.date < today).length,
        sectionsPlanned: active.filter((s) => s.status === "PLANNED" && s.date >= today).length,
        sectionsCancelled: mySessions.length - active.length,
        sectionsByName,
      };
    })
    // Nieaktywnych instruktorów pokazujemy tylko, jeśli pracowali w danym okresie.
    .filter((s) => users.find((u) => u.id === s.userId)!.active || s.totalMin > 0);
}
