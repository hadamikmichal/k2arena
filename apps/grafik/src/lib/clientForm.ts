// Ankieta klienta ściany – statusy, kategorie, treść powiadomienia (czyste funkcje + testy).

export const FORM_STATUSES = ["WERYFIKACJA", "SZKOLENIE", "ZAKONCZONE"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const FORM_STATUS_LABEL: Record<string, string> = {
  WERYFIKACJA: "Do weryfikacji",
  SZKOLENIE: "Do szkolenia",
  ZAKONCZONE: "Zakończone",
};

// Kategorie nadawane przez instruktora po wprowadzeniu START / szkoleniu ABC / PRO.
export const CATEGORIES = [
  { code: "A", label: "A – autoasekuracja" },
  { code: "W", label: "W – wędka" },
  { code: "P", label: "P – prowadzenie" },
] as const;

// Pytania o umiejętności – kolejność jak na papierowym formularzu.
export const SKILL_QUESTIONS = [
  { key: "knowsAutobelay", label: "Znam zasady działania autoasekuracji", short: "autoasekuracja" },
  { key: "canHarness", label: "Potrafię prawidłowo założyć uprząż wspinaczkową", short: "uprząż" },
  { key: "canBelay", label: "Potrafię asekurować", short: "asekuracja" },
] as const;

export type SkillAnswers = { knowsAutobelay: boolean; canHarness: boolean; canBelay: boolean };

/** Wszystkie odpowiedzi TAK → weryfikacja umiejętności; choć jedno NIE → szkolenie. */
export function initialStatus(a: SkillAnswers): FormStatus {
  return a.knowsAutobelay && a.canHarness && a.canBelay ? "WERYFIKACJA" : "SZKOLENIE";
}

/** Pełne lata na dany dzień (daty "YYYY-MM-DD"). */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/**
 * Powiadomienie w aplikacji o nowej ankiecie. Celowo bez telefonu, e-maila i daty urodzenia –
 * pełne dane są na liście ankiet (link).
 */
export function formNotification(f: SkillAnswers & { name: string; minors: number; adult: boolean }): { title: string; body: string; href: string } {
  const status = initialStatus(f);
  const no = SKILL_QUESTIONS.filter((q) => !f[q.key]).map((q) => q.short);
  const lines = [status === "WERYFIKACJA" ? "Wszystkie odpowiedzi: TAK" : `NIE: ${no.join(", ")}`];
  if (f.minors > 0) lines.push(`Pod opieką: ${f.minors} ${f.minors === 1 ? "osoba niepełnoletnia" : "osoby niepełnoletnie"}`);
  return {
    title: `${status === "WERYFIKACJA" ? "Do weryfikacji" : "Do szkolenia"}: ${f.name}${f.adult ? "" : " (niepełnoletni)"}`,
    body: lines.join(" · "),
    href: `/ankiety?status=${status}`,
  };
}
