import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AERO_CAPTURE_BUCKET,
  createAeroServiceRoleClient,
} from "@/lib/aerodynamics/aero-capture-storage";
import { claimAerodynamicsCaptureJob, failAerodynamicsCaptureJob } from "@/lib/aerodynamics/aero-capture-pipeline";
import {
  AeroGeometryCvError,
  extractAeroGeometryFromCv,
  type AeroGeometryProposalV1,
} from "@/lib/aerodynamics/aero-geometry-cv-adapter";
import { buildAeroScenarioCompareFromProposal } from "@/lib/aerodynamics/aero-scenario-runner";

export type ProcessAeroCaptureResult =
  | { ok: true; stagingRunId: string; jobId: string; confidence01: number }
  | { ok: false; code: string; message: string };

function reverseCameraMode(mode: string | null): "side" | "front" | "rear" | "multi_view" | "three_sixty" {
  if (mode === "front" || mode === "rear" || mode === "multi_view" || mode === "three_sixty") return mode;
  return "side";
}

export async function processAerodynamicsCaptureJob(
  db: SupabaseClient,
  input: { athleteId: string; jobId: string },
): Promise<ProcessAeroCaptureResult> {
  const claimed = await claimAerodynamicsCaptureJob(db, { athleteId: input.athleteId, jobId: input.jobId });
  if (!claimed) {
    return { ok: false, code: "job_not_pending", message: "Capture job non in coda o già elaborato." };
  }

  const mediaPath = claimed.media_storage_path?.trim();
  const contentType = claimed.media_content_type?.trim() || "image/jpeg";
  if (!mediaPath) {
    await failAerodynamicsCaptureJob(db, {
      athleteId: input.athleteId,
      jobId: input.jobId,
      errorMessage: "missing_media_path",
    });
    return { ok: false, code: "missing_media", message: "Media path assente sul job." };
  }

  const admin = createAeroServiceRoleClient();
  if (!admin) {
    await failAerodynamicsCaptureJob(db, {
      athleteId: input.athleteId,
      jobId: input.jobId,
      errorMessage: "aero_service_role_unavailable",
    });
    return { ok: false, code: "service_role", message: "Servizio storage non configurato." };
  }

  const signed = await admin.storage.from(AERO_CAPTURE_BUCKET).createSignedUrl(mediaPath, 600);
  if (signed.error || !signed.data?.signedUrl) {
    await failAerodynamicsCaptureJob(db, {
      athleteId: input.athleteId,
      jobId: input.jobId,
      errorMessage: signed.error?.message ?? "signed_url_failed",
    });
    return { ok: false, code: "media_url", message: "Impossibile aprire il media catturato." };
  }

  const cameraMode = reverseCameraMode(claimed.camera_mode);

  let proposal: AeroGeometryProposalV1;
  try {
    proposal = await extractAeroGeometryFromCv({
      mediaDownloadUrl: signed.data.signedUrl,
      athleteId: input.athleteId,
      cameraMode,
      contentType,
    });
  } catch (err) {
    const message =
      err instanceof AeroGeometryCvError
        ? `${err.code}: ${err.message}`
        : err instanceof Error
          ? err.message
          : "aero_cv_failed";
    await failAerodynamicsCaptureJob(db, {
      athleteId: input.athleteId,
      jobId: input.jobId,
      errorMessage: message,
    });
    return { ok: false, code: "cv_failed", message };
  }

  const scenarioCompare = buildAeroScenarioCompareFromProposal(proposal);

  const { data: stagingRow, error: stagingErr } = await db
    .from("interpretation_staging_runs")
    .insert({
      athlete_id: input.athleteId,
      domain: "aerodynamics",
      status: "pending_validation",
      trigger_source: "aero_capture_cv",
      source_refs: [{ table: "aero_capture_jobs", id: input.jobId }],
      candidate_bundle: {
        captureJobId: input.jobId,
        cameraMode,
        source: claimed.source,
        mediaStoragePath: mediaPath,
        mediaContentType: contentType,
        cvProvider: proposal.provider,
        cvModel: proposal.model ?? null,
      },
      proposed_structured_patches: { aeroGeometryProposal: proposal, aeroScenarioCompare: scenarioCompare },
      confidence: proposal.confidence01,
    })
    .select("id")
    .single<{ id: string }>();

  if (stagingErr || !stagingRow) {
    await failAerodynamicsCaptureJob(db, {
      athleteId: input.athleteId,
      jobId: input.jobId,
      errorMessage: stagingErr?.message ?? "staging_insert_failed",
    });
    return { ok: false, code: "staging_failed", message: stagingErr?.message ?? "Staging non creato." };
  }

  return {
    ok: true,
    stagingRunId: stagingRow.id,
    jobId: input.jobId,
    confidence01: proposal.confidence01,
  };
}
