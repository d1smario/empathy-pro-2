import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";

export type HealthPanelTimelineRow = {
  id: string;
  type: string;
  sample_date: string | null;
  reported_at: string | null;
  source: string | null;
  values: Record<string, unknown> | null;
  created_at: string | null;
};

export async function fetchHealthPanelsTimeline(athleteId: string): Promise<{
  panels: HealthPanelTimelineRow[];
  error: string | null;
}> {
  const url = `/api/health/panels-timeline?athleteId=${encodeURIComponent(athleteId)}`;
  let res = await fetch(url, {
    cache: "no-store",
    headers: await buildSupabaseAuthHeaders(),
  });
  let json = (await res.json()) as
    | { ok: true; panels: HealthPanelTimelineRow[] }
    | { ok: false; error?: string };
  // In some production sessions a stale Bearer token can override valid cookies: retry cookie-only.
  if (!res.ok && res.status === 401) {
    res = await fetch(url, { cache: "no-store" });
    json = (await res.json()) as
      | { ok: true; panels: HealthPanelTimelineRow[] }
      | { ok: false; error?: string };
  }
  if (!res.ok || !json.ok) {
    return { panels: [], error: ("error" in json && json.error) || "Timeline non disponibile" };
  }
  return { panels: json.panels, error: null };
}

export async function uploadHealthDocument(input: {
  athleteId: string;
  panelType: string;
  sampleDate: string;
  file: File;
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  const form = new FormData();
  form.set("athleteId", input.athleteId);
  form.set("panelType", input.panelType);
  form.set("sampleDate", input.sampleDate);
  form.set("file", input.file);

  const headers = await buildSupabaseAuthHeaders();
  headers.delete("Content-Type");

  const res = await fetch("/api/health/upload-document", {
    method: "POST",
    body: form,
    headers,
  });
  const json = (await res.json()) as { ok: boolean; error?: string; message?: string };
  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error || "Upload fallito" };
  }
  return { ok: true, message: json.message };
}

export type HealthSystemMapViewModel = {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  bioenergeticsResponses: Array<Record<string, unknown>>;
  stagingRuns: Array<Record<string, unknown>>;
};

export type HealthStagingRunAction = "committed" | "rejected" | "archived";

export async function fetchHealthSystemMap(athleteId: string): Promise<{
  systemMap: HealthSystemMapViewModel;
  error: string | null;
}> {
  const res = await fetch(`/api/health/system-map?athleteId=${encodeURIComponent(athleteId)}`, {
    cache: "no-store",
    headers: await buildSupabaseAuthHeaders(),
  });
  const json = (await res.json()) as
    | { ok: true; systemMap: HealthSystemMapViewModel }
    | { ok: false; error?: string };
  if (!res.ok || !json.ok) {
    return {
      systemMap: { nodes: [], edges: [], bioenergeticsResponses: [], stagingRuns: [] },
      error: ("error" in json && json.error) || "System map non disponibile",
    };
  }
  return { systemMap: json.systemMap, error: null };
}

export async function patchHealthStagingRun(input: {
  runId: string;
  status: HealthStagingRunAction;
  reason?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/health/staging-runs/${encodeURIComponent(input.runId)}`, {
    method: "PATCH",
    cache: "no-store",
    headers,
    body: JSON.stringify({ status: input.status, reason: input.reason }),
  });
  const json = (await res.json()) as { ok: boolean; error?: string };
  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error || "Aggiornamento staging fallito" };
  }
  return { ok: true };
}
