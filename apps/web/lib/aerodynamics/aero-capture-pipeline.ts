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
