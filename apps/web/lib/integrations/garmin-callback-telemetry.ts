import "server-only";

/** Prefisso UUID per correlazione log senza esporre l’intero id. */
export function garminLogIdPrefix(id: string | undefined | null): string | undefined {
  const t = id?.trim();
  if (!t) return undefined;
  return t.length <= 8 ? t : `${t.slice(0, 8)}…`;
}

export type GarminCallbackTelemetry = {
  step: string;
  athleteIdPrefix?: string;
  reason?: string;
  oauthError?: string;
  queryParamKeys?: string[];
  hasCode?: boolean;
  hasOauthVerifier?: boolean;
  /** Solo messaggio/traccia pubblica (es. HTTP Garmin), mai token/code. */
  detailSnippet?: string;
  garminUserIdPrefix?: string;
};

/**
 * Log una riga JSON su stdout (Vercel Runtime Logs / `vercel logs`).
 * Non passare mai `code`, verifier, cookie, access_token, refresh_token.
 */
export function logGarminCallbackEvent(payload: GarminCallbackTelemetry): void {
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "garmin_oauth_callback",
      ...payload,
    }),
  );
}
