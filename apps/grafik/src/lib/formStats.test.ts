import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFormStats, formsTable, toCsv, type FormRecord } from "./formStats.ts";

const base: FormRecord = {
  id: "1", name: "Jan Kowalski", birthDate: "1990-05-01", phone: "600100200", email: "jan@example.com", minor1: null, minor2: null,
  knowsAutobelay: true, canHarness: true, canBelay: true, status: "WERYFIKACJA", category: null, note: null,
  reviewedBy: null, reviewedAt: null, consentVersion: "2026-11-06", ip: null, userAgent: null, createdAt: new Date("2026-11-06T10:00:00Z"),
};

test("statystyki: wynik przy wysłaniu, odpowiedzi NIE, kategorie, małoletni, miesiące", () => {
  const s = computeFormStats([
    base,
    { ...base, id: "2", canBelay: false, status: "ZAKONCZONE", category: "A,W", reviewedBy: "Ola", minor1: "Kasia", minor2: "Tomek" },
    // 31.10 23:30 UTC = 1.11 00:30 w Warszawie → listopad; klient 17-letni
    { ...base, id: "3", birthDate: "2009-06-01", knowsAutobelay: false, canHarness: false, status: "SZKOLENIE", createdAt: new Date("2026-10-31T23:30:00Z") },
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.verify, 1);
  assert.equal(s.training, 2);
  assert.deepEqual(s.byStatus, { WERYFIKACJA: 1, SZKOLENIE: 1, ZAKONCZONE: 1 });
  assert.deepEqual(s.noByQuestion, { knowsAutobelay: 1, canHarness: 1, canBelay: 1 });
  assert.deepEqual(s.categories, { A: 1, W: 1, P: 0 });
  assert.equal(s.minorClients, 1);
  assert.equal(s.withMinors, 1);
  assert.equal(s.minorsUnderCare, 2);
  assert.deepEqual(s.byMonth, [{ month: "2026-11", total: 3, verify: 1, training: 2 }]);
  assert.deepEqual(s.byReviewer, [{ name: "Ola", count: 1 }]);
});

test("CSV: średnik, BOM, cudzysłowy i ochrona przed formułami", () => {
  const csv = toCsv(formsTable([{ ...base, name: '=HYPERLINK("x")', note: 'a "b"' }]));
  assert.ok(csv.startsWith("﻿\"ID\";"));
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.match(csv, /"a ""b"""/);
  assert.match(csv, /"2026-11-06 11:00:00"/);
});
