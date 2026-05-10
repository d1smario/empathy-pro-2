import test from "node:test";
import assert from "node:assert/strict";
import { SIM_BANK_VERSION, buildSimulatedGluLacDiurnal, simulatedLabNumeric } from "@empathy/domain-bioenergetics";

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
