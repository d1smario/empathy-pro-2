import type { NextRequest } from "next/server";

/**
 * True se la richiesta è probabile navigazione top-level (click su link), non fetch/XHR.
 */
export function isGarminOAuthBrowserNavigation(req: NextRequest): boolean {
  const dest = req.headers.get("sec-fetch-dest");
  if (dest === "document") return true;
  const mode = req.headers.get("sec-fetch-mode");
  if (mode === "navigate") return true;
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("text/html");
}
