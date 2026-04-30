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
  const res = await fetch(`/api/health/panels-timeline?athleteId=${encodeURIComponent(athleteId)}`, {
    cache: "no-store",
    headers: await buildSupabaseAuthHeaders(),
  });
  const json = (await res.json()) as
    | { ok: true; panels: HealthPanelTimelineRow[] }
    | { ok: false; error?: string };
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
