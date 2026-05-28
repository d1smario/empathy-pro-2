/**
 * Decoder durata step FIT — helper puri (no server-only) testabili in isolamento.
 *
 * Garmin FIT SDK + TrainingPeaks: `wkt_step.duration_value` per `duration_type=time`
 * e' uint32 con scale=1000 (millisecondi). Alcuni file legacy / parser pre-scaled
 * espongono direttamente secondi.
 *
 * Decisione UNICA per file via `detectFitTimeScale`: heuristic basata su soglia
 * plausibilita' (raw > 8h = quasi certo ms; nessun workout step e' realisticamente
 * > 8h). Risolve il bug "step da 1440' = 24h" su workout TrainingPeaks importati.
 */

export type FitTimeScale = "ms" | "s";

const WKT_STEP_DURATION_BY_NUM: Record<number, string> = {
  0: "time",
  1: "distance",
  2: "hr_less_than",
  3: "hr_greater_than",
  4: "calories",
  5: "open",
  6: "repeat_until_steps_cmplt",
  7: "repeat_until_time",
  8: "repeat_until_distance",
  9: "repeat_until_calories",
  10: "repeat_until_hr_less_than",
  11: "repeat_until_hr_greater_than",
  12: "repeat_until_power_less_than",
  13: "repeat_until_power_greater_than",
  14: "power_less_than",
  15: "power_greater_than",
  16: "training_peaks_tss",
  17: "repeat_until_power_last_lap_less_than",
  18: "repeat_until_max_power_last_lap_less_than",
  19: "power_3s_less_than",
  20: "power_10s_less_than",
  21: "power_30s_less_than",
  22: "power_3s_greater_than",
  23: "power_10s_greater_than",
  24: "power_30s_greater_than",
  25: "power_lap_less_than",
  26: "power_lap_greater_than",
  27: "repeat_until_training_peaks_tss",
  28: "repetition_time",
  29: "reps",
};

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickStepNumber(step: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const k of keys) {
    const n = asNumber(step[k]);
    if (n != null && Number.isFinite(n)) return n;
  }
  return null;
}

export function normalizeFitWktDurationType(step: Record<string, unknown>): string {
  const t = step.duration_type ?? step.durationType;
  if (typeof t === "string") {
    const s = t.toLowerCase().trim().replace(/[\s-]+/g, "_");
    return s || "time";
  }
  if (typeof t === "number" && Number.isFinite(t) && Number.isInteger(t)) {
    return WKT_STEP_DURATION_BY_NUM[t] ?? "time";
  }
  return "time";
}

/**
 * Decisione scala (ms vs s) a livello FILE per i `duration_value` di step time-based.
 *
 * Heuristic robusta:
 *  - Se almeno UN step time/open ha raw > 8h (28800) → tutto il file e' ms.
 *  - Altrimenti → 's' (file legacy/parser pre-scaled o test sintetico).
 *
 * Sicuro: il fallback "s" e' attivo solo se nessuno step ha valore > 8h.
 */
export function detectFitTimeScale(steps: Array<Record<string, unknown>>): FitTimeScale {
  for (const step of steps) {
    const dtype = normalizeFitWktDurationType(step);
    if (
      dtype !== "time" &&
      dtype !== "repeat_until_time" &&
      dtype !== "repetition_time" &&
      dtype !== "open"
    )
      continue;
    const raw = pickStepNumber(step, ["duration_value", "durationValue", "duration_time", "durationTime"]);
    if (raw == null || !Number.isFinite(raw)) continue;
    if (raw > 8 * 3600) return "ms";
  }
  return "s";
}

export function rawTimeToSec(raw: number, scale: FitTimeScale): number {
  if (scale === "ms") return Math.round(raw / 1000);
  return Math.round(raw);
}

/**
 * Secondi per un blocco grafico. `null` = step da non materializzare (contenitori / open senza valore).
 */
