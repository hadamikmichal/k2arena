import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notificationsFor } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// Dzwonek w nagłówku odpytuje ten adres co kilkadziesiąt sekund.
export async function GET() {
  const session = await getSession();
  const user = session && (await prisma.user.findUnique({ where: { id: session.sub }, select: { active: true } }));
  if (!user?.active) return NextResponse.json({ error: "Brak dostępu" }, { status: 401 });
  return NextResponse.json(await notificationsFor(session!.sub), { headers: { "Cache-Control": "no-store" } });
}
