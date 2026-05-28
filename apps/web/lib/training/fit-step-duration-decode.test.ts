import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectFitTimeScale,
  fitStepDurationSecForImport,
  fitStepPowerTargetRatios,
  normalizeFitWktTargetType,
  type FitTimeScale,
} from "./fit-step-duration-decode";

/**
 * Regression guardrail: workout TrainingPeaks/Garmin di Timothy 29-05-2026.
 *
 * Bug osservato: file FIT da TrainingPeaks salvava 10 step "time" con
 * `duration_value` in millisecondi (Garmin SDK scale=1000), il parser li
 * leggeva come secondi → durata totale gonfiata da 1h 18m 15s reali a
 * 195h 47m e step capped a 24h ciascuno.
 *
 * Fix: detect file-level scale (ms vs s) basato su soglia plausibilita'
 * (raw > 8h = quasi certo ms) + conversione con `rawTimeToSec`.
 *
 * Step reali del workout di Timothy (in millisecondi nel FIT, valore reale in s):
 *  Warm up        ~600.000 ms = 600 s
 *  2 giri lanciati 20.000 ms = 20 s
 *  Easy           ~300.000 ms = 300 s
 *  Cool down      ~600.000 ms = 600 s
 *  1km fermo       65.000 ms = 65 s
 *  Easy           ~300.000 ms = 300 s
 *  Cool down      ~600.000 ms = 600 s
 *  1 giro fermo    15.000 ms = 15 s
 *  Easy           ~300.000 ms = 300 s
 *  Cool down     ~1.500.000 ms = 1500 s
 *  Totale ≈ 4300 s ≈ 1h 11m (vicino a 1h 18m 15s atteso)
 */

test("detectFitTimeScale: file TrainingPeaks (ms scale=1000) -> 'ms'", () => {
  /** Almeno UN step con raw > 8h (28800) e' diagnostico per ms scale. */
  const stepsTpMs = [
    { duration_type: "time", duration_value: 600000 },
    { duration_type: "time", duration_value: 20000 },
    { duration_type: "time", duration_value: 65000 },
  ];
  assert.equal(detectFitTimeScale(stepsTpMs), "ms");
});

test("detectFitTimeScale: file legacy (sec) -> 's'", () => {
  /** Tutti i raw entro 8h: file legacy / parser pre-scaled. */
  const stepsSec = [
    { duration_type: "time", duration_value: 600 },
    { duration_type: "time", duration_value: 20 },
    { duration_type: "time", duration_value: 65 },
    { duration_type: "time", duration_value: 1500 },
  ];
  assert.equal(detectFitTimeScale(stepsSec), "s");
});

test("detectFitTimeScale: open con timer di sicurezza grande -> 'ms'", () => {
  /** Step "open" con duration_value (timer max) e' frequente in TrainingPeaks. */
  const steps = [
    { duration_type: "open", duration_value: 5400000 }, // 90 min in ms
    { duration_type: "time", duration_value: 30000 }, // 30s in ms
  ];
  assert.equal(detectFitTimeScale(steps), "ms");
});

test("detectFitTimeScale: file vuoto / no time-step -> 's' (default sicuro)", () => {
  const steps = [{ duration_type: "distance", duration_value: 100000 }];
  assert.equal(detectFitTimeScale(steps), "s");
});

test("fitStepDurationSecForImport: time step ms -> secondi corretti", () => {
  const sec = fitStepDurationSecForImport(
    { duration_type: "time", duration_value: 600000 },
    9.5,
    "ms",
  );
  assert.equal(sec, 600);
});

test("fitStepDurationSecForImport: time step ms 20s -> 20s (no gonfiaggio)", () => {
  /** Bug originale Timothy: 20.000 ms diventava 20.000 s (5h 33m). Ora: 20 s. */
  const sec = fitStepDurationSecForImport(
    { duration_type: "time", duration_value: 20000, custom_name: "2 giri lanciati" },
    9.5,
    "ms",
  );
  assert.equal(sec, 20);
});

test("fitStepDurationSecForImport: time step in s scale -> secondi diretti", () => {
  /** File legacy: il parser FIT espone gia' secondi → no /1000. */
  const sec = fitStepDurationSecForImport(
    { duration_type: "time", duration_value: 600 },
    9.5,
    "s",
  );
  assert.equal(sec, 600);
});

