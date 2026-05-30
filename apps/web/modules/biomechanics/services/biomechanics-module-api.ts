"use client";

import type {
  BiomechanicsCameraPlane,
  BiomechanicsCaptureJobV1,
  BiomechanicsCaptureSource,
  BiomechanicsDiscipline,
  BiomechanicsSessionImportV1,
} from "@empathy/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

type SignUploadOk = {
  ok: true;
  bucket: string;
  path: string;
  token: string;
  objectPath: string;
};

type ApiError = { ok?: false; error?: string };

function apiErrorMessage(json: unknown, fallback: string): string {
  if (json && typeof json === "object" && "error" in json) {
    const error = (json as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return fallback;
}

export type BiomechanicsSessionsResponse = {
  sessions: BiomechanicsSessionImportV1[];
  captureJobs: BiomechanicsCaptureJobV1[];
  error: string | null;
};

export async function fetchBiomechanicsSessions(athleteId: string): Promise<BiomechanicsSessionsResponse> {
  const url = `/api/biomechanics/sessions?athleteId=${encodeURIComponent(athleteId)}`;
  const headers = await buildSupabaseAuthHeaders();
  let res = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });
  let json = (await res.json().catch(() => ({}))) as
    | ({ ok: true; sessions?: BiomechanicsSessionImportV1[]; captureJobs?: BiomechanicsCaptureJobV1[] })
    | ApiError;

  if (!res.ok && (res.status === 401 || res.status === 403)) {
    res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    json = (await res.json().catch(() => ({}))) as
      | ({ ok: true; sessions?: BiomechanicsSessionImportV1[]; captureJobs?: BiomechanicsCaptureJobV1[] })
      | ApiError;
  }

  if (!res.ok || !json.ok) {
    return {
      sessions: [],
      captureJobs: [],
      error: apiErrorMessage(json, "Biomechanics non disponibile."),
    };
  }

  return {
    sessions: json.sessions ?? [],
    captureJobs: json.captureJobs ?? [],
    error: null,
  };
}

async function requestBiomechanicsSignUpload(input: { athleteId: string; file: File }): Promise<SignUploadOk> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/biomechanics/capture/sign-upload", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({
      athleteId: input.athleteId,
      fileName: input.file.name,
      contentType: input.file.type,
      fileSizeBytes: input.file.size,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as SignUploadOk | ApiError;
  if (!res.ok || !json.ok) {
    throw new Error(apiErrorMessage(json, "Firma upload Biomechanics non riuscita."));
  }
  return json;
}

export async function uploadBiomechanicsCapture(input: {
  athleteId: string;
  file: File;
  discipline: BiomechanicsDiscipline;
  source: BiomechanicsCaptureSource;
  cameraPlane: BiomechanicsCameraPlane;
  statedExerciseId?: string | null;
}): Promise<{ job: BiomechanicsCaptureJobV1 }> {
  const sign = await requestBiomechanicsSignUpload({ athleteId: input.athleteId, file: input.file });
  const sb = createEmpathyBrowserSupabase();
  if (!sb) {
    throw new Error("Client Supabase non disponibile.");
  }

  const { error: uploadError } = await sb.storage.from(sign.bucket).uploadToSignedUrl(sign.path, sign.token, input.file);
  if (uploadError) {
    throw new Error(uploadError.message || "Upload Biomechanics fallito.");
  }

  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/biomechanics/capture", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({
      athleteId: input.athleteId,
      discipline: input.discipline,
      source: input.source,
      cameraPlane: input.cameraPlane,
      storage: { bucket: sign.bucket, objectPath: sign.objectPath },
      mediaContentType: input.file.type,
      statedExerciseId: input.statedExerciseId ?? null,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as ({ ok: true; job: BiomechanicsCaptureJobV1 } & Record<string, unknown>) | ApiError;
  if (!res.ok || !json.ok) {
    throw new Error(apiErrorMessage(json, "Creazione job Biomechanics non riuscita."));
  }
  return { job: json.job };
}
