import assert from "node:assert/strict";
import test from "node:test";
import { computeEmpathyLoadMetricsV2 } from "./empathy-load-metrics-v2";

function day(
  date: string,
  trainingLoad: number,
  wellness?: { hrvMs?: number; sleepHours?: number; restingHrBpm?: number },
) {
  return {
    date,
    sessions: [{ trainingLoad, durationMinutes: 60, hrAvgBpm: 140 }],
    wellness,
  };
}

test("high load week increases strain and fitness4", () => {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date("2026-05-01T12:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + i);
    return day(d.toISOString().slice(0, 10), 80);
  });
  const series = computeEmpathyLoadMetricsV2(days);
  const last = series.at(-1)!;
  assert.ok(last.strain > 20);
  assert.ok(last.fitness4 > 40);
  assert.ok(last.form < last.fitness4);
});

test("poor recovery raises stressCore vs good recovery", () => {
  const base = Array.from({ length: 10 }, (_, i) => {
    const d = new Date("2026-05-01T12:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + i);
    return day(d.toISOString().slice(0, 10), 50, { hrvMs: 60, sleepHours: 7.5, restingHrBpm: 48 });
  });
  const good = computeEmpathyLoadMetricsV2([
    ...base,
    day("2026-05-11", 50, { hrvMs: 62, sleepHours: 8, restingHrBpm: 47 }),
  ]);
  const bad = computeEmpathyLoadMetricsV2([
    ...base,
    day("2026-05-11", 50, { hrvMs: 35, sleepHours: 5, restingHrBpm: 58 }),
  ]);
  assert.ok(bad.at(-1)!.stressCore > good.at(-1)!.stressCore);
});

test("formInt drops when fatigueInt dominates conditioning", () => {
  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date("2026-05-01T12:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + i);
    const load = i < 7 ? 10 : 100;
    return day(d.toISOString().slice(0, 10), load, { hrvMs: 40, sleepHours: 5 });
  });
  const series = computeEmpathyLoadMetricsV2(days);
  const last = series.at(-1)!;
  assert.ok(last.fatigueInt > 0);
  assert.ok(last.formInt < 2);
});
