import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BiomechanicsCaptureSource, BiomechanicsDiscipline } from "@empathy/contracts";

import {
  BIOMECH_CAPTURE_BUCKET,
  createBiomechServiceRoleClient,
} from "@/lib/biomechanics/biomech-capture-storage";
import {
  claimBiomechanicsCaptureJob,
  failBiomechanicsCaptureJob,
  findPendingBiomechanicsStagingForJob,
  mapBiomechanicsCameraPlaneToDb,
  mapBiomechanicsDisciplineToDbModality,
  reopenBiomechanicsCaptureJobForRetry,
} from "@/lib/biomechanics/biomech-capture-pipeline";
import {
  BiomechPoseCvError,
  extractBiomechPoseFromCv,
  type BiomechPoseProposalV1,
} from "@/lib/biomechanics/biomech-pose-cv-adapter";
import { isLabInlineMockEnabled } from "@/lib/lab/lab-inline-mock-fixtures";

export type ProcessBiomechCaptureResult =
  | { ok: true; stagingRunId: string; jobId: string; confidence01: number }
  | { ok: false; code: string; message: string };

function isStagingDomainError(error: { message?: string } | null | undefined): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("interpretation_staging_runs_domain_check") || (msg.includes("domain") && msg.includes("check"));
}

function reverseDiscipline(modality: string | null): BiomechanicsDiscipline {
  if (modality === "cycling" || modality === "running" || modality === "gym") return modality;
  return "movement_screening";
}

function reverseCameraPlane(plane: string | null): "front" | "side" | "rear" | "oblique" | "multi_view" {
  switch (plane) {
    case "frontal":
      return "front";
    case "sagittal":
      return "side";
    case "oblique":
      return "oblique";
    case "multiview":
      return "multi_view";
    default:
      return "rear";
  }
}

export async function processBiomechanicsCaptureJob(
  db: SupabaseClient,
  input: { athleteId: string; jobId: string; source?: BiomechanicsCaptureSource },
): Promise<ProcessBiomechCaptureResult> {
  let claimed = await claimBiomechanicsCaptureJob(db, { athleteId: input.athleteId, jobId: input.jobId });
  if (!claimed) {
    const existingStaging = await findPendingBiomechanicsStagingForJob(db, {
      athleteId: input.athleteId,
      jobId: input.jobId,
    });
    if (existingStaging) {
      return {
        ok: true,
        stagingRunId: existingStaging.id,
        jobId: input.jobId,
        confidence01: existingStaging.confidence01,
      };
    }

    const reopened = await reopenBiomechanicsCaptureJobForRetry(db, {
      athleteId: input.athleteId,
      jobId: input.jobId,
    });
    if (reopened) {
      claimed = await claimBiomechanicsCaptureJob(db, { athleteId: input.athleteId, jobId: input.jobId });
    }
  }

  if (!claimed) {
    return { ok: false, code: "job_not_pending", message: "Capture job non in coda o già elaborato." };
  }

  const mediaPath = claimed.media_storage_path?.trim();
  const contentType = claimed.media_content_type?.trim() || "video/mp4";
  if (!mediaPath) {
    await failBiomechanicsCaptureJob(db, {
      athleteId: input.athleteId,
      jobId: input.jobId,
      errorMessage: "missing_media_path",
    });
    return { ok: false, code: "missing_media", message: "Media path assente sul job." };
  }

  const admin = createBiomechServiceRoleClient();
  let mediaDownloadUrl: string;

  if (isLabInlineMockEnabled()) {
    mediaDownloadUrl = "inline://lab-mock";
  } else {
    if (!admin) {
      await failBiomechanicsCaptureJob(db, {
        athleteId: input.athleteId,
        jobId: input.jobId,
        errorMessage: "biomech_service_role_unavailable",
      });
      return { ok: false, code: "service_role", message: "Servizio storage non configurato." };
    }

    const signed = await admin.storage.from(BIOMECH_CAPTURE_BUCKET).createSignedUrl(mediaPath, 600);
    if (signed.error || !signed.data?.signedUrl) {
      await failBiomechanicsCaptureJob(db, {
        athleteId: input.athleteId,
        jobId: input.jobId,
        errorMessage: signed.error?.message ?? "signed_url_failed",
      });
      return { ok: false, code: "media_url", message: "Impossibile aprire il media catturato." };
    }
    mediaDownloadUrl = signed.data.signedUrl;
  }

  const discipline = reverseDiscipline(claimed.modality);
  const cameraPlane = reverseCameraPlane(claimed.camera_plane);

  let proposal: BiomechPoseProposalV1;
  try {
    proposal = await extractBiomechPoseFromCv({
      mediaDownloadUrl,
      athleteId: input.athleteId,
      discipline,
      cameraPlane,
      contentType,
    });
  } catch (err) {
    const message =
      err instanceof BiomechPoseCvError
        ? `${err.code}: ${err.message}`
        : err instanceof Error
          ? err.message
          : "pose_cv_failed";
    await failBiomechanicsCaptureJob(db, {
      athleteId: input.athleteId,
      jobId: input.jobId,
      errorMessage: message,
    });
    return { ok: false, code: "cv_failed", message };
  }

  const { data: stagingRow, error: stagingErr } = await db
    .from("interpretation_staging_runs")
    .insert({
      athlete_id: input.athleteId,
      domain: "biomechanics",
      status: "pending_validation",
      trigger_source: "biomech_capture_cv",
      source_refs: [{ table: "biomech_capture_jobs", id: input.jobId }],
      candidate_bundle: {
        captureJobId: input.jobId,
        discipline,
        cameraPlane,
        modality: mapBiomechanicsDisciplineToDbModality(discipline),
        cameraPlaneDb: mapBiomechanicsCameraPlaneToDb(cameraPlane),
        mediaStoragePath: mediaPath,
        mediaContentType: contentType,
        cvProvider: proposal.provider,
        cvModel: proposal.model ?? null,
      },
      proposed_structured_patches: { biomechPoseProposal: proposal },
      confidence: proposal.confidence01,
    })
    .select("id")
    .single<{ id: string }>();

  if (stagingErr || !stagingRow) {
    const stagingMessage = stagingErr?.message ?? "Staging non creato.";
    await failBiomechanicsCaptureJob(db, {
      athleteId: input.athleteId,
      jobId: input.jobId,
      errorMessage: stagingErr?.message ?? "staging_insert_failed",
    });
    if (isStagingDomainError(stagingErr)) {
      return {
        ok: false,
        code: "migration_required",
        message: "Migration Supabase 072_lab_staging_domains_v1 non applicata. Applica le migration lab su Supabase.",
      };
    }
    return { ok: false, code: "staging_failed", message: stagingMessage };
  }

  return {
    ok: true,
    stagingRunId: stagingRow.id,
    jobId: input.jobId,
    confidence01: proposal.confidence01,
  };
}
