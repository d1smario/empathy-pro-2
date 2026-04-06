import type { MetadataRoute } from "next";
import { getCanonicalSiteOrigin, isSiteIndexingDisabled } from "@/lib/site-url";

/** Produzione: allow `/`. Preview: `NEXT_PUBLIC_SITE_INDEX=0` → disallow tutto. */
export default function robots(): MetadataRoute.Robots {
  const host = getCanonicalSiteOrigin();

  if (isSiteIndexingDisabled()) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${host}/sitemap.xml`,
  };
}
