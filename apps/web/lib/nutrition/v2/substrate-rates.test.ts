import assert from "node:assert/strict";
import test from "node:test";
import { substrateRatesAtPowerW, substrateTotalsForSession } from "@/lib/nutrition/v2/substrate-rates";

test("270W @ FTP 313: CHO e FAT g/h positivi", () => {
  const r = substrateRatesAtPowerW(270, { ftpW: 313 });
  assert.ok(r.choGPerH > 80, `CHO/h atteso alto, got ${r.choGPerH}`);
  assert.ok(r.fatGPerH > 5);
  assert.ok(r.proGPerH >= 2);
});

test("4h @ 270W: totali CHO ~ 4 × g/h", () => {
  const t = substrateTotalsForSession(270, 240, { ftpW: 313 });
  assert.ok(t.choG > 300, `CHO totale 4h atteso elevato, got ${t.choG}`);
  assert.equal(t.durationH, 4);
});
