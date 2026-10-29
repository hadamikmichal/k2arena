// Wczytywanie danych miesiąca dla generatora i dyspozycyjności.
import { prisma } from "./db";
import { getRules } from "./settings";
import { generateSchedule, type GenResult } from "./generator";
import type { Interval } from "./rules";
import { dateRange, monthBounds } from "./time";

export type GenerateMode = "fill" | "replace";

export type GenerateOptions = {
  month: string;
  /** Pierwszy dzień, od którego generujemy (np. dziś w bieżącym miesiącu) */
  from: string;
  mode: GenerateMode;
  assumeDefault: boolean;
  includeRoutesetting: boolean;
};

export async function loadAvailability(month: string) {
  const { from, to } = monthBounds(month);
  const [rows, submissions] = await Promise.all([
    prisma.availability.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { startMin: "asc" } }),
    prisma.availabilitySubmission.findMany({ where: { month } }),
  ]);
  const availability: Record<string, Record<string, Interval[]>> = {};
  for (const r of rows) {
    ((availability[r.userId] ??= {})[r.date] ??= []).push({ startMin: r.startMin, endMin: r.endMin });
  }
  return { availability, submissions };
}

export async function runGenerator(opts: GenerateOptions): Promise<GenResult & { replaced: number }> {
  const { from: monthStart, to } = monthBounds(opts.month);
  const dates = dateRange(opts.from, to);
  const range = { gte: opts.from, lte: to };
  const before = { gte: monthStart, lt: opts.from };
  const [rules, users, sessions, existing, { availability, submissions }, priorShifts, priorSessions] = await Promise.all([
    getRules(),
    prisma.user.findMany({ where: { role: "INSTRUCTOR", active: true }, orderBy: { name: "asc" } }),
    prisma.sectionSession.findMany({ where: { date: range } }),
    prisma.shift.findMany({ where: { date: range } }),
    loadAvailability(opts.month),
    prisma.shift.findMany({ where: { date: before } }),
    prisma.sectionSession.findMany({ where: { date: before } }),
  ]);
  const result = generateSchedule({
    dates,
    rules,
    users: users.map((u) => ({ id: u.id, name: u.name, employment: u.employment })),
    sessions,
    existing: opts.mode === "fill" ? existing : [],
    prior: [...priorShifts, ...priorSessions],
    availability,
    submitted: new Set(submissions.map((s) => s.userId)),
    assumeDefault: opts.assumeDefault,
    includeRoutesetting: opts.includeRoutesetting,
  });
  return { ...result, replaced: opts.mode === "replace" ? existing.length : 0 };
}
