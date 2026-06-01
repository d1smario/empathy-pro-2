import { NextRequest, NextResponse } from "next/server";

import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAthleteWriteContext,
  requireAuthenticatedTrainingUser,
  supabaseForAthleteTableRead,
} from "@/lib/auth/athlete-read-context";
import {
  BIOMECH_CAPTURE_BUCKET,
  createBiomechServiceRoleClient,
} from "@/lib/biomechanics/biomech-capture-storage";
import { patchBiomechanicsStagingPoseProposal } from "@/lib/biomechanics/biomech-staging-pose-patch";
import type { BiomechanicsJointAngleSample, BiomechanicsLandmark3D } from "@empathy/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const runId = params.id?.trim();
    if (!runId) {
      return NextResponse.json({ ok: false as const, error: "missing_run_id" }, { status: 400, headers: NO_STORE });
    }

    const { rlsClient } = await requireAuthenticatedTrainingUser(req);
    const readDb = supabaseForAthleteTableRead(rlsClient);
    const { data: run, error: runErr } = await readDb
      .from("interpretation_staging_runs")
      .select(
        "id, athlete_id, domain, status, trigger_source, source_refs, candidate_bundle, proposed_structured_patches, confidence, created_at, updated_at",
      )
      .eq("id", runId)
      .maybeSingle();

    if (runErr) {
      return NextResponse.json({ ok: false as const, error: runErr.message }, { status: 500, headers: NO_STORE });
    }
    if (!run) {
      return NextResponse.json({ ok: false as const, error: "staging_run_not_found" }, { status: 404, headers: NO_STORE });
    }
    if (run.domain !== "biomechanics") {
      return NextResponse.json({ ok: false as const, error: "wrong_domain" }, { status: 409, headers: NO_STORE });
    }

    const athleteId = String(run.athlete_id ?? "");
    await requireAthleteReadContext(req, athleteId);

    const bundle = asRecord(run.candidate_bundle);
    const mediaPath = typeof bundle?.mediaStoragePath === "string" ? bundle.mediaStoragePath : null;
    let signedUrl: string | null = null;
    const admin = createBiomechServiceRoleClient();
    if (admin && mediaPath) {
      const sig = await admin.storage.from(BIOMECH_CAPTURE_BUCKET).createSignedUrl(mediaPath, 300);
      if (!sig.error && sig.data) signedUrl = sig.data.signedUrl ?? null;
    }

    return NextResponse.json(
      {
        ok: true as const,
        run,
        signedUrl,
        captureJobId: typeof bundle?.captureJobId === "string" ? bundle.captureJobId : null,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "biomech_staging_get_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}

function parseLandmarksBody(raw: unknown): BiomechanicsLandmark3D[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out: BiomechanicsLandmark3D[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row || typeof row.name !== "string") continue;
    if (typeof row.xMm !== "number" || typeof row.yMm !== "number") continue;
    out.push({
      name: row.name,
      xMm: row.xMm,
      yMm: row.yMm,
      zMm: typeof row.zMm === "number" ? row.zMm : undefined,
      confidence01: typeof row.confidence01 === "number" ? row.confidence01 : undefined,
    });
  }
  return out.length ? out : null;
}

function parseJointAnglesBody(raw: unknown): BiomechanicsJointAngleSample[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const out: BiomechanicsJointAngleSample[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row || typeof row.joint !== "string" || typeof row.angleDeg !== "number") continue;
    out.push({
      joint: row.joint as BiomechanicsJointAngleSample["joint"],
      side: typeof row.side === "string" ? (row.side as BiomechanicsJointAngleSample["side"]) : undefined,
      angleDeg: row.angleDeg,
      phasePct: typeof row.phasePct === "number" ? row.phasePct : undefined,
      confidence01: typeof row.confidence01 === "number" ? row.confidence01 : undefined,
    });
  }
  return out.length ? out : undefined;
}

/** Salva correzione manuale landmark / angoli sulla proposta CV in staging. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const runId = params.id?.trim();
    if (!runId) {
      return NextResponse.json({ ok: false as const, error: "missing_run_id" }, { status: 400, headers: NO_STORE });
    }

    const body = (await req.json().catch(() => ({}))) as {
      landmarks?: unknown;
      jointAngles?: unknown;
    };
    const landmarks = parseLandmarksBody(body.landmarks);
    if (!landmarks) {
      return NextResponse.json({ ok: false as const, error: "missing_landmarks" }, { status: 400, headers: NO_STORE });
    }

    const { rlsClient } = await requireAuthenticatedTrainingUser(req);
    const readDb = supabaseForAthleteTableRead(rlsClient);
    const { data: run, error: runErr } = await readDb
      .from("interpretation_staging_runs")
      .select("id, athlete_id, domain")
      .eq("id", runId)
      .maybeSingle();

    if (runErr) {
      return NextResponse.json({ ok: false as const, error: runErr.message }, { status: 500, headers: NO_STORE });
    }
    if (!run) {
      return NextResponse.json({ ok: false as const, error: "staging_run_not_found" }, { status: 404, headers: NO_STORE });
    }
    if (run.domain !== "biomechanics") {
      return NextResponse.json({ ok: false as const, error: "wrong_domain" }, { status: 409, headers: NO_STORE });
    }

    const athleteId = String(run.athlete_id ?? "");
    const { db } = await requireAthleteWriteContext(req, athleteId);

    const result = await patchBiomechanicsStagingPoseProposal({
      db,
      athleteId,
      runId,
      landmarks,
      jointAngles: parseJointAnglesBody(body.jointAngles),
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false as const, error: result.error }, { status: 409, headers: NO_STORE });
    }

    return NextResponse.json(
      {
        ok: true as const,
        jointAngles: result.jointAngles,
        efficiencyScores: result.efficiencyScores,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "biomech_staging_pose_patch_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
