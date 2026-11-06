import { test } from "node:test";
import assert from "node:assert/strict";
import { ageOn, formNotification, initialStatus } from "./clientForm.ts";

test("wszystko TAK → weryfikacja, choć jedno NIE → szkolenie", () => {
  assert.equal(initialStatus({ knowsAutobelay: true, canHarness: true, canBelay: true }), "WERYFIKACJA");
  assert.equal(initialStatus({ knowsAutobelay: true, canHarness: false, canBelay: true }), "SZKOLENIE");
  assert.equal(initialStatus({ knowsAutobelay: false, canHarness: false, canBelay: false }), "SZKOLENIE");
});

test("wiek liczony w pełnych latach", () => {
  assert.equal(ageOn("2008-11-07", "2026-11-06"), 17);
  assert.equal(ageOn("2008-11-06", "2026-11-06"), 18);
  assert.equal(ageOn("1990-01-01", "2026-11-06"), 36);
});

test("powiadomienie wymienia odpowiedzi NIE i nie zawiera danych kontaktowych", () => {
  const n = formNotification({ name: "Jan Kowalski", minors: 1, adult: true, knowsAutobelay: true, canHarness: true, canBelay: false });
  assert.equal(n.title, "Do szkolenia: Jan Kowalski");
  assert.match(n.body, /NIE: asekuracja/);
  assert.match(n.body, /1 osoba niepełnoletnia/);
  assert.equal(n.href, "/ankiety?status=SZKOLENIE");
});
