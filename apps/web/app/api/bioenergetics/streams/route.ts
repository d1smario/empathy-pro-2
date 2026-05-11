import { NextRequest, NextResponse } from "next/server";
import { ATHLETE_TIME_SERIES_CHANNEL_V1 } from "@empathy/contracts";
import type { BioenergeticsTimeSeriesStreamResponseV1 } from "@/api/bioenergetics/contracts";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { BIOENERGETIC_WINDOW_MAX_DAYS, enumerateInclusiveIsoDates } from "@/lib/bioenergetics/bioenergetic-window-range";
import { loadAthleteTimeSeriesSamplesForRange } from "@/lib/bioenergetics/load-athlete-time-series-stream";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

type StreamChannelQuery =
  | "all"
  | (typeof ATHLETE_TIME_SERIES_CHANNEL_V1)["GLUCOSE_MMOL_L"]
  | (typeof ATHLETE_TIME_SERIES_CHANNEL_V1)["LACTATE_MMOL_L"];

function parseStreamChannel(raw: string | null): StreamChannelQuery {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "glucose_mmol_l" || t === "glucose") return ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L;
  if (t === "lactate_mmol_l" || t === "lactate") return ATHLETE_TIME_SERIES_CHANNEL_V1.LACTATE_MMOL_L;
  return "all";
}

/** Query: `athleteId`, `from`, `to` (`YYYY-MM-DD`, max inclusivo come finestra), opz. `channel` (`all` \| `glucose_mmol_l` \| `lactate_mmol_l`). */
export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    const from = (req.nextUrl.searchParams.get("from") ?? "").trim().slice(0, 10);
    const to = (req.nextUrl.searchParams.get("to") ?? "").trim().slice(0, 10);
    const channelParam = parseStreamChannel(req.nextUrl.searchParams.get("channel"));

    if (!athleteId) {
      return NextResponse.json({ error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: "missing_or_invalid_from_to" }, { status: 400, headers: NO_STORE });
    }

    const range = enumerateInclusiveIsoDates(from, to);
    if (!range.ok) {
      return NextResponse.json(
        { error: range.error, maxDays: BIOENERGETIC_WINDOW_MAX_DAYS },
        { status: 400, headers: NO_STORE },
      );
    }

    const { db } = await requireAthleteReadContext(req, athleteId);

    const result = await loadAthleteTimeSeriesSamplesForRange(db, {
      athleteId,
      fromDate: range.dates[0]!,
      toDate: range.dates[range.dates.length - 1]!,
      channel: channelParam,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400, headers: NO_STORE });
    }

    const body: BioenergeticsTimeSeriesStreamResponseV1 = {
      streamContractVersion: 1,
      athleteId,
      from: range.dates[0]!,
      to: range.dates[range.dates.length - 1]!,
      channel: channelParam === "all" ? "all" : channelParam,
      samples: result.samples,
      truncated: result.truncated,
    };
    if (result.skippedSchema) {
      body.skippedSchema = true;
    }

    return NextResponse.json(body, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "bioenergetics_streams_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
