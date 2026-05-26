import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MECHANICAL_EFFICIENCY,
  mechanicalKjFromIntensitySegments,
  mechanicalKjFromSegments,
  metabolicKcalFromMechanicalKj,
  metabolicKcalFromMechanicalWork,
  powerWattsForZoneLabel,
} from "./session-mechanical-energy";

test("powerWattsForZoneLabel: Z2 @ 250 W FTP (midpoint fascia)", () => {
  assert.equal(powerWattsForZoneLabel("Z2", 250), Math.round(250 * ((0.63 + 0.74) / 2)));
});

test("mechanicalKjFromIntensitySegments: 200 W × 3600 s via Z4 proxy", () => {
  const ftp = 250;
  const pZ4 = powerWattsForZoneLabel("Z4", ftp);
  const kj = mechanicalKjFromIntensitySegments([{ durationSeconds: 3600, intensityLabel: "Z4" }], ftp);
  assert.equal(kj, Math.round((pZ4 * 3600) / 1000));
});

test("mechanicalKjFromSegments: 200 W × 3600 s = 720 kJ", () => {
  assert.equal(mechanicalKjFromSegments([{ powerW: 200, durationSeconds: 3600 }]), 720);
});

test("metabolicKcalFromMechanicalKj: 720 kJ @ η=0.24", () => {
  const kcal = metabolicKcalFromMechanicalKj(720, DEFAULT_MECHANICAL_EFFICIENCY);
  assert.equal(kcal, Math.round(720 / 0.24 / 4.184));
});

test("metabolicKcalFromMechanicalWork prefers explicit kJ over avg power", () => {
  const fromKj = metabolicKcalFromMechanicalWork({ mechanicalKj: 500, avgPowerW: 999, durationSec: 9999 });
  assert.equal(fromKj, metabolicKcalFromMechanicalKj(500));
});
