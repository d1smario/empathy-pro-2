import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BiomechanicsCameraPlane,
  BiomechanicsCaptureJobV1,
  BiomechanicsCaptureSource,
  BiomechanicsDiscipline,
  BiomechanicsSessionImportV1,
} from "@empathy/contracts";

export type BiomechDbModality = "gym" | "running" | "cycling" | "field_sport" | "other";
export type BiomechDbCameraPlane = "sagittal" | "frontal" | "oblique" | "multiview" | "unknown";

const BIOMECH_JOB_SELECT =
  "id, athlete_id, status, modality, stated_exercise_id, camera_plane, media_storage_path, media_content_type, source, provider, external_session_id, error_message, result_import_id, created_at, updated_at";

const BIOMECH_JOB_SELECT_LEGACY =
  "id, athlete_id, status, modality, stated_exercise_id, camera_plane, media_storage_path, media_content_type, error_message, result_import_id, created_at, updated_at";

function isMissingColumnError(error: { message?: string } | null | undefined): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("column") && (msg.includes("does not exist") || msg.includes("could not find"));
}

export type CreateBiomechCaptureJobInput = {
  athleteId: string;
  discipline: BiomechanicsDiscipline;
  source: BiomechanicsCaptureSource;
  cameraPlane: BiomechanicsCameraPlane;
  mediaStoragePath: string;
  mediaContentType: string;
  statedExerciseId?: string | null;
};

