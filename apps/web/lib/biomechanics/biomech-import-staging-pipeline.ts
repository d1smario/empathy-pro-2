import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BiomechanicsDiscipline } from "@empathy/contracts";

import {
  fetchOpenCapPoseProposal,
  OpenCapImportError,
} from "@/lib/biomechanics/adapters/opencap-session-adapter";
import {
  getBiomechLabProviderDescriptor,
  type BiomechLabProviderId,
} from "@/lib/biomechanics/biomech-lab-provider-registry";
import {
  mapBiomechanicsCameraPlaneToDb,
  mapBiomechanicsDisciplineToDbModality,
} from "@/lib/biomechanics/biomech-capture-pipeline";

export type ImportBiomechOpenCapInput = {
  athleteId: string;
  externalSessionId: string;
  discipline: BiomechanicsDiscipline;
  provider?: BiomechLabProviderId;
};

export type ImportBiomechOpenCapResult =
  | { ok: true; stagingRunId: string; jobId: string; confidence01: number }
  | { ok: false; code: string; message: string };

export async function importBiomechanicsOpenCapSession(
  db: SupabaseClient,
  input: ImportBiomechOpenCapInput,
): Promise<ImportBiomechOpenCapResult> {
  const providerId = input.provider ?? "opencap";
  const descriptor = getBiomechLabProviderDescriptor(providerId);

  const { data: existing } = await db
    .from("biomech_session_imports")
    .select("id")
    .eq("athlete_id", input.athleteId)
    .eq("external_session_id", input.externalSessionId)
    .maybeSingle();

  if (existing?.id) {
    return { ok: false, code: "duplicate_session", message: "Sessione OpenCap già importata per questo atleta." };
  }

  let proposal;
  try {
    proposal = await fetchOpenCapPoseProposal({
      externalSessionId: input.externalSessionId,
      athleteId: input.athleteId,
      discipline: input.discipline,
    });
  } catch (err) {
    const message =
      err instanceof OpenCapImportError
        ? `${err.code}: ${err.message}`
        : err instanceof Error
          ? err.message
          : "opencap_import_failed";
    return { ok: false, code: "import_failed", message };
  }

  const { data: jobRow, error: jobErr } = await db
    .from("biomech_capture_jobs")
    .insert({
      athlete_id: input.athleteId,
      status: "processing",
      modality: mapBiomechanicsDisciplineToDbModality(input.discipline),
      camera_plane: mapBiomechanicsCameraPlaneToDb("multi_view"),
      source: descriptor.captureSource,
      provider: providerId,
      external_session_id: input.externalSessionId,
    })
    .select("id")
    .single<{ id: string }>();

  if (jobErr || !jobRow) {
    return { ok: false, code: "job_insert_failed", message: jobErr?.message ?? "Job import non creato." };
  }

  const { data: stagingRow, error: stagingErr } = await db
    .from("interpretation_staging_runs")
    .insert({
      athlete_id: input.athleteId,
      domain: "biomechanics",
      status: "pending_validation",
      trigger_source: "biomech_external_import",
      source_refs: [{ table: "biomech_capture_jobs", id: jobRow.id }],
      candidate_bundle: {
        captureJobId: jobRow.id,
        discipline: input.discipline,
        source: descriptor.captureSource,
        provider: providerId,
        externalSessionId: input.externalSessionId,
        cameraPlaneDb: "multiview",
      },
      proposed_structured_patches: { biomechPoseProposal: proposal },
      confidence: proposal.confidence01,
    })
    .select("id")
    .single<{ id: string }>();

  if (stagingErr || !stagingRow) {
    await db
      .from("biomech_capture_jobs")
      .update({ status: "failed", error_message: stagingErr?.message ?? "staging_failed" })
      .eq("id", jobRow.id);
    return { ok: false, code: "staging_failed", message: stagingErr?.message ?? "Staging non creato." };
  }

  return { ok: true, stagingRunId: stagingRow.id, jobId: jobRow.id, confidence01: proposal.confidence01 };
}
