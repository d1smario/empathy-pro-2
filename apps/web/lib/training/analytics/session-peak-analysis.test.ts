import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutedWorkout } from "@empathy/domain-training";
import {
  buildAllSessionPeakAnalysisProfiles,
  buildSessionPeakAnalysisProfile,
  SESSION_PEAK_METRIC_DEFS,
} from "./session-peak-analysis";

function mockWorkout(
  partial: Partial<ExecutedWorkout> & { trace?: Record<string, unknown> | null },
): ExecutedWorkout {
  const { trace, ...rest } = partial;
  return {
    id: "w1",
    athleteId: "a1",
    date: "2026-05-16",
    durationMinutes: 60,
    tss: 50,
    traceSummary: trace ?? null,
    lactateMmoll: null,
    glucoseMmol: null,
    smo2: null,
    ...rest,
  } as ExecutedWorkout;
}

test("buildAllSessionPeakAnalysisProfiles: power + hr + speed when series present", () => {
  const series = Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i / 5) * 30);
  const primary = mockWorkout({
    trace: {
      power_series_w: series,
      hr_series_bpm: series.map((v) => 120 + v * 0.2),
      speed_series_kmh: series.map((v) => 20 + v * 0.05),
    },
  });
  const profiles = buildAllSessionPeakAnalysisProfiles(primary, [primary]);
  const ids = profiles.map((p) => p.metricId);
  assert.ok(ids.includes("power"));
  assert.ok(ids.includes("hr"));
  assert.ok(ids.includes("speed"));
});

test("buildSessionPeakAnalysisProfile: lactate from scalar when no series", () => {
  const primary = mockWorkout({ lactateMmoll: 4.2, trace: { lactate_max_mmol_l: 4.5 } });
  const def = SESSION_PEAK_METRIC_DEFS.find((d) => d.id === "lactate")!;
  const profile = buildSessionPeakAnalysisProfile(primary, [primary], def);
  assert.ok(profile != null);
  assert.equal(profile.metricId, "lactate");
  assert.ok(profile.rows.some((r) => r.sessionW != null && r.sessionW > 0));
});

test("buildSessionPeakAnalysisProfile: vam from elevation gain", () => {
  const primary = mockWorkout({ durationMinutes: 116, trace: { elevation_gain_m: 551 } });
  const def = SESSION_PEAK_METRIC_DEFS.find((d) => d.id === "vam")!;
  const profile = buildSessionPeakAnalysisProfile(primary, [primary], def);
  assert.ok(profile != null);
});
