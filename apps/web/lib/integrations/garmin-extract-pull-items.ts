export type GarminPullItem = {
  streamKey: string;
  userAccessToken: string;
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
  const urlRaw = rec.callbackURL ?? rec.callbackUrl ?? rec.callback_url;
  if (typeof tokenRaw !== "string" || typeof urlRaw !== "string") return;
  const token = tokenRaw.trim();
  const url = urlRaw.trim();
  if (!token || !url) return;
  const garminUserId = readGarminUserId(rec);
  sink.push({
    streamKey,
    userAccessToken: token,
    callbackUrl: url,
    garminUserId,
    querySnapshot: snapshotFromRecord(rec),
  });
}

/**
 * Estrae voci pull dalla JSON tipica della push Garmin (array per stream: dailies, activities, …).
 */
export function extractRootGarminUserId(parsed: unknown): string | null {
  const root = asRecord(parsed);
  if (!root) return null;
  for (const k of ["userId", "user_id", "userUUID", "userUuid"]) {
    const v = root[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function extractGarminPullItems(parsed: unknown, endpointKind: string): GarminPullItem[] {
  const sink: GarminPullItem[] = [];
  const root = asRecord(parsed);
  if (!root) return sink;

  for (const [streamKey, value] of Object.entries(root)) {
    if (streamKey === "raw" || streamKey === "parse_error" || streamKey === "raw_prefix") continue;
    if (!Array.isArray(value)) continue;
    for (const el of value) {
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
