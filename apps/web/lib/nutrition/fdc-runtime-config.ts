/** True when live USDA import/discovery must be disabled (production after bulk import). */
export function isFdcCacheOnly(): boolean {
  const v = (process.env.FDC_CACHE_ONLY ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
