import { test } from "node:test";
import assert from "node:assert/strict";
import { findUnderCoverage, peakConcurrency, validateDay, type ShiftLike, type SessionLike } from "./rules.ts";

const h = (x: number) => x * 60;
const MON = "2026-10-26";
const SAT = "2026-10-31";

const op = (userId: string, s: number, e: number, extra: Partial<ShiftLike> = {}): ShiftLike => ({
  userId, userName: userId, date: MON, startMin: h(s), endMin: h(e), type: "OPERATOR", ...extra,
});
const sec = (userId: string, s: number, e: number, extra: Partial<SessionLike> = {}): SessionLike => ({
  userId, userName: userId, date: MON, startMin: h(s), endMin: h(e), name: "Dzieci", status: "PLANNED", ...extra,
});

test("pełne pokrycie dnia roboczego – brak błędów", () => {
  const issues = validateDay(MON, [op("A", 10, 16), op("B", 16, 22)], []);
  assert.deepEqual(issues.filter((i) => i.level === "error"), []);
});

test("luka w dyżurze jest wykrywana", () => {
  const issues = validateDay(MON, [op("A", 10, 15), op("B", 16, 22)], []);
  assert.ok(issues.some((i) => i.message.includes("Brak operatora na dyżurze 15:00–16:00")));
});

test("operator prowadzący sekcję nie liczy się jako dyżurny", () => {
  const issues = validateDay(MON, [op("A", 10, 16), op("B", 16, 22)], [sec("B", 17, 18.5)]);
  assert.ok(issues.some((i) => i.message.includes("Brak operatora na dyżurze 17:00–18:30")));
  const ok = validateDay(MON, [op("A", 10, 16), op("B", 16, 22), op("C", 14, 22)], [sec("B", 17, 18.5)]);
  assert.ok(!ok.some((i) => i.message.startsWith("Brak operatora")));
});

test("odwołana sekcja nie blokuje dyżuru", () => {
  const issues = validateDay(MON, [op("A", 10, 16), op("B", 16, 22)], [sec("B", 17, 18.5, { status: "CANCELLED" })]);
  assert.ok(!issues.some((i) => i.message.startsWith("Brak operatora")));
});

test("minimum 4h pracy", () => {
  const issues = validateDay(MON, [op("A", 10, 22), op("B", 18, 21)], []);
  assert.ok(issues.some((i) => i.userId === "B" && i.message.includes("minimum")));
});

test("routesetting poza oknem 8–14 i poza pn–śr", () => {
  const rs = validateDay(MON, [op("A", 10, 22), op("B", 9, 15, { type: "ROUTESETTING" })], []);
  assert.ok(rs.some((i) => i.message.includes("poza oknem")));
  const thu = "2026-10-29";
  const rs2 = validateDay(thu, [op("A", 10, 22, { date: thu }), op("B", 8, 13, { type: "ROUTESETTING", date: thu })], []);
  assert.ok(rs2.some((i) => i.message.includes("tylko pn–śr")));
});

test("limit jednoczesnych instruktorów: 3 w pn, 2 w czw", () => {
  const three = [op("A", 10, 22), op("B", 12, 18), op("C", 13, 17)];
  assert.ok(!validateDay(MON, three, []).some((i) => i.message.includes("jednocześnie")));
  const thu = "2026-10-29";
  const issues = validateDay(thu, three.map((s) => ({ ...s, date: thu })), []);
  assert.ok(issues.some((i) => i.message.includes("3 instruktorów jednocześnie (13:00–17:00)")));
});

test("stały instruktor w weekend – ostrzeżenie", () => {
  const issues = validateDay(SAT, [op("A", 9, 21, { date: SAT, employment: "STALY" })], []);
  assert.ok(issues.some((i) => i.message.includes("w weekend")));
});

test("nakładające się zmiany tej samej osoby", () => {
  const issues = validateDay(MON, [op("A", 10, 22), op("A", 8, 12, { type: "ROUTESETTING" })], []);
  assert.ok(issues.some((i) => i.level === "error" && i.message.includes("nakładające się")));
});

test("helpers", () => {
  assert.deepEqual(findUnderCoverage({ startMin: 0, endMin: 10 }, [{ startMin: 2, endMin: 5 }], 1), [
    { startMin: 0, endMin: 2 },
    { startMin: 5, endMin: 10 },
  ]);
  assert.deepEqual(peakConcurrency([{ startMin: 0, endMin: 10 }, { startMin: 5, endMin: 15 }]), {
    count: 2, at: { startMin: 5, endMin: 10 },
  });
});
