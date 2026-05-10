import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBioenergeticBiaLiteratureV1, resolveEcwTbwRatio } from "./bia-literature-model-v1";

test("resolveEcwTbwRatio preferisce ratio esplicito", () => {
  const r = resolveEcwTbwRatio({
    measurementTs: "2026-05-10T08:00:00",
    source: "bia_device",
    ecwTbwRatio: 0.392,
    quality: "fasting_morning",
  });
  assert.ok(r != null);
  assert.equal(Math.round((r ?? 0) * 1000) / 1000, 0.392);
});

test("resolveEcwTbwRatio da ECW e TBW litri", () => {
  const r = resolveEcwTbwRatio({
    measurementTs: "2026-05-10T08:00:00",
    source: "bia_device",
    ecwL: 15,
    tbwL: 40,
    quality: "arbitrary",
  });
  assert.ok(r != null);
  assert.equal(Math.round((r ?? 0) * 1000) / 1000, 0.375);
});

test("analyzeBioenergeticBiaLiteratureV1: PhA molto basso donna → low_support_cue", () => {
  const out = analyzeBioenergeticBiaLiteratureV1({
    snapshot: {
      measurementTs: "2026-05-10T07:00:00",
      source: "bia_device",
      phaseAngleDeg: 3.85,
      quality: "fasting_morning",
    },
    phenotype: { sex: "f" },
  });
  assert.equal(out.modelVersion, 1);
  assert.equal(out.cellularGeometry.band, "low_support_cue");
  assert.ok(out.cellularGeometry.supportIndex01 < 0.45);
  assert.equal(out.extracellularFluid.band, "insufficient_data");
});

test("analyzeBioenergeticBiaLiteratureV1: PhA alto uomo digiuno → favourable_geometry_cue", () => {
  const out = analyzeBioenergeticBiaLiteratureV1({
    snapshot: {
      measurementTs: "2026-05-10T07:00:00",
      source: "bia_device",
      phaseAngleDeg: 7.4,
      ecwTbwRatio: 0.368,
      quality: "fasting_morning",
    },
    phenotype: { sex: "m" },
  });
  assert.equal(out.cellularGeometry.band, "favourable_geometry_cue");
  assert.equal(out.extracellularFluid.band, "favourable_balance");
  assert.ok(out.confidence01 > 0.75);
});

test("analyzeBioenergeticBiaLiteratureV1: ECW/TBW elevato → extracellular_shift_cue", () => {
  const out = analyzeBioenergeticBiaLiteratureV1({
    snapshot: {
      measurementTs: "2026-05-10T18:00:00",
      source: "bia_device",
      ecwTbwRatio: 0.412,
      quality: "fasting_morning",
    },
  });
  assert.equal(out.extracellularFluid.band, "extracellular_shift_cue");
  assert.ok((out.extracellularFluid.loadBias01 ?? 0) > 0.55);
});

test("post_esercizio riduce confidence vs digiuno", () => {
  const base = analyzeBioenergeticBiaLiteratureV1({
    snapshot: {
      measurementTs: "2026-05-10T07:00:00",
      source: "bia_device",
      phaseAngleDeg: 6.2,
      ecwTbwRatio: 0.38,
      quality: "fasting_morning",
    },
  });
  const post = analyzeBioenergeticBiaLiteratureV1({
    snapshot: {
      measurementTs: "2026-05-10T19:00:00",
      source: "bia_device",
      phaseAngleDeg: 6.2,
      ecwTbwRatio: 0.38,
      quality: "post_exercise",
    },
  });
  assert.ok(post.confidence01 < base.confidence01);
});
