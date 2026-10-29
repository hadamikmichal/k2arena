// Typy zatrudnienia instruktorów – jedno źródło etykiet i reguł dni pracy.
//  STALY    – instruktor stały: dyżury i routesetting pn–pt
//  ZLECENIE – zleceniobiorca / student: dyżury w weekendy
//  SEKCJA   – instruktor sekcji (zlecenie): prowadzi sekcje w dowolne dni, operator tylko w weekendy
//  UOP      – instruktor na umowę o pracę: jak stały (pn–pt), z miesięczną normą godzin

export const EMPLOYMENT_TYPES = ["STALY", "UOP", "ZLECENIE", "SEKCJA"] as const;
export type Employment = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_LABEL: Record<string, string> = {
  STALY: "Stały (pn–pt)",
  UOP: "Instruktor UoP (pn–pt, norma godzin)",
  ZLECENIE: "Zlecenie / student (sb–nd)",
  SEKCJA: "Instruktor sekcji (sekcje + weekendy)",
};

export const EMPLOYMENT_SHORT: Record<string, string> = {
  STALY: "stały",
  UOP: "UoP",
  ZLECENIE: "zlecenie",
  SEKCJA: "sekcje",
};

/** Instruktorzy pracujący w dni robocze (stali i na UoP). */
export function isStaff(employment: string): boolean {
  return employment === "STALY" || employment === "UOP";
}

/** Czy dyżur w danym dniu pasuje do typu zatrudnienia (staffDay = dzień instruktorów stałych). */
export function fitsDay(employment: string, staffDay: boolean): boolean {
  return isStaff(employment) ? staffDay : !staffDay;
}

/** Instruktor sekcji nie bierze dyżurów w dni robocze ani routesettingu. */
export function canTakeShift(employment: string, type: string, staffDay: boolean): boolean {
  if (employment !== "SEKCJA") return true;
  return type === "OPERATOR" && !staffDay;
}
