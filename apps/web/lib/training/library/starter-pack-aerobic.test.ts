import test from "node:test";
import assert from "node:assert/strict";
import {
  AEROBIC_STARTER_PRESETS,
  EMPATHY_AEROBIC_STARTER_PACK_ID,
  buildStarterContractFromPreset,
  empathyAerobicStarterContracts,
} from "./starter-pack-aerobic";
import { parsePro2BuilderSessionContract } from "./library-item-from-contract";

test("empathy aerobic starter pack: 20 unique presets", () => {
  assert.equal(AEROBIC_STARTER_PRESETS.length, 20);
  const ids = new Set(AEROBIC_STARTER_PRESETS.map((p) => p.presetId));
  assert.equal(ids.size, 20);
  assert.equal(EMPATHY_AEROBIC_STARTER_PACK_ID, "empathy_aerobic_starter_v1");
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
