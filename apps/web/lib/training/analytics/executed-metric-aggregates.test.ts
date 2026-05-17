import assert from "node:assert/strict";
import test from "node:test";
import { refKpisLastNDays } from "./executed-metric-aggregates";

test("refKpisLastNDays infers training load when stored tss is zero", () => {
  const kpis = refKpisLastNDays(
    [
      {
        date: "2026-05-16",
        tss: 0,
        duration_minutes: 116,
        kcal: 0,
        trace_summary: { hr_avg_bpm: 140 },
        lactate_mmoll: null,
        glucose_mmol: null,
        smo2: null,
      },
    ],
    7,
    "2026-05-17",
  );
  assert.ok(kpis.tss > 0);
});
