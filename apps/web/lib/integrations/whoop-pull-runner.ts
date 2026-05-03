import "server-only";

import type { ObservationIngestTags, RealityDomain } from "@/lib/empathy/schemas";
import {
  dedupeWhoopRecordsById,
  extractWhoopListRecords,
  extractWhoopNextToken,
  whoopRecordPrimaryId,
} from "@/lib/integrations/whoop-collection-response";
import { observationDomainsFromWhoopPayload } from "@/lib/integrations/whoop-observation-from-payload";
import { exchangeWhoopRefreshToken, WHOOP_V2_COLLECTION_PATHS, whoopApiBaseUrl } from "@/lib/integrations/whoop-oauth2-api";
import { readVendorOauthTokens } from "@/lib/integrations/vendor-oauth-read";
import { updateVendorOauthTokens } from "@/lib/integrations/vendor-oauth-persist";
import { persistRealityDeviceExport } from "@/lib/reality/provider-adapters";
import { defaultObservationIngestTags } from "@/lib/reality/observation-ingest-defaults";
import { mergeObservationIngestTags } from "@/lib/reality/observation-merge";
import { getMergedIngestStreams } from "@/lib/integrations/ingest-stream-policy";

function whoopMaxCollectionPages(): number {
  const raw = process.env.WHOOP_API_MAX_COLLECTION_PAGES?.trim();
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 1) return Math.min(100, n);
  return 40;
}

async function ensureWhoopAccessToken(athleteId: string): Promise<string> {
  let row = await readVendorOauthTokens(athleteId, "whoop");
  if (!row) throw new Error("WHOOP non collegato per questo atleta (vendor_oauth_links).");

  const now = Date.now();
  const expMs = row.expiresAt?.getTime() ?? 0;
  const expiringSoon = expMs > 0 && expMs < now + 5 * 60 * 1000;
  if (row.refreshToken && expiringSoon) {
    const tok = await exchangeWhoopRefreshToken(row.refreshToken);
    if ("error" in tok) throw new Error(tok.error);
    const expiresAt =
      tok.expires_in != null && Number.isFinite(tok.expires_in)
        ? new Date(Date.now() + Math.max(0, tok.expires_in) * 1000)
        : null;
    const upd = await updateVendorOauthTokens({
      athleteId,
      vendor: "whoop",
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

/**
 * Scarica tutte le pagine di una collection v2 nello stesso intervallo [start,end].
 * @see https://developer.whoop.com/docs/developing/pagination
 */
async function fetchWhoopCollectionAllPages(input: {
  accessToken: string;
  path: string;
  startIso: string;
  endIso: string;
  limit: number;
  maxPages?: number;
}): Promise<Record<string, unknown>[]> {
  const base = whoopApiBaseUrl();
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const maxPages = Math.min(100, Math.max(1, input.maxPages ?? whoopMaxCollectionPages()));
  const aggregated: Record<string, unknown>[] = [];
  let nextToken: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const u = new URL(`${base}${path}`);
    u.searchParams.set("start", input.startIso);
    u.searchParams.set("end", input.endIso);
    u.searchParams.set("limit", String(input.limit));
    if (nextToken) {
      u.searchParams.set("nextToken", nextToken);
    }

    const res = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${input.accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`whoop_${path}_parse:${res.status}:${text.slice(0, 400)}`);
    }
    if (!res.ok) {
      throw new Error(`whoop_${path}_http_${res.status}:${text.slice(0, 600)}`);
    }

    const pageRecords = extractWhoopListRecords(json);
    aggregated.push(...pageRecords);
    nextToken = extractWhoopNextToken(json);
    if (!nextToken) break;
  }

  return dedupeWhoopRecordsById(aggregated);
}

function calendarDayFromWhoopRecord(rec: Record<string, unknown>): string | null {
  const s = rec.start;
  if (typeof s === "string" && s.length >= 10) return s.slice(0, 10);
  const e = rec.end;
  if (typeof e === "string" && e.length >= 10) return e.slice(0, 10);
  const created = rec.created_at;
  if (typeof created === "string" && created.length >= 10) return created.slice(0, 10);
  return null;
}

function isDuplicateExportError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("duplicate") || m.includes("23505") || m.includes("unique") || m.includes("uq_device_sync_exports");
}

function buildWhoopObservation(
  rec: Record<string, unknown>,
  domain: RealityDomain,
  day: string | null,
): ObservationIngestTags {
  const base = defaultObservationIngestTags({
    provider: "whoop",
    domain,
    sourceKind: "api_sync",
    channelCoverage: null,
  });
  const doms = observationDomainsFromWhoopPayload(rec);
  const fallback: ObservationIngestTags = {
    domains: doms.length > 0 ? doms : domain === "training" ? ["exertion_physiological_load"] : ["autonomic_recovery_state"],
    modalities: ["daily_aggregate", "epoch_summary"],
    contextRefs: null,
  };
  let observation = base != null ? mergeObservationIngestTags(base, { domains: doms }) : fallback;
  if (day) {
    observation = mergeObservationIngestTags(observation, {
      contextRefs: [{ kind: "calendar_day", date: day }],
    });
  }
  return observation;
}

async function persistWhoopRecords(input: {
  athleteId: string;
  records: Record<string, unknown>[];
  domain: RealityDomain;
  payloadKey: string;
  previewKeys: string[];
}): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;
  let skipped = 0;

  for (const rec of input.records) {
    const id = whoopRecordPrimaryId(rec);
    if (!id) continue;
    const day = calendarDayFromWhoopRecord(rec);
    const observation = buildWhoopObservation(rec, input.domain, day);
    const preview: Record<string, unknown> = { whoop_id: id };
    for (const k of input.previewKeys) {
      if (k in rec) preview[k] = rec[k];
    }

    try {
      await persistRealityDeviceExport({
        athleteId: input.athleteId,
        provider: "whoop",
        domain: input.domain,
        sourceKind: "api_sync",
        externalRef: id,
        payload: { [input.payloadKey]: rec },
        canonicalPreview: preview,
        status: "created",
        parserEngine: "whoop_v2_rest",
        parserVersion: "2",
        observation,
      });
      inserted += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isDuplicateExportError(msg)) {
        skipped += 1;
        continue;
      }
      errors.push(`[${input.domain}] ${msg}`);
    }
  }

  return { inserted, skipped, errors };
}

