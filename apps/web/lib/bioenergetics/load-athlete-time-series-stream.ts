import type { SupabaseClient } from "@supabase/supabase-js";
import type { AthleteTimeSeriesChannelV1, AthleteTimeSeriesSampleRowV1 } from "@empathy/contracts";
import { ATHLETE_TIME_SERIES_CHANNEL_V1 } from "@empathy/contracts";
import { enumerateInclusiveIsoDates } from "@/lib/bioenergetics/bioenergetic-window-range";
import { isMissingRelationError } from "@/lib/supabase/missing-relation-error";

/** Limite righe per `GET …/bioenergetics/streams` (protezione DB / payload). */
export const ATHLETE_TIME_SERIES_STREAM_MAX_ROWS = 8000 as const;

export type LoadAthleteTimeSeriesStreamInput = {
  athleteId: string;
  /** `YYYY-MM-DD` inclusivi (stessa convenzione UTC-mezzanotte della slice giorno). */
  fromDate: string;
  toDate: string;
  /** Canale singolo o tutti i canali v1. */
  channel: AthleteTimeSeriesChannelV1 | "all";
};

export type LoadAthleteTimeSeriesStreamResult =
  | { ok: true; samples: AthleteTimeSeriesSampleRowV1[]; truncated: boolean; skippedSchema: false }
  | { ok: true; samples: []; truncated: false; skippedSchema: true }
  | { ok: false; error: string };

function boundsUtcInclusive(fromDate: string, toDate: string): { fromTs: string; toTs: string } {
  const range = enumerateInclusiveIsoDates(fromDate, toDate);
  if (!range.ok) {
    return { fromTs: "", toTs: "" };
  }
  const first = range.dates[0]!;
  const last = range.dates[range.dates.length - 1]!;
  return {
    fromTs: `${first}T00:00:00.000Z`,
    toTs: `${last}T23:59:59.999Z`,
  };
}

/**
 * Lettura thin `athlete_time_series_samples` per intervallo calendario (max giorni come finestra VM).
 */
export async function loadAthleteTimeSeriesSamplesForRange(
  db: SupabaseClient,
  input: LoadAthleteTimeSeriesStreamInput,
): Promise<LoadAthleteTimeSeriesStreamResult> {
  const range = enumerateInclusiveIsoDates(input.fromDate, input.toDate);
  if (!range.ok) {
    return { ok: false, error: range.error };
  }

  const { fromTs, toTs } = boundsUtcInclusive(input.fromDate, input.toDate);
  if (!fromTs || !toTs) return { ok: false, error: "invalid_date_range" };

  const limit = ATHLETE_TIME_SERIES_STREAM_MAX_ROWS + 1;
  let q = db
    .from("athlete_time_series_samples")
    .select("id, observed_at, channel, value, unit, quality, source, source_ref, created_at")
    .eq("athlete_id", input.athleteId)
    .gte("observed_at", fromTs)
    .lte("observed_at", toTs)
    .order("observed_at", { ascending: true })
    .limit(limit);

  if (input.channel !== "all") {
    q = q.eq("channel", input.channel);
  } else {
    q = q.in("channel", [ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L, ATHLETE_TIME_SERIES_CHANNEL_V1.LACTATE_MMOL_L]);
  }

  const { data, error } = await q;

  if (error) {
    if (isMissingRelationError(error)) {
      return { ok: true, samples: [], truncated: false, skippedSchema: true };
    }
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const truncated = rows.length > ATHLETE_TIME_SERIES_STREAM_MAX_ROWS;
  const capped = truncated ? rows.slice(0, ATHLETE_TIME_SERIES_STREAM_MAX_ROWS) : rows;

  const samples: AthleteTimeSeriesSampleRowV1[] = [];
  for (const r of capped) {
    const observed_at = typeof r.observed_at === "string" ? r.observed_at : "";
    if (!observed_at) continue;
    const rawVal = typeof r.value === "number" ? r.value : Number(r.value);
    if (!Number.isFinite(rawVal)) continue;
    const ch = r.channel;
    if (ch !== ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L && ch !== ATHLETE_TIME_SERIES_CHANNEL_V1.LACTATE_MMOL_L) {
      continue;
    }
    samples.push({
      id: typeof r.id === "string" ? r.id : undefined,
      athlete_id: input.athleteId,
      observed_at,
      channel: ch,
      value: rawVal,
      unit: typeof r.unit === "string" ? r.unit : "mmol/L",
      quality: (r.quality as AthleteTimeSeriesSampleRowV1["quality"]) ?? null,
      source: typeof r.source === "string" ? r.source : "unknown",
      source_ref:
        r.source_ref && typeof r.source_ref === "object" && !Array.isArray(r.source_ref)
          ? (r.source_ref as Record<string, unknown>)
          : undefined,
      created_at: typeof r.created_at === "string" ? r.created_at : undefined,
    });
  }

  return { ok: true, samples, truncated, skippedSchema: false };
}