test("fitStepDurationSecForImport: time step capped a 24h (no overflow)", () => {
  /** Vecchio cap 24h resta come safety net (es. file corrotto). */
  const sec = fitStepDurationSecForImport(
    { duration_type: "time", duration_value: 30 * 3600 },
    9.5,
    "s",
  );
  assert.equal(sec, 24 * 3600);
});

test("fitStepDurationSecForImport: distance step in centimetri (Garmin SDK scale=100)", () => {
  /** Distance > 100km come centimetri (scale=100): 1.000.000 cm = 10 km. */
  const sec = fitStepDurationSecForImport(
    { duration_type: "distance", duration_value: 1_000_000 },
    9.5,
    "ms",
  );
  /** 10000 m / 9.5 m/s ≈ 1052 s. */
  assert.ok(sec != null && sec > 1000 && sec < 1100, `expected ~1052s, got ${sec}`);
});

test("fitStepDurationSecForImport: distance step in metri (file legacy)", () => {
  const sec = fitStepDurationSecForImport(
    { duration_type: "distance", duration_value: 5000 },
    9.5,
    "ms",
  );
  /** 5000 m / 9.5 m/s ≈ 526 s. */
  assert.ok(sec != null && sec > 500 && sec < 540, `expected ~526s, got ${sec}`);
});

test("fitStepDurationSecForImport: open step ms / s rispetta timeScale", () => {
  /** open con timer 90 minuti (5_400_000 ms) → 5400 s. */
  const secMs = fitStepDurationSecForImport(
    { duration_type: "open", duration_value: 5_400_000 },
    9.5,
    "ms",
  );
  assert.equal(secMs, 5400);
  /** open con timer 5400s in file legacy → 5400 s. */
  const secS = fitStepDurationSecForImport(
    { duration_type: "open", duration_value: 5400 },
    9.5,
    "s",
  );
  assert.equal(secS, 5400);
});

test("fitStepDurationSecForImport: power_/hr_ steps -> null (no durata)", () => {
  for (const dt of ["hr_less_than", "hr_greater_than", "power_less_than", "power_greater_than", "repeat_until_power_less_than"]) {
    const sec = fitStepDurationSecForImport(
      { duration_type: dt, duration_value: 200 },
      9.5,
      "ms",
    );
    assert.equal(sec, null, `${dt} should return null`);
  }
});

/**
 * Integrazione end-to-end (deterministica): simula il workout di Timothy
 * 29-05-2026 e verifica che la durata totale sia ~70-80 min (vicino al
 * 1h 18m 15s reale), NON 195h 47m del bug.
 */
/**
 * Regression: target di potenza Garmin SDK convention.
 * File reale Timothy 29-05-2026 (TrainingPeaks export, FTP=270 W):
 *   custom_target_value_low/high con bias +1000 = watt assoluti.
 *   1105 → 105 W, 1132 → 132 W, 1355 → 355 W, 1947 → 947 W.
 *
 * Bug originale: il vecchio decoder leggeva 1105 come watt diretti
 * (1105/270 = 4.09 → clamp 1.5) → tutti gli step finivano a Z7 311-346 W.
 */

test("normalizeFitWktTargetType: stringhe e numeri Garmin SDK", () => {
  assert.equal(normalizeFitWktTargetType({ target_type: "power" }), "power");
  assert.equal(normalizeFitWktTargetType({ target_type: 4 }), "power");
  assert.equal(normalizeFitWktTargetType({ target_type: 1 }), "heart_rate");
  assert.equal(normalizeFitWktTargetType({ target_type: 255 }), "open");
  assert.equal(normalizeFitWktTargetType({}), "open");
});

test("fitStepPowerTargetRatios: Warm up TrainingPeaks (1105-1132) -> 105-132 W con FTP=270", () => {
  const r = fitStepPowerTargetRatios(
    {
      target_type: "power",
      custom_target_value_low: 1105,
      custom_target_value_high: 1132,
      duration_type: "time",
      duration_value: 900000,
      wkt_step_name: "Warm up",
    },
    270,
  );
  /** 105 W / 270 W = 0.389; 132 W / 270 W = 0.489. Z1 easy. NON Z7! */
  assert.ok(r.low >= 0.35 && r.low <= 0.45, `low: expected ~0.39, got ${r.low}`);
  assert.ok(r.high >= 0.45 && r.high <= 0.55, `high: expected ~0.49, got ${r.high}`);
});

