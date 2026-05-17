import assert from "node:assert/strict";
import test from "node:test";
import {
  bestVamMhInAltitudeWindow,
  pickAltitudeSeriesFromTrace,
  sessionAverageVamMh,
  sessionPeakVam,
  vamProfileFromAltitudeSeries,
  vamProfileFromTrace,
} from "./vam-from-trace";

test("bestVamMhInAltitudeWindow: 100m in 1h → ~100 m/h", () => {
  const n = 120;
  const alt = Array.from({ length: n }, (_, i) => (i / (n - 1)) * 100);
  const vam = bestVamMhInAltitudeWindow(alt, 3600, 3600 / (n - 1));
  assert.ok(vam != null);
  assert.ok(vam >= 85 && vam <= 115);
});

test("pickAltitudeSeriesFromTrace prefers altitude_series_m", () => {
  const s = pickAltitudeSeriesFromTrace({
    altitude_series_m: [100, 110, 125, 140],
  });
  assert.equal(s.length, 4);
});

test("vamProfileFromTrace uses garmin vertical_speed when present", () => {
  const profile = vamProfileFromTrace(
    { vertical_speed_series_mps: [0, 0.5, 0.8, 0.3, 0] },
    5,
  );
  const w1 = profile.find((p) => p.key === "w1m");
  assert.ok(w1?.vamMh != null && w1.vamMh > 0);
});

test("sessionPeakVam from elevation_gain scalar fallback", () => {
  const peak = sessionPeakVam({ elevation_gain_m: 1200 }, 120);
  assert.ok(peak != null && peak.vamMh > 0);
});

test("sessionAverageVamMh: 551m in 116min ≈ 285 m/h", () => {
  const vam = sessionAverageVamMh({ elevation_gain_m: 551 }, 116);
  assert.ok(vam != null);
  assert.ok(vam >= 275 && vam <= 295, `expected ~285 m/h, got ${vam}`);
});
