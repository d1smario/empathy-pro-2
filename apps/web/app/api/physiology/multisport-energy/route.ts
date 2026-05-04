import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import type { MultisportEnergyEngineInput } from "@/lib/engines/multisport-energy-engine";
import { buildPhysiologyPayloadsFromMultisport } from "@/lib/physiology/multisport-energy-physiology-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST: calcola motore multisport + payload snapshot per `metabolic_lab_runs` (metabolic_profile + lactate_analysis).
 * Il client deve poi chiamare `POST /api/physiology/snapshot` due volte con i payload restituiti (non salva qui).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<MultisportEnergyEngineInput> & { athleteId?: string };
    const athleteId = (body.athleteId ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    }
    await requireAthleteReadContext(req, athleteId);

    if (!body.sport || typeof body.bodyMassKg !== "number" || typeof body.durationSec !== "number") {
      return NextResponse.json({ error: "Missing sport, bodyMassKg or durationSec" }, { status: 400 });
    }

    const input: MultisportEnergyEngineInput = {
      sport: body.sport,
      bodyMassKg: body.bodyMassKg,
      durationSec: body.durationSec,
      powerW: body.powerW,
      velocityMps: body.velocityMps,
      gradeFraction: body.gradeFraction,
      meanAbsAccelerationMps2: body.meanAbsAccelerationMps2,
      heartRateBpm: body.heartRateBpm,
      restingHrBpm: body.restingHrBpm,
      maxHrBpm: body.maxHrBpm,
      efficiency: body.efficiency,
      ftpWatts: body.ftpWatts,
      vo2maxMlKgMinLab: body.vo2maxMlKgMinLab,
    };

    const result = buildPhysiologyPayloadsFromMultisport(input);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
    });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Multisport energy compute failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
