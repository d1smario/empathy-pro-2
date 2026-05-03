import { type NextRequest } from "next/server";
import { GET as stravaIntegrationsCallbackGet } from "@/app/api/integrations/strava/callback/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Alias se `STRAVA_OAUTH2_REDIRECT_URI` punta a `/api/auth/callback/strava`. */
export function GET(req: NextRequest) {
  return stravaIntegrationsCallbackGet(req);
}
