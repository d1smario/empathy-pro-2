import type { MetadataRoute } from "next";
import { PRODUCT_MODULE_NAV } from "@/core/navigation/module-registry";
import { getCanonicalSiteOrigin, isSiteIndexingDisabled } from "@/lib/site-url";

/** Sitemap statico; moduli da registry. Base da `NEXT_PUBLIC_APP_URL` o `VERCEL_URL`. */
export default function sitemap(): MetadataRoute.Sitemap {
  if (isSiteIndexingDisabled()) {
    return [];
  }

  const base = getCanonicalSiteOrigin();
  const now = new Date();

  /** `/preview` è noindex a livello pagina — non in sitemap. */
  const paths = new Set<string>(["/", "/access", "/pricing", "/privacy"]);
  for (const item of PRODUCT_MODULE_NAV) {
    paths.add(item.href);
  }
  paths.add("/training/builder");
  paths.add("/training/calendar");
  paths.add("/training/analytics");
  paths.add("/training/vyria");

  return [...paths].map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : path === "/dashboard" ? 0.9 : 0.7,
  }));
}
