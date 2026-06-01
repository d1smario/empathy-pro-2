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
  pendingStaging: Array<{ id: string; status: string; createdAt: string; jobId: string | null }>;
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
    | ({
        ok: true;
        sessions?: BiomechanicsSessionImportV1[];
        captureJobs?: BiomechanicsCaptureJobV1[];
        pendingStaging?: BiomechanicsSessionsResponse["pendingStaging"];
      })
    | ApiError;

  if (!res.ok && (res.status === 401 || res.status === 403)) {
    res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    json = (await res.json().catch(() => ({}))) as
      | ({
          ok: true;
          sessions?: BiomechanicsSessionImportV1[];
          captureJobs?: BiomechanicsCaptureJobV1[];
          pendingStaging?: BiomechanicsSessionsResponse["pendingStaging"];
        })
      | ApiError;
  }

  if (!res.ok || !json.ok) {
    return {
      sessions: [],
      captureJobs: [],
      pendingStaging: [],
      error: apiErrorMessage(json, "Biomechanics non disponibile."),
    };
  }

  return {
    sessions: json.sessions ?? [],
    captureJobs: json.captureJobs ?? [],
    pendingStaging: json.pendingStaging ?? [],
    error: null,
  };
}

export async function fetchBiomechanicsSessionDetail(input: {
  athleteId: string;
  sessionId: string;
}): Promise<{ ok: boolean; session?: BiomechanicsSessionImportV1; signedUrl?: string | null; error?: string }> {
  const url = `/api/biomechanics/sessions/${encodeURIComponent(input.sessionId)}?athleteId=${encodeURIComponent(input.athleteId)}`;
  const headers = await buildSupabaseAuthHeaders();
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });
  const json = (await res.json().catch(() => ({}))) as
    | ({ ok: true; session?: BiomechanicsSessionImportV1; signedUrl?: string | null } & Record<string, unknown>)
    | ApiError;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Report sessione non disponibile.") };
  }
  if (!json.session) {
    return { ok: false, error: "session_not_found" };
  }
  return {
    ok: true,
    session: json.session,
    signedUrl: typeof json.signedUrl === "string" ? json.signedUrl : null,
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

export async function processBiomechanicsCaptureJob(input: {
  athleteId: string;
  jobId: string;
}): Promise<{ ok: boolean; stagingRunId?: string; error?: string; message?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/biomechanics/capture/process", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    const message = typeof json.message === "string" && json.message.trim() ? json.message : undefined;
    const code = typeof json.code === "string" ? json.code : undefined;
    return {
      ok: false,
      error: message ?? apiErrorMessage(json, "Elaborazione CV fallita."),
      message: message ?? code ?? "",
    };
  }
  return { ok: true, stagingRunId: typeof json.stagingRunId === "string" ? json.stagingRunId : undefined };
}

export async function fetchBiomechanicsStagingRunDetail(runId: string): Promise<{
  ok: boolean;
  run?: Record<string, unknown>;
  signedUrl?: string | null;
  error?: string;
}> {
  const headers = await buildSupabaseAuthHeaders();
  const res = await fetch(`/api/biomechanics/staging-runs/${encodeURIComponent(runId)}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Staging non disponibile.") };
  }
  return {
    ok: true,
    run: json.run as Record<string, unknown>,
    signedUrl: typeof json.signedUrl === "string" ? json.signedUrl : null,
  };
}

export async function saveBiomechanicsStagingPoseCorrection(input: {
  runId: string;
  landmarks: import("@empathy/contracts").BiomechanicsLandmark3D[];
  jointAngles: import("@empathy/contracts").BiomechanicsJointAngleSample[];
}): Promise<{ ok: boolean; error?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/biomechanics/staging-runs/${encodeURIComponent(input.runId)}`, {
    method: "PATCH",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({
      landmarks: input.landmarks,
      jointAngles: input.jointAngles,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Salvataggio correzione fallito.") };
  }
  return { ok: true };
}

export async function applyBiomechanicsStagingRun(runId: string): Promise<{ ok: boolean; error?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/biomechanics/staging-runs/${encodeURIComponent(runId)}/apply`, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({}),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Conferma fallita.") };
  }
  return { ok: true };
}

export async function rejectBiomechanicsStagingRun(runId: string): Promise<{ ok: boolean; error?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/biomechanics/staging-runs/${encodeURIComponent(runId)}/apply`, {
    method: "PATCH",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({ status: "rejected" }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Rifiuto fallito.") };
  }
  return { ok: true };
}

export async function importBiomechanicsOpenCapSession(input: {
  athleteId: string;
  externalSessionId: string;
  discipline: import("@empathy/contracts").BiomechanicsDiscipline;
}): Promise<{ ok: boolean; stagingRunId?: string; error?: string; message?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/biomechanics/sessions/import", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return {
      ok: false,
      error: apiErrorMessage(json, "Import OpenCap fallito."),
      message: String(json.message ?? ""),
    };
  }
  return {
    ok: true,
    stagingRunId: typeof json.stagingRunId === "string" ? json.stagingRunId : undefined,
  };
}
