import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSchedule, type GenInput } from "./generator.ts";
import { DEFAULT_RULES, validateDay, type SessionLike } from "./rules.ts";
import { dateRange } from "./time.ts";

const h = (x: number) => x * 60;
const STAFF = [
  { id: "anna", name: "Anna", employment: "STALY" },
  { id: "bartek", name: "Bartek", employment: "STALY" },
  { id: "kasia", name: "Kasia", employment: "STALY" },
];
const CONTRACT = [
  { id: "ola", name: "Ola", employment: "ZLECENIE" },
  { id: "piotr", name: "Piotr", employment: "ZLECENIE" },
];
const WEEK = dateRange("2026-11-02", "2026-11-08"); // pn–nd

const base = (over: Partial<GenInput> = {}): GenInput => ({
  dates: WEEK,
  rules: DEFAULT_RULES,
  users: [...STAFF, ...CONTRACT],
  sessions: [],
  existing: [],
  availability: {},
  submitted: new Set(),
  assumeDefault: true,
  includeRoutesetting: true,
  ...over,
});

const errors = (r: ReturnType<typeof generateSchedule>) =>
  Object.values(r.issues).flat().filter((i) => i.level === "error");

test("pełny tydzień bez sekcji – brak błędów, każdy dzień pokryty", () => {
  const r = generateSchedule(base());
  assert.deepEqual(errors(r), []);
  for (const d of WEEK) assert.ok(r.shifts.some((s) => s.date === d && s.type === "OPERATOR"), d);
});

test("routesetting tylko pn–śr, w oknie 8–12, przez stałego", () => {
  const r = generateSchedule(base());
  const rs = r.shifts.filter((s) => s.type === "ROUTESETTING");
  assert.deepEqual(rs.map((s) => s.date), ["2026-11-02", "2026-11-03", "2026-11-04"]);
  for (const s of rs) {
    assert.equal(s.startMin, h(8));
    assert.equal(s.endMin, h(12));
    assert.equal(s.employment, "STALY");
  }
});

test("weekend obsadzają zleceniobiorcy, dni robocze stali", () => {
  const r = generateSchedule(base());
  const sat = r.shifts.filter((s) => s.date === "2026-11-07");
  const mon = r.shifts.filter((s) => s.date === "2026-11-02");
  assert.ok(sat.every((s) => s.employment === "ZLECENIE"));
  assert.ok(mon.every((s) => s.employment === "STALY"));
});

test("dyżury mają min. 4 h i nie łamią limitu osób naraz", () => {
  const r = generateSchedule(base());
  for (const s of r.shifts.filter((x) => x.type === "OPERATOR")) assert.ok(s.endMin - s.startMin >= h(4));
  const warnings = Object.values(r.issues).flat().filter((i) => i.message.includes("jednocześnie"));
  assert.deepEqual(warnings, []);
});

test("sekcja prowadzona przez operatora – drugi operator dochodzi na czas sekcji", () => {
  const sessions: SessionLike[] = [{ userId: "anna", date: "2026-11-05", startMin: h(17), endMin: h(18.5), name: "Dzieci", status: "PLANNED" }];
  const r = generateSchedule(base({ sessions }));
  assert.deepEqual(errors(r), []);
  const thu = r.shifts.filter((s) => s.date === "2026-11-05" && s.type === "OPERATOR");
  const coverDuring = thu.filter((s) => s.userId !== "anna" && s.startMin <= h(17) && s.endMin >= h(18.5));
  assert.ok(coverDuring.length >= 1);
});

test("dyspozycyjność jest respektowana; brak dnia w zgłoszeniu = niedostępny", () => {
  const avail = { anna: { "2026-11-02": [{ startMin: h(16), endMin: h(22) }] } };
  const r = generateSchedule(base({ dates: ["2026-11-02"], availability: avail, submitted: new Set(["anna", "bartek"]) }));
  for (const s of r.shifts.filter((x) => x.userId === "anna")) assert.ok(s.startMin >= h(16));
  assert.ok(!r.shifts.some((s) => s.userId === "bartek"));
});

test("brak zgłoszenia = dostępny cały dzień, także poza „swoimi” dniami", () => {
  const r = generateSchedule(base({ dates: ["2026-11-07"], users: STAFF }));
  assert.deepEqual(errors(r), []);
});

test("brak chętnych – luka zgłoszona jako błąd, generator się nie zapętla", () => {
  const r = generateSchedule(base({ dates: ["2026-11-07"], users: STAFF, submitted: new Set(STAFF.map((u) => u.id)) }));
  assert.ok(errors(r).some((i) => i.message.startsWith("Brak operatora")));
});

test("tryb uzupełniania zostawia istniejące zmiany i dokłada brakujące", () => {
  const existing = [{ userId: "anna", date: "2026-11-02", startMin: h(10), endMin: h(16), type: "OPERATOR" }];
  const r = generateSchedule(base({ dates: ["2026-11-02"], existing }));
  assert.ok(!r.shifts.some((s) => s.userId === "anna" && s.type === "OPERATOR"));
  const all = [...existing, ...r.shifts];
  assert.deepEqual(validateDay("2026-11-02", all, [], DEFAULT_RULES).filter((i) => i.level === "error"), []);
});

