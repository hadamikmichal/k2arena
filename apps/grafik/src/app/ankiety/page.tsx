import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ageOn, FORM_STATUSES, FORM_STATUS_LABEL } from "@/lib/clientForm";
import { todayWarsaw } from "@/lib/time";
import { whatsappConfig } from "@/lib/whatsapp";
import { FormsView } from "./FormsView";

export default async function AnkietyPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const session = await requireUser();
  const sp = await searchParams;
  const status = FORM_STATUSES.find((s) => s === sp.status) ?? "WERYFIKACJA";
  const q = sp.q?.trim() ?? "";
  const [forms, counts] = await Promise.all([
    prisma.clientForm.findMany({
      where: { status, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] } : {}) },
      orderBy: { createdAt: status === "ZAKONCZONE" ? "desc" : "asc" },
      include: { reviewedBy: { select: { name: true } } },
      take: 200,
    }),
    prisma.clientForm.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const today = todayWarsaw();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title">Ankiety klientów</h1>
        <div className="seg" role="tablist">
          {FORM_STATUSES.map((s) => (
            <Link key={s} href={`/ankiety?status=${s}`} role="tab" aria-selected={s === status}>
              {FORM_STATUS_LABEL[s]}{s !== "ZAKONCZONE" && count[s] ? ` (${count[s]})` : ""}
            </Link>
          ))}
        </div>
        <form className="flex gap-2 sm:ml-auto">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Szukaj: nazwisko, telefon, e-mail" className="input w-64" />
        </form>
        <Link href="/ankiety/qr" className="btn">Kod QR</Link>
      </div>
      {!whatsappConfig().enabled && session.role === "ADMIN" && (
        <p className="alert-warn">Powiadomienia WhatsApp są wyłączone – ustaw zmienne Green-API (README, sekcja „Ankieta klienta”).</p>
      )}
      <FormsView
        isAdmin={session.role === "ADMIN"}
        forms={forms.map((f) => ({
          id: f.id, name: f.name, phone: f.phone, email: f.email, birthDate: f.birthDate, age: ageOn(f.birthDate, today),
          minors: [f.minor1, f.minor2].filter((m): m is string => Boolean(m)),
          answers: { knowsAutobelay: f.knowsAutobelay, canHarness: f.canHarness, canBelay: f.canBelay },
          status: f.status, category: f.category, note: f.note, reviewedBy: f.reviewedBy?.name ?? null,
          reviewedAt: f.reviewedAt?.toISOString() ?? null, createdAt: f.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
