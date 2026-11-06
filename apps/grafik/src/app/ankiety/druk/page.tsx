import { notFound } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { ageOn, CATEGORIES, consentTexts, FORM_STATUS_LABEL, initialStatus, REVIEW_TEXT, SKILL_QUESTIONS } from "@/lib/clientForm";
import { loadForms, parseRange } from "@/lib/formData";
import type { FormRecord } from "@/lib/formStats";
import { dateWarsaw, fmtDate } from "@/lib/time";
import { PrintButton } from "../qr/PrintButton";

const dt = (d: Date) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "long", timeStyle: "medium" }).format(d);

// Wydruk ankiety (kopia elektronicznego formularza z pełną treścią oświadczeń) – jako dowód / do archiwum.
// ?id=… – jedna ankieta (każdy zalogowany); ?od=…&do=… – wszystkie z okresu (administrator), każda na osobnej stronie.
export default async function DrukPage({ searchParams }: { searchParams: Promise<{ id?: string; od?: string; do?: string }> }) {
  const sp = await searchParams;
  const range = parseRange(sp.od, sp.do);
  const session = sp.id ? await requireUser() : await requireAdmin();
  if (!sp.id && !range) notFound();
  const forms = await loadForms(sp.id ? { ids: [sp.id] } : range!);
  if (sp.id && !forms.length) notFound();
  const printedAt = dt(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton />
        <span className="text-sm muted">
          {forms.length === 1 ? "1 ankieta" : `${forms.length} ankiet`}
          {range && !sp.id && ` z okresu ${fmtDate(range.from)} – ${fmtDate(range.to)}`} · każda drukuje się na osobnej stronie
        </span>
      </div>
      {forms.length === 0 && <p className="card muted">Brak ankiet w tym okresie.</p>}
      {forms.map((f) => <Sheet key={f.id} f={f} printedAt={printedAt} printedBy={session.name} />)}
    </div>
  );
}

function Sheet({ f, printedAt, printedBy }: { f: FormRecord; printedAt: string; printedBy: string }) {
  const t = consentTexts(f.consentVersion);
  const age = ageOn(f.birthDate, dateWarsaw(f.createdAt));
  const minors = [f.minor1, f.minor2].filter(Boolean);
  const cats = f.category?.split(",") ?? [];
  return (
    <article
      className="print-sheet mx-auto max-w-3xl space-y-4 rounded-xl border p-8 text-[13px] leading-snug print:max-w-none print:rounded-none print:border-0 print:p-0"
      style={{ background: "#fff", color: "#17181c", borderColor: "var(--border)" }}
    >
      <header className="flex items-start justify-between gap-4 border-b-2 pb-3" style={{ borderColor: "#17181c" }}>
        <div>
          <p className="text-lg font-extrabold uppercase">Formularz danych osobowych</p>
          <p>Klub Sportowy K2 Arena, ul. Halicka 1, 45-319 Opole</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/k2-arena-logo.png" alt="K2 Arena" width={144} height={30} className="h-[30px] w-auto" />
      </header>

      <table className="w-full">
        <tbody>
          <Row label="Imię i nazwisko"><b>{f.name}</b></Row>
          <Row label="Data urodzenia">{f.birthDate} ({age} l. w dniu wypełnienia{age < 18 ? " – niepełnoletni" : ""})</Row>
          <Row label="Nr telefonu">{f.phone}</Row>
          <Row label="E-mail">{f.email}</Row>
          <Row label="Data i godzina wypełnienia"><b>{dt(f.createdAt)}</b></Row>
        </tbody>
      </table>

      <Check>{t.health}</Check>

      <section className="space-y-2">
        <p className="font-extrabold uppercase">Strefa wspinania</p>
        <ul className="list-disc space-y-1 pl-5">{t.riskItems.map((x) => <li key={x}>{x}</li>)}</ul>
        <Check>{t.risk}</Check>
        <p>
          <span className="font-semibold">Osoby małoletnie pod opieką: </span>
          {minors.length ? minors.map((m, i) => `${i + 1}. ${m}`).join("   ") : "nie dotyczy"}
        </p>
      </section>

      <table className="w-full border-collapse">
        <tbody>
          {SKILL_QUESTIONS.map((q) => (
            <tr key={q.key} className="border-b" style={{ borderColor: "#d8d6d0" }}>
              <td className="py-1">{q.label}</td>
              <td className="w-24 py-1 text-right font-bold">{f[q.key] ? "☒ TAK  ☐ NIE" : "☐ TAK  ☒ NIE"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Check>{t.liability}</Check>
      <Check>{t.rodo}</Check>

      <section className="space-y-1 rounded border p-3" style={{ borderColor: "#17181c" }}>
        <p className="font-extrabold uppercase">Wypełnia instruktor</p>
        <p>{REVIEW_TEXT}</p>
        <p className="font-semibold">
          {CATEGORIES.map((c) => `${cats.includes(c.code) ? "☒" : "☐"} ${c.label}`).join("     ")}
        </p>
        {f.status === "ZAKONCZONE" && f.reviewedAt ? (
          <p>Zatwierdził: <b>{f.reviewedBy ?? "(konto usunięte)"}</b>, {dt(f.reviewedAt)}{f.note && ` · Uwagi: ${f.note}`}</p>
        ) : (
          <p>Status: <b>{FORM_STATUS_LABEL[f.status] ?? f.status}</b> (wynik przy wysłaniu: {FORM_STATUS_LABEL[initialStatus(f)]})</p>
        )}
      </section>

      <footer className="space-y-0.5 border-t pt-2 text-[11px]" style={{ borderColor: "#d8d6d0", color: "#5b5f55" }}>
        <p>
          Formularz wypełniony elektronicznie; zaznaczenie wszystkich oświadczeń było wymagane do wysłania, a wysłanie formularza zastąpiło podpis.
          Treść oświadczeń: wersja {f.consentVersion}.
        </p>
        <p>
          ID ankiety: {f.id} · Adres IP: {f.ip ?? "nie zarejestrowano"} · Przeglądarka: {f.userAgent ?? "nie zarejestrowano"}
        </p>
        <p>Wydruk z systemu K2 Arena – grafik: {printedAt}, {printedBy}.</p>
      </footer>
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b" style={{ borderColor: "#d8d6d0" }}>
      <td className="w-56 py-1 pr-3" style={{ color: "#5b5f55" }}>{label}</td>
      <td className="py-1">{children}</td>
    </tr>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2">
      <span className="font-bold" aria-label="zaznaczone">☒</span>
      <span>{children}</span>
    </p>
  );
}
