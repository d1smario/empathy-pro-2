import type { AthleteHealthMemory } from "@/lib/empathy/schemas/memory";

export function asLabNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeLabKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function resolveBloodValuesFromHealth(
  health: AthleteHealthMemory | null | undefined,
): Record<string, unknown> | null {
  if (!health) return null;
  if (health.blood && typeof health.blood === "object" && !Array.isArray(health.blood)) {
    return health.blood as Record<string, unknown>;
  }
  for (const panel of health.panels ?? []) {
    if (String(panel.type ?? "").toLowerCase() !== "blood") continue;
    const values = panel.values;
    if (values && typeof values === "object" && !Array.isArray(values)) {
      return values as Record<string, unknown>;
    }
  }
  return null;
}

export function readLabMarkerValue(
  blood: Record<string, unknown> | null | undefined,
  aliases: readonly string[],
  options?: { excludeHbA1c?: boolean },
): { value: number; sourceKey: string } | null {
  if (!blood) return null;
  for (const [rawKey, rawVal] of Object.entries(blood)) {
    const nk = normalizeLabKey(rawKey);
    if (options?.excludeHbA1c && (nk === "hba1c" || nk.startsWith("hba_"))) continue;
    const matched = aliases.some((alias) => {
      if (nk === alias) return true;
      if (alias.length >= 4 && nk.includes(alias)) return true;
      return false;
    });
    if (!matched) continue;
    const value = asLabNumeric(rawVal);
    if (value == null) continue;
    return { value, sourceKey: rawKey };
  }
  return null;
}

/** Glucosio a digiuno in mmol/L — chiavi condivise ingest Health + bioenergetics. */
export function readFastingGlucoseMmolL(values: Record<string, unknown> | null | undefined): number | null {
  if (!values) return null;
  const direct =
    asLabNumeric(values.glucose_mmol_l) ??
    asLabNumeric(values.glucose_mmol) ??
    asLabNumeric(values.fasting_glucose_mmol) ??
    asLabNumeric(values.glicemia_mmol);
  if (direct != null && direct > 0 && direct < 35) return Math.round(direct * 100) / 100;

  const mgDl =
    readLabMarkerValue(values, ["glicemia", "glucose", "fasting_glucose", "glucosio"])?.value ??
    asLabNumeric(values.glucose_mg_dl) ??
    asLabNumeric(values.glicemia);
  if (mgDl != null && mgDl > 20 && mgDl < 600) return Math.round((mgDl / 18) * 100) / 100;
  return null;
}
