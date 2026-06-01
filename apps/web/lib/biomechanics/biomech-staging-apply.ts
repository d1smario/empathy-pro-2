import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeBiomechanicsEfficiencyScores } from "@empathy/domain-biomechanics";
import type {
  BiomechanicsCaptureSource,
  BiomechanicsDiscipline,
  BiomechanicsJointAngleSample,
  BiomechanicsMovementPatternSummary,
  BiomechanicsRiskScores,
  BiomechanicsScaleCalibration,
} from "@empathy/contracts";

import {
  completeBiomechanicsCaptureJob,
  insertBiomechanicsSessionImport,
} from "@/lib/biomechanics/biomech-capture-pipeline";
import {
  parseBiomechPoseProposalV1,
  type BiomechPoseProposalV1,
} from "@/lib/biomechanics/biomech-pose-cv-adapter";

export const BIOMECH_ENGINE_VERSION = "biomechanics_engine_v1" as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readPoseProposal(patches: unknown): BiomechPoseProposalV1 | null {
  const row = asRecord(patches);
  if (!row?.biomechPoseProposal) return null;
  try {
    return parseBiomechPoseProposalV1(row.biomechPoseProposal);
  } catch {
    return null;
  }
}

function readCalibration(bundle: unknown): BiomechanicsScaleCalibration | undefined {
  const row = asRecord(bundle);
  const cal = asRecord(row?.calibration);
  if (!cal || typeof cal.method !== "string" || typeof cal.referenceLabel !== "string") return undefined;
  if (typeof cal.referenceValueMm !== "number") return undefined;
  return {
    method: cal.method as BiomechanicsScaleCalibration["method"],
    referenceLabel: cal.referenceLabel,
    referenceValueMm: cal.referenceValueMm,
    confidence01: typeof cal.confidence01 === "number" ? cal.confidence01 : undefined,
  };
}

export type ApplyBiomechStagingInput = {
  db: SupabaseClient;
  athleteId: string;
  runId: string;
  userId: string;
  reason?: string | null;
  calibration?: BiomechanicsScaleCalibration | null;
};

export type ApplyBiomechStagingResult =
  | { ok: true; sessionImportId: string; jobId: string | null; efficiencyScores: ReturnType<typeof computeBiomechanicsEfficiencyScores> }
  | { ok: false; error: string };