test("godziny rozkładają się w miarę równo między stałych", () => {
  const r = generateSchedule(base({ dates: dateRange("2026-11-02", "2026-11-27") }));
  const hours = STAFF.map((u) => r.shifts.filter((s) => s.userId === u.id).reduce((a, s) => a + s.endMin - s.startMin, 0) / 60);
  assert.ok(Math.max(...hours) - Math.min(...hours) <= 16, `rozrzut: ${hours.join(", ")}`);
});

const UOP = [
  { id: "anna", name: "Anna", employment: "UOP" },
  { id: "bartek", name: "Bartek", employment: "UOP" },
  { id: "kasia", name: "Kasia", employment: "STALY" },
];
const NOVEMBER = dateRange("2026-11-01", "2026-11-30");

test("UoP: generator dopełnia normę 160 h w miesiącu", () => {
  const r = generateSchedule(base({ dates: NOVEMBER, users: [...UOP, ...CONTRACT] }));
  assert.deepEqual(errors(r), []);
  for (const n of r.norm) assert.ok(n.workedMin >= 160 * 60, `${n.name}: ${n.workedMin / 60} h`);
  // dyżury UoP mieszczą się w dniach roboczych i nie łamią limitu osób naraz
  for (const s of r.shifts.filter((x) => x.employment === "UOP")) assert.ok(!["6", "0"].includes(String(new Date(s.date).getUTCDay())), s.date);
  assert.deepEqual(Object.values(r.issues).flat().filter((i) => i.message.includes("jednocześnie")), []);
});

test("UoP: norma liczy pracę sprzed dnia startu generatora", () => {
  const prior = dateRange("2026-11-02", "2026-11-13")
    .filter((d) => ![6, 0].includes(new Date(d).getUTCDay()))
    .map((date) => ({ userId: "anna", date, startMin: h(10), endMin: h(18), type: "OPERATOR" }));
  const r = generateSchedule(base({ dates: dateRange("2026-11-14", "2026-11-30"), users: [...UOP, ...CONTRACT], prior }));
  const anna = r.norm.find((n) => n.userId === "anna")!;
  assert.ok(anna.workedMin >= 160 * 60);
  // 80 h przed startem → generator dokłada dokładnie do normy, nie więcej
  assert.ok(anna.workedMin <= 160 * 60, `${anna.workedMin / 60} h`);
});

test("UoP: brak dyspozycyjności – norma niedopełniona i zgłoszona", () => {
  const r = generateSchedule(base({ dates: NOVEMBER, users: [...UOP, ...CONTRACT], submitted: new Set(["anna"]) }));
  const anna = r.norm.find((n) => n.userId === "anna")!;
  assert.equal(anna.workedMin, 0);
  assert.equal(anna.missingMin, 160 * 60);
});

test("„tylko sekcje”: generator nie daje żadnych zmian, nawet w weekend i przy brakach", () => {
  const only = { id: "kasiaR", name: "Kasia R", employment: "TYLKO_SEKCJE" };
  const sessions: SessionLike[] = [{ userId: "kasiaR", date: "2026-11-02", startMin: h(16), endMin: h(17), name: "Kijanki", status: "PLANNED" }];
  const r = generateSchedule(base({ users: [only, STAFF[0]], sessions }));
  assert.ok(!r.shifts.some((s) => s.userId === "kasiaR"));
  assert.ok(!Object.values(r.issues).flat().some((i) => i.userId === "kasiaR"), "bez ostrzeżenia o minimum 4 h");
});

test("UoP: generator nigdy nie przekracza normy (sufit), także przy brakach w obsadzie", () => {
  // Tylko dwie osoby UoP na cały miesiąc – dyżurów jest więcej niż 2 × 160 h, ale norma to sufit.
  const r = generateSchedule(base({ dates: NOVEMBER, users: UOP.slice(0, 2) }));
  for (const n of r.norm) assert.ok(n.workedMin <= 160 * 60, `${n.name}: ${n.workedMin / 60} h`);
  assert.ok(errors(r).some((i) => i.message.startsWith("Brak operatora")), "luki zgłoszone zamiast nadgodzin");
});

test("routesetting rotuje równo między wszystkich stałych i UoP", () => {
  const users = [
    { id: "kris", name: "Kris", employment: "UOP" },
    { id: "michal", name: "Michał", employment: "UOP" },
    { id: "cichy", name: "Cichy", employment: "STALY" },
    ...CONTRACT,
  ];
  const r = generateSchedule(base({ dates: NOVEMBER, users }));
  const rs = r.shifts.filter((s) => s.type === "ROUTESETTING");
  const counts = ["kris", "michal", "cichy"].map((id) => rs.filter((s) => s.userId === id).length);
  assert.equal(rs.length, 13); // pn–śr w listopadzie 2026
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `podział: ${counts.join("/")}`);
  assert.ok(!rs.some((s) => s.employment === "ZLECENIE"));
});
