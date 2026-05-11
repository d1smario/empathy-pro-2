import assert from "node:assert/strict";
import test from "node:test";

import { BIOENERGETIC_WINDOW_MAX_DAYS, enumerateInclusiveIsoDates } from "@/lib/bioenergetics/bioenergetic-window-range";

test("enumerateInclusiveIsoDates ordina e include estremi", () => {
  const r = enumerateInclusiveIsoDates("2026-05-03", "2026-05-01");
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.dates, ["2026-05-01", "2026-05-02", "2026-05-03"]);
});

test("enumerateInclusiveIsoDates singolo giorno", () => {
  const r = enumerateInclusiveIsoDates("2026-01-15", "2026-01-15");
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.dates, ["2026-01-15"]);
});

test("enumerateInclusiveIsoDates rifiuta range troppo lungo", () => {
  const r = enumerateInclusiveIsoDates("2026-01-01", "2026-01-20");
  assert.equal(r.ok, false);
});

test("enumerateInclusiveIsoDates ammette esattamente max giorni", () => {
  const r = enumerateInclusiveIsoDates("2026-01-01", "2026-01-14");
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.dates.length, BIOENERGETIC_WINDOW_MAX_DAYS);
});
