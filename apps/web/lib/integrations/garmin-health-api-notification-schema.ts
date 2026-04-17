/**
 * Riferimento: Garmin Health API 1.2.3 — sez. 4.2 Ping Notification Content, 5.1 Push Notification Content.
 * https://developerportal.garmin.com/sites/default/files/Health_API_1.2.3.pdf
 *
 * Allineamento **Wellness API Prod** (summary GET `/rest/...`): stessi nomi in notifica e in `garmin-wellness-api.ts`.
 * https://apis.garmin.com/wellness-api — documentazione strumenti: https://apis.garmin.com/tools/apiDocs
 *
 * Ping: POST JSON con chiavi = tipi di summary; ogni elemento ha `userId` + `callbackURL` (camelCase) verso wellness-api.
 * Push: stesse chiavi lista; ogni elemento ha `userId` + campi summary inline; opzionale `userAccessToken` per il pull legacy.
 */

/**
 * Chiavi di lista Ping/Push (camelCase / varianti) allineate a Health API + Wellness summary paths
 * (`/rest/activities` → spesso `activities` nel JSON, ecc.).
 */
export const GARMIN_HEALTH_SUMMARY_LIST_KEYS = [
  "dailies",
  "epochs",
  "sleeps",
  "bodyComps",
  "stressDetails",
  "userMetrics",
  "pulseox",
  "pulseOx",
  "allDayRespiration",
  "respiration",
  "healthSnapshot",
  "hrv",
  "bloodPressures",
  "skinTemp",
  "solarIntensity",
  "activities",
  "activityDetails",
  "activityFiles",
  "activityFile",
  "manuallyUpdatedActivities",
  "moveIQ",
  "moveiq",
  "mct",
] as const;

export type GarminHealthSummaryListKey = (typeof GARMIN_HEALTH_SUMMARY_LIST_KEYS)[number];

const LIST_KEY_SET = new Set<string>(GARMIN_HEALTH_SUMMARY_LIST_KEYS);

export function isGarminHealthSummaryListKey(key: string): boolean {
  return LIST_KEY_SET.has(key) || LIST_KEY_SET.has(key.toLowerCase());
}

/** Stream di lista la cui risposta pull / push contiene riepiloghi attività (Wellness summary). */
export function isGarminActivitySummaryStreamKey(key: string): boolean {
  const s = key.toLowerCase();
  return (
    s === "activities" ||
    s === "activitydetails" ||
    s === "activityfiles" ||
    s === "activityfile" ||
    s.includes("manuallyupdated") ||
    s.includes("moveiq") ||
    s === "mct"
  );
}

/**
 * Primo array in radice sotto una chiave stream “attività” (Ping/Push §4.2 / §5.1).
 * Usato per capire se il payload è importabile come workout e per hint materialize.
 */
export function inferGarminActivityStreamKeyFromRoot(parsed: unknown): string | null {
  const root = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  if (!root) return null;
  const preferred = [
    "activities",
    "activityDetails",
    "activityFiles",
    "activityFile",
    "manuallyUpdatedActivities",
    "moveIQ",
    "mct",
  ] as const;
  for (const k of preferred) {
    if (k in root && Array.isArray(root[k])) return k;
    const found = Object.keys(root).find((x) => x.toLowerCase() === k.toLowerCase());
    if (found && Array.isArray(root[found])) return found;
  }
  for (const key of Object.keys(root)) {
    if (!Array.isArray(root[key])) continue;
    if (isGarminActivitySummaryStreamKey(key)) return key;
  }
  return null;
}

/**
 * Decide se il corpo (pull GET o push inline) va mappato su `executed_workouts`.
 * `stream_key` dalla coda ha priorità su `endpoint_kind` (spesso `ping` nel portale).
 */
export function shouldMaterializeGarminActivities(input: {
  streamKey?: string | null;
  endpointKind: string;
  responseBody: unknown;
}): boolean {
  const sk = input.streamKey?.trim();
  if (sk) return isGarminActivitySummaryStreamKey(sk);
  const ek = input.endpointKind.toLowerCase();
  if (ek.includes("activit") || ek.includes("moveiq") || ek.includes("session")) return true;
  if (ek.includes("mct")) return true;
  return inferGarminActivityStreamKeyFromRoot(input.responseBody) != null;
}

/** Primo `userId` API trovato nel payload (depth-first). */
export function extractFirstGarminUserIdDeep(node: unknown): string | null {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const x of node) {
      const id = extractFirstGarminUserIdDeep(x);
      if (id) return id;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const r = node as Record<string, unknown>;
  for (const k of ["userId", "user_id", "userUUID", "userUuid"]) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  for (const v of Object.values(r)) {
    const id = extractFirstGarminUserIdDeep(v);
    if (id) return id;
  }
  return null;
}
