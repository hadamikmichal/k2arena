"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import { getRules, saveRules } from "@/lib/settings";
import { deleteGoogleEvent, syncRange, syncSession, syncShift } from "@/lib/google";
import { addDays, dateRange, isoWeekday, toMin, todayWarsaw } from "@/lib/time";
import type { Rules } from "@/lib/rules";

export type FormState = { ok?: boolean; error?: string; message?: string } | null;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Nieprawidłowa data");
const time = z.string().regex(/^\d{2}:\d{2}$/, "Nieprawidłowa godzina");

function fail(err: unknown): FormState {
  if (err instanceof z.ZodError) return { error: err.errors.map((e) => e.message).join(", ") };
  if (err instanceof Error) return { error: err.message };
  return { error: "Nieznany błąd" };
}

function revalidateAll() {
  for (const p of ["/grafik", "/sekcje", "/statystyki", "/moj-grafik", "/instruktorzy"]) revalidatePath(p);
}

// ---------- Logowanie ----------

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Nieprawidłowy e-mail lub hasło" };
  }
  const token = await signSession({ sub: user.id, role: user.role as "ADMIN" | "INSTRUCTOR", name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(user.role === "ADMIN" ? "/grafik" : "/moj-grafik");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const session = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next.length < 8) return { error: "Nowe hasło musi mieć min. 8 znaków" };
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.sub } });
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Obecne hasło jest nieprawidłowe" };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: true, message: "Hasło zmienione" };
}

// ---------- Zmiany (dyżury / routesetting) ----------

const shiftSchema = z
  .object({
    id: z.string().optional(),
    userId: z.string().min(1, "Wybierz instruktora"),
    date,
    start: time,
    end: time,
    type: z.enum(["OPERATOR", "ROUTESETTING"]),
    note: z.string().optional(),
  })
  .refine((v) => toMin(v.end) > toMin(v.start), "Koniec musi być po początku");

export async function saveShift(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const v = shiftSchema.parse(Object.fromEntries(fd));
    const data = {
      userId: v.userId,
      date: v.date,
      startMin: toMin(v.start),
      endMin: toMin(v.end),
      type: v.type,
      note: v.note?.trim() || null,
    };
    const shift = v.id
      ? await prisma.shift.update({ where: { id: v.id }, data })
      : await prisma.shift.create({ data });
    await syncShift(shift.id);
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteShift(id: string): Promise<void> {
  await requireAdmin();
  const s = await prisma.shift.delete({ where: { id } });
  await deleteGoogleEvent(s.googleEventId);
  revalidateAll();
}

/** Kopiuje zmiany z tygodnia źródłowego do docelowego (tylko gdy docelowy jest pusty). */
export async function copyWeek(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const from = date.parse(fd.get("from"));
    const to = date.parse(fd.get("to"));
    const existing = await prisma.shift.count({ where: { date: { gte: to, lte: addDays(to, 6) } } });
    if (existing > 0) return { error: "Docelowy tydzień ma już zmiany – usuń je lub edytuj ręcznie" };
    const source = await prisma.shift.findMany({ where: { date: { gte: from, lte: addDays(from, 6) } } });
    if (source.length === 0) return { error: "Tydzień źródłowy jest pusty" };
    const offset = Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
    for (const s of source) {
      const created = await prisma.shift.create({
        data: { userId: s.userId, date: addDays(s.date, offset), startMin: s.startMin, endMin: s.endMin, type: s.type, note: s.note },
      });
      await syncShift(created.id);
    }
    revalidateAll();
    return { ok: true, message: `Skopiowano ${source.length} zmian` };
  } catch (err) {
    return fail(err);
  }
}

// ---------- Instruktorzy ----------

const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Podaj imię i nazwisko"),
  email: z.string().trim().toLowerCase().email("Nieprawidłowy e-mail"),
  role: z.enum(["ADMIN", "INSTRUCTOR"]),
  employment: z.enum(["STALY", "ZLECENIE"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  password: z.string().optional(),
});

export async function saveUser(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const v = userSchema.parse(Object.fromEntries(fd));
    const base = { name: v.name, email: v.email, role: v.role, employment: v.employment, color: v.color };
    if (v.id) {
      await prisma.user.update({
        where: { id: v.id },
        data: { ...base, ...(v.password ? { passwordHash: await bcrypt.hash(v.password, 10) } : {}) },
      });
    } else {
      if (!v.password || v.password.length < 8) return { error: "Hasło startowe musi mieć min. 8 znaków" };
      await prisma.user.create({ data: { ...base, passwordHash: await bcrypt.hash(v.password, 10) } });
    }
    revalidateAll();
    return { ok: true };
  } catch (err) {
    if (String(err).includes("Unique constraint")) return { error: "Ten e-mail jest już używany" };
    return fail(err);
  }
}

export async function toggleUserActive(id: string): Promise<void> {
  const admin = await requireAdmin();
  if (admin.sub === id) return;
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id }, data: { active: !u.active } });
  revalidateAll();
}

export async function resetIcalToken(id: string): Promise<void> {
  const session = await requireUser();
  if (session.role !== "ADMIN" && session.sub !== id) return;
  await prisma.user.update({ where: { id }, data: { icalToken: randomUUID() } });
  revalidateAll();
}

// ---------- Sekcje ----------

const seriesSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Podaj nazwę sekcji"),
    kind: z.enum(["DZIECI", "DOROSLI"]),
    userId: z.string().min(1, "Wybierz prowadzącego"),
    weekday: z.coerce.number().int().min(1).max(7),
    start: time,
    end: time,
    validFrom: date,
    validTo: date,
  })
  .refine((v) => toMin(v.end) > toMin(v.start), "Koniec musi być po początku")
  .refine((v) => v.validTo >= v.validFrom, "Data końca przed datą początku");

/**
 * Tworzy/aktualizuje cykliczną sekcję i (re)generuje przyszłe zajęcia.
 * Przeszłe zajęcia zostają nietknięte, żeby nie psuć statystyk.
 */
export async function saveSeries(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const v = seriesSchema.parse(Object.fromEntries(fd));
    const data = {
      name: v.name, kind: v.kind, userId: v.userId, weekday: v.weekday,
      startMin: toMin(v.start), endMin: toMin(v.end), validFrom: v.validFrom, validTo: v.validTo,
    };
    const series = v.id
      ? await prisma.sectionSeries.update({ where: { id: v.id }, data })
      : await prisma.sectionSeries.create({ data });

    const today = todayWarsaw();
    const regenerateFrom = v.validFrom > today ? v.validFrom : today;
    const stale = await prisma.sectionSession.findMany({
      where: { seriesId: series.id, date: { gte: regenerateFrom }, status: "PLANNED" },
    });
    await prisma.sectionSession.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    for (const s of stale) await deleteGoogleEvent(s.googleEventId);

    const kept = new Set(
      (await prisma.sectionSession.findMany({ where: { seriesId: series.id }, select: { date: true } })).map((s) => s.date),
    );
    const dates = dateRange(regenerateFrom, v.validTo).filter((d) => isoWeekday(d) === v.weekday && !kept.has(d));
    for (const d of dates) {
      const created = await prisma.sectionSession.create({
        data: { seriesId: series.id, name: v.name, kind: v.kind, userId: v.userId, date: d, startMin: data.startMin, endMin: data.endMin },
      });
      await syncSession(created.id);
    }
    revalidateAll();
    return { ok: true, message: `Zapisano – wygenerowano ${dates.length} zajęć` };
  } catch (err) {
    return fail(err);
  }
}

/** Kończy sekcję: usuwa przyszłe zaplanowane zajęcia, historia zostaje w statystykach. */
export async function endSeries(id: string): Promise<void> {
  await requireAdmin();
  const today = todayWarsaw();
  const future = await prisma.sectionSession.findMany({ where: { seriesId: id, date: { gte: today }, status: "PLANNED" } });
  await prisma.sectionSession.deleteMany({ where: { id: { in: future.map((s) => s.id) } } });
  for (const s of future) await deleteGoogleEvent(s.googleEventId);
  await prisma.sectionSeries.update({ where: { id }, data: { active: false, validTo: addDays(today, -1) } });
  revalidateAll();
}

const sessionSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Podaj nazwę"),
    kind: z.enum(["DZIECI", "DOROSLI"]),
    userId: z.string().min(1, "Wybierz prowadzącego"),
    date,
    start: time,
    end: time,
    status: z.enum(["PLANNED", "DONE", "CANCELLED"]),
    note: z.string().optional(),
  })
  .refine((v) => toMin(v.end) > toMin(v.start), "Koniec musi być po początku");

export async function saveSession(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const v = sessionSchema.parse(Object.fromEntries(fd));
    const data = {
      name: v.name, kind: v.kind, userId: v.userId, date: v.date,
      startMin: toMin(v.start), endMin: toMin(v.end), status: v.status, note: v.note?.trim() || null,
    };
    const s = v.id
      ? await prisma.sectionSession.update({ where: { id: v.id }, data })
      : await prisma.sectionSession.create({ data });
    await syncSession(s.id);
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteSession(id: string): Promise<void> {
  await requireAdmin();
  const s = await prisma.sectionSession.delete({ where: { id } });
  await deleteGoogleEvent(s.googleEventId);
  revalidateAll();
}

// ---------- Ustawienia ----------

export async function saveRulesAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const current = await getRules();
    const iv = (prefix: string) => ({ startMin: toMin(time.parse(fd.get(`${prefix}_start`))), endMin: toMin(time.parse(fd.get(`${prefix}_end`))) });
    const rules: Rules = {
      ...current,
      opening: Array.from({ length: 7 }, (_, i) => iv(`open${i}`)),
      routesettingWindow: iv("rs"),
      routesettingDays: fd.getAll("rsDays").map(Number),
      staffDays: fd.getAll("staffDays").map(Number),
      maxConcurrent: Array.from({ length: 7 }, (_, i) => z.coerce.number().int().min(1).parse(fd.get(`max${i}`))),
      minDailyMin: Math.round(z.coerce.number().min(0).parse(fd.get("minDailyHours")) * 60),
      minOperators: z.coerce.number().int().min(1).parse(fd.get("minOperators")),
    };
    await saveRules(rules);
    revalidateAll();
    return { ok: true, message: "Zapisano reguły" };
  } catch (err) {
    return fail(err);
  }
}

export async function syncGoogleAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const from = date.parse(fd.get("from"));
    const to = date.parse(fd.get("to"));
    const r = await syncRange(from, to);
    return { ok: r.errors === 0, message: `Zsynchronizowano ${r.count - r.errors} z ${r.count} wydarzeń`, error: r.errors ? `${r.errors} błędów – szczegóły w logach serwera` : undefined };
  } catch (err) {
    return fail(err);
  }
}
