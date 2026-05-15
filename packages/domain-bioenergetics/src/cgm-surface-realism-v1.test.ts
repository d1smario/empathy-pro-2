import test from "node:test";
import assert from "node:assert/strict";
import { applyCgmLikeSurfaceToSubhourlyGluLac } from "./cgm-surface-realism-v1";
import { buildSimulatedGluLacDiurnalSubHourly } from "./day-simulator-v1";

const kernel = {
  insulinDemandScore: 40,
  anabolicSuppressionScore: 20,
  glucoseHandlingScore: 50,
  oxidationDriveScore: 50,
  pathwayState: "supportive" as const,
};

test("buildSimulatedGluLacDiurnalSubHourly: stesso input → stessa curva (deterministico)", () => {
  const a = buildSimulatedGluLacDiurnalSubHourly("2026-06-01", kernel, [], {}, 5);
  const b = buildSimulatedGluLacDiurnalSubHourly("2026-06-01", kernel, [], {}, 5);
  assert.deepEqual(a.glucose, b.glucose);
  assert.deepEqual(a.lactate, b.lactate);
  assert.deepEqual(a.insulinProxy, b.insulinProxy);
});

test("applyCgmLikeSurfaceToSubhourlyGluLac: doppia applicazione idempotente su stessi punti", () => {
  const rawG = Array.from({ length: 12 }, (_, i) => ({
    ts: `2026-06-01T${String(8 + Math.floor(i / 6)).padStart(2, "0")}:${String((i % 6) * 10).padStart(2, "0")}:00`,
    value: 5.2 + (i % 3) * 0.01,
    source: "glucose_stimulus_predictor_v1_5m",
  }));
  const rawL = rawG.map((p, i) => ({ ...p, value: 1.2 + (i % 2) * 0.02, source: "lactate_stimulus_predictor_v1_5m" }));
  const a = applyCgmLikeSurfaceToSubhourlyGluLac({
    glucose: rawG,
    lactate: rawL,
    date: "2026-06-01",
    kernel,
    glucoseClamp: { lo: 3.9, hi: 9.8 },
    lactateClamp: { lo: 0.75, hi: 5.2 },
  });
  const b = applyCgmLikeSurfaceToSubhourlyGluLac({
    glucose: rawG,
    lactate: rawL,
    date: "2026-06-01",
    kernel,
    glucoseClamp: { lo: 3.9, hi: 9.8 },
    lactateClamp: { lo: 0.75, hi: 5.2 },
  });
  assert.deepEqual(a.glucose, b.glucose);
});

test("subhourly 5m dopo superficie CGM-like ha micro-variazione (non piatta)", () => {
  const { glucose } = buildSimulatedGluLacDiurnalSubHourly("2026-06-02", kernel, [], {}, 5);
  let sumSq = 0;
  for (let i = 1; i < glucose.length; i += 1) {
    const d = glucose[i]!.value - glucose[i - 1]!.value;
    sumSq += d * d;
  }
  const rms = Math.sqrt(sumSq / (glucose.length - 1));
  assert.ok(rms > 0.006, "rumore correlato + smoothing devono lasciare variazione locale visibile");
});
