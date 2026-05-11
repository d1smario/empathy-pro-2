import test from "node:test";
import assert from "node:assert/strict";
import { mealGlycemicHourWeights24, mealPostprandialDecayWeightsForGi } from "./sim-timeline-v1";

test("mealPostprandialDecayWeightsForGi: IG alto ha meno peso in coda che IG basso", () => {
  const low = mealPostprandialDecayWeightsForGi(38);
  const high = mealPostprandialDecayWeightsForGi(88);
  assert.ok(high[0]! > low[0]!, "picco più accentuato con IG alto");
  const lowTail = low[low.length - 1] ?? 0;
  const highTail = high[high.length - 1] ?? 0;
  assert.ok(lowTail >= highTail, "IG basso mantiene più peso in coda");
});

test("mealGlycemicHourWeights24: stesso CHO, IG alto vs basso → peso ora picco diversa", () => {
  const base = { ts: "2026-05-01T12:00:00", type: "meal", payload: { carbsG: 80, kcal: 400, glycemicIndex: 40 } };
  const hi = { ...base, payload: { ...base.payload, glycemicIndex: 85 } };
  const wLow = mealGlycemicHourWeights24([base]);
  const wHi = mealGlycemicHourWeights24([hi]);
  assert.equal(wLow[12]! > 0, true);
  assert.equal(wHi[12]! > 0, true);
  assert.notDeepEqual(wLow, wHi);
});

test("mealGlycemicHourWeights24: insalata+pollo (poco CHO) vs 150 g CHO", () => {
  const light = {
    ts: "2026-05-01T12:00:00",
    type: "meal",
    payload: { carbsG: 8, kcal: 220, proteinG: 35, glycemicIndex: 35 },
  };
  const heavy = {
    ts: "2026-05-01T12:00:00",
    type: "meal",
    payload: { carbsG: 150, kcal: 600, glycemicIndex: 72 },
  };
  const wL = mealGlycemicHourWeights24([light]);
  const wH = mealGlycemicHourWeights24([heavy]);
  assert.ok(wH[12]! > wL[12]! * 5, "150 g CHO genera bump molto maggiore del pasto ipoglucidico");
});
