import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const ALLOWED_CHANNELS = new Set(["power", "hr", "speed", "cadence", "altitude", "temperature"]);

/**
 * Fase 3 device→UI: lettura serie HD da `executed_workout_series` per una sessione.
 * Letture **read-only**, scoping atleta tramite `requireAthleteReadContext`.
 *
 * Query: `?athleteId=…&executedId=…&channels=power,hr` (channels opzionale).
 */
export async function GET(req: NextRequest) {
  const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
  const executedId = (req.nextUrl.searchParams.get("executedId") ?? "").trim();
  const channelsParam = (req.nextUrl.searchParams.get("channels") ?? "").trim();

  if (!athleteId || !executedId) {
    return NextResponse.json(
      { ok: false as const, error: "missing_params" },
      { status: 400, headers: NO_STORE },
    );
  }

  const channels = channelsParam
    ? channelsParam
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => ALLOWED_CHANNELS.has(s))
    : Array.from(ALLOWED_CHANNELS);

  try {
    const { db } = await requireAthleteReadContext(req, athleteId);

    let query = db
      .from("executed_workout_series")
      .select("channel, unit, sample_count, samples, parser_engine, parser_version, source, version")
      .eq("athlete_id", athleteId)
      .eq("executed_workout_id", executedId);

    if (channels.length && channels.length < ALLOWED_CHANNELS.size) {
      query = query.in("channel", channels);
    }

    const { data, error } = await query;

    if (error) {
      const msg = error.message ?? "session_series_read_failed";
      const isMissingTable = /relation .*executed_workout_series.* does not exist/i.test(msg);
      return NextResponse.json(
        {
          ok: false as const,
          error: isMissingTable ? "table_missing" : msg,
          channels: [],
        },
        { status: isMissingTable ? 503 : 500, headers: NO_STORE },
      );
    }

    type Row = {
      channel: string;
      unit: string;
      sample_count: number;
      samples: unknown;
      parser_engine: string | null;
      parser_version: string | null;
      source: string;
      version: number;
    };
    const rows = (data ?? []) as Row[];

    const out = rows.map((r) => ({
      channel: r.channel,
      unit: r.unit,
      sampleCount: r.sample_count,
      samples: Array.isArray(r.samples)
        ? r.samples.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
        : [],
      parserEngine: r.parser_engine,
      parserVersion: r.parser_version,
      source: r.source,
      version: r.version,
    }));

    return NextResponse.json(
      {
        ok: true as const,
        athleteId,
        executedId,
        channels: out,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json(
        { ok: false as const, error: err.message, channels: [] },
        { status: err.status, headers: NO_STORE },
      );
    }
    const message = err instanceof Error ? err.message : "session-series failed";
    return NextResponse.json(
      { ok: false as const, error: message, channels: [] },
      { status: 500, headers: NO_STORE },
    );
  }
}
