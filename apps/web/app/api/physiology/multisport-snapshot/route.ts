import { NextRequest, NextResponse } from "next/server";
import type { MultisportEnergyEngineInput } from "@/lib/engines/multisport-energy-engine";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { buildPhysiologyPayloadsFromMultisport } from "@/lib/physiology/multisport-energy-physiology-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" as const };

/**
 * POST: multisport energy → due righe `metabolic_lab_runs` (metabolic_profile + lactate_analysis).
 * Unifica il flusso che prima richiedeva POST su `/api/physiology/multisport-energy` + doppio `/api/physiology/snapshot`.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<MultisportEnergyEngineInput> & { athleteId?: string; createdBy?: string | null };
    const athleteId = (body.athleteId ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }

    if (!body.sport || typeof body.bodyMassKg !== "number" || typeof body.durationSec !== "number") {
      return NextResponse.json({ error: "Missing sport, bodyMassKg or durationSec" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteWriteContext(req, athleteId);

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

    const payloads = buildPhysiologyPayloadsFromMultisport(input);
    const modelVersion = payloads.engine.modelVersion;

    const metabolicInput: Record<string, unknown> = {
      source: "empathy_multisport_snapshot_v1",
      body_mass_kg: body.bodyMassKg,
      duration_sec: body.durationSec,
      ...input,
    };

    const { error: metabolicErr } = await db.from("metabolic_lab_runs").insert({
      athlete_id: athleteId,
      section: "metabolic_profile",
      model_version: modelVersion,
      input_payload: metabolicInput,
      output_payload: payloads.metabolicProfileOutputPayload,
      created_by: body.createdBy != null ? String(body.createdBy) : null,
    });
    if (metabolicErr) {
      return NextResponse.json({ error: metabolicErr.message }, { status: 500, headers: NO_STORE });
    }

    const { error: lactateErr } = await db.from("metabolic_lab_runs").insert({
      athlete_id: athleteId,
      section: "lactate_analysis",
      model_version: modelVersion,
      input_payload: payloads.lactateInputPayload,
      output_payload: payloads.lactateOutputPayload,
      created_by: body.createdBy != null ? String(body.createdBy) : null,
    });
    if (lactateErr) {
      return NextResponse.json({ error: lactateErr.message }, { status: 500, headers: NO_STORE });
    }

    return NextResponse.json(
      { ok: true as const, engine: payloads.engine, sectionsPersisted: ["metabolic_profile", "lactate_analysis"] },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Multisport snapshot persist failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
