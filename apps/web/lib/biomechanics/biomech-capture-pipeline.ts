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
  return {
    id: row.id,
    athleteId: row.athlete_id,
    status: row.status,
    source: "smartphone_video",
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
  return {
    id: row.id,
    athleteId: row.athlete_id,
    recordedAt: row.recorded_at,
    source: "manual_import",
    discipline: "movement_screening",
    payloadVersion: "biomechanics_session_import_v1",
    payload,
  };
}

export async function createBiomechanicsCaptureJob(
  db: SupabaseClient,
  input: CreateBiomechCaptureJobInput,
): Promise<BiomechanicsCaptureJobV1> {
  const { data, error } = await db
    .from("biomech_capture_jobs")
    .insert({
      athlete_id: input.athleteId,
      status: "pending",
      modality: mapBiomechanicsDisciplineToDbModality(input.discipline),
      stated_exercise_id: input.statedExerciseId?.trim() || null,
      camera_plane: mapBiomechanicsCameraPlaneToDb(input.cameraPlane),
      media_storage_path: input.mediaStoragePath,
      media_content_type: input.mediaContentType,
    })
    .select(
      "id, athlete_id, status, modality, stated_exercise_id, camera_plane, media_storage_path, media_content_type, error_message, result_import_id, created_at, updated_at",
    )
    .single<BiomechCaptureJobRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "biomech_capture_job_insert_failed");
  }

  return mapBiomechJobRow(data);
}

export async function listBiomechanicsCaptureJobs(db: SupabaseClient, athleteId: string): Promise<BiomechanicsCaptureJobV1[]> {
  const { data, error } = await db
    .from("biomech_capture_jobs")
    .select(
      "id, athlete_id, status, modality, stated_exercise_id, camera_plane, media_storage_path, media_content_type, error_message, result_import_id, created_at, updated_at",
    )
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<BiomechCaptureJobRow[]>();

  if (error) {
    throw new Error(error.message || "biomech_capture_jobs_read_failed");
  }
  return (data ?? []).map(mapBiomechJobRow);
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
