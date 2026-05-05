import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { readVendorOauthTokens } from "@/lib/integrations/vendor-oauth-read";
import { updateVendorOauthTokens } from "@/lib/integrations/vendor-oauth-persist";
import { exchangeStravaRefreshToken } from "@/lib/integrations/strava-oauth2-api";
import { persistRealityDeviceExport } from "@/lib/reality/provider-adapters";
import { buildExecutedTrainingImportQuality } from "@/lib/reality/training-import-quality";

function stravaActivitiesUrl(): string {
  return process.env.STRAVA_API_ACTIVITIES_URL?.trim() || "https://www.strava.com/api/v3/athlete/activities";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

async function ensureStravaAccessToken(athleteId: string): Promise<string> {
  let row = await readVendorOauthTokens(athleteId, "strava");
  if (!row) throw new Error("Strava non collegato per questo atleta (vendor_oauth_links).");
  const now = Date.now();
  const expMs = row.expiresAt?.getTime() ?? 0;
  const expiringSoon = expMs > 0 && expMs < now + 5 * 60 * 1000;
  if (row.refreshToken && expiringSoon) {
    const tok = await exchangeStravaRefreshToken({ refreshToken: row.refreshToken });
    if ("error" in tok) throw new Error(tok.error);
    const expiresAt =
      tok.expires_at != null && Number.isFinite(tok.expires_at)
        ? new Date(Math.max(0, tok.expires_at) * 1000)
        : tok.expires_in != null && Number.isFinite(tok.expires_in)
          ? new Date(Date.now() + Math.max(0, tok.expires_in) * 1000)
          : null;
    const upd = await updateVendorOauthTokens({
      athleteId,
      vendor: "strava",
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token ?? row.refreshToken,
      expiresAt,
    });
    if (!upd.ok) throw new Error(upd.error);
    row = { accessToken: tok.access_token, refreshToken: tok.refresh_token ?? row.refreshToken, expiresAt };
  }
  return row.accessToken;
}

function stravaChannelCoverage(rec: Record<string, unknown>): Record<string, number> {
  return {
    power: num(rec.average_watts) != null || num(rec.weighted_average_watts) != null ? 100 : 0,
    hr: num(rec.average_heartrate) != null || num(rec.max_heartrate) != null ? 100 : 0,
    speed: num(rec.average_speed) != null || num(rec.max_speed) != null || num(rec.distance) != null ? 100 : 0,
    cadence: num(rec.average_cadence) != null ? 100 : 0,
    altitude: num(rec.total_elevation_gain) != null ? 100 : 0,
    temperature: 0,
  };
}

function activityDay(rec: Record<string, unknown>): string | null {
  const d = rec.start_date_local;
  if (typeof d === "string" && d.length >= 10) return d.slice(0, 10);
  const gmt = rec.start_date;
  if (typeof gmt === "string" && gmt.length >= 10) return gmt.slice(0, 10);
  return null;
}

function activityExternalId(rec: Record<string, unknown>): string | null {
  const id = rec.id;
  if (typeof id === "number" && Number.isFinite(id)) return `strava:${Math.trunc(id)}`;
  if (typeof id === "string" && id.trim()) return `strava:${id.trim()}`;
  return null;
}

function isDuplicate(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("duplicate") || m.includes("23505") || m.includes("unique") || m.includes("uq_device_sync_exports");
}

async function upsertExecutedFromStrava(input: {
  athleteId: string;
  extId: string;
  rec: Record<string, unknown>;
}): Promise<void> {
  const date = activityDay(input.rec);
  if (!date) return;
  const durationSec = num(input.rec.moving_time) ?? num(input.rec.elapsed_time);
  const durationMinutes = durationSec != null && durationSec > 0 ? Math.max(1, Math.round(durationSec / 60)) : 0;
  if (durationMinutes <= 0) return;
  const distanceM = num(input.rec.distance);
  const avgPower = num(input.rec.average_watts);
  const estimateTss = avgPower != null && durationSec != null ? Math.max(0, (avgPower * (durationSec / 3600)) / 10) : 0;
  const channelCoverage = stravaChannelCoverage(input.rec);
  const quality = buildExecutedTrainingImportQuality({ channelCoverage });
  const source = "api_sync:strava:activities";
  const traceSummary = {
    parser_engine: "strava_v3_activities",
    parser_version: "3",
    source,
    strava_activity_id: input.rec.id ?? null,
    activity_type: input.rec.sport_type ?? input.rec.type ?? null,
    distance_m: distanceM,
    distance_km: distanceM != null ? distanceM / 1000 : null,
    elevation_gain_m: num(input.rec.total_elevation_gain),
    power_avg_w: avgPower,
    hr_avg_bpm: num(input.rec.average_heartrate),
    hr_max_bpm: num(input.rec.max_heartrate),
    calories: num(input.rec.calories),
    channels_available: Object.fromEntries(Object.entries(channelCoverage).map(([k, v]) => [k, v > 0])) as Record<
      string,
      boolean
    >,
    import_quality: {
      coverage_pct: quality.coveragePct,
      quality_status: quality.qualityStatus,
      quality_note: quality.qualityNote,
      missing_channels: quality.missingChannels,
      recommended_inputs: quality.recommendedInputs,
      channel_coverage_pct: channelCoverage,
    },
  };
  const kcal = num(input.rec.calories);
  const kj = kcal != null ? Math.round(kcal * 4.184 * 100) / 100 : null;
  const payload = {
    athlete_id: input.athleteId,
    date,
    duration_minutes: durationMinutes,
    tss: estimateTss,
    kcal,
    kj,
    source,
    external_id: input.extId,
    trace_summary: traceSummary,
    subjective_notes: null as string | null,
  };
  const supabase = createServerSupabaseClient();
  const existing = await supabase
    .from("executed_workouts")
    .select("id")
    .eq("athlete_id", input.athleteId)
    .eq("external_id", input.extId)
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) {
    const upd = await supabase.from("executed_workouts").update(payload).eq("id", existing.data.id);
    if (upd.error) throw new Error(upd.error.message);
    return;
  }
  const ins = await supabase.from("executed_workouts").insert(payload);
  if (ins.error) throw new Error(ins.error.message);
}

