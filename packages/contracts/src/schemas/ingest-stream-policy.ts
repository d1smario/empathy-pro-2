import type { RealityProvider } from "./reality";

/** Provider per cui esistono stream configurabili nel Pro 2 (estendibile). */
export type IngestPolicyProvider = Extract<
  RealityProvider,
  | "whoop"
  | "wahoo"
  | "garmin"
  | "garmin_connectiq"
  | "polar"
  | "strava"
  | "suunto"
  | "hammerhead"
  | "coros"
  | "oura"
  | "cgm"
>;

export const INGEST_POLICY_PROVIDERS = [
  "whoop",
  "wahoo",
  "garmin",
  "garmin_connectiq",
  "polar",
  "strava",
  "suunto",
  "hammerhead",
  "coros",
  "oura",
  "cgm",
] as const satisfies readonly IngestPolicyProvider[];

const policyProviderSet = new Set<string>(INGEST_POLICY_PROVIDERS);

export function isIngestPolicyProvider(value: string): value is IngestPolicyProvider {
  return policyProviderSet.has(value);
}

/** Chiavi stream stabili (WHOOP). */
export const WHOOP_INGEST_STREAM_KEYS = ["whoop_sleep", "whoop_recovery", "whoop_workout"] as const;
export type WhoopIngestStreamKey = (typeof WHOOP_INGEST_STREAM_KEYS)[number];

/** Chiavi stream stabili (Wahoo). */
export const WAHOO_INGEST_STREAM_KEYS = ["wahoo_workout"] as const;
export type WahooIngestStreamKey = (typeof WAHOO_INGEST_STREAM_KEYS)[number];

/** Chiavi stream Garmin (materialize / API summary). */
export const GARMIN_INGEST_STREAM_KEYS = ["garmin_activity_summary"] as const;
export type GarminIngestStreamKey = (typeof GARMIN_INGEST_STREAM_KEYS)[number];

/** Chiavi stream Polar AccessLink (exercises / sleep / nightly-recharge). */
export const POLAR_INGEST_STREAM_KEYS = ["polar_exercise", "polar_sleep", "polar_recharge"] as const;
export type PolarIngestStreamKey = (typeof POLAR_INGEST_STREAM_KEYS)[number];

/** Chiavi stream Suunto (workouts via /v2/workouts). */
export const SUUNTO_INGEST_STREAM_KEYS = ["suunto_workout"] as const;
export type SuuntoIngestStreamKey = (typeof SUUNTO_INGEST_STREAM_KEYS)[number];

/** Chiavi stream Hammerhead Karoo (activities). */
export const KAROO_INGEST_STREAM_KEYS = ["karoo_activity"] as const;
export type KarooIngestStreamKey = (typeof KAROO_INGEST_STREAM_KEYS)[number];

/** Default conservativi: WHOOP workout off (evita doppione se il training arriva da altro device). */
export const DEFAULT_WHOOP_INGEST_STREAMS: Record<WhoopIngestStreamKey, boolean> = {
  whoop_sleep: true,
  whoop_recovery: true,
  whoop_workout: false,
};

export const DEFAULT_WAHOO_INGEST_STREAMS: Record<WahooIngestStreamKey, boolean> = {
  wahoo_workout: false,
};

export const DEFAULT_GARMIN_INGEST_STREAMS: Record<GarminIngestStreamKey, boolean> = {
  garmin_activity_summary: true,
};

/** Default conservativi Polar: wellness on, exercise off (evita doppione training se primario è altro device). */
export const DEFAULT_POLAR_INGEST_STREAMS: Record<PolarIngestStreamKey, boolean> = {
  polar_exercise: false,
  polar_sleep: true,
  polar_recharge: true,
};

/** Suunto: device sportivo → workout on di default. */
export const DEFAULT_SUUNTO_INGEST_STREAMS: Record<SuuntoIngestStreamKey, boolean> = {
  suunto_workout: true,
};

/** Karoo: ciclocomputer → activity on di default. */
export const DEFAULT_KAROO_INGEST_STREAMS: Record<KarooIngestStreamKey, boolean> = {
  karoo_activity: true,
};

export type IngestStreamEntry = { enabled: boolean };

export type AthleteDeviceIngestPolicyRow = {
  id: string;
  athlete_id: string;
  provider: string;
  streams: Record<string, IngestStreamEntry | boolean>;
  created_at: string;
  updated_at: string;
};

export function parseIngestStreamEnabled(raw: unknown): boolean {
  if (raw === true) return true;
  if (raw === false) return false;
  if (raw && typeof raw === "object" && "enabled" in (raw as object)) {
    return Boolean((raw as { enabled?: unknown }).enabled);
  }
  return false;
}

/** Merge DB `streams` con default: solo chiavi presenti in `defaults` sono considerate. */
export function mergeIngestStreamsWithDefaults(
  dbStreams: Record<string, unknown> | null | undefined,
  defaults: Record<string, boolean>,
): Record<string, boolean> {
  const out: Record<string, boolean> = { ...defaults };
  if (!dbStreams || typeof dbStreams !== "object") return out;
  for (const key of Object.keys(defaults)) {
    if (Object.prototype.hasOwnProperty.call(dbStreams, key)) {
      out[key] = parseIngestStreamEnabled(dbStreams[key]);
    }
  }
  return out;
}

export function defaultStreamsForProvider(provider: IngestPolicyProvider): Record<string, boolean> {
  if (provider === "whoop") return { ...DEFAULT_WHOOP_INGEST_STREAMS };
  if (provider === "wahoo") return { ...DEFAULT_WAHOO_INGEST_STREAMS };
  if (provider === "garmin" || provider === "garmin_connectiq") return { ...DEFAULT_GARMIN_INGEST_STREAMS };
  if (provider === "polar") return { ...DEFAULT_POLAR_INGEST_STREAMS };
  if (provider === "suunto") return { ...DEFAULT_SUUNTO_INGEST_STREAMS };
  if (provider === "hammerhead") return { ...DEFAULT_KAROO_INGEST_STREAMS };
  return {};
}

export function allowedIngestStreamKeysForProvider(provider: IngestPolicyProvider): readonly string[] {
  if (provider === "whoop") return WHOOP_INGEST_STREAM_KEYS;
  if (provider === "wahoo") return WAHOO_INGEST_STREAM_KEYS;
  if (provider === "garmin" || provider === "garmin_connectiq") return GARMIN_INGEST_STREAM_KEYS;
  if (provider === "polar") return POLAR_INGEST_STREAM_KEYS;
  if (provider === "suunto") return SUUNTO_INGEST_STREAM_KEYS;
  if (provider === "hammerhead") return KAROO_INGEST_STREAM_KEYS;
  return [];
}
