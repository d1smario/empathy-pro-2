import test from "node:test";
import assert from "node:assert/strict";
import type { BioenergeticConditioningContextV1 } from "@empathy/contracts";
import { metabolicSleepContextFromConditioningContext } from "@/lib/bioenergetics/metabolic-sleep-context-from-conditioning";

function ctx(partial: Partial<BioenergeticConditioningContextV1>): BioenergeticConditioningContextV1 {
  return {
    athleteId: "a1",
    localDate: "2026-05-10",
    timeZone: "UTC",
    training: [],
    nutrition: [],
    labAnchors: [],
    ...partial,
  };
}

test("metabolicSleepContextFromConditioningContext: senza sleepAutonomic → present false", () => {
  const s = metabolicSleepContextFromConditioningContext(ctx({}));
  assert.equal(s.present, false);
  assert.equal(s.maxSleepHours, null);
});

test("metabolicSleepContextFromConditioningContext: max ore sonno da finestre", () => {
  const s = metabolicSleepContextFromConditioningContext(
    ctx({
      sleepAutonomic: [
        { windowId: "w1", startTs: "2026-05-10T07:00:00", sleepHours: 6.5 },
        { windowId: "w2", startTs: "2026-05-10T08:00:00", sleepHours: 7.2 },
      ],
    }),
  );
  assert.equal(s.present, true);
  assert.equal(s.maxSleepHours, 7.2);
});