type BiomechCaptureJobRow = {
  id: string;
  athlete_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  modality: BiomechDbModality | null;
  stated_exercise_id: string | null;
  camera_plane: BiomechDbCameraPlane | null;
  media_storage_path: string | null;
  media_content_type: string | null;
  source: string | null;
  provider: string | null;
  external_session_id: string | null;
  error_message: string | null;
  result_import_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type BiomechSessionImportRow = {
  id: string;
  athlete_id: string;
  source: string;
  recorded_at: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export function mapBiomechanicsDisciplineToDbModality(discipline: BiomechanicsDiscipline): BiomechDbModality {
  switch (discipline) {
    case "cycling":
    case "running":
    case "gym":
      return discipline;
    case "walking":
    case "movement_screening":
      return "other";
  }
}

export function mapBiomechanicsCameraPlaneToDb(cameraPlane: BiomechanicsCameraPlane): BiomechDbCameraPlane {
  switch (cameraPlane) {
    case "front":
      return "frontal";
    case "side":
      return "sagittal";
    case "oblique":
      return "oblique";
    case "multi_view":
      return "multiview";
    case "rear":
      return "unknown";
  }
}

export function mapBiomechJobRow(row: BiomechCaptureJobRow): BiomechanicsCaptureJobV1 {
  const source =
    typeof row.source === "string" && row.source.trim()
      ? (row.source as BiomechanicsCaptureSource)
      : "smartphone_video";
  return {
    id: row.id,
    athleteId: row.athlete_id,
    status: row.status,
    source,
    discipline: row.modality === "cycling" || row.modality === "running" || row.modality === "gym" ? row.modality : "movement_screening",
    cameraPlane:
      row.camera_plane === "frontal"
        ? "front"
        : row.camera_plane === "sagittal"
          ? "side"
          : row.camera_plane === "oblique"
            ? "oblique"
            : row.camera_plane === "multiview"
              ? "multi_view"
              : "rear",
    mediaStoragePath: row.media_storage_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    errorMessage: row.error_message,
  };
}

export function mapBiomechSessionImportRow(row: BiomechSessionImportRow): BiomechanicsSessionImportV1 {
  const payload = row.payload;
  const discipline =
    typeof payload.discipline === "string"
      ? (payload.discipline as BiomechanicsDiscipline)
      : "movement_screening";
  const source =
    typeof row.source === "string" && row.source.trim()
      ? (row.source as BiomechanicsCaptureSource)
      : "manual_import";
  return {
    id: row.id,
    athleteId: row.athlete_id,
    recordedAt: row.recorded_at,
    source,
    discipline,
    calibration: payload.calibration as BiomechanicsSessionImportV1["calibration"],
    landmarks: Array.isArray(payload.landmarks) ? (payload.landmarks as BiomechanicsSessionImportV1["landmarks"]) : undefined,
    jointAngles: Array.isArray(payload.jointAngles) ? (payload.jointAngles as BiomechanicsSessionImportV1["jointAngles"]) : undefined,
    anthropometrics: payload.anthropometrics as BiomechanicsSessionImportV1["anthropometrics"],
    movementPatterns: payload.movementPatterns as BiomechanicsSessionImportV1["movementPatterns"],
    riskScores: payload.riskScores as BiomechanicsSessionImportV1["riskScores"],
    efficiencyScores: payload.efficiencyScores as BiomechanicsSessionImportV1["efficiencyScores"],
    payloadVersion: "biomechanics_session_import_v1",
    payload,
  };
}

export async function createBiomechanicsCaptureJob(
  db: SupabaseClient,
  input: CreateBiomechCaptureJobInput,
): Promise<BiomechanicsCaptureJobV1> {
  const baseRow = {
    athlete_id: input.athleteId,
    status: "pending" as const,
    modality: mapBiomechanicsDisciplineToDbModality(input.discipline),
    stated_exercise_id: input.statedExerciseId?.trim() || null,
    camera_plane: mapBiomechanicsCameraPlaneToDb(input.cameraPlane),
    media_storage_path: input.mediaStoragePath,
    media_content_type: input.mediaContentType,
  };

  let result = await db
    .from("biomech_capture_jobs")
    .insert({ ...baseRow, source: input.source, provider: "generic_cv" })
    .select(BIOMECH_JOB_SELECT)
    .single<BiomechCaptureJobRow>();

  if (result.error && isMissingColumnError(result.error)) {
    result = await db.from("biomech_capture_jobs").insert(baseRow).select(BIOMECH_JOB_SELECT_LEGACY).single<BiomechCaptureJobRow>();
  }

  const { data, error } = result;
  if (error || !data) {
    throw new Error(error?.message ?? "biomech_capture_job_insert_failed");
  }

  return mapBiomechJobRow(data);
}

export async function listBiomechanicsCaptureJobs(db: SupabaseClient, athleteId: string): Promise<BiomechanicsCaptureJobV1[]> {
  let result = await db
    .from("biomech_capture_jobs")
    .select(BIOMECH_JOB_SELECT)
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<BiomechCaptureJobRow[]>();

  if (result.error && isMissingColumnError(result.error)) {
    result = await db
      .from("biomech_capture_jobs")
      .select(BIOMECH_JOB_SELECT_LEGACY)
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<BiomechCaptureJobRow[]>();
  }

  if (result.error) {
    throw new Error(result.error.message || "biomech_capture_jobs_read_failed");
  }
  return (result.data ?? []).map(mapBiomechJobRow);
}

export async function listBiomechanicsSessionImports(
  db: SupabaseClient,
  athleteId: string,
): Promise<BiomechanicsSessionImportV1[]> {
  const { data, error } = await db
    .from("biomech_session_imports")
    .select("id, athlete_id, source, recorded_at, payload, created_at")
    .eq("athlete_id", athleteId)
    .order("recorded_at", { ascending: false })
    .limit(20)
    .returns<BiomechSessionImportRow[]>();

  if (error) {
    throw new Error(error.message || "biomech_session_imports_read_failed");
  }
  return (data ?? []).map(mapBiomechSessionImportRow);
}

export async function getBiomechanicsSessionImportById(
  db: SupabaseClient,
  input: { athleteId: string; sessionId: string },
): Promise<BiomechanicsSessionImportV1 | null> {
  const { data, error } = await db
    .from("biomech_session_imports")
    .select("id, athlete_id, source, recorded_at, payload, created_at")
    .eq("id", input.sessionId)
    .eq("athlete_id", input.athleteId)
    .maybeSingle<BiomechSessionImportRow>();

  if (error) {
    throw new Error(error.message || "biomech_session_import_read_failed");
  }
  return data ? mapBiomechSessionImportRow(data) : null;
}

export async function getBiomechanicsCaptureJobById(
  db: SupabaseClient,
  input: { athleteId: string; jobId: string },
): Promise<BiomechanicsCaptureJobV1 | null> {
  let result = await db
    .from("biomech_capture_jobs")
    .select(BIOMECH_JOB_SELECT)
    .eq("id", input.jobId)
    .eq("athlete_id", input.athleteId)
    .maybeSingle<BiomechCaptureJobRow>();

  if (result.error && isMissingColumnError(result.error)) {
    result = await db
      .from("biomech_capture_jobs")
      .select(BIOMECH_JOB_SELECT_LEGACY)
      .eq("id", input.jobId)
      .eq("athlete_id", input.athleteId)
      .maybeSingle<BiomechCaptureJobRow>();
  }

  if (result.error) throw new Error(result.error.message || "biomech_capture_job_read_failed");
  return result.data ? mapBiomechJobRow(result.data) : null;
}

export async function claimBiomechanicsCaptureJob(
  db: SupabaseClient,
  input: { athleteId: string; jobId: string },
): Promise<BiomechCaptureJobRow | null> {
  let result = await db
    .from("biomech_capture_jobs")
    .update({ status: "processing", updated_at: new Date().toISOString(), error_message: null })
    .eq("id", input.jobId)
    .eq("athlete_id", input.athleteId)
    .eq("status", "pending")
    .select(BIOMECH_JOB_SELECT)
    .maybeSingle<BiomechCaptureJobRow>();

  if (result.error && isMissingColumnError(result.error)) {
    result = await db
      .from("biomech_capture_jobs")
      .update({ status: "processing", updated_at: new Date().toISOString(), error_message: null })
      .eq("id", input.jobId)
      .eq("athlete_id", input.athleteId)
      .eq("status", "pending")
      .select(BIOMECH_JOB_SELECT_LEGACY)
      .maybeSingle<BiomechCaptureJobRow>();
  }

  if (result.error) throw new Error(result.error.message || "biomech_capture_job_claim_failed");
  return result.data ?? null;
}

export async function failBiomechanicsCaptureJob(
  db: SupabaseClient,
  input: { athleteId: string; jobId: string; errorMessage: string },
): Promise<void> {
  const { error } = await db
    .from("biomech_capture_jobs")
    .update({
      status: "failed",
      error_message: input.errorMessage.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.jobId)
    .eq("athlete_id", input.athleteId);
  if (error) throw new Error(error.message || "biomech_capture_job_fail_update_failed");
}

export async function completeBiomechanicsCaptureJob(
  db: SupabaseClient,
  input: { athleteId: string; jobId: string; resultImportId: string },
): Promise<void> {
  const { error } = await db
    .from("biomech_capture_jobs")
    .update({
      status: "completed",
      result_import_id: input.resultImportId,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.jobId)
    .eq("athlete_id", input.athleteId);
  if (error) throw new Error(error.message || "biomech_capture_job_complete_failed");
}

export async function insertBiomechanicsSessionImport(
  db: SupabaseClient,
  input: {
    athleteId: string;
    source: BiomechanicsCaptureSource;
    recordedAt: string;
    payload: Record<string, unknown>;
    externalSessionId?: string | null;
  },
): Promise<string> {
  const { data, error } = await db
    .from("biomech_session_imports")
    .insert({
      athlete_id: input.athleteId,
      schema_version: 1,
      source: input.source,
      recorded_at: input.recordedAt,
      external_session_id: input.externalSessionId ?? null,
      payload: input.payload,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) throw new Error(error?.message ?? "biomech_session_import_insert_failed");
  return data.id;
}

export async function reopenBiomechanicsCaptureJobForRetry(
  db: SupabaseClient,
  input: { athleteId: string; jobId: string },
): Promise<boolean> {
  const { data, error } = await db
    .from("biomech_capture_jobs")
    .update({
      status: "pending",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.jobId)
    .eq("athlete_id", input.athleteId)
    .in("status", ["processing", "failed"])
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(error.message || "biomech_capture_job_reopen_failed");
  return Boolean(data?.id);
}

export async function findPendingBiomechanicsStagingForJob(
  db: SupabaseClient,
  input: { athleteId: string; jobId: string },
): Promise<{ id: string; confidence01: number } | null> {
  const { data, error } = await db
    .from("interpretation_staging_runs")
    .select("id, confidence, candidate_bundle, proposed_structured_patches")
    .eq("athlete_id", input.athleteId)
    .eq("domain", "biomechanics")
    .eq("status", "pending_validation")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (error.message?.includes("interpretation_staging_runs")) return null;
    throw new Error(error.message || "biomech_staging_lookup_failed");
  }

  for (const row of data ?? []) {
    const bundle =
      row.candidate_bundle && typeof row.candidate_bundle === "object" && !Array.isArray(row.candidate_bundle)
        ? (row.candidate_bundle as Record<string, unknown>)
        : {};
    if (bundle.captureJobId !== input.jobId) continue;
    const confidence =
      typeof row.confidence === "number" && Number.isFinite(row.confidence) ? row.confidence : 0.82;
    return { id: String(row.id), confidence01: confidence };
  }
  return null;
}

export async function listPendingBiomechanicsStagingRuns(
  db: SupabaseClient,
  athleteId: string,
): Promise<Array<{ id: string; status: string; createdAt: string; jobId: string | null }>> {
  const { data, error } = await db
    .from("interpretation_staging_runs")
    .select("id, status, created_at, candidate_bundle")
    .eq("athlete_id", athleteId)
    .eq("domain", "biomechanics")
    .eq("status", "pending_validation")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    if (error.message?.includes("interpretation_staging_runs")) return [];
    throw new Error(error.message || "biomech_staging_list_failed");
  }

  return (data ?? []).map((row) => {
    const bundle =
      row.candidate_bundle && typeof row.candidate_bundle === "object" && !Array.isArray(row.candidate_bundle)
        ? (row.candidate_bundle as Record<string, unknown>)
        : {};
    return {
      id: String(row.id),
      status: String(row.status),
      createdAt: String(row.created_at),
      jobId: typeof bundle.captureJobId === "string" ? bundle.captureJobId : null,
    };
  });
}
