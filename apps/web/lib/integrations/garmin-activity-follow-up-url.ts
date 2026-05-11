/**
 * Costruzione URL follow-up Garmin (token + finestra upload) — senza `server-only`
 * così i test `tsx --test` possono importare le pure function.
 */

export function extractGarminPullTokenFromCallbackUrl(callbackUrl: string): string | null {
  try {
    const u = new URL(callbackUrl);
    return u.searchParams.get("token")?.trim() || null;
  } catch {
    return null;
  }
}

export function readUploadWindowFromCallbackUrl(callbackUrl: string): { start: number; end: number } | null {
  try {
    const u = new URL(callbackUrl);
    const a = u.searchParams.get("uploadStartTimeInSeconds");
    const b = u.searchParams.get("uploadEndTimeInSeconds");
    if (!a || !b) return null;
    const sa = Number(a);
    const sb = Number(b);
    if (!Number.isFinite(sa) || !Number.isFinite(sb) || sb <= sa) return null;
    return { start: sa, end: sb };
  } catch {
    return null;
  }
}
