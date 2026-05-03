import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  allowedIngestStreamKeysForProvider,
  defaultStreamsForProvider,
  isIngestPolicyProvider,
  mergeIngestStreamsWithDefaults,
  type IngestPolicyProvider,
} from "@empathy/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const POLICY_TABLE = "athlete_device_ingest_policy";

/** Provider usato in DB per il link Garmin Health (OAuth tabella dedicata). */
export const GARMIN_POLICY_PROVIDER: IngestPolicyProvider = "garmin";

/** Provider con link attivo (OAuth vendor o Garmin). Richiede service role per `vendor_oauth_links`. */
export async function listLinkedDeviceIngestProviders(athleteId: string): Promise<IngestPolicyProvider[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const linked = new Set<IngestPolicyProvider>();

  const { data: oauthRows, error: oauthErr } = await admin
    .from("vendor_oauth_links")
    .select("vendor")
    .eq("athlete_id", athleteId);

  if (!oauthErr && Array.isArray(oauthRows)) {
    for (const row of oauthRows) {
      const v = typeof row?.vendor === "string" ? row.vendor.trim() : "";
      if (isIngestPolicyProvider(v)) linked.add(v);
    }
  }

  const { data: garminRow, error: garminErr } = await admin
    .from("garmin_athlete_links")
    .select("athlete_id")
    .eq("athlete_id", athleteId)
    .maybeSingle();

  if (!garminErr && garminRow?.athlete_id) {
    linked.add(GARMIN_POLICY_PROVIDER);
  }

  const order: IngestPolicyProvider[] = ["whoop", "wahoo", "garmin"];
  return order.filter((p) => linked.has(p) && allowedIngestStreamKeysForProvider(p).length > 0);
}

/** Chiave `provider` nella tabella policy (allineata a OAuth / dominio). */
export function normalizePolicyProvider(provider: IngestPolicyProvider): string {
  if (provider === "garmin_connectiq") return "garmin_connectiq";
  return provider;
}

/**
 * Merge tra default applicativo e riga `athlete_device_ingest_policy` (se presente).
 * Preferisce `db` se passato; altrimenti service role se configurata.
 */
export async function getMergedIngestStreams(
  athleteId: string,
  provider: IngestPolicyProvider,
  db?: SupabaseClient | null,
): Promise<Record<string, boolean>> {
  const defaults = defaultStreamsForProvider(provider);
  const client = db ?? createSupabaseAdminClient();
  if (!client) {
    return { ...defaults };
  }

  const { data, error } = await client
    .from(POLICY_TABLE)
    .select("streams")
    .eq("athlete_id", athleteId)
    .eq("provider", normalizePolicyProvider(provider))
    .maybeSingle();

  if (error || !data?.streams) {
    return { ...defaults };
  }

  const raw = data.streams as Record<string, unknown>;
  return mergeIngestStreamsWithDefaults(raw, defaults);
}

export async function isStreamEnabled(
  athleteId: string,
  provider: IngestPolicyProvider,
  streamKey: string,
  db?: SupabaseClient | null,
): Promise<boolean> {
  const merged = await getMergedIngestStreams(athleteId, provider, db);
  return Boolean(merged[streamKey]);
}

export type DeviceIngestPolicyProviderPayload = {
  provider: IngestPolicyProvider;
  linked: true;
  streams: Record<string, boolean>;
};

export async function buildDeviceIngestPolicyGetPayload(
  athleteId: string,
  db: SupabaseClient,
): Promise<DeviceIngestPolicyProviderPayload[]> {
  const linked = await listLinkedDeviceIngestProviders(athleteId);
  const out: DeviceIngestPolicyProviderPayload[] = [];
  for (const provider of linked) {
    const streams = await getMergedIngestStreams(athleteId, provider, db);
    out.push({ provider, linked: true, streams });
  }
  return out;
}