export async function runStravaPullForAthlete(input: {
  athleteId: string;
  perPage?: number;
}): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const access = await ensureStravaAccessToken(input.athleteId);
  const perPage = Math.min(100, Math.max(1, Math.floor(input.perPage ?? 50)));
  const after = Math.floor((Date.now() - 14 * 24 * 3600 * 1000) / 1000);
  const u = new URL(stravaActivitiesUrl());
  u.searchParams.set("after", String(after));
  u.searchParams.set("per_page", String(perPage));
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${access}`, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`strava_activities_non_json:${res.status}:${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(`strava_activities_http_${res.status}:${text.slice(0, 600)}`);
  }
  const records = Array.isArray(json) ? (json as Record<string, unknown>[]) : [];
  const errors: string[] = [];
  let inserted = 0;
  let skipped = 0;
  for (const rec of records) {
    const extId = activityExternalId(rec);
    if (!extId) continue;
    const day = activityDay(rec);
    const channelCoverage = stravaChannelCoverage(rec);
    const quality = buildExecutedTrainingImportQuality({ channelCoverage });
    try {
      await persistRealityDeviceExport({
        athleteId: input.athleteId,
        provider: "strava",
        domain: "training",
        sourceKind: "api_sync",
        externalRef: extId,
        payload: { strava_activity: rec },
        canonicalPreview: {
          strava_activity_id: rec.id ?? null,
          name: rec.name ?? null,
          sport_type: rec.sport_type ?? rec.type ?? null,
          date: day,
        },
        status: "created",
        parserEngine: "strava_v3_activities",
        parserVersion: "3",
        qualityStatus: quality.qualityStatus,
        qualityNote: quality.qualityNote,
        channelCoverage,
        missingChannels: quality.missingChannels,
        recommendedInputs: quality.recommendedInputs,
      });
      await upsertExecutedFromStrava({
        athleteId: input.athleteId,
        extId,
        rec,
      });
      inserted += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isDuplicate(msg)) {
        skipped += 1;
        continue;
      }
      errors.push(msg);
    }
  }
  return { inserted, skipped, errors };
}
