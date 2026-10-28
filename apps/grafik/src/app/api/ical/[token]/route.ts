import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildICal, sessionEvent, shiftEvent } from "@/lib/calendar";
import { addDays, todayWarsaw } from "@/lib/time";

// Prywatny feed iCal do subskrypcji w Google Calendar / Apple / Outlook.
// Instruktor dostaje własny grafik, administrator – cały grafik.
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await prisma.user.findUnique({ where: { icalToken: token.replace(/\.ics$/, "") } });
  if (!user || !user.active) return new NextResponse("Nie znaleziono", { status: 404 });

  const today = todayWarsaw();
  const isAdmin = user.role === "ADMIN";
  const where = { date: { gte: addDays(today, -60), lte: addDays(today, 180) }, ...(isAdmin ? {} : { userId: user.id }) };
  const [shifts, sessions] = await Promise.all([
    prisma.shift.findMany({ where, include: { user: true } }),
    prisma.sectionSession.findMany({ where, include: { user: true } }),
  ]);
  const events = [...shifts.map((s) => shiftEvent(s, isAdmin)), ...sessions.map((s) => sessionEvent(s, isAdmin))];
  const body = buildICal(isAdmin ? "K2 Arena – grafik instruktorów" : `K2 Arena – ${user.name}`, events);
  return new NextResponse(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
  });
}
