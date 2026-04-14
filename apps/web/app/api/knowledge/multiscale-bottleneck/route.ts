import {
  computeMetabolicBottleneckView,
  metabolicLevelLabelIt,
  multiscaleSubgraphForNodes,
} from "@empathy/domain-knowledge";
import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import type { MultiscaleBottleneckApiOk } from "@/lib/knowledge/multiscale-bottleneck-contract";
import { buildMultiscaleSignalSnapshotFromAthlete } from "@/lib/knowledge/multiscale-signal-from-state";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { resolveCanonicalPhysiologyState } from "@/lib/physiology/profile-resolver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    const includeSubgraph = req.nextUrl.searchParams.get("includeSubgraph") === "1";

    if (!athleteId) {
      return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }

    await requireAthleteReadContext(req, athleteId);

    const athleteMemory = await resolveAthleteMemory(athleteId);
    const physiology = athleteMemory.physiology ?? (await resolveCanonicalPhysiologyState(athleteId));
    const snapshot = buildMultiscaleSignalSnapshotFromAthlete(physiology, athleteMemory.twin);
    const bottleneck = computeMetabolicBottleneckView(snapshot);

    const payload: MultiscaleBottleneckApiOk = {
      ok: true,
      athleteId,
      snapshot,
      bottleneck,
      dominantLevelLabelIt: metabolicLevelLabelIt(bottleneck.dominantBottleneck.level),
    };

    if (includeSubgraph) {
      payload.subgraph = multiscaleSubgraphForNodes(bottleneck.activatedNodeIds, { includeOneHop: true });
    }

    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "multiscale_bottleneck_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
