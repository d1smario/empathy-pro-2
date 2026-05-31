"use client";

import type {
  AerodynamicsCameraMode,
  AerodynamicsCaptureJobV1,
  AerodynamicsCaptureSource,
  AerodynamicsTestSessionV1,
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

export type AerodynamicsTestsResponse = {
  tests: AerodynamicsTestSessionV1[];
  captureJobs: AerodynamicsCaptureJobV1[];
  pendingStaging: Array<{ id: string; status: string; createdAt: string; jobId: string | null }>;
  error: string | null;
};

export async function fetchAerodynamicsTests(athleteId: string): Promise<AerodynamicsTestsResponse> {
  const url = `/api/aerodynamics/tests?athleteId=${encodeURIComponent(athleteId)}`;
  const headers = await buildSupabaseAuthHeaders();
  let res = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });
  let json = (await res.json().catch(() => ({}))) as
    | ({ ok: true; tests?: AerodynamicsTestSessionV1[]; captureJobs?: AerodynamicsCaptureJobV1[] })
    | ApiError;

  if (!res.ok && (res.status === 401 || res.status === 403)) {
    res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    json = (await res.json().catch(() => ({}))) as
      | ({ ok: true; tests?: AerodynamicsTestSessionV1[]; captureJobs?: AerodynamicsCaptureJobV1[] })
      | ApiError;
  }

  if (!res.ok || !json.ok) {
    return {
      tests: [],
      captureJobs: [],
      pendingStaging: [],
      error: apiErrorMessage(json, "Aerodynamics non disponibile."),
    };
  }

  return {
    tests: json.tests ?? [],
    captureJobs: json.captureJobs ?? [],
    pendingStaging: (json as { pendingStaging?: AerodynamicsTestsResponse["pendingStaging"] }).pendingStaging ?? [],
    error: null,
  };
}

async function requestAerodynamicsSignUpload(input: { athleteId: string; file: File }): Promise<SignUploadOk> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/aerodynamics/capture/sign-upload", {
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
    throw new Error(apiErrorMessage(json, "Firma upload Aerodynamics non riuscita."));
  }
  return json;
}

export async function uploadAerodynamicsCapture(input: {
  athleteId: string;
  file: File;
  source: AerodynamicsCaptureSource;
  cameraMode: AerodynamicsCameraMode;
}): Promise<{ job: AerodynamicsCaptureJobV1 }> {
  const sign = await requestAerodynamicsSignUpload({ athleteId: input.athleteId, file: input.file });
  const sb = createEmpathyBrowserSupabase();
  if (!sb) {
    throw new Error("Client Supabase non disponibile.");
  }

  const { error: uploadError } = await sb.storage.from(sign.bucket).uploadToSignedUrl(sign.path, sign.token, input.file);
  if (uploadError) {
    throw new Error(uploadError.message || "Upload Aerodynamics fallito.");
  }

  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/aerodynamics/capture", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({
      athleteId: input.athleteId,
      source: input.source,
      cameraMode: input.cameraMode,
      storage: { bucket: sign.bucket, objectPath: sign.objectPath },
      mediaContentType: input.file.type,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as ({ ok: true; job: AerodynamicsCaptureJobV1 } & Record<string, unknown>) | ApiError;
  if (!res.ok || !json.ok) {
    throw new Error(apiErrorMessage(json, "Creazione job Aerodynamics non riuscita."));
  }
  return { job: json.job };
}

export async function processAerodynamicsCaptureJob(input: {
  athleteId: string;
  jobId: string;
}): Promise<{ ok: boolean; stagingRunId?: string; error?: string; message?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/aerodynamics/capture/process", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Elaborazione CV fallita."), message: String(json.message ?? "") };
  }
  return { ok: true, stagingRunId: typeof json.stagingRunId === "string" ? json.stagingRunId : undefined };
}

export async function fetchAerodynamicsStagingRunDetail(runId: string): Promise<{
  ok: boolean;
  run?: Record<string, unknown>;
  signedUrl?: string | null;
  scenarioCompare?: import("@empathy/contracts").AerodynamicsScenarioCompareV1 | null;
  error?: string;
}> {
  const headers = await buildSupabaseAuthHeaders();
  const res = await fetch(`/api/aerodynamics/staging-runs/${encodeURIComponent(runId)}`, {
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
    scenarioCompare: (json.scenarioCompare as import("@empathy/contracts").AerodynamicsScenarioCompareV1 | null) ?? null,
  };
}

export async function applyAerodynamicsStagingRun(
  runId: string,
  selectedScenarioId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/aerodynamics/staging-runs/${encodeURIComponent(runId)}/apply`, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({ selectedScenarioId: selectedScenarioId ?? "baseline" }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Conferma fallita.") };
  }
  return { ok: true };
}

export async function rejectAerodynamicsStagingRun(runId: string): Promise<{ ok: boolean; error?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/aerodynamics/staging-runs/${encodeURIComponent(runId)}/apply`, {
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
