import { test } from "node:test";
import assert from "node:assert/strict";
import { ageOn, initialStatus, notificationText } from "./clientForm.ts";

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
  const msg = notificationText(
    { id: "x", name: "Jan Kowalski", minors: 1, adult: true, knowsAutobelay: true, canHarness: true, canBelay: false },
    "https://grafik.k2arena.pl",
  );
  assert.match(msg, /DO SZKOLENIA/);
  assert.match(msg, /NIE: asekuracja/);
  assert.match(msg, /1 osoba niepełnoletnia/);
  assert.match(msg, /\/ankiety\?status=SZKOLENIE$/);
});
