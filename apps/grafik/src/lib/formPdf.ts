// PDF ankiety klienta – ta sama treść co wydruk (/ankiety/druk), do wysyłki mailem na recepcję i do pobrania.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ageOn, CATEGORIES, consentTexts, FORM_STATUS_LABEL, initialStatus, REVIEW_TEXT, SKILL_QUESTIONS, zonesText } from "./clientForm";
import type { FormRecord } from "./formStats";
import { dateWarsaw } from "./time";

// Pliki dołączane do funkcji na Vercelu przez outputFileTracingIncludes w next.config.ts.
const asset = (p: string) => readFile(path.join(process.cwd(), p));

const dt = (d: Date) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "long", timeStyle: "medium" }).format(d);

const A4 = { w: 595.28, h: 841.89 };
const M = 48; // margines
const INK = rgb(0.09, 0.094, 0.11);
const MUTED = rgb(0.36, 0.37, 0.33);
const LINE = rgb(0.85, 0.84, 0.82);

/** Nazwa pliku: ankieta-2026-11-20-jan-kowalski.pdf */
export function formPdfName(f: { name: string; createdAt: Date }): string {
  const slug = f.name
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `ankieta-${dateWarsaw(f.createdAt)}-${slug || "klient"}.pdf`;
}

export async function buildFormPdf(f: FormRecord & { zones: string; wall: boolean; signature: string | null }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Formularz danych osobowych – ${f.name}`);
  doc.setAuthor("K2 Arena");
  doc.setCreationDate(f.createdAt);
  const [regBytes, boldBytes, logoBytes] = await Promise.all([
    asset("src/assets/fonts/DejaVuSans.ttf"),
    asset("src/assets/fonts/DejaVuSans-Bold.ttf"),
    asset("public/k2-arena-logo.png").catch(() => null),
  ]);
  const reg = await doc.embedFont(regBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });
  const logo = logoBytes ? await doc.embedPng(logoBytes) : null;
  const signature = f.signature ? await embedDataUrl(doc, f.signature) : null;

  const w = new Writer(doc, reg, bold);
  const t = consentTexts(f.consentVersion);
  const age = ageOn(f.birthDate, dateWarsaw(f.createdAt));
  const minors = [f.minor1, f.minor2].filter(Boolean);
  const cats = f.category?.split(",") ?? [];

  // Nagłówek
  if (logo) {
    const s = 26 / logo.height;
    w.page.drawImage(logo, { x: A4.w - M - logo.width * s, y: w.y - 26, width: logo.width * s, height: 26 });
  }
  w.text("FORMULARZ DANYCH OSOBOWYCH", { font: bold, size: 14 });
  w.text("Klub Sportowy K2 Arena, ul. Halicka 1, 45-319 Opole", { size: 9 });
  w.gap(4);
  w.rule(1.5, INK);
  w.gap(6);

  // Dane
  w.row("Imię i nazwisko", f.name, true);
  w.row("Data urodzenia", `${f.birthDate} (${age} l. w dniu wypełnienia${age < 18 ? " – niepełnoletni" : ""})`);
  w.row("Nr telefonu", f.phone);
  w.row("E-mail", f.email);
  w.row("Korzysta z", zonesText(f.zones), true);
  w.row("Data i godzina wypełnienia", dt(f.createdAt), true);
  w.gap(8);

  w.check(t.health);

  if (f.wall) {
    w.gap(4);
    w.text("STREFA WSPINANIA", { font: bold });
    for (const item of t.riskItems) w.text(`•  ${item}`, { indent: 10, hanging: 9, size: 8.5 });
    w.gap(2);
    w.check(t.risk);
    w.text(`Osoby małoletnie pod opieką: ${minors.length ? minors.map((m, i) => `${i + 1}. ${m}`).join("   ") : "nie dotyczy"}`, { size: 9 });
    w.gap(6);
    for (const q of SKILL_QUESTIONS) w.row(q.label, f[q.key] ? "☒ TAK   ☐ NIE" : "☐ TAK   ☒ NIE", true, 300);
    w.gap(6);
    w.check(t.liability);
  }
  w.check(t.rodo);

  // Podpis
  w.gap(6);
  w.ensure(110);
  w.text("Podpis klienta:", { font: bold, size: 9 });
  if (signature) {
    const maxW = 220, maxH = 80;
    const s = Math.min(maxW / signature.width, maxH / signature.height);
    w.page.drawImage(signature, { x: M, y: w.y - signature.height * s, width: signature.width * s, height: signature.height * s });
    w.y -= signature.height * s + 2;
  } else {
    w.text("(brak podpisu – formularz wysłany przed wprowadzeniem podpisu na ekranie)", { size: 8.5, color: MUTED });
  }
  w.page.drawLine({ start: { x: M, y: w.y }, end: { x: M + 220, y: w.y }, thickness: 0.6, color: MUTED });
  w.gap(10);

  // Instruktor
  if (f.wall) {
    w.ensure(90);
    w.rule(1, INK);
    w.gap(4);
    w.text("WYPEŁNIA INSTRUKTOR", { font: bold });
    w.text(REVIEW_TEXT, { size: 9 });
    w.text(CATEGORIES.map((c) => `${cats.includes(c.code) ? "☒" : "☐"} ${c.label}`).join("      "), { font: bold, size: 9 });
    if (f.status === "ZAKONCZONE" && f.reviewedAt) {
      w.text(`Zatwierdził: ${f.reviewedBy ?? "(konto usunięte)"}, ${dt(f.reviewedAt)}${f.note ? ` · Uwagi: ${f.note}` : ""}`, { size: 9 });
    } else {
      w.text(`Status: ${FORM_STATUS_LABEL[f.status] ?? f.status} (wynik przy wysłaniu: ${FORM_STATUS_LABEL[initialStatus(f)]})`, { size: 9 });
    }
    w.gap(4);
    w.rule(1, INK);
    w.gap(8);
  }

  // Stopka dowodowa
  w.rule(0.5, LINE);
  w.gap(4);
  const foot = { size: 7.5, color: MUTED };
  w.text(
    `Formularz wypełniony elektronicznie; zaznaczenie wszystkich oświadczeń było wymagane do wysłania${f.signature ? ", klient złożył podpis na ekranie" : ""}. Treść oświadczeń: wersja ${f.consentVersion}.`,
    foot,
  );
  w.text(`ID ankiety: ${f.id} · Adres IP: ${f.ip ?? "nie zarejestrowano"}`, foot);
  w.text(`Przeglądarka: ${f.userAgent ?? "nie zarejestrowano"}`, foot);
  w.text(`Wygenerowano: ${dt(new Date())}, system K2 Arena – grafik.`, foot);

  return doc.save();
}

async function embedDataUrl(doc: PDFDocument, dataUrl: string): Promise<PDFImage | null> {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  try {
    return await doc.embedPng(Buffer.from(m[1], "base64"));
  } catch {
    return null;
  }
}

type TextOpts = { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number; hanging?: number };

/** Proste składanie tekstu od góry strony z zawijaniem wierszy i nowymi stronami. */
class Writer {
  page: PDFPage;
  y: number;
  constructor(private doc: PDFDocument, private reg: PDFFont, private bold: PDFFont) {
    this.page = doc.addPage([A4.w, A4.h]);
    this.y = A4.h - M;
  }

  ensure(h: number) {
    if (this.y - h < M) {
      this.page = this.doc.addPage([A4.w, A4.h]);
      this.y = A4.h - M;
    }
  }

  gap(h: number) {
    this.y -= h;
  }

  rule(thickness: number, color: ReturnType<typeof rgb>) {
    this.ensure(thickness + 2);
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: A4.w - M, y: this.y }, thickness, color });
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    let cur = "";
    for (const word of text.split(/\s+/)) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && font.widthOfTextAtSize(next, size) > width) {
        lines.push(cur);
        cur = word;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  text(s: string, o: TextOpts = {}) {
    const font = o.font ?? this.reg, size = o.size ?? 10, indent = o.indent ?? 0, hanging = o.hanging ?? 0;
    const lh = size * 1.35;
    const lines = this.wrap(s, font, size, A4.w - 2 * M - indent - hanging);
    lines.forEach((line, i) => {
      this.ensure(lh);
      this.y -= size;
      this.page.drawText(line, { x: M + indent + (i ? hanging : 0), y: this.y, size, font, color: o.color ?? INK });
      this.y -= lh - size;
    });
  }

  /** Zaznaczone oświadczenie: ☒ + treść z wcięciem. */
  check(s: string) {
    const size = 9;
    this.ensure(size * 1.35);
    this.page.drawText("☒", { x: M, y: this.y - size, size, font: this.bold, color: INK });
    this.text(s, { size, indent: 14 });
    this.gap(3);
  }

  row(label: string, value: string, strong = false, labelW = 150) {
    const size = 9.5;
    const lines = this.wrap(value, strong ? this.bold : this.reg, size, A4.w - 2 * M - labelW);
    const h = lines.length * size * 1.35 + 4;
    this.ensure(h);
    const top = this.y;
    this.page.drawText(label, { x: M, y: top - size, size, font: this.reg, color: MUTED });
    lines.forEach((l, i) =>
      this.page.drawText(l, { x: M + labelW, y: top - size - i * size * 1.35, size, font: strong ? this.bold : this.reg, color: INK }),
    );
    this.y = top - h;
    this.page.drawLine({ start: { x: M, y: this.y + 1 }, end: { x: A4.w - M, y: this.y + 1 }, thickness: 0.5, color: LINE });
    this.y -= 2;
  }
}