export function fitStepDurationSecForImport(
  step: Record<string, unknown>,
  mps: number,
  timeScale: FitTimeScale,
): number | null {
  const dtype = normalizeFitWktDurationType(step);
  const raw = pickStepNumber(step, ["duration_value", "durationValue", "duration_time", "durationTime"]);

  if (dtype === "repeat_until_steps_cmplt") return null;

  if (dtype === "open") {
    const v = raw ?? 0;
    if (!Number.isFinite(v) || v <= 0) return null;
    return Math.min(Math.max(1, rawTimeToSec(v, timeScale)), 24 * 3600);
  }

  if (dtype === "reps") return null;

  if (dtype === "distance" || dtype === "repeat_until_distance") {
    /** Garmin SDK: distance in metri × 100 (centimetri) per workout_step. Heuristic:
     *  raw > 100_000 (= 1000 m al 1× scale) → probabile cm (× 100), altrimenti metri. */
    const rawN = Math.max(0, Math.round(raw ?? 0));
    if (rawN <= 0) return null;
    const meters = rawN > 100_000 ? rawN / 100 : rawN;
    return Math.max(45, Math.round(meters / Math.max(0.7, mps)));
  }

  if (dtype === "training_peaks_tss" || dtype === "repeat_until_training_peaks_tss") {
    const tss = Math.max(1, Math.round(raw ?? 1));
    const ifAssumed = 0.72;
    const hours = tss / (ifAssumed * ifAssumed * 100);
    return Math.max(300, Math.min(8 * 3600, Math.round(hours * 3600)));
  }

  if (dtype === "calories" || dtype === "repeat_until_calories") {
    const kcal = Math.max(1, Math.round(raw ?? 1));
    return Math.max(120, Math.min(8 * 3600, Math.round((kcal / 650) * 3600)));
  }

  if (dtype === "time" || dtype === "repeat_until_time" || dtype === "repetition_time") {
    if (raw == null) return Math.max(1, Math.min(120, 24 * 3600));
    const sec = rawTimeToSec(raw, timeScale);
    return Math.max(1, Math.min(sec, 24 * 3600));
  }

  if (
    dtype === "hr_less_than" ||
    dtype === "hr_greater_than" ||
    dtype.startsWith("power_") ||
    dtype.startsWith("repeat_until_hr_") ||
    dtype.startsWith("repeat_until_power_")
  ) {
    return null;
  }

  /** Fallback: tipo non noto. Tratta come time con la stessa scala del file. */
  const v0 = raw ?? 120;
  const sec = rawTimeToSec(v0, timeScale);
  return Math.max(1, Math.min(sec, 24 * 3600));
}

export function fitStepDurationSecLegacy(step: Record<string, unknown>, timeScale: FitTimeScale): number {
  const raw =
    pickStepNumber(step, ["duration_value", "durationValue", "duration_time", "durationTime", "duration"]) ?? 120;
  const v = Math.max(1, rawTimeToSec(raw, timeScale));
  return Math.min(v, 48 * 3600);
}

