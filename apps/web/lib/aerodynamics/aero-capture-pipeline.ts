import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AerodynamicsCameraMode,
  AerodynamicsCaptureJobV1,
  AerodynamicsCaptureSource,
  AerodynamicsEquipmentSnapshot,
  AerodynamicsPositionSnapshot,
  AerodynamicsTestSessionV1,
} from "@empathy/contracts";

export type CreateAeroCaptureJobInput = {
  athleteId: string;
  source: AerodynamicsCaptureSource;
  cameraMode: AerodynamicsCameraMode;
  mediaStoragePath: string;
  mediaContentType: string;
};

type AeroCaptureJobRow = {
  id: string;
  athlete_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  source: AerodynamicsCaptureSource;
  camera_mode: AerodynamicsCameraMode | "unknown" | null;
  media_storage_path: string | null;
  media_content_type: string | null;
  error_message: string | null;
  result_test_session_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type AeroTestSessionRow = {
  id: string;
  athlete_id: string;
  source: AerodynamicsCaptureSource;
  recorded_at: string;
  position: AerodynamicsPositionSnapshot;
  equipment: AerodynamicsEquipmentSnapshot;
  geometry: Record<string, unknown> | null;
  cda_estimate: Record<string, unknown>;
  optimization: Record<string, unknown> | null;
  scores: Record<string, unknown> | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export function mapAeroJobRow(row: AeroCaptureJobRow): AerodynamicsCaptureJobV1 {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    status: row.status,
    source: row.source,
    cameraMode: row.camera_mode === "unknown" || !row.camera_mode ? "side" : row.camera_mode,
    mediaStoragePath: row.media_storage_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    errorMessage: row.error_message,
  };
}

export function mapAeroTestSessionRow(row: AeroTestSessionRow): AerodynamicsTestSessionV1 {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    recordedAt: row.recorded_at,
    source: row.source,
    position: row.position ?? {},
    equipment: row.equipment ?? {},
    geometry: row.geometry ?? undefined,
    cdaEstimate: row.cda_estimate as AerodynamicsTestSessionV1["cdaEstimate"],
    optimization: (row.optimization ?? undefined) as AerodynamicsTestSessionV1["optimization"],
    scores: (row.scores ?? undefined) as AerodynamicsTestSessionV1["scores"],
    payloadVersion: "aerodynamics_test_session_v1",
    payload: row.payload ?? {},
  };
}

export async function createAerodynamicsCaptureJob(
  db: SupabaseClient,
  input: CreateAeroCaptureJobInput,
): Promise<AerodynamicsCaptureJobV1> {
  const { data, error } = await db
    .from("aero_capture_jobs")
    .insert({
      athlete_id: input.athleteId,
      status: "pending",
      source: input.source,
      camera_mode: input.cameraMode,
      media_storage_path: input.mediaStoragePath,
      media_content_type: input.mediaContentType,
    })
    .select(
      "id, athlete_id, status, source, camera_mode, media_storage_path, media_content_type, error_message, result_test_session_id, created_at, updated_at",
    )
    .single<AeroCaptureJobRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "aero_capture_job_insert_failed");
  }
  return mapAeroJobRow(data);
}

export async function listAerodynamicsCaptureJobs(db: SupabaseClient, athleteId: string): Promise<AerodynamicsCaptureJobV1[]> {
  const { data, error } = await db
    .from("aero_capture_jobs")
    .select(
      "id, athlete_id, status, source, camera_mode, media_storage_path, media_content_type, error_message, result_test_session_id, created_at, updated_at",
    )
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<AeroCaptureJobRow[]>();

  if (error) {
    throw new Error(error.message || "aero_capture_jobs_read_failed");
  }
  return (data ?? []).map(mapAeroJobRow);
}

export async function listAerodynamicsTestSessions(db: SupabaseClient, athleteId: string): Promise<AerodynamicsTestSessionV1[]> {
  const { data, error } = await db
    .from("aero_test_sessions")
    .select("id, athlete_id, source, recorded_at, position, equipment, geometry, cda_estimate, optimization, scores, payload, created_at")
    .eq("athlete_id", athleteId)
    .order("recorded_at", { ascending: false })
    .limit(20)
    .returns<AeroTestSessionRow[]>();

  if (error) {
    throw new Error(error.message || "aero_test_sessions_read_failed");
  }
  return (data ?? []).map(mapAeroTestSessionRow);
}

