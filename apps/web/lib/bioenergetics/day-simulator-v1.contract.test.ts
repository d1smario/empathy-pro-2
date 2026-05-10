import test from "node:test";
import assert from "node:assert/strict";
import {
  SIM_BANK_VERSION,
  buildNominalCortisolActhHourly24,
  buildSimulatedGluLacDiurnal,
  simulatedLabNumeric,
} from "@empathy/domain-bioenergetics";

test("buildSimulatedGluLacDiurnal emette 24 punti in range e source sim_diurnal_v1", () => {
  const kernel = {
    insulinDemandScore: 40,
    anabolicSuppressionScore: 25,
    glucoseHandlingScore: 55,
    oxidationDriveScore: 45,
    pathwayState: "mixed" as const,
  };
  const { glucose, lactate } = buildSimulatedGluLacDiurnal("2026-05-10", kernel, []);
  assert.equal(glucose.length, 24);
  assert.equal(lactate.length, 24);
  for (const p of glucose) {
    assert.ok(p.value >= 3.9 && p.value <= 9.8);
    assert.equal(p.source, "sim_diurnal_v1");
  }
  for (const p of lactate) {
    assert.ok(p.value >= 0.75 && p.value <= 5.2);
  }
});

test("simulatedLabNumeric supporta tile note e null per id sconosciuto", () => {
  const k = {
    insulinDemandScore: 30,
    anabolicSuppressionScore: 20,
    glucoseHandlingScore: 60,
    oxidationDriveScore: 50,
    pathwayState: "supportive" as const,
  };
  assert.ok(simulatedLabNumeric("crp", k) != null);
  assert.equal(simulatedLabNumeric("unknown_tile_xyz", k), null);
});

test("SIM_BANK_VERSION è 1", () => {
  assert.equal(SIM_BANK_VERSION, 1);
});

test("buildNominalCortisolActhHourly24 produce 24 punti per cortisolo e ACTH", () => {
  const k = {
    insulinDemandScore: 35,
    anabolicSuppressionScore: 22,
    glucoseHandlingScore: 58,
    oxidationDriveScore: 46,
    pathwayState: "mixed" as const,
  };
  const { cortisolUgdL, acthPgMl } = buildNominalCortisolActhHourly24(k);
  assert.equal(cortisolUgdL.length, 24);
  assert.equal(acthPgMl.length, 24);
  assert.ok(cortisolUgdL.every((v) => v >= 2 && v <= 26));
  assert.ok(acthPgMl.every((v) => v >= 5 && v <= 55));
});
