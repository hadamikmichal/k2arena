// Typy zatrudnienia instruktorów – jedno źródło etykiet i reguł dni pracy.
//  STALY    – instruktor stały: dyżury i routesetting pn–pt
//  ZLECENIE – zleceniobiorca / student: dyżury w weekendy
//  UOP      – instruktor na umowę o pracę: jak stały (pn–pt), z miesięczną normą godzin
//  TYLKO_SEKCJE – prowadzi wyłącznie sekcje, nie obsługuje dyżurów ani routesettingu

export const EMPLOYMENT_TYPES = ["STALY", "UOP", "ZLECENIE", "TYLKO_SEKCJE"] as const;
export type Employment = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_LABEL: Record<string, string> = {
  STALY: "Stały (pn–pt)",
  UOP: "Instruktor UoP (pn–pt, norma godzin)",
  ZLECENIE: "Zlecenie / student (sb–nd)",
  TYLKO_SEKCJE: "Tylko sekcje (bez dyżurów)",
};

export const EMPLOYMENT_SHORT: Record<string, string> = {
  STALY: "stały",
  UOP: "UoP",
  ZLECENIE: "zlecenie",
  TYLKO_SEKCJE: "tylko sekcje",
};

/** Instruktorzy pracujący w dni robocze i robiący routesetting (stali i na UoP). */
export function isStaff(employment: string): boolean {
  return employment === "STALY" || employment === "UOP";
}

/** Czy dyżur w danym dniu pasuje do typu zatrudnienia (staffDay = dzień instruktorów stałych). */
export function fitsDay(employment: string, staffDay: boolean): boolean {
  return isStaff(employment) ? staffDay : !staffDay;
}

/** Osoby, które przychodzą tylko na sekcje (bez wymogu minimum godzin). */
export function leadsSectionsOnly(employment: string | undefined): boolean {
  return employment === "TYLKO_SEKCJE";
}

/** Czy osoba obsługuje jakiekolwiek dyżury / routesetting. */
export function takesShifts(employment: string): boolean {
  return employment !== "TYLKO_SEKCJE";
}

/** „Tylko sekcje” – żadnych zmian; routesetting robią tylko stali i UoP. */
export function canTakeShift(employment: string, type: string, _staffDay?: boolean): boolean {
  if (!takesShifts(employment)) return false;
  return type !== "ROUTESETTING" || isStaff(employment);
}