export async function getAerodynamicsCaptureJobById(
  db: SupabaseClient,
  input: { athleteId: string; jobId: string },
): Promise<AerodynamicsCaptureJobV1 | null> {
  const { data, error } = await db
    .from("aero_capture_jobs")
    .select(
      "id, athlete_id, status, source, camera_mode, media_storage_path, media_content_type, error_message, result_test_session_id, created_at, updated_at",
    )
    .eq("id", input.jobId)
    .eq("athlete_id", input.athleteId)
    .maybeSingle<AeroCaptureJobRow>();

  if (error) throw new Error(error.message || "aero_capture_job_read_failed");
  return data ? mapAeroJobRow(data) : null;
}

export async function claimAerodynamicsCaptureJob(
  db: SupabaseClient,
  input: { athleteId: string; jobId: string },
): Promise<AeroCaptureJobRow | null> {
  const { data, error } = await db
    .from("aero_capture_jobs")
    .update({ status: "processing", updated_at: new Date().toISOString(), error_message: null })
    .eq("id", input.jobId)
    .eq("athlete_id", input.athleteId)
    .eq("status", "pending")
    .select(
      "id, athlete_id, status, source, camera_mode, media_storage_path, media_content_type, error_message, result_test_session_id, created_at, updated_at",
    )
    .maybeSingle<AeroCaptureJobRow>();

  if (error) throw new Error(error.message || "aero_capture_job_claim_failed");
  return data ?? null;
}

export async function failAerodynamicsCaptureJob(
  db: SupabaseClient,
  input: { athleteId: string; jobId: string; errorMessage: string },
): Promise<void> {
  const { error } = await db
    .from("aero_capture_jobs")
    .update({
      status: "failed",
      error_message: input.errorMessage.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.jobId)
    .eq("athlete_id", input.athleteId);
  if (error) throw new Error(error.message || "aero_capture_job_fail_update_failed");
}

export async function completeAerodynamicsCaptureJob(
  db: SupabaseClient,
  input: { athleteId: string; jobId: string; resultTestSessionId: string },
): Promise<void> {
  const { error } = await db
    .from("aero_capture_jobs")
    .update({
      status: "completed",
      result_test_session_id: input.resultTestSessionId,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.jobId)
    .eq("athlete_id", input.athleteId);
  if (error) throw new Error(error.message || "aero_capture_job_complete_failed");
}

export async function insertAerodynamicsTestSession(
  db: SupabaseClient,
  input: {
    athleteId: string;
    source: AerodynamicsCaptureSource;
    recordedAt: string;
    position: AerodynamicsPositionSnapshot;
    equipment: AerodynamicsEquipmentSnapshot;
    geometry?: Record<string, unknown> | null;
    cdaEstimate: Record<string, unknown>;
    optimization?: Record<string, unknown> | null;
    scores?: Record<string, unknown> | null;
    payload: Record<string, unknown>;
  },
): Promise<string> {
  const { data, error } = await db
    .from("aero_test_sessions")
    .insert({
      athlete_id: input.athleteId,
      schema_version: 1,
      source: input.source,
      recorded_at: input.recordedAt,
      position: input.position,
      equipment: input.equipment,
      geometry: input.geometry ?? null,
      cda_estimate: input.cdaEstimate,
      optimization: input.optimization ?? null,
      scores: input.scores ?? null,
      payload: input.payload,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) throw new Error(error?.message ?? "aero_test_session_insert_failed");
  return data.id;
}

export async function listPendingAerodynamicsStagingRuns(
  db: SupabaseClient,
  athleteId: string,
): Promise<Array<{ id: string; status: string; createdAt: string; jobId: string | null }>> {
  const { data, error } = await db
    .from("interpretation_staging_runs")
    .select("id, status, created_at, candidate_bundle")
    .eq("athlete_id", athleteId)
    .eq("domain", "aerodynamics")
    .eq("status", "pending_validation")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    if (error.message?.includes("interpretation_staging_runs")) return [];
    throw new Error(error.message || "aero_staging_list_failed");
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