function clampNum(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

const WKT_STEP_TARGET_BY_NUM: Record<number, string> = {
  0: "speed",
  1: "heart_rate",
  2: "open",
  3: "cadence",
  4: "power",
  5: "grade",
  6: "resistance",
  7: "power_3s",
  8: "power_10s",
  9: "power_30s",
  10: "power_lap",
  11: "swim_stroke",
  12: "speed_lap",
  13: "heart_rate_lap",
};

export function normalizeFitWktTargetType(step: Record<string, unknown>): string {
  const t = step.target_type ?? step.targetType;
  if (typeof t === "string") return t.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (typeof t === "number" && Number.isFinite(t) && Number.isInteger(t)) {
    return WKT_STEP_TARGET_BY_NUM[t] ?? "open";
  }
  return "open";
}

/**
 * Mappa Garmin/TP `power_zone` index (target_value 1..7) → ratio FTP centrale.
 * Garmin Connect zone reference: Z1 ≤55%, Z2 56-75%, Z3 76-90%, Z4 91-105%,
 * Z5 106-120%, Z6 121-150%, Z7 >150%. Centrale di ogni zona.
 */
function powerZoneIndexToRatio(zoneIdx: number): { low: number; high: number } | null {
  const zones: Array<[number, number]> = [
    [0.4, 0.55], // Z1
    [0.56, 0.75], // Z2
    [0.76, 0.9], // Z3
    [0.91, 1.05], // Z4
    [1.06, 1.2], // Z5
    [1.21, 1.5], // Z6
    [1.51, 1.8], // Z7
  ];
  if (!Number.isFinite(zoneIdx)) return null;
  const idx = Math.round(zoneIdx) - 1;
  if (idx < 0 || idx >= zones.length) return null;
  const [lo, hi] = zones[idx]!;
  return { low: lo, high: hi };
}

/**
 * Decoder target di potenza per workout step FIT (Garmin/TrainingPeaks/Wahoo).
 *
 * Convention Garmin FIT SDK ufficiale per `custom_target_value_low/high` con `target_type=power`:
 *  - value 0..999  → **percentuale FTP** (es. 75 = 75% FTP, ratio 0.75)
 *  - value 1000+   → **watt assoluti**, formula: `watts = value − 1000` (es. 1105 = 105 W)
 *
 * Esempi reali da TrainingPeaks (file Timothy 29-05-2026):
 *   custom_target_value_low=1105, high=1132 (Warm up) → 105–132 W (NON Z7 311–346 W).
 *   custom_target_value_low=1355, high=1947 (sprint) → 355–947 W.
 *
 * Per `target_type=power_zone` con `target_value=N` (1..7): mappiamo al ratio
 * tipico della zona Garmin Connect.
 */
export function fitStepPowerTargetRatios(
  step: Record<string, unknown>,
  ftpW: number,
): { low: number; high: number } {
  const targetType = normalizeFitWktTargetType(step);
  const lowRaw = pickStepNumber(step, [
    "custom_target_value_low",
    "customTargetValueLow",
    "custom_target_power_low",
    "target_value_low",
    "power_low",
  ]);
  const highRaw = pickStepNumber(step, [
    "custom_target_value_high",
    "customTargetValueHigh",
    "custom_target_power_high",
    "target_value_high",
    "power_high",
  ]);
  const mid = pickStepNumber(step, ["target_value", "targetValue", "power", "intensity"]);

  /** Garmin SDK convention per power: value < 1000 → % FTP, >= 1000 → watt assoluti (value-1000). */
  const decodePowerRaw = (raw: number): number | null => {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    if (raw >= 1000 && raw <= 5000) return clampNum((raw - 1000) / Math.max(1, ftpW), 0.2, 4.0);
    if (raw < 1000 && raw >= 30) return clampNum(raw / 100, 0.2, 2.5);
    /** Caso speciale legacy "% FTP × 10000": se 2000..15000 e NON in range power-bias plausibile. */
    if (raw >= 2000 && raw <= 15000 && (raw % 100 !== 0 || raw > 5000))
      return clampNum(raw / 10000, 0.2, 2.5);
    /** Fallback: watt assoluti senza bias (es. parser custom). */
    if (raw > 0 && raw <= 1500) return clampNum(raw / Math.max(1, ftpW), 0.2, 4.0);
    return null;
  };

  if (targetType === "power" || targetType === "power_3s" || targetType === "power_10s" || targetType === "power_30s" || targetType === "power_lap") {
    if (lowRaw != null && highRaw != null) {
      const lo = decodePowerRaw(lowRaw);
      const hi = decodePowerRaw(highRaw);
      if (lo != null && hi != null) return { low: Math.min(lo, hi), high: Math.max(lo, hi) };
    }
    if (mid != null) {
      const m = decodePowerRaw(mid);
      if (m != null) return { low: m, high: m };
    }
  }

  if (targetType === "power_zone") {
    const zone = mid != null ? powerZoneIndexToRatio(mid) : null;
    if (zone) return zone;
  }

  if (targetType === "heart_rate" || targetType === "heart_rate_lap") {
    /** HR target: ratio neutro ~Z2 (non controlla power). UI usa zone HR separate dove disponibili. */
    return { low: 0.6, high: 0.7 };
  }

  /** target_type = open / 255 / cadence / speed / grade / resistance: nessun watt target diretto. */
  return { low: 0.6, high: 0.7 };
}
