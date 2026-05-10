import type { SupabaseClient } from "@supabase/supabase-js";
import { ATHLETE_TIME_SERIES_CHANNEL_V1 } from "@empathy/contracts";
import { glucosePointsFromPayload, lactatePointsFromPayload } from "@/lib/bioenergetics/bioenergetic-day-payload-parsers";
import { isMissingRelationError } from "@/lib/supabase/missing-relation-error";

export type AthleteTimeSeriesSampleInsertRow = {
  athlete_id: string;
  observed_at: string;
  channel: string;
  value: number;
  unit: string;
  quality: null;
  source: string;
  source_ref: Record<string, unknown>;
};

function normalizeObservedAtIso(ts: string): string {
  const raw = ts.trim();
  if (!raw) return new Date(0).toISOString();
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw) && !raw.includes("Z") && !/[+-]\d{2}:?\d{2}$/.test(raw)) {
    const p2 = Date.parse(`${raw}Z`);
    if (Number.isFinite(p2)) return new Date(p2).toISOString();
  }
  return raw;
}

/**
 * Deriva righe `athlete_time_series_samples` dallo stesso `sourcePayload` usato per
 * `device_sync_exports` (allineato a `glucosePointsFromPayload` / `lactatePointsFromPayload`).
 */
export function buildAthleteTimeSeriesSampleRowsFromDeviceExport(input: {
  athleteId: string;
  deviceSyncExportId: string;
  provider: string;
  payload: Record<string, unknown> | null | undefined;
  exportCreatedAt: string | null;
}): AthleteTimeSeriesSampleInsertRow[] {
  const payload = input.payload ?? {};
  const refBase: Record<string, unknown> = {
    device_sync_export_id: input.deviceSyncExportId,
    provider: input.provider,
  };
  const rows: AthleteTimeSeriesSampleInsertRow[] = [];

  if (input.provider === "cgm") {
    for (const p of glucosePointsFromPayload(payload, input.exportCreatedAt)) {
      rows.push({
        athlete_id: input.athleteId,
        observed_at: normalizeObservedAtIso(p.ts),
        channel: ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L,
        value: p.value,
        unit: "mmol/L",
        quality: null,
        source: "device_sync_export",
        source_ref: { ...refBase },
      });
    }
  }

  for (const p of lactatePointsFromPayload(payload, input.exportCreatedAt)) {
    rows.push({
      athlete_id: input.athleteId,
      observed_at: normalizeObservedAtIso(p.ts),
      channel: ATHLETE_TIME_SERIES_CHANNEL_V1.LACTATE_MMOL_L,
      value: p.value,
      unit: "mmol/L",
      quality: null,
      source: "device_sync_export",
      source_ref: { ...refBase },
    });
  }

  return rows;
}

const INSERT_CHUNK = 400;

/**
 * Sostituisce i campioni legati a un export: delete per `source_ref.device_sync_export_id` poi insert.
 * Se la tabella non è ancora in schema (migrazione 055), ignora senza errori.
 */
export async function syncAthleteTimeSeriesSamplesForDeviceExport(
  supabase: SupabaseClient,
  input: {
    athleteId: string;
    deviceSyncExportId: string;
    provider: string;
    payload: Record<string, unknown> | null | undefined;
    exportCreatedAt: string | null;
  },
): Promise<{ inserted: number; skippedSchema: boolean }> {
  const rows = buildAthleteTimeSeriesSampleRowsFromDeviceExport({
    athleteId: input.athleteId,
    deviceSyncExportId: input.deviceSyncExportId,
    provider: input.provider,
    payload: input.payload,
    exportCreatedAt: input.exportCreatedAt,
  });

  const { error: delErr } = await supabase
    .from("athlete_time_series_samples")
    .delete()
    .eq("athlete_id", input.athleteId)
    .filter("source_ref->>device_sync_export_id", "eq", input.deviceSyncExportId);

  if (delErr) {
    if (isMissingRelationError(delErr)) return { inserted: 0, skippedSchema: true };
    throw new Error(delErr.message);
  }

  if (!rows.length) return { inserted: 0, skippedSchema: false };

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const { error: insErr } = await supabase.from("athlete_time_series_samples").insert(chunk);
    if (insErr) {
      if (isMissingRelationError(insErr)) return { inserted: 0, skippedSchema: true };
      throw new Error(insErr.message);
    }
  }

  return { inserted: rows.length, skippedSchema: false };
}
