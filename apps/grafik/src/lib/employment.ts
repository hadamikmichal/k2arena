// Typy zatrudnienia instruktorów – jedno źródło etykiet i reguł dni pracy.
//  STALY    – instruktor stały: dyżury i routesetting pn–pt
//  ZLECENIE – zleceniobiorca / student: dyżury w weekendy
//  SEKCJA   – instruktor sekcji (zlecenie): prowadzi sekcje w dowolne dni, operator tylko w weekendy
//  UOP      – instruktor na umowę o pracę: jak stały (pn–pt), z miesięczną normą godzin
//  TYLKO_SEKCJE – prowadzi wyłącznie sekcje, nie obsługuje dyżurów ani routesettingu

export const EMPLOYMENT_TYPES = ["STALY", "UOP", "ZLECENIE", "SEKCJA", "TYLKO_SEKCJE"] as const;
export type Employment = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_LABEL: Record<string, string> = {
  STALY: "Stały (pn–pt)",
  UOP: "Instruktor UoP (pn–pt, norma godzin)",
  ZLECENIE: "Zlecenie / student (sb–nd)",
  SEKCJA: "Instruktor sekcji (sekcje + weekendy)",
  TYLKO_SEKCJE: "Tylko sekcje (bez dyżurów)",
};

export const EMPLOYMENT_SHORT: Record<string, string> = {
  STALY: "stały",
  UOP: "UoP",
  ZLECENIE: "zlecenie",
  SEKCJA: "sekcje",
  TYLKO_SEKCJE: "tylko sekcje",
};

/** Instruktorzy pracujący w dni robocze (stali i na UoP). */
export function isStaff(employment: string): boolean {
  return employment === "STALY" || employment === "UOP";
}

/** Czy dyżur w danym dniu pasuje do typu zatrudnienia (staffDay = dzień instruktorów stałych). */
export function fitsDay(employment: string, staffDay: boolean): boolean {
  return isStaff(employment) ? staffDay : !staffDay;
}

/** Osoby, które przychodzą na sekcje (bez wymogu minimum godzin w takie dni). */
export function leadsSectionsOnly(employment: string | undefined): boolean {
  return employment === "SEKCJA" || employment === "TYLKO_SEKCJE";
}

/** Czy osoba obsługuje jakiekolwiek dyżury / routesetting. */
export function takesShifts(employment: string): boolean {
  return employment !== "TYLKO_SEKCJE";
}

/** Instruktor sekcji nie bierze dyżurów w dni robocze ani routesettingu; „tylko sekcje” – żadnych zmian. */
export function canTakeShift(employment: string, type: string, staffDay: boolean): boolean {
  if (!takesShifts(employment)) return false;
  if (employment !== "SEKCJA") return true;
  return type === "OPERATOR" && !staffDay;
}
