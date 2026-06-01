import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expandFitWorkoutStepsForImport,
  flattenFitWorkoutStepsWithRepeats,
  pickFitRepeatCount,
  resolveFitRepeatLoopStartIndex,
} from "./fit-workout-step-expand";
import { fitStepDurationSecForImport, detectFitTimeScale } from "./fit-step-duration-decode";

/** Pattern TrainingPeaks tipico: warm → work 4' → rec 8' → repeat×5 → cool. */
const TP_INTERVAL_REPEAT_STEPS: Array<Record<string, unknown>> = [
  { message_index: 0, duration_type: "time", duration_value: 600_000, wkt_step_name: "Warm up" },
  {
    message_index: 1,
    duration_type: "time",
    duration_value: 240_000,
    wkt_step_name: "Z5 tork",
    target_type: "power",
    custom_target_value_low: 1300,
    custom_target_value_high: 1400,
  },
  {
    message_index: 2,
    duration_type: "time",
    duration_value: 480_000,
    wkt_step_name: "Recupero",
    target_type: "power",
    custom_target_value_low: 1100,
    custom_target_value_high: 1150,
  },
  {
    message_index: 3,
    duration_type: "repeat_until_steps_cmplt",
    duration_step: 1,
    repeat_steps: 5,
  },
  { message_index: 4, duration_type: "time", duration_value: 600_000, wkt_step_name: "Cool down" },
];

test("pickFitRepeatCount: repeat_steps Garmin SDK", () => {
  assert.equal(pickFitRepeatCount({ repeat_steps: 5 }), 5);
  assert.equal(pickFitRepeatCount({ repeat_count: 4 }), 4);
  assert.equal(pickFitRepeatCount({}), 1);
});

test("resolveFitRepeatLoopStartIndex: duration_step → message_index", () => {
  const idx = resolveFitRepeatLoopStartIndex(TP_INTERVAL_REPEAT_STEPS[3]!, 3, TP_INTERVAL_REPEAT_STEPS);
  assert.equal(idx, 1);
});

test("flattenFitWorkoutStepsWithRepeats: 5× (work+rec) materializzati", () => {
  const flat = flattenFitWorkoutStepsWithRepeats(TP_INTERVAL_REPEAT_STEPS);
  assert.equal(flat.length, 12, "warm + 5×2 interval + cool");
  assert.equal(flat[0]?.wkt_step_name, "Warm up");
  assert.equal(flat[1]?.wkt_step_name, "Z5 tork");
  assert.equal(flat[2]?.wkt_step_name, "Recupero");
  assert.equal(flat[3]?.wkt_step_name, "Z5 tork");
  assert.equal(flat[11]?.wkt_step_name, "Cool down");
});

test("expandFitWorkoutStepsForImport: coppia work/rec → interval2 con repeats=5", () => {
  const expanded = expandFitWorkoutStepsForImport(TP_INTERVAL_REPEAT_STEPS);
  const intervalMarkers = expanded.filter((s) => s._fitInterval2);
  assert.equal(intervalMarkers.length, 1);
  assert.equal(intervalMarkers[0]?._fitInterval2?.repeats, 5);
  assert.equal(expanded.length, 3, "warm + interval2 + cool");
});

test("integrazione durata: 5×(4'+8') + warm/cool ≈ 70 min", () => {
  const expanded = expandFitWorkoutStepsForImport(TP_INTERVAL_REPEAT_STEPS);
  const scale = detectFitTimeScale(TP_INTERVAL_REPEAT_STEPS);
  assert.equal(scale, "ms");

  let totalSec = 0;
  for (const step of expanded) {
    if (step._fitInterval2) {
      const w = fitStepDurationSecForImport(step._fitInterval2.work, 9.5, scale)!;
      const r = fitStepDurationSecForImport(step._fitInterval2.recovery, 9.5, scale)!;
      totalSec += step._fitInterval2.repeats * (w + r);
      continue;
    }
    const sec = fitStepDurationSecForImport(step, 9.5, scale);
    if (sec != null) totalSec += sec;
  }
  /** 600 + 5×(240+480) + 600 = 4800 s = 80 min. */
  assert.equal(totalSec, 4800);
});

test("repeat marker PRIMA del corpo (lookahead)", () => {
  const steps: Array<Record<string, unknown>> = [
    { message_index: 0, duration_type: "time", duration_value: 300, wkt_step_name: "Warm" },
    { message_index: 1, duration_type: "repeat_until_steps_cmplt", duration_step: 2, repeat_steps: 3, duration_value: 2 },
    { message_index: 2, duration_type: "time", duration_value: 60, wkt_step_name: "Work" },
    { message_index: 3, duration_type: "time", duration_value: 30, wkt_step_name: "Rec" },
    { message_index: 4, duration_type: "time", duration_value: 300, wkt_step_name: "Cool" },
  ];
  const flat = flattenFitWorkoutStepsWithRepeats(steps);
  assert.equal(flat.length, 8, "warm + 3×2 + cool");
});
