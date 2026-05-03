import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { VendorOauthVendor } from "@/lib/integrations/vendor-oauth-persist";

export type VendorOauthTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
};

/** Lettura token OAuth vendor (solo service role: tabella senza policy utente). */
export async function readVendorOauthTokens(
  athleteId: string,
  vendor: VendorOauthVendor,
): Promise<VendorOauthTokens | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY richiesta per leggere i token OAuth vendor (WHOOP / Wahoo / Strava).");
  }
  const { data, error } = await admin
    .from("vendor_oauth_links")
    .select("oauth_access_token, oauth_refresh_token, token_expires_at")
    .eq("athlete_id", athleteId)
    .eq("vendor", vendor)
    .maybeSingle();

  if (error || !data) return null;
  const at = data.oauth_access_token;
  if (typeof at !== "string" || !at.trim()) return null;
  const expRaw = data.token_expires_at;
  return {
    accessToken: at.trim(),
    refreshToken: typeof data.oauth_refresh_token === "string" ? data.oauth_refresh_token : null,
    expiresAt: expRaw ? new Date(String(expRaw)) : null,
  };
}
