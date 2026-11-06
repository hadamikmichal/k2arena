import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadForms, parseRange } from "@/lib/formData";
import { computeFormStats, formsTable, statsTable, toCsv } from "@/lib/formStats";
import { toXlsx } from "@/lib/xlsx";

// Eksport ankiet (dane osobowe) – tylko administrator.
// ?od=YYYY-MM-DD&do=YYYY-MM-DD&format=csv|xlsx&typ=ankiety|statystyki  (xlsx zawsze ma oba arkusze)
export async function GET(req: NextRequest) {
  const session = await getSession();
  const user = session && (await prisma.user.findUnique({ where: { id: session.sub } }));
  if (!user?.active || user.role !== "ADMIN") return new NextResponse("Brak dostępu", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const range = parseRange(sp.get("od"), sp.get("do"));
  if (!range) return new NextResponse("Podaj parametry od i do (YYYY-MM-DD)", { status: 400 });
  const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
  const kind = sp.get("typ") === "statystyki" ? "statystyki" : "ankiety";

  const forms = await loadForms(range);
  const stats = statsTable(computeFormStats(forms), range.from, range.to);
  const list = formsTable(forms);
  const name = `k2-ankiety-${format === "xlsx" ? "raport" : kind}-${range.from}_${range.to}`;

  if (format === "xlsx") {
    const buf = await toXlsx([{ name: "Ankiety", table: list }, { name: "Statystyki", table: stats }]);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new NextResponse(toCsv(kind === "statystyki" ? stats : list), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "no-store" },
  });
}
