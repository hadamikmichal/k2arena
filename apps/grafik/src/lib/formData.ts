// Pobieranie ankiet z bazy do raportu, eksportu i wydruku.
import { prisma } from "./db";
import { addDays, warsawDayStart } from "./time";
import type { FormRecord } from "./formStats";

const isDate = (s?: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Zakres dat z parametrów (od/do, czas Europe/Warsaw) albo null, gdy niepoprawny. */
export function parseRange(from?: string | null, to?: string | null): { from: string; to: string } | null {
  return isDate(from) && isDate(to) && from <= to ? { from, to } : null;
}

type Where = { ids?: string[]; from?: string; to?: string };

export async function loadForms(w: Where): Promise<FormRecord[]> {
  const rows = await prisma.clientForm.findMany({
    where: {
      ...(w.ids ? { id: { in: w.ids } } : {}),
      ...(w.from && w.to ? { createdAt: { gte: warsawDayStart(w.from), lt: warsawDayStart(addDays(w.to, 1)) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: { reviewedBy: { select: { name: true } } },
  });
  return rows.map(({ reviewedById: _, reviewedBy, ...f }) => ({ ...f, reviewedBy: reviewedBy?.name ?? null }));
}