export type WhoopPullStreams = {
  sleep?: boolean;
  recovery?: boolean;
  workout?: boolean;
};

/**
 * Pull WHOOP API v2 (sleep, recovery, workout) → `device_sync_exports`.
 * Range default: ultimi 14 giorni UTC; paginazione `nextToken` fino a `WHOOP_API_MAX_COLLECTION_PAGES` (default 40).
 */
export async function runWhoopPullForAthlete(input: {
  athleteId: string;
  limit?: number;
  maxCollectionPages?: number;
  /** Default: tutti e tre; sempre intersecato con policy `athlete_device_ingest_policy` (chiavi whoop_*). */
  streams?: WhoopPullStreams | null;
}): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const policy = await getMergedIngestStreams(input.athleteId, "whoop");
  const req = input.streams ?? {};
  const streams: WhoopPullStreams = {
    sleep: Boolean(policy.whoop_sleep && (req.sleep ?? true)),
    recovery: Boolean(policy.whoop_recovery && (req.recovery ?? true)),
    workout: Boolean(policy.whoop_workout && (req.workout ?? true)),
  };
  const errors: string[] = [];
  let inserted = 0;
  let skipped = 0;

  if (!streams.sleep && !streams.recovery && !streams.workout) {
    return { inserted: 0, skipped: 0, errors };
  }

  const access = await ensureWhoopAccessToken(input.athleteId);
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 14);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const limit = Math.min(25, Math.max(1, Math.floor(input.limit ?? 10)));
  const maxPages =
    input.maxCollectionPages != null && Number.isFinite(input.maxCollectionPages)
      ? Math.min(100, Math.max(1, Math.floor(input.maxCollectionPages)))
      : undefined;

  const runStream = async (
    enabled: boolean | undefined,
    path: string,
    domain: RealityDomain,
    payloadKey: string,
    previewKeys: string[],
  ) => {
    if (!enabled) return;
    try {
      const records = await fetchWhoopCollectionAllPages({
        accessToken: access,
        path,
        startIso,
        endIso,
        limit,
        maxPages,
      });
      const r = await persistWhoopRecords({
        athleteId: input.athleteId,
        records,
        domain,
        payloadKey,
        previewKeys,
      });
      inserted += r.inserted;
      skipped += r.skipped;
      errors.push(...r.errors);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  };

  await runStream(streams.sleep, WHOOP_V2_COLLECTION_PATHS.sleep, "sleep", "whoop_sleep", [
    "score_state",
    "start",
    "end",
  ]);
  await runStream(streams.recovery, WHOOP_V2_COLLECTION_PATHS.recovery, "recovery", "whoop_recovery", [
    "score_state",
    "cycle_id",
  ]);
  await runStream(streams.workout, WHOOP_V2_COLLECTION_PATHS.workout, "training", "whoop_workout", [
    "score_state",
    "sport_name",
    "start",
    "end",
  ]);

  return { inserted, skipped, errors };
}
