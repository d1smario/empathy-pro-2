import type { NextRequest } from "next/server";

/** Base URL pubblica per redirect post-OAuth (preferire NEXT_PUBLIC_APP_URL in prod). */
export function resolveGarminAppBaseUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = (req.headers.get("x-forwarded-proto") ?? "https").split(",")[0]!.trim();
  if (host) return `${proto}://${host}`;
  return "http://localhost:3020";
}
