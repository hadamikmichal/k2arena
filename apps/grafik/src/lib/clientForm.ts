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

// Treść oświadczeń z formularza. Przy każdej zmianie treści dodaj NOWĄ wersję i ustaw CONSENT_VERSION –
// stare ankiety drukują się z tekstem, który klient faktycznie zaakceptował (ClientForm.consentVersion).
export type ConsentTexts = { health: string; riskItems: string[]; risk: string; liability: string; rodo: string };

export const CONSENT_VERSION = "2026-11-06";

export const CONSENTS: Record<string, ConsentTexts> = {
  "2026-11-06": {
    health:
      "Oświadczam, iż nie posiadam żadnych przeciwwskazań zdrowotnych do korzystania z usług sportowych w Klubie Sportowym K2 Arena w Opolu oraz informuję, iż zapoznałem/łam się z regulaminem Klubu Sportowego K2 Arena oraz zobowiązuję się do jego przestrzegania.",
    riskItems: [
      "Zostałem/am poinformowany/a i zdaję sobie sprawę, że wspinanie to sport niebezpieczny, stwarzający ryzyko utraty zdrowia/życia dla osoby wspinającej się lub osób postronnych.",
      "Przeczytałem/am i zrozumiałem/am treść Regulaminu Klubu Sportowego K2 Arena, a także rozumiem zasady bezpieczeństwa na ściance wspinaczkowej i bulderowni. Zobowiązuję się do przestrzegania zasad bezpieczeństwa oraz poleceń instruktora.",
      "Nie mam przeciwwskazań zdrowotnych do uprawiania wspinaczki.",
      "Mam świadomość, że korzystając z własnego sprzętu do wspinania czynię to na własne ryzyko i ponoszę pełną odpowiedzialność za jego sprawność.",
      "Rozumiem, że brak prawidłowego szkolenia i umiejętności może spowodować wypadek lub kontuzję moją lub innych użytkowników ściany i bulderowni.",
      "Rozumiem, że aby bezpiecznie wspinać się na ściance wspinaczkowej K2 Arena, konieczne jest odbycie wprowadzenia „START” i sprawdzenie moich umiejętności przez instruktora.",
      "Rozumiem, że zgodnie z regulaminem Klubu Sportowego K2 Arena mogę nadzorować tylko dwie osoby niepełnoletnie i biorę pełną odpowiedzialność za bezpieczeństwo i zachowanie tych osób.",
    ],
    risk: "Potwierdzam powyższe oświadczenia.",
    liability: "Ponoszę odpowiedzialność za wypadki wynikające z nieprzestrzegania zasad wspinania, regulaminu i poleceń instruktora.",
    rodo:
      "Wypełnienie niniejszego formularza jest warunkiem niezbędnym do korzystania z usług sportowych w Obiekcie Sportowym K2 Arena w Opolu przy ul. Halickiej 1. Administratorem moich danych osobowych jest Fundacja Klub Sportowy K2 Arena w Opolu, ul. Halicka 1, 45-319 Opole.",
  },
};

export function consentTexts(version: string): ConsentTexts {
  return CONSENTS[version] ?? CONSENTS[CONSENT_VERSION];
}

// Treść potwierdzenia instruktora (dół papierowego formularza).
export const REVIEW_TEXT =
  "Klient odbył wprowadzenie START / szkolenie ABC / szkolenie PRO, zademonstrował wystarczające umiejętności, aby wspinać się bez opieki instruktora K2 Arena, i otrzymuje kategorię:";

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
