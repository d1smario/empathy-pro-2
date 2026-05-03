import "server-only";

import { exchangeWahooRefreshToken } from "@/lib/integrations/wahoo-oauth2-api";
import { readVendorOauthTokens } from "@/lib/integrations/vendor-oauth-read";
import { updateVendorOauthTokens } from "@/lib/integrations/vendor-oauth-persist";

export async function ensureWahooAccessToken(athleteId: string): Promise<string> {
  let row = await readVendorOauthTokens(athleteId, "wahoo");
  if (!row) throw new Error("Wahoo non collegato per questo atleta (vendor_oauth_links).");

  const now = Date.now();
  const expMs = row.expiresAt?.getTime() ?? 0;
  const expiringSoon = expMs > 0 && expMs < now + 5 * 60 * 1000;
  if (row.refreshToken && expiringSoon) {
    const tok = await exchangeWahooRefreshToken(row.refreshToken);
    if ("error" in tok) throw new Error(tok.error);
    const expiresAt =
      tok.expires_in != null && Number.isFinite(tok.expires_in)
        ? new Date(Date.now() + Math.max(0, tok.expires_in) * 1000)
        : null;
    const upd = await updateVendorOauthTokens({
      athleteId,
      vendor: "wahoo",
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token ?? row.refreshToken,
      expiresAt,
    });
    if (!upd.ok) throw new Error(upd.error);
    row = {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token ?? row.refreshToken,
      expiresAt,
    };
  }

  return row.accessToken;
}
