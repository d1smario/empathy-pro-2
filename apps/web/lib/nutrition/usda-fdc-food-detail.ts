/**
 * USDA FoodData Central — dettaglio alimento per fdcId (fonte deterministica macro).
 * @see https://fdc.nal.usda.gov/api-guide.html
 */

export type FdcPer100gMacros = {
  fdcId: number;
  description: string;
  dataType: string | null;
  kcalPer100g: number;
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  sodiumMgPer100g: number | null;
};

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function nutrientRowName(row: Record<string, unknown>): string {
  const nested = row.nutrient as Record<string, unknown> | undefined;
  return String(nested?.name ?? row.nutrientName ?? "").toLowerCase();
}

function nutrientRowAmount(row: Record<string, unknown>): unknown {
  return row.amount ?? row.value;
}

function pickNutrient(
  nutrients: Array<Record<string, unknown>>,
  names: string[],
): number | null {
  const lower = names.map((n) => n.toLowerCase());
  for (const row of nutrients) {
    const nm = nutrientRowName(row);
    if (!nm) continue;
    if (lower.some((target) => nm === target || nm.includes(target))) {
      const v = toNumber(nutrientRowAmount(row));
      if (v != null) return v;
    }
  }
  return null;
}

/** Estrae macro per 100 g da `foodNutrients` (dettaglio FDC o risultati search). */
export function summarizePer100gFromFdcNutrientRows(nutrients: Array<Record<string, unknown>>): {
  kcalPer100g: number | null;
  carbsPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  sodiumMgPer100g: number | null;
} {
  const kcal =
    pickNutrient(nutrients, ["energy", "energy (Atwater General Factors)"]) ??
    pickNutrient(nutrients, ["Energy"]);
  const carbs = pickNutrient(nutrients, ["carbohydrate, by difference", "carbohydrate"]);
  const protein = pickNutrient(nutrients, ["protein"]);
  const fat = pickNutrient(nutrients, ["total lipid (fat)", "lipid"]);
  const sodium = pickNutrient(nutrients, ["sodium, na", "sodium"]);
  return {
    kcalPer100g: kcal != null && kcal >= 0 ? kcal : null,
    carbsPer100g: carbs != null && carbs >= 0 ? carbs : null,
    proteinPer100g: protein != null && protein >= 0 ? protein : null,
    fatPer100g: fat != null && fat >= 0 ? fat : null,
    sodiumMgPer100g: sodium != null && sodium >= 0 ? sodium : null,
  };
}

export async function fetchFdcFoodPer100gMacros(
  apiKey: string,
  fdcId: number,
): Promise<FdcPer100gMacros | { error: string }> {
  if (!Number.isFinite(fdcId) || fdcId < 1) {
    return { error: "fdcId non valido" };
  }
  const url = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { error: `USDA FDC ${res.status}: ${t.slice(0, 120)}` };
  }
  const data = (await res.json()) as Record<string, unknown>;
  const rawNutrients = Array.isArray(data.foodNutrients) ? data.foodNutrients : [];
  const nutrients = rawNutrients as Array<Record<string, unknown>>;
  const s = summarizePer100gFromFdcNutrientRows(nutrients);

  if (s.kcalPer100g == null && s.carbsPer100g == null && s.proteinPer100g == null && s.fatPer100g == null) {
    return { error: "Nessun nutriente per 100 g riconosciuto nella risposta FDC" };
  }

  return {
    fdcId,
    description: String(data.description ?? "Alimento FDC"),
    dataType: data.dataType != null ? String(data.dataType) : null,
    kcalPer100g: Math.max(0, s.kcalPer100g ?? 0),
    carbsPer100g: Math.max(0, s.carbsPer100g ?? 0),
    proteinPer100g: Math.max(0, s.proteinPer100g ?? 0),
    fatPer100g: Math.max(0, s.fatPer100g ?? 0),
    sodiumMgPer100g: s.sodiumMgPer100g,
  };
}

/** `foodNutrients` grezzi per arricchimenti (micronutrienti, ecc.). */
export async function fetchFdcFoodNutrientsRaw(
  apiKey: string,
  fdcId: number,
): Promise<{ foodNutrients: unknown[] } | { error: string }> {
  if (!Number.isFinite(fdcId) || fdcId < 1) {
    return { error: "fdcId non valido" };
  }
  const url = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { error: `USDA FDC ${res.status}: ${t.slice(0, 120)}` };
  }
  const data = (await res.json()) as Record<string, unknown>;
  const rawNutrients = Array.isArray(data.foodNutrients) ? data.foodNutrients : [];
  return { foodNutrients: rawNutrients };
}

export function scaleMacrosFromPer100g(
  per100: Pick<
    FdcPer100gMacros,
    "kcalPer100g" | "carbsPer100g" | "proteinPer100g" | "fatPer100g" | "sodiumMgPer100g"
  >,
  quantityG: number,
): { kcal: number; carbsG: number; proteinG: number; fatG: number; sodiumMg: number | null } {
  const f = quantityG / 100;
  return {
    kcal: Math.round(per100.kcalPer100g * f * 100) / 100,
    carbsG: Math.round(per100.carbsPer100g * f * 100) / 100,
    proteinG: Math.round(per100.proteinPer100g * f * 100) / 100,
    fatG: Math.round(per100.fatPer100g * f * 100) / 100,
    sodiumMg:
      per100.sodiumMgPer100g != null
        ? Math.round(per100.sodiumMgPer100g * f * 100) / 100
        : null,
  };
}
