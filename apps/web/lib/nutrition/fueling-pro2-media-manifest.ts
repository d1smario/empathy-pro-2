import { buildFuelingMediaKeyCandidates, type FuelingCategory, type FuelingProduct } from "@/lib/nutrition/fueling-product-catalog";

/**
 * Mappa statica opzionale: chiavi = output di `buildFuelingProductKey` / `buildFuelingBrandCategoryKey` / categoria.
 * Valori = path pubblici (es. `/assets/empathy/fueling/enervit__isocarb_c2_1pro.png`).
 * Lasciare vuoto finché non aggiungi asset in `public/`.
 */
export const FUELING_PRO2_MEDIA_MANIFEST: Record<string, string> = {
  // Esempio (decommenta e aggiungi file in public/):
  // enervit__isocarb_c2_1pro: "/assets/empathy/fueling/enervit-isocarb.png",
  // enervit_recovery: "/assets/empathy/fueling/enervit-recovery.png",
};

export function resolveFuelingPro2MediaUrlFromCandidates(keys: string[]): string | null {
  for (const key of keys) {
    const url = FUELING_PRO2_MEDIA_MANIFEST[key];
    if (typeof url === "string" && url.trim() !== "") return url.trim();
  }
  return null;
}

export function resolveFuelingPro2MediaUrlForProduct(
  product: FuelingProduct | undefined,
  category: FuelingCategory,
): string | null {
  return resolveFuelingPro2MediaUrlFromCandidates(buildFuelingMediaKeyCandidates(product, category));
}
