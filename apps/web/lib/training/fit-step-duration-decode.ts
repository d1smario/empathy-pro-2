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
