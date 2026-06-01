import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BiomechanicsJointAngleSample, BiomechanicsLandmark3D } from "@empathy/contracts";
import { computeBiomechanicsEfficiencyScores } from "@empathy/domain-biomechanics";

import { deriveJointAnglesFromLandmarks } from "@/lib/biomechanics/biomech-landmark-angles";
import { normalizeMonolateralLandmarks } from "@/lib/biomechanics/biomech-skeleton-overlay";
import { POSE_PROPOSAL_VERSION, type BiomechPoseProposalV1 } from "@/lib/biomechanics/biomech-pose-cv-adapter";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readExistingProposal(patches: unknown): Record<string, unknown> | null {
  const root = asRecord(patches);
  return asRecord(root?.biomechPoseProposal);
}

export type PatchBiomechStagingPoseInput = {
  db: SupabaseClient;
  athleteId: string;
  runId: string;
  landmarks: BiomechanicsLandmark3D[];
  jointAngles?: BiomechanicsJointAngleSample[];
};

export type PatchBiomechStagingPoseResult =
  | {
      ok: true;
      jointAngles: BiomechanicsJointAngleSample[];
      efficiencyScores: ReturnType<typeof computeBiomechanicsEfficiencyScores>;
    }
  | { ok: false; error: string };

export async function patchBiomechanicsStagingPoseProposal(
  input: PatchBiomechStagingPoseInput,
): Promise<PatchBiomechStagingPoseResult> {
  const { data: run, error: runErr } = await input.db
    .from("interpretation_staging_runs")
    .select("id, athlete_id, domain, status, proposed_structured_patches")
    .eq("id", input.runId)
    .eq("athlete_id", input.athleteId)
    .maybeSingle();

  if (runErr) return { ok: false, error: runErr.message };
  if (!run) return { ok: false, error: "staging_run_not_found" };
  if (run.domain !== "biomechanics") return { ok: false, error: "wrong_domain" };
  if (run.status === "committed" || run.status === "rejected" || run.status === "archived") {
    return { ok: false, error: "staging_already_closed" };
  }

  const existing = readExistingProposal(run.proposed_structured_patches);
  if (!existing) return { ok: false, error: "missing_pose_proposal" };

  const templateAngles = Array.isArray(existing.jointAngles)
    ? (existing.jointAngles as BiomechanicsJointAngleSample[])
    : [];
  const jointAngles =
    input.jointAngles?.length
      ? input.jointAngles
      : deriveJointAnglesFromLandmarks(input.landmarks, templateAngles);

  const landmarks = normalizeMonolateralLandmarks(input.landmarks);

  const movementPatterns = existing.movementPatterns as BiomechPoseProposalV1["movementPatterns"];
  const riskScores = existing.riskScores as BiomechPoseProposalV1["riskScores"];
  const efficiencyScores = computeBiomechanicsEfficiencyScores({
    jointAngles,
    movementPatterns,
    riskScores,
  });

  const updatedProposal: Record<string, unknown> = {
    ...existing,
    version: POSE_PROPOSAL_VERSION,
    landmarks,
    jointAngles,
    manuallyAdjusted: true,
    adjustedAt: new Date().toISOString(),
  };

  const patchesRoot = asRecord(run.proposed_structured_patches) ?? {};
  const { error: updErr } = await input.db
    .from("interpretation_staging_runs")
    .update({
      proposed_structured_patches: {
        ...patchesRoot,
        biomechPoseProposal: updatedProposal,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.runId)
    .eq("athlete_id", input.athleteId);

  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true, jointAngles, efficiencyScores };
}