test("fitStepPowerTargetRatios: sprint TrainingPeaks (1355-1947) -> 355-947 W", () => {
  const r = fitStepPowerTargetRatios(
    {
      target_type: "power",
      custom_target_value_low: 1355,
      custom_target_value_high: 1947,
    },
    270,
  );
  /** 355 W / 270 = 1.31 (Z6+); 947 W / 270 = 3.5 (sprint massimo). */
  assert.ok(r.low >= 1.25 && r.low <= 1.4, `low: expected ~1.31, got ${r.low}`);
  assert.ok(r.high >= 3.0 && r.high <= 4.0, `high: expected ~3.5, got ${r.high}`);
});

test("fitStepPowerTargetRatios: Easy TrainingPeaks (1132-1158) -> 132-158 W (Z2)", () => {
  const r = fitStepPowerTargetRatios(
    {
      target_type: "power",
      custom_target_value_low: 1132,
      custom_target_value_high: 1158,
    },
    270,
  );
  assert.ok(r.low >= 0.45 && r.low <= 0.55, `low: ${r.low}`);
  assert.ok(r.high >= 0.55 && r.high <= 0.65, `high: ${r.high}`);
});

test("fitStepPowerTargetRatios: % FTP diretta (75-85) -> 0.75-0.85 ratio", () => {
  /** Convention legacy / alcuni export tools: value < 1000 = % FTP. */
  const r = fitStepPowerTargetRatios(
    {
      target_type: "power",
      custom_target_value_low: 75,
      custom_target_value_high: 85,
    },
    270,
  );
  assert.equal(r.low, 0.75);
  assert.equal(r.high, 0.85);
});

test("fitStepPowerTargetRatios: power_zone target_value=2 -> Z2 ratios", () => {
  const r = fitStepPowerTargetRatios(
    {
      target_type: "power_zone",
      target_value: 2,
    },
    270,
  );
  assert.ok(r.low >= 0.5 && r.low <= 0.6, `Z2 low: ${r.low}`);
  assert.ok(r.high >= 0.7 && r.high <= 0.8, `Z2 high: ${r.high}`);
});

test("fitStepPowerTargetRatios: target_type=open / 255 -> ratio neutro", () => {
  const r = fitStepPowerTargetRatios({ target_type: 255, duration_type: "open" }, 270);
  assert.ok(r.low > 0 && r.low < 1);
  assert.ok(r.high > r.low);
});

test("integrazione: workout Timothy TrainingPeaks (10 step ms) -> totale ~70-80 min, NON 195h", () => {
  const stepsTimothyTp: Array<Record<string, unknown>> = [
    { duration_type: "time", duration_value: 600_000, custom_name: "Warm up" },
    { duration_type: "time", duration_value: 20_000, custom_name: "2 giri lanciati" },
    { duration_type: "time", duration_value: 300_000, custom_name: "Easy" },
    { duration_type: "time", duration_value: 600_000, custom_name: "Cool down" },
    { duration_type: "time", duration_value: 65_000, custom_name: "1km fermo" },
    { duration_type: "time", duration_value: 300_000, custom_name: "Easy" },
    { duration_type: "time", duration_value: 600_000, custom_name: "Cool down" },
    { duration_type: "time", duration_value: 15_000, custom_name: "1 giro fermo" },
    { duration_type: "time", duration_value: 300_000, custom_name: "Easy" },
    { duration_type: "time", duration_value: 1_500_000, custom_name: "Cool down" },
  ];
  const scale: FitTimeScale = detectFitTimeScale(stepsTimothyTp);
  assert.equal(scale, "ms");
  const secs = stepsTimothyTp
    .map((s) => fitStepDurationSecForImport(s, 9.5, scale))
    .filter((v): v is number => v != null);
  const totalSec = secs.reduce((a, b) => a + b, 0);
  /** 600+20+300+600+65+300+600+15+300+1500 = 4300 s = 71 min 40 s. */
  assert.equal(totalSec, 4300);
  const totalMin = Math.round(totalSec / 60);
  assert.ok(
    totalMin >= 70 && totalMin <= 80,
    `Atteso 70-80 min, ottenuto ${totalMin} min (bug: era 11747 min)`,
  );
});
