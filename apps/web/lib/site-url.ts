/**
 * Origine canonica del sito (senza slash finale).
 * Usare per sitemap, metadataBase, Open Graph.
 */
export function getCanonicalSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return "http://localhost:3000";
}

export function getMetadataBaseUrl(): URL | undefined {
  try {
    return new URL(getCanonicalSiteOrigin());
  } catch {
    return undefined;
  }
}

/** Preview/staging: `NEXT_PUBLIC_SITE_INDEX=0` → noindex lato metadata, robots e header. */
export function isSiteIndexingDisabled(): boolean {
  return process.env.NEXT_PUBLIC_SITE_INDEX === "0";
}
