import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeStats } from "@/lib/stats";

const isDate = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const h = (min: number) => (min / 60).toFixed(2).replace(".", ",");

export async function GET(req: NextRequest) {
  const session = await getSession();
  const user = session && (await prisma.user.findUnique({ where: { id: session.sub } }));
  if (!user?.active || user.role !== "ADMIN") return new NextResponse("Brak dostępu", { status: 403 });
  const from = req.nextUrl.searchParams.get("od");
  const to = req.nextUrl.searchParams.get("do");
  if (!isDate(from) || !isDate(to)) return new NextResponse("Podaj parametry od i do (YYYY-MM-DD)", { status: 400 });

  const stats = await computeStats(from!, to!);
  const header = ["Instruktor", "Zatrudnienie", "Dni pracy", "Dyżur [h]", "Routesetting [h]", "Sekcje [h]", "Razem [h]", "Sekcje odbyte", "Sekcje zaplanowane", "Sekcje odwołane"];
  const rows = stats.map((s) => [
    s.name, s.employment === "STALY" ? "stały" : "zlecenie", s.daysWorked, h(s.operatorMin), h(s.routesettingMin), h(s.sectionMin), h(s.totalMin),
    s.sectionsDone, s.sectionsPlanned, s.sectionsCancelled,
  ]);
  // Średnik jako separator i BOM – Excel w polskiej wersji otwiera to poprawnie.
  const csv = "﻿" + [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="k2-statystyki-${from}_${to}.csv"`,
    },
  });
}
