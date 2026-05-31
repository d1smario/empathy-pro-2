import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildAerodynamicsOptimizationResult,
  buildCdAEstimate,
  computeAerodynamicsScores,
  estimateCdaFromPositionSurrogate,
  findScenarioById,
} from "@empathy/domain-aerodynamics";
import type { AerodynamicsCaptureSource, AerodynamicsScenarioCompareV1 } from "@empathy/contracts";

import {
  completeAerodynamicsCaptureJob,
  insertAerodynamicsTestSession,
} from "@/lib/aerodynamics/aero-capture-pipeline";
import {
  parseAeroGeometryProposalV1,
  type AeroGeometryProposalV1,
} from "@/lib/aerodynamics/aero-geometry-cv-adapter";
import {
  buildAeroScenarioCompareFromProposal,
  DEFAULT_AERO_REFERENCE_SPEED_KPH,
} from "@/lib/aerodynamics/aero-scenario-runner";

export const AERO_ENGINE_VERSION = "aerodynamics_engine_v2" as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readGeometryProposal(patches: unknown): AeroGeometryProposalV1 | null {
  const row = asRecord(patches);
  if (!row?.aeroGeometryProposal) return null;
  try {
    return parseAeroGeometryProposalV1(row.aeroGeometryProposal);
  } catch {
    return null;
  }
}

function readScenarioCompare(patches: unknown): AerodynamicsScenarioCompareV1 | null {
  const row = asRecord(patches);
  const raw = row?.aeroScenarioCompare;
  if (!raw || typeof raw !== "object") return null;
  const compare = raw as AerodynamicsScenarioCompareV1;
  if (compare.version !== "aero_scenario_compare_v1" || !Array.isArray(compare.candidates)) return null;
  return compare;
}

export type ApplyAeroStagingInput = {
  db: SupabaseClient;
  athleteId: string;
  runId: string;
  userId: string;
  reason?: string | null;
  selectedScenarioId?: string | null;
};

export type ApplyAeroStagingResult =
  | { ok: true; testSessionId: string; jobId: string | null; cdaM2: number; scores: ReturnType<typeof computeAerodynamicsScores> }
  | { ok: false; error: string };

export async function applyAerodynamicsStagingRun(input: ApplyAeroStagingInput): Promise<ApplyAeroStagingResult> {
  const { data: run, error: runErr } = await input.db
    .from("interpretation_staging_runs")
    .select("id, athlete_id, domain, status, candidate_bundle, proposed_structured_patches, confidence")
    .eq("id", input.runId)
    .eq("athlete_id", input.athleteId)
    .maybeSingle();

  if (runErr) return { ok: false, error: runErr.message };
  if (!run) return { ok: false, error: "staging_run_not_found" };
  if (run.domain !== "aerodynamics") return { ok: false, error: "wrong_domain" };
  if (run.status === "committed" || run.status === "rejected" || run.status === "archived") {
    return { ok: false, error: "staging_already_closed" };
  }

  const proposal = readGeometryProposal(run.proposed_structured_patches);
  if (!proposal) return { ok: false, error: "missing_geometry_proposal" };

  const scenarioCompare =
    readScenarioCompare(run.proposed_structured_patches) ?? buildAeroScenarioCompareFromProposal(proposal);

  const selectedId = input.selectedScenarioId?.trim() || scenarioCompare.selectedScenarioId || "baseline";
  const selectedScenario =
    findScenarioById(scenarioCompare, selectedId) ??
    findScenarioById(scenarioCompare, "baseline") ??
    scenarioCompare.candidates[0];
  if (!selectedScenario) return { ok: false, error: "missing_scenario" };

  const bundle = asRecord(run.candidate_bundle);
  const jobId = typeof bundle?.captureJobId === "string" ? bundle.captureJobId : null;
  const source = (typeof bundle?.source === "string" ? bundle.source : "smartphone_video") as AerodynamicsCaptureSource;

  const baselineCda = estimateCdaFromPositionSurrogate({
    position: proposal.position,
    geometry: proposal.geometry,
    equipment: proposal.equipment,
    cdaSurrogateM2: proposal.cdaSurrogateM2,
  });
  const optimizedCda = selectedScenario.id === "baseline" ? baselineCda : selectedScenario.cdaM2;

  const cdaEstimate = buildCdAEstimate({
    cdaM2: baselineCda,
    speedKph: scenarioCompare.referenceSpeedKph ?? DEFAULT_AERO_REFERENCE_SPEED_KPH,
    confidence01: proposal.confidence01,
    method: "surrogate_model",
  });
  const optimization = buildAerodynamicsOptimizationResult({
    baselineCdaM2: baselineCda,
    optimizedCdaM2: optimizedCda,
    referenceSpeedKph: scenarioCompare.referenceSpeedKph ?? DEFAULT_AERO_REFERENCE_SPEED_KPH,
    confidence01: selectedScenario.confidence01,
    changedVariables: selectedScenario.changedVariables.length
      ? selectedScenario.changedVariables
      : ["torsoAngleDeg", "headDropMm"],
  });
  const scores = computeAerodynamicsScores({
    cdaM2: baselineCda,
    optimizedCdaM2: optimizedCda,
    positionConfidence01: proposal.position.confidence01 ?? proposal.confidence01,
    equipmentConfidence01: proposal.confidence01 * 0.9,
  });

  const recordedAt = new Date().toISOString();
  const payload: Record<string, unknown> = {
    payloadVersion: "aerodynamics_test_session_v1",
    stagingRunId: input.runId,
    algorithmVersion: AERO_ENGINE_VERSION,
    cvProvider: proposal.provider,
    cvModel: proposal.model ?? null,
    scenarioCompare: { ...scenarioCompare, selectedScenarioId: selectedScenario.id },
    selectedScenario,
  };

  const testSessionId = await insertAerodynamicsTestSession(input.db, {
    athleteId: input.athleteId,
    source,
    recordedAt,
    position: selectedScenario.id === "baseline" ? proposal.position : selectedScenario.position,
    equipment: selectedScenario.equipment ?? proposal.equipment,
    geometry: proposal.geometry ?? null,
    cdaEstimate: cdaEstimate as unknown as Record<string, unknown>,
    optimization: optimization as unknown as Record<string, unknown>,
    scores: scores as unknown as Record<string, unknown>,
    payload,
  });

  if (jobId) {
    await completeAerodynamicsCaptureJob(input.db, {
      athleteId: input.athleteId,
      jobId,
      resultTestSessionId: testSessionId,
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
    target: "aero_test_sessions",
    target_ids: [testSessionId],
    status: "committed",
    reason: input.reason ?? null,
    payload: {
      domain: "aerodynamics",
      captureJobId: jobId,
      testSessionId,
      cdaM2: baselineCda,
      selectedScenarioId: selectedScenario.id,
      scores,
    },
    committed_by: input.userId,
  });

  return { ok: true, testSessionId, jobId, cdaM2: baselineCda, scores };
}

export async function rejectAerodynamicsStagingRun(input: {
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
  if (run.domain !== "aerodynamics") return { ok: false, error: "wrong_domain" };
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
      .from("aero_capture_jobs")
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
    target: "aero_test_sessions",
    target_ids: [],
    status: "rejected",
    reason: input.reason ?? null,
    payload: { domain: "aerodynamics", captureJobId: jobId },
    committed_by: input.userId,
  });

  return { ok: true };
}