export async function applyBiomechanicsStagingRun(input: ApplyBiomechStagingInput): Promise<ApplyBiomechStagingResult> {
  const { data: run, error: runErr } = await input.db
    .from("interpretation_staging_runs")
    .select("id, athlete_id, domain, status, source_refs, candidate_bundle, proposed_structured_patches, confidence")
    .eq("id", input.runId)
    .eq("athlete_id", input.athleteId)
    .maybeSingle();

  if (runErr) return { ok: false, error: runErr.message };
  if (!run) return { ok: false, error: "staging_run_not_found" };
  if (run.domain !== "biomechanics") return { ok: false, error: "wrong_domain" };
  if (run.status === "committed" || run.status === "rejected" || run.status === "archived") {
    return { ok: false, error: "staging_already_closed" };
  }

  const proposal = readPoseProposal(run.proposed_structured_patches);
  if (!proposal) return { ok: false, error: "missing_pose_proposal" };

  const bundle = asRecord(run.candidate_bundle);
  const jobId = typeof bundle?.captureJobId === "string" ? bundle.captureJobId : null;
  const discipline = (typeof bundle?.discipline === "string" ? bundle.discipline : "movement_screening") as BiomechanicsDiscipline;
  const source = (
    typeof bundle?.source === "string" ? bundle.source : "smartphone_video"
  ) as BiomechanicsCaptureSource;
  const externalSessionId =
    typeof bundle?.externalSessionId === "string" ? bundle.externalSessionId : null;

  const jointAngles: BiomechanicsJointAngleSample[] = proposal.jointAngles;
  const movementPatterns: BiomechanicsMovementPatternSummary | undefined = proposal.movementPatterns;
  const riskScores: BiomechanicsRiskScores | undefined = proposal.riskScores;

  const efficiencyScores = computeBiomechanicsEfficiencyScores({
    jointAngles,
    movementPatterns,
    riskScores,
  });

  const calibration = input.calibration ?? readCalibration(bundle);
  const recordedAt = new Date().toISOString();
  const payload: Record<string, unknown> = {
    payloadVersion: "biomechanics_session_import_v1",
    discipline,
    calibration,
    landmarks: proposal.landmarks,
    jointAngles,
    anthropometrics: undefined,
    movementPatterns,
    riskScores: riskScores ?? {},
    efficiencyScores,
    correctiveActionTags: movementPatterns?.compensationFlags ?? [],
    confidence01: proposal.confidence01,
    algorithmVersion: BIOMECH_ENGINE_VERSION,
    stagingRunId: input.runId,
    cvProvider: proposal.provider,
    cvModel: proposal.model ?? null,
    mediaStoragePath: typeof bundle?.mediaStoragePath === "string" ? bundle.mediaStoragePath : null,
    captureJobId: jobId,
  };

  const sessionImportId = await insertBiomechanicsSessionImport(input.db, {
    athleteId: input.athleteId,
    source,
    recordedAt,
    payload,
    externalSessionId: typeof bundle?.externalSessionId === "string" ? bundle.externalSessionId : null,
  });

  if (jobId) {
    await completeBiomechanicsCaptureJob(input.db, {
      athleteId: input.athleteId,
      jobId,
      resultImportId: sessionImportId,
    });
  }

  const nowIso = new Date().toISOString();
  const { error: stagingUpdErr } = await input.db
    .from("interpretation_staging_runs")
    .update({ status: "committed", updated_at: nowIso })
    .eq("id", input.runId)
    .eq("athlete_id", input.athleteId);
  if (stagingUpdErr) return { ok: false, error: stagingUpdErr.message };

  await input.db.from("interpretation_staging_commits").insert({
    run_id: input.runId,
    athlete_id: input.athleteId,
    target: "biomech_session_imports",
    target_ids: [sessionImportId],
    status: "committed",
    reason: input.reason ?? null,
    payload: {
      domain: "biomechanics",
      captureJobId: jobId,
      sessionImportId,
      efficiencyScores,
      committedByRole: "athlete_or_coach",
    },
    committed_by: input.userId,
  });

  return { ok: true, sessionImportId, jobId, efficiencyScores };
}

export async function rejectBiomechanicsStagingRun(input: {
  db: SupabaseClient;
  athleteId: string;
  runId: string;
  userId: string;
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: run, error: runErr } = await input.db
    .from("interpretation_staging_runs")
    .select("id, athlete_id, domain, status, candidate_bundle")
    .eq("id", input.runId)
    .eq("athlete_id", input.athleteId)
    .maybeSingle();

  if (runErr) return { ok: false, error: runErr.message };
  if (!run) return { ok: false, error: "staging_run_not_found" };
  if (run.domain !== "biomechanics") return { ok: false, error: "wrong_domain" };
  if (run.status === "committed" || run.status === "rejected") return { ok: false, error: "staging_already_closed" };

  const bundle = asRecord(run.candidate_bundle);
  const jobId = typeof bundle?.captureJobId === "string" ? bundle.captureJobId : null;

  const { error: stagingErr } = await input.db
    .from("interpretation_staging_runs")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", input.runId)
    .eq("athlete_id", input.athleteId);
  if (stagingErr) return { ok: false, error: stagingErr.message };

  if (jobId) {
    await input.db
      .from("biomech_capture_jobs")
      .update({
        status: "cancelled",
        error_message: input.reason ?? "staging_rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("athlete_id", input.athleteId);
  }

  await input.db.from("interpretation_staging_commits").insert({
    run_id: input.runId,
    athlete_id: input.athleteId,
    target: "biomech_session_imports",
    target_ids: [],
    status: "rejected",
    reason: input.reason ?? null,
    payload: { domain: "biomechanics", captureJobId: jobId },
    committed_by: input.userId,
  });

  return { ok: true };
}
