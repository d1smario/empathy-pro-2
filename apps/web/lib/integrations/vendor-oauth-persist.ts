import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type VendorOauthVendor = "whoop" | "wahoo" | "strava";

export async function upsertVendorOauthLink(input: {
  athleteId: string;
  vendor: VendorOauthVendor;
  externalUserId?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date | null;
  scope?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY o URL mancanti: impossibile salvare il collegamento OAuth." };
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("vendor_oauth_links").upsert(
    {
      athlete_id: input.athleteId,
      vendor: input.vendor,
      external_user_id: input.externalUserId ?? null,
      oauth_access_token: input.accessToken,
      oauth_refresh_token: input.refreshToken ?? null,
      token_expires_at: input.expiresAt?.toISOString() ?? null,
      scope: input.scope ?? null,
      updated_at: now,
    },
    { onConflict: "athlete_id,vendor" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateVendorOauthTokens(input: {
  athleteId: string;
  vendor: VendorOauthVendor;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY o URL mancanti." };
  }
  const patch: Record<string, unknown> = {
    oauth_access_token: input.accessToken,
    token_expires_at: input.expiresAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.refreshToken !== undefined) {
    patch.oauth_refresh_token = input.refreshToken;
  }
  const { error } = await admin.from("vendor_oauth_links").update(patch).eq("athlete_id", input.athleteId).eq("vendor", input.vendor);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
