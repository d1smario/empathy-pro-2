const MAX_KCAL_PER_100G = 900;
const MAX_MACRO_PER_100G = 100;

export function isPlausiblePer100gMacros(row: {
  kcal_100: number | null;
  carbs_100: number | null;
  protein_100: number | null;
  fat_100: number | null;
}): boolean {
  const { kcal_100, carbs_100, protein_100, fat_100 } = row;
  if (kcal_100 != null && (!Number.isFinite(kcal_100) || kcal_100 < 0 || kcal_100 > MAX_KCAL_PER_100G)) return false;
  for (const m of [carbs_100, protein_100, fat_100]) {
    if (m != null && (!Number.isFinite(m) || m < 0 || m > MAX_MACRO_PER_100G)) return false;
  }
  return true;
}
