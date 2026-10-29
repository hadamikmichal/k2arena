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

const SECTION_ONLY = { id: "marcin", name: "Marcin", employment: "SEKCJA" };

test("instruktor sekcji: dyżury tylko w weekend, nigdy routesetting", () => {
  // Brak innych chętnych w tygodniu – mimo to instruktor sekcji nie dostaje dyżuru w dzień roboczy.
  const r = generateSchedule(base({ users: [SECTION_ONLY, ...CONTRACT] }));
  const mine = r.shifts.filter((s) => s.userId === "marcin");
  assert.ok(mine.length > 0, "powinien dostać dyżury w weekend");
  for (const s of mine) {
    assert.equal(s.type, "OPERATOR");
    assert.ok(["2026-11-07", "2026-11-08"].includes(s.date), s.date);
  }
});

test("instruktor sekcji z samą sekcją w dzień roboczy – bez ostrzeżenia o minimum 4 h", () => {
  const sessions: SessionLike[] = [{ userId: "marcin", date: "2026-11-04", startMin: h(17.5), endMin: h(19), name: "Jaszczurki", status: "PLANNED" }];
  const r = generateSchedule(base({ dates: ["2026-11-04"], users: [...STAFF, SECTION_ONLY], sessions }));
  assert.ok(!r.issues["2026-11-04"].some((i) => i.userId === "marcin"), JSON.stringify(r.issues["2026-11-04"]));
});
