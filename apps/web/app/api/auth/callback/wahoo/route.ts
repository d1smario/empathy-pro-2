import { type NextRequest } from "next/server";
import { GET as wahooIntegrationsCallbackGet } from "@/app/api/integrations/wahoo/callback/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Alias OAuth callback: alcune configurazioni Wahoo usano `/api/auth/callback/wahoo`.
 * Deve coincidere con `WAHOO_OAUTH2_REDIRECT_URI` e con la Callback URL nel portale Wahoo.
 */
export function GET(req: NextRequest) {
  return wahooIntegrationsCallbackGet(req);
}
