// Statystyki i eksport ankiet klientów (czyste funkcje + testy).
import { ageOn, CATEGORIES, FORM_STATUS_LABEL, FORM_STATUSES, initialStatus, SKILL_QUESTIONS } from "./clientForm.ts";
import { dateWarsaw } from "./time.ts";

export type FormRecord = {
  id: string; name: string; birthDate: string; phone: string; email: string; minor1: string | null; minor2: string | null;
  knowsAutobelay: boolean; canHarness: boolean; canBelay: boolean;
  status: string; category: string | null; note: string | null; reviewedBy: string | null; reviewedAt: Date | null;
  consentVersion: string; ip: string | null; userAgent: string | null; createdAt: Date;
};

export type FormStats = {
  total: number;
  verify: number; // przy wysłaniu: wszystkie TAK
  training: number; // przy wysłaniu: choć jedno NIE
  byStatus: Record<string, number>;
  noByQuestion: Record<string, number>;
  minorClients: number; // klient niepełnoletni w dniu wypełnienia
  withMinors: number; // ankiety z osobami małoletnimi pod opieką
  minorsUnderCare: number;
  categories: Record<string, number>;
  byMonth: { month: string; total: number; verify: number; training: number }[];
  byReviewer: { name: string; count: number }[];
};

export function computeFormStats(forms: FormRecord[]): FormStats {
  const s: FormStats = {
    total: forms.length, verify: 0, training: 0,
    byStatus: Object.fromEntries(FORM_STATUSES.map((k) => [k, 0])),
    noByQuestion: Object.fromEntries(SKILL_QUESTIONS.map((q) => [q.key, 0])),
    minorClients: 0, withMinors: 0, minorsUnderCare: 0,
    categories: Object.fromEntries(CATEGORIES.map((c) => [c.code, 0])),
    byMonth: [], byReviewer: [],
  };
  const months = new Map<string, FormStats["byMonth"][number]>();
  const reviewers = new Map<string, number>();
  for (const f of forms) {
    const day = dateWarsaw(f.createdAt);
    const first = initialStatus(f);
    const m = months.get(day.slice(0, 7)) ?? { month: day.slice(0, 7), total: 0, verify: 0, training: 0 };
    m.total++;
    if (first === "WERYFIKACJA") { s.verify++; m.verify++; } else { s.training++; m.training++; }
    months.set(m.month, m);
    s.byStatus[f.status] = (s.byStatus[f.status] ?? 0) + 1;
    for (const q of SKILL_QUESTIONS) if (!f[q.key]) s.noByQuestion[q.key]++;
    if (ageOn(f.birthDate, day) < 18) s.minorClients++;
    const minors = [f.minor1, f.minor2].filter(Boolean).length;
    if (minors) { s.withMinors++; s.minorsUnderCare += minors; }
    if (f.status === "ZAKONCZONE") {
      for (const c of f.category?.split(",") ?? []) if (c in s.categories) s.categories[c]++;
      const who = f.reviewedBy ?? "(konto usunięte)";
      reviewers.set(who, (reviewers.get(who) ?? 0) + 1);
    }
  }
  s.byMonth = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
  s.byReviewer = [...reviewers].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pl"));
  return s;
}

export type Table = { header: string[]; rows: (string | number)[][] };

const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");

/** Statystyki jako jedna tabela (sekcja / pozycja / liczba / udział) – do CSV i Excela. */
export function statsTable(s: FormStats, from: string, to: string): Table {
  const rows: (string | number)[][] = [
    ["Okres", `${from} – ${to}`, "", ""],
    ["Razem", "Ankiety wypełnione", s.total, ""],
    ["Wynik przy wysłaniu", "Do weryfikacji (wszystkie TAK)", s.verify, pct(s.verify, s.total)],
    ["Wynik przy wysłaniu", "Do szkolenia (choć jedno NIE)", s.training, pct(s.training, s.total)],
    ...FORM_STATUSES.map((k) => ["Obecny status", FORM_STATUS_LABEL[k], s.byStatus[k] ?? 0, pct(s.byStatus[k] ?? 0, s.total)]),
    ...SKILL_QUESTIONS.map((q) => ["Odpowiedź NIE", q.label, s.noByQuestion[q.key], pct(s.noByQuestion[q.key], s.total)]),
    ...CATEGORIES.map((c) => ["Nadane kategorie", c.label, s.categories[c.code], pct(s.categories[c.code], s.byStatus.ZAKONCZONE ?? 0)]),
    ["Klienci", "Niepełnoletni w dniu wypełnienia", s.minorClients, pct(s.minorClients, s.total)],
    ["Klienci", "Ankiety z osobami małoletnimi pod opieką", s.withMinors, pct(s.withMinors, s.total)],
    ["Klienci", "Osoby małoletnie pod opieką (łącznie)", s.minorsUnderCare, ""],
    ...s.byMonth.map((m) => ["Miesiąc", m.month, m.total, `weryfikacja ${m.verify} / szkolenie ${m.training}`]),
    ...s.byReviewer.map((r) => ["Zatwierdził instruktor", r.name, r.count, ""]),
  ];
  return { header: ["Sekcja", "Pozycja", "Liczba", "Udział / uwagi"], rows };
}

const yn = (b: boolean) => (b ? "TAK" : "NIE");
const dt = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "medium" }).format(d) : "";

/** Pełna lista ankiet – wszystkie pola, także dowodowe (wersja oświadczeń, IP, przeglądarka). */
export function formsTable(forms: FormRecord[]): Table {
  return {
    header: [
      "ID", "Data wypełnienia", "Imię i nazwisko", "Data urodzenia", "Wiek", "Telefon", "E-mail", "Małoletni 1", "Małoletni 2",
      ...SKILL_QUESTIONS.map((q) => q.label), "Oświadczenia zaakceptowane", "Wersja oświadczeń",
      "Wynik przy wysłaniu", "Status", "Kategoria", "Zatwierdził", "Data zatwierdzenia", "Uwagi", "Adres IP", "Przeglądarka",
    ],
    rows: forms.map((f) => [
      f.id, dt(f.createdAt), f.name, f.birthDate, ageOn(f.birthDate, dateWarsaw(f.createdAt)), f.phone, f.email, f.minor1 ?? "", f.minor2 ?? "",
      ...SKILL_QUESTIONS.map((q) => yn(f[q.key])), "TAK (wszystkie wymagane)", f.consentVersion,
      FORM_STATUS_LABEL[initialStatus(f)], FORM_STATUS_LABEL[f.status] ?? f.status, f.category?.split(",").join(" ") ?? "",
      f.reviewedBy ?? "", dt(f.reviewedAt), f.note ?? "", f.ip ?? "", f.userAgent ?? "",
    ]),
  };
}

/** CSV dla polskiego Excela: średnik, BOM, CRLF. Komórki zaczynające się od =+-@ są neutralizowane (CSV injection). */
export function toCsv(t: Table): string {
  const cell = (c: string | number) => {
    let v = String(c);
    if (typeof c === "string" && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
    return `"${v.replace(/"/g, '""')}"`;
  };
  return "﻿" + [t.header, ...t.rows].map((r) => r.map(cell).join(";")).join("\r\n");
}
