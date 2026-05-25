import test from "node:test";
import assert from "node:assert/strict";
import {
  AEROBIC_CATALOG_GROWTH_TARGET,
  AEROBIC_STARTER_PRESETS,
  EMPATHY_AEROBIC_STARTER_PACK_ID,
  STARTER_PACK_TEMPLATE_COUNT,
  buildStarterContractFromPreset,
  empathyAerobicStarterContracts,
} from "./starter-pack-aerobic";
import { parsePro2BuilderSessionContract } from "./library-item-from-contract";

test("empathy workout catalog: expanded unique presets", () => {
  assert.ok(AEROBIC_STARTER_PRESETS.length >= 480, `expected >=480 presets, got ${AEROBIC_STARTER_PRESETS.length}`);
  assert.ok(AEROBIC_STARTER_PRESETS.length < AEROBIC_CATALOG_GROWTH_TARGET + 50);
  assert.equal(AEROBIC_STARTER_PRESETS.length, STARTER_PACK_TEMPLATE_COUNT);
  const ids = new Set(AEROBIC_STARTER_PRESETS.map((p) => p.presetId));
  assert.equal(ids.size, AEROBIC_STARTER_PRESETS.length);
  assert.equal(EMPATHY_AEROBIC_STARTER_PACK_ID, "empathy_workout_catalog_v2");
});

test("workout catalog covers methodologies and disciplines", () => {
  const tags = new Set(AEROBIC_STARTER_PRESETS.flatMap((p) => p.tags));
  for (const required of [
    "norwegian",
    "polarized",
    "lactate",
    "vo2",
    "hit",
    "hypoxic",
    "heat",
    "time_trial",
    "sprint",
    "force",
    "swimming",
    "running",
    "canoe",
  ]) {
    assert.ok(tags.has(required), `missing tag ${required}`);
  }
  const disciplines = new Set(AEROBIC_STARTER_PRESETS.map((p) => p.discipline));
  for (const d of ["Cycling", "Running", "Swimming", "Canoe"]) {
    assert.ok(disciplines.has(d), `missing discipline ${d}`);
  }
});

test("buildStarterContractFromPreset: valid Pro2 contract", () => {
  const preset = AEROBIC_STARTER_PRESETS[0]!;
  const contract = buildStarterContractFromPreset(preset);
  assert.equal(contract.version, 1);
  assert.equal(contract.family, "aerobic");
  assert.ok((contract.blocks?.length ?? 0) >= 3);
  assert.ok(parsePro2BuilderSessionContract(contract));
});

test("empathyAerobicStarterContracts: all parseable", () => {
  for (const { contract } of empathyAerobicStarterContracts()) {
    assert.ok(parsePro2BuilderSessionContract(contract));
  }
});

test("workout catalog: structural variety beyond warm + single block + cool", () => {
  const contracts = empathyAerobicStarterContracts();
  const rich = contracts.filter(({ contract }) => {
    const mainBlocks = (contract.blocks ?? []).filter(
      (b) => !/riscaldamento|defaticamento|warm|cool/i.test(b.label),
    );
    const kinds = new Set(mainBlocks.map((b) => b.kind));
    const hasLongRec = mainBlocks.some((b) => /recupero profondo/i.test(b.label) && (b.durationMinutes ?? 0) >= 5);
    const multiMain = mainBlocks.length >= 3;
    return kinds.has("pyramid") || kinds.has("interval3") || kinds.has("ramp") || hasLongRec || multiMain;
  });
  assert.ok(rich.length >= 120, `expected >=120 structurally rich presets, got ${rich.length}`);

  const pyramid = contracts.find((c) => c.preset.presetId === "cyc_pyramid_z4_7step");
  assert.ok(pyramid);
  assert.ok(pyramid.contract.blocks?.some((b) => b.kind === "pyramid"));
});
