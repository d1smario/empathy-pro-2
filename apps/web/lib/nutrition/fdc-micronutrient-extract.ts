/**
 * Estrae e classifica micronutrienti dalla risposta USDA FDC `foodNutrients`
 * (solo interpretazione / reportistica, non decisioni cliniche).
 */

export type FdcMicroBucket = "vitamins" | "minerals" | "aminoAcids" | "fattyAcids";

export type FdcMicroPer100g = {
  nutrientId: number;
  name: string;
  amountPer100g: number;
  unit: string;
};

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function nutrientMeta(row: Record<string, unknown>): { id: number; name: string; unit: string } | null {
  const nested = row.nutrient as Record<string, unknown> | undefined;
  const idRaw = nested?.id ?? row.nutrientId;
  const id = typeof idRaw === "number" && Number.isFinite(idRaw) ? idRaw : Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) return null;
  const name = String(nested?.name ?? row.nutrientName ?? "").trim();
  if (!name) return null;
  const unit = String(nested?.unitName ?? row.unitName ?? "").trim() || "—";
  return { id, name, unit };
}

function amountForRow(row: Record<string, unknown>): number | null {
  return toNumber(row.amount ?? row.value);
}

const SKIP_NAME_FRAGMENTS = [
  "energy",
  "protein",
  "total lipid",
  "carbohydrate, by difference",
  "carbohydrate",
  "fiber, total dietary",
  "sugars, total including",
  "sugars, total",
  "starch",
  "water",
  "ash",
  "alcohol",
  "caffeine",
  "theobromine",
];

function shouldSkipName(lower: string): boolean {
  return SKIP_NAME_FRAGMENTS.some((f) => lower.includes(f));
}

/** Classifica per bucket (ordine: grassi → amino → vitamine → minerali). */
export function bucketForFdcNutrientName(name: string): FdcMicroBucket | null {
  const L = name.toLowerCase();
  if (shouldSkipName(L)) return null;
  if (L.includes("sodium") && (L.includes("na") || L === "sodium, na")) return null;

  if (
    /fatty acid|cholesterol|phytosterol|trans fat|trans-monoenoic|trans-polyenoic|omega|linole|linolen|arachidonic|epa|dha\b|elaidic|erucic| nervonic|^\d+:\d+/.test(
      L,
    ) ||
    L.includes("cis-") ||
    L.includes("octadecenoic") ||
    L.includes("eicosapentaenoic") ||
    L.includes("docosahexaenoic") ||
    L.includes("docosapentaenoic")
  ) {
    return "fattyAcids";
  }

  const aminoHints = [
    "tryptophan",
    "threonine",
    "isoleucine",
    "leucine",
    "lysine",
    "methionine",
    "cystine",
    "cysteine",
    "phenylalanine",
    "tyrosine",
    "valine",
    "arginine",
    "histidine",
    "alanine",
    "aspartic acid",
    "glutamic acid",
    "glycine",
    "proline",
    "serine",
    "hydroxyproline",
    "taurine",
    "asparagine",
    "glutamine",
  ];
  if (aminoHints.some((a) => L.includes(a))) return "aminoAcids";

  if (
    /vitamin|thiamin|riboflavin|niacin|folate|folic acid|choline|pantothenic|biotin|carotene|retinol|cryptoxanthin|lutein|zeaxanthin|lycopene/.test(
      L,
    )
  ) {
    return "vitamins";
  }

  const mineralHints = [
    "calcium",
    "iron",
    "magnesium",
    "phosphorus",
    "phosphorous",
    "potassium",
    "zinc",
    "copper",
    "selenium",
    "manganese",
    "iodine",
    "chromium",
    "molybdenum",
    "fluoride",
    "chloride",
  ];
  if (mineralHints.some((m) => L.includes(m))) return "minerals";

  return null;
}

export function extractMicroNutrientsPer100g(foodNutrients: unknown): FdcMicroPer100g[] {
  if (!Array.isArray(foodNutrients)) return [];
  const out: FdcMicroPer100g[] = [];
  for (const raw of foodNutrients) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const meta = nutrientMeta(row);
    if (!meta) continue;
    const amt = amountForRow(row);
    if (amt == null || amt < 0) continue;
    if (!bucketForFdcNutrientName(meta.name)) continue;
    out.push({
      nutrientId: meta.id,
      name: meta.name,
      amountPer100g: amt,
      unit: meta.unit,
    });
  }
  return out;
}

export type MicroTotalLine = { nutrientId: number; name: string; unit: string; total: number; bucket: FdcMicroBucket };

export function scaleAndMergeMicros(
  per100: FdcMicroPer100g[],
  quantityG: number,
  acc: Map<number, MicroTotalLine>,
): void {
  const f = quantityG / 100;
  if (!Number.isFinite(f) || f <= 0) return;
  for (const row of per100) {
    const b = bucketForFdcNutrientName(row.name);
    if (!b) continue;
    const add = row.amountPer100g * f;
    const prev = acc.get(row.nutrientId);
    if (!prev) {
      acc.set(row.nutrientId, { nutrientId: row.nutrientId, name: row.name, unit: row.unit, total: add, bucket: b });
    } else {
      if (prev.unit === row.unit) prev.total += add;
    }
  }
}

export function bucketLines(lines: Iterable<MicroTotalLine>): Record<FdcMicroBucket, MicroTotalLine[]> {
  const empty = (): MicroTotalLine[] => [];
  const res: Record<FdcMicroBucket, MicroTotalLine[]> = {
    vitamins: empty(),
    minerals: empty(),
    aminoAcids: empty(),
    fattyAcids: empty(),
  };
  for (const L of lines) {
    res[L.bucket].push(L);
  }
  const sortFn = (a: MicroTotalLine, b: MicroTotalLine) => a.name.localeCompare(b.name, "it");
  res.vitamins.sort(sortFn);
  res.minerals.sort(sortFn);
  res.aminoAcids.sort(sortFn);
  res.fattyAcids.sort(sortFn);
  return res;
}
