import { NextRequest, NextResponse } from "next/server";

import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAuthenticatedTrainingUser,
  supabaseForAthleteTableRead,
} from "@/lib/auth/athlete-read-context";
import {
  BIOMECH_CAPTURE_BUCKET,
  createBiomechServiceRoleClient,
} from "@/lib/biomechanics/biomech-capture-storage";

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
