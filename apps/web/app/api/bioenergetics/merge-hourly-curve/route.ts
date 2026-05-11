import { NextRequest, NextResponse } from "next/server";
import { parseBioenergeticAiCurveProposalV1 } from "@empathy/contracts";
import { mergeHourlyBioenergeticCurvesV1 } from "@empathy/domain-bioenergetics";
import type { BioenergeticHourlyCurveMergeResponseV1 } from "@/api/bioenergetics/contracts";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { assembleBioenergeticDay } from "@/lib/bioenergetics/bioenergetic-day-assembler";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Merge numerico orario (24 punti) tra curva deterministica del giorno e proposta AI strutturata.
 * Governance e pesi da `assembleBioenergeticDay` (non accettati dal client). Thin: riusa assembler.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
    const date = typeof body.date === "string" ? body.date.trim().slice(0, 10) : "";
    const channelId = body.channelId;
    if (!athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "invalid_athlete_or_date" }, { status: 400, headers: NO_STORE });
    }
    if (channelId !== "glucose" && channelId !== "lactate") {
      return NextResponse.json({ error: "invalid_channelId" }, { status: 400, headers: NO_STORE });
    }

    const parsed = parseBioenergeticAiCurveProposalV1(body.aiProposal, channelId);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteReadContext(req, athleteId);

    const day = await assembleBioenergeticDay(db, athleteId, date, {
      includeDeterministicMonitoringStripForMergeEndpoint: true,
    });
    if (!day.ok) {
      return NextResponse.json({ error: day.error }, { status: day.status, headers: NO_STORE });
    }

    const ch = day.body.continuousMonitoring?.channels.find((c) => c.id === channelId);
    if (!ch?.hourly || ch.hourly.length !== 24) {
      return NextResponse.json({ error: "channel_hourly_missing" }, { status: 404, headers: NO_STORE });
    }
    const resolution = ch.curveResolution;
    if (!resolution) {
      return NextResponse.json({ error: "curve_resolution_missing" }, { status: 500, headers: NO_STORE });
    }
    if (resolution.channelId !== channelId) {
      return NextResponse.json({ error: "resolution_channel_mismatch" }, { status: 500, headers: NO_STORE });
    }

    let merged;
    try {
      merged = mergeHourlyBioenergeticCurvesV1({
        deterministicHourly: ch.hourly,
        aiHourly: [...parsed.value.hourly24],
        resolution,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "merge_failed";
      return NextResponse.json({ error: msg }, { status: 400, headers: NO_STORE });
    }

    const out: BioenergeticHourlyCurveMergeResponseV1 = {
      mergeContractVersion: 1,
      channelId,
      mergedHourly: merged.merged,
      curveResolution: resolution,
      appliedAiBlend: merged.appliedAiBlend,
      dayContractVersion: day.body.dayContractVersion,
    };

    return NextResponse.json(out, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "merge_hourly_curve_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
