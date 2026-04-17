import { extractFirstGarminUserIdDeep, isGarminHealthSummaryListKey } from "@/lib/integrations/garmin-health-api-notification-schema";

export type GarminPullItem = {
  streamKey: string;
  /** OAuth1 dalla push; `null` se assente (post-migrazione) → pull con Bearer OAuth2 + `garmin_user_id`. */
  userAccessToken: string | null;
  callbackUrl: string;
  /** User ID API Garmin (push / ping) per mappare l’atleta. */
  garminUserId?: string;
  /** Parametri tipici notifica Garmin (tempi finestra, id riepilogo, …) */
  querySnapshot: Record<string, string | number | boolean | null>;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

const TIME_KEYS = [
  "uploadStartTimeInSeconds",
  "uploadEndTimeInSeconds",
  "startTimeInSeconds",
  "endTimeInSeconds",
] as const;

const META_KEYS = [
  ...TIME_KEYS,
  "summaryId",
  "calendarDate",
  "activityId",
  "activityType",
  "fileType",
  "manual",
] as const;

function snapshotFromRecord(rec: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const snap: Record<string, string | number | boolean | null> = {};
  for (const k of META_KEYS) {
    if (!(k in rec)) continue;
    const v = rec[k];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
      snap[k] = v;
    }
  }
  return snap;
}

function readGarminUserId(rec: Record<string, unknown>): string | undefined {
  const v = rec.userId ?? rec.user_id ?? rec.userUUID ?? rec.userUuid;
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

function pushItem(streamKey: string, rec: Record<string, unknown>, sink: GarminPullItem[]): void {
  const tokenRaw = rec.userAccessToken ?? rec.user_access_token;
  const urlCandidate = rec.callbackURL ?? rec.callbackUrl ?? rec.callback_url ?? (rec as { CallbackURL?: unknown }).CallbackURL;
  const urlRaw = typeof urlCandidate === "string" ? urlCandidate : "";
  const url = urlRaw.trim();
  if (!url) return;
  const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";
  const garminUserId = readGarminUserId(rec);
  if (!token && !garminUserId) return;
  sink.push({
    streamKey,
    userAccessToken: token.length ? token : null,
    callbackUrl: url,
    garminUserId,
    querySnapshot: snapshotFromRecord(rec),
  });
}

export function extractRootGarminUserId(parsed: unknown): string | null {
  return extractFirstGarminUserIdDeep(parsed);
}

/**
 * Ping (§4.2): radice `{ dailies|epochs|…: [ { userId, callbackURL } ] }`.
 * Push (§5.1): stesse chiavi ma oggetti summary senza `callbackURL` → nessun elemento pull (solo dati inline).
 */
export function extractGarminPullItems(parsed: unknown, endpointKind: string): GarminPullItem[] {
  const sink: GarminPullItem[] = [];
  const root = asRecord(parsed);
  if (!root) return sink;

  const entries = Object.entries(root).filter(([k, v]) => {
    if (k === "raw" || k === "parse_error" || k === "raw_prefix") return false;
    return Array.isArray(v);
  });
  entries.sort(([a], [b]) => {
    const pa = isGarminHealthSummaryListKey(a) ? 0 : 1;
    const pb = isGarminHealthSummaryListKey(b) ? 0 : 1;
    return pa - pb || a.localeCompare(b);
  });

  for (const [streamKey, value] of entries) {
    const arr = value as unknown[];
    for (const el of arr) {
      const rec = asRecord(el);
      if (rec) pushItem(streamKey, rec, sink);
    }
  }

  if (sink.length === 0) {
    const rec = asRecord(parsed);
    if (rec) pushItem(endpointKind || "unspecified", rec, sink);
  }

  return sink;
}

/**
 * Costruisce URL finale: base callbackURL + parametri tempo richiesti da molte API wellness Garmin.
 */
export function buildGarminPullRequestUrl(item: GarminPullItem): string {
  let u: URL;
  try {
    u = new URL(item.callbackUrl);
  } catch {
    return item.callbackUrl;
  }
  for (const k of TIME_KEYS) {
    const v = item.querySnapshot[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      u.searchParams.set(k, String(Math.trunc(v)));
    }
  }
  return u.toString();
}
