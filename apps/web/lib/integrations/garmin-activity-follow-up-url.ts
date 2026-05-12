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

/**
 * Scorre il JSON push (anche nested): prima stringa che è URL `*.garmin.com` con query `token=`.
 * Serve quando §5.1 inline non crea `garmin_pull_items` ma il `token` è comunque nel payload.
 */
export function scanJsonForGarminPullToken(node: unknown): string | null {
  const seen = new WeakSet<object>();
  const walk = (n: unknown): string | null => {
    if (n === null || n === undefined) return null;
    if (typeof n === "string") {
      const s = n.trim();
      if (!s.includes("token") || s.length < 16) return null;
      try {
        const u = new URL(s);
        if (!u.hostname.toLowerCase().endsWith("garmin.com")) return null;
        const t = u.searchParams.get("token")?.trim();
        if (t) return t;
      } catch {
        return null;
      }
      return null;
    }
    if (typeof n !== "object") return null;
    if (seen.has(n as object)) return null;
    seen.add(n as object);
    if (Array.isArray(n)) {
      for (const x of n) {
        const t = walk(x);
        if (t) return t;
      }
      return null;
    }
    for (const v of Object.values(n as Record<string, unknown>)) {
      const t = walk(v);
      if (t) return t;
    }
    return null;
  };
  return walk(node);
}

/** Primo `userAccessToken` / `user_access_token` nested (OAuth1 body push). */
export function scanJsonForGarminActivityUserAccessToken(node: unknown): string | null {
  const seen = new WeakSet<object>();
  const walk = (n: unknown): string | null => {
    if (n === null || n === undefined) return null;
    if (typeof n !== "object") return null;
    if (seen.has(n as object)) return null;
    seen.add(n as object);
    if (Array.isArray(n)) {
      for (const x of n) {
        const t = walk(x);
        if (t) return t;
      }
      return null;
    }
    const o = n as Record<string, unknown>;
    const direct = o.userAccessToken ?? o.user_access_token;
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    for (const v of Object.values(o)) {
      const t = walk(v);
      if (t) return t;
    }
    return null;
  };
  return walk(node);
}
