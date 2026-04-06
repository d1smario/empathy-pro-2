import { summarizeSignalPresence } from "@/lib/data-sufficiency/coverage";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickNumber(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value != null) return value;
  }
  return null;
}

function collectCandidateRecords(payload: Record<string, unknown> | null): Array<Record<string, unknown>> {
  if (!payload) return [];
  const directChildren = Object.values(payload)
    .map((value) => asRecord(value))
    .filter((value): value is Record<string, unknown> => value != null);
  return [payload, ...directChildren];
}

export type NutritionDeviceSignal = {
  calories?: number | null;
  carbsG?: number | null;
  proteinsG?: number | null;
  fatsG?: number | null;
  hydrationMl?: number | null;
};

export function extractNutritionDeviceSignal(payload: Record<string, unknown> | null): NutritionDeviceSignal {
  const records = collectCandidateRecords(payload);
  const merged: NutritionDeviceSignal = {};

  for (const record of records) {
    merged.calories ??= pickNumber(record, ["calories", "kcal", "energy_kcal", "energy", "total_calories"]);
    merged.carbsG ??= pickNumber(record, ["carbs_g", "carbohydrates_g", "carbs", "carbohydrates"]);
    merged.proteinsG ??= pickNumber(record, ["proteins_g", "protein_g", "proteins", "protein"]);
    merged.fatsG ??= pickNumber(record, ["fats_g", "fat_g", "fats", "fat"]);
    merged.hydrationMl ??= pickNumber(record, ["hydration_ml", "water_ml", "fluids_ml", "total_water_ml"]);
  }

  return merged;
}

export function buildNutritionDeviceCanonicalPreview(payload: Record<string, unknown>) {
  const signal = extractNutritionDeviceSignal(payload);
  return {
    payload_keys: Object.keys(payload),
    calories: signal.calories ?? null,
    carbs_g: signal.carbsG ?? null,
    proteins_g: signal.proteinsG ?? null,
    fats_g: signal.fatsG ?? null,
    hydration_ml: signal.hydrationMl ?? null,
  };
}

export function buildNutritionDeviceCoverage(payload: Record<string, unknown>) {
  const signal = extractNutritionDeviceSignal(payload);
  const summarized = summarizeSignalPresence([
    { key: "calories", present: signal.calories != null, recommendedInput: "calories_kcal" },
    { key: "carbs", present: signal.carbsG != null, recommendedInput: "carbohydrates_g" },
    { key: "proteins", present: signal.proteinsG != null, recommendedInput: "proteins_g" },
    { key: "fats", present: signal.fatsG != null, recommendedInput: "fats_g" },
    { key: "hydration", present: signal.hydrationMl != null, recommendedInput: "hydration_ml" },
  ]);

  return {
    signal,
    channelCoverage: {
      calories: signal.calories != null ? 100 : 0,
      carbs: signal.carbsG != null ? 100 : 0,
      proteins: signal.proteinsG != null ? 100 : 0,
      fats: signal.fatsG != null ? 100 : 0,
      hydration: signal.hydrationMl != null ? 100 : 0,
    },
    missingChannels: summarized.missingSignals,
    recommendedInputs: summarized.recommendedInputs,
    coveragePct: summarized.coveragePct,
    inputUncertaintyPct: summarized.inputUncertaintyPct,
  };
}
