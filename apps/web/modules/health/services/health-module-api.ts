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

export type HealthTimelineFetchDiagnostics = {
  /** `athleteId` della query (sempre presente quando l'API risponde). */
  requestedAthleteId?: string | null;
  /** `app_user_profiles.athlete_id` dell'utente autenticato (quando server ha potuto leggerlo). */
  userProfileAthleteId?: string | null;
  /** Codice errore strutturato emesso dall'API. */
  errorCode?: string | null;
  /** Status HTTP osservato dall'ultima richiesta. */
  httpStatus?: number;
};

type TimelineErrorEnvelope = {
  ok: false;
  error?: string;
  requestedAthleteId?: string;
  userProfileAthleteId?: string | null;
};

type TimelineSuccessEnvelope = {
  ok: true;
  panels: HealthPanelTimelineRow[];
  athleteId?: string;
};

const COOKIE_ONLY: RequestInit = { cache: "no-store", credentials: "same-origin" };

/**
 * Fetch archivio panel + diagnostica leggera. Strategia:
 * 1. Tentativo con `Authorization: Bearer` (Supabase client-side) + cookie session.
 * 2. **Fallback cookie-only** quando il server risponde 401 OR 403 (token bearer
 *    stale che non corrisponde alla sessione cookie del browser, oppure profilo
 *    legato a un atleta diverso da quello attivo).
 * 3. In caso di errore, ritorna `error` umano + `diagnostics` strutturate per la UI.
 */
export async function fetchHealthPanelsTimeline(athleteId: string): Promise<{
  panels: HealthPanelTimelineRow[];
  error: string | null;
  diagnostics: HealthTimelineFetchDiagnostics;
}> {
  const url = `/api/health/panels-timeline?athleteId=${encodeURIComponent(athleteId)}`;
  let res = await fetch(url, {
    ...COOKIE_ONLY,
    headers: await buildSupabaseAuthHeaders(),
  });
  let json = (await res.json()) as TimelineSuccessEnvelope | TimelineErrorEnvelope;

  // Bearer stale o legato a utente diverso dalla sessione cookie: ritenta cookie-only.
  if (!res.ok && (res.status === 401 || res.status === 403)) {
    res = await fetch(url, COOKIE_ONLY);
    json = (await res.json()) as TimelineSuccessEnvelope | TimelineErrorEnvelope;
  }

  if (!res.ok || !json.ok) {
    const errCode = ("error" in json && json.error) || "Timeline non disponibile";
    return {
      panels: [],
      error: humanizeTimelineError(errCode),
      diagnostics: {
        requestedAthleteId:
          ("requestedAthleteId" in json && json.requestedAthleteId) || athleteId,
        userProfileAthleteId:
          ("userProfileAthleteId" in json ? json.userProfileAthleteId : null) ?? null,
        errorCode: errCode,
        httpStatus: res.status,
      },
    };
  }

  return {
    panels: json.panels ?? [],
    error: null,
    diagnostics: {
      requestedAthleteId: json.athleteId ?? athleteId,
      httpStatus: res.status,
    },
  };
}

function humanizeTimelineError(code: string): string {
  switch (code) {
    case "missing_athleteId":
      return "Atleta non specificato (athleteId vuoto).";
    case "unauthorized":
      return "Sessione scaduta: rientra per ricaricare l'archivio.";
    case "forbidden":
      return "Atleta non autorizzato per questo account: il profilo collegato non corrisponde all'atleta attivo.";
    case "supabase_unconfigured":
      return "Configurazione Supabase mancante sul server.";
    default:
      return code;
  }
}

export async function uploadHealthDocument(input: {
  athleteId: string;
  panelType: string;
  sampleDate: string;
  file: File;
}): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  importStatus?: string;
  stagingRunId?: string | null;
  reviewUrl?: string | null;
}> {
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
  const json = (await res.json()) as {
    ok: boolean;
    error?: string;
    message?: string;
    importStatus?: string;
    stagingRunId?: string | null;
    reviewUrl?: string | null;
  };
  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error || "Upload fallito" };
  }
  return {
    ok: true,
    message: json.message,
    importStatus: json.importStatus,
    stagingRunId: json.stagingRunId ?? null,
    reviewUrl: json.reviewUrl ?? null,
  };
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
  const url = `/api/health/system-map?athleteId=${encodeURIComponent(athleteId)}`;
  let res = await fetch(url, {
    ...COOKIE_ONLY,
    headers: await buildSupabaseAuthHeaders(),
  });
  let json = (await res.json()) as
    | { ok: true; systemMap: HealthSystemMapViewModel }
    | { ok: false; error?: string };
  if (!res.ok && (res.status === 401 || res.status === 403)) {
    res = await fetch(url, COOKIE_ONLY);
    json = (await res.json()) as
      | { ok: true; systemMap: HealthSystemMapViewModel }
      | { ok: false; error?: string };
  }
  if (!res.ok || !json.ok) {
    return {
      systemMap: { nodes: [], edges: [], bioenergeticsResponses: [], stagingRuns: [] },
      error: ("error" in json && json.error) || "System map non disponibile",
    };
  }
  return { systemMap: json.systemMap ?? { nodes: [], edges: [], bioenergeticsResponses: [], stagingRuns: [] }, error: null };
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

export type HealthStagingRunDetail = {
  id: string;
  athleteId: string;
  domain: string;
  status: string;
  triggerSource: string | null;
  candidateBundle: Record<string, unknown> | null;
  proposedPatches: Array<Record<string, unknown>>;
  confidence: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type HealthStagingPanelSnapshot = {
  id: string;
  type: string;
  sampleDate: string | null;
  source: string | null;
  values: Record<string, unknown> | null;
  createdAt: string | null;
};

export async function fetchHealthStagingRunDetail(runId: string): Promise<{
  ok: boolean;
  run: HealthStagingRunDetail | null;
  panel: HealthStagingPanelSnapshot | null;
  signedUrl: string | null;
  importBlock: Record<string, unknown> | null;
  error?: string;
}> {
  const headers = await buildSupabaseAuthHeaders();
  let res = await fetch(`/api/health/staging-runs/${encodeURIComponent(runId)}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });
  let json = (await res.json()) as
    | {
        ok: true;
        run: Record<string, unknown>;
        panel: Record<string, unknown> | null;
        signedUrl: string | null;
        importBlock: Record<string, unknown> | null;
      }
    | { ok: false; error?: string };
  if (!res.ok && (res.status === 401 || res.status === 403)) {
    res = await fetch(`/api/health/staging-runs/${encodeURIComponent(runId)}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    json = (await res.json()) as typeof json;
  }
  if (!res.ok || !json.ok) {
    return {
      ok: false,
      run: null,
      panel: null,
      signedUrl: null,
      importBlock: null,
      error: ("error" in json && json.error) || "Review non disponibile",
    };
  }
  const r = json.run as Record<string, unknown>;
  const p = json.panel as Record<string, unknown> | null;
  const detail: HealthStagingRunDetail = {
    id: String(r.id ?? ""),
    athleteId: String(r.athlete_id ?? ""),
    domain: String(r.domain ?? ""),
    status: String(r.status ?? ""),
    triggerSource: typeof r.trigger_source === "string" ? r.trigger_source : null,
    candidateBundle:
      r.candidate_bundle && typeof r.candidate_bundle === "object" && !Array.isArray(r.candidate_bundle)
        ? (r.candidate_bundle as Record<string, unknown>)
        : null,
    proposedPatches: Array.isArray(r.proposed_structured_patches)
      ? (r.proposed_structured_patches as Array<Record<string, unknown>>)
      : [],
    confidence: typeof r.confidence === "number" ? r.confidence : null,
    createdAt: typeof r.created_at === "string" ? r.created_at : null,
    updatedAt: typeof r.updated_at === "string" ? r.updated_at : null,
  };
  const panel: HealthStagingPanelSnapshot | null = p
    ? {
        id: String(p.id ?? ""),
        type: String(p.type ?? ""),
        sampleDate: typeof p.sample_date === "string" ? p.sample_date : null,
        source: typeof p.source === "string" ? p.source : null,
        values:
          p.values && typeof p.values === "object" && !Array.isArray(p.values)
            ? (p.values as Record<string, unknown>)
            : null,
        createdAt: typeof p.created_at === "string" ? p.created_at : null,
      }
    : null;
  return {
    ok: true,
    run: detail,
    panel,
    signedUrl: json.signedUrl ?? null,
    importBlock: json.importBlock ?? null,
  };
}

export type HealthStagingApplyPatch = {
  field: string;
  value: number | string | null;
  unit?: string | null;
  confidence?: number;
};

export async function analyzePanelWithAi(input: {
  panelId: string;
  athleteId: string;
}): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  reviewUrl?: string | null;
  stagingRunId?: string | null;
  fieldCount?: number;
}> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/health/panels/${encodeURIComponent(input.panelId)}/analyze-with-ai`, {
    method: "POST",
    cache: "no-store",
    headers,
    body: JSON.stringify({ athleteId: input.athleteId }),
  });
  const json = (await res.json()) as {
    ok: boolean;
    error?: string;
    note?: string;
    message?: string;
    reviewUrl?: string | null;
    stagingRunId?: string | null;
    fieldCount?: number;
  };
  if (!res.ok || !json.ok) {
    return {
      ok: false,
      error: json.note ? `${json.error ?? ""}: ${json.note}` : json.error || "Analisi AI fallita",
    };
  }
  return {
    ok: true,
    message: json.message,
    reviewUrl: json.reviewUrl ?? null,
    stagingRunId: json.stagingRunId ?? null,
    fieldCount: json.fieldCount,
  };
}

export async function bulkReanalyzePanelsWithAi(input: {
  athleteId: string;
}): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  analyzed?: number;
  candidates?: number;
  withVlmProposals?: number;
  withParsedValues?: number;
  failed?: number;
  canonicalSkipped?: number;
}> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/health/panels/reanalyze-bulk`, {
    method: "POST",
    cache: "no-store",
    headers,
    body: JSON.stringify({ athleteId: input.athleteId }),
  });
  const json = (await res.json()) as {
    ok: boolean;
    error?: string;
    message?: string;
    analyzed?: number;
    candidates?: number;
    withVlmProposals?: number;
    withParsedValues?: number;
    failed?: number;
    canonicalSkipped?: number;
  };
  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error || "Bulk re-analyze fallito" };
  }
  return {
    ok: true,
    message: json.message,
    analyzed: json.analyzed,
    candidates: json.candidates,
    withVlmProposals: json.withVlmProposals,
    withParsedValues: json.withParsedValues,
    failed: json.failed,
    canonicalSkipped: json.canonicalSkipped,
  };
}

export async function applyHealthStagingPatches(input: {
  runId: string;
  confirmedPatches: HealthStagingApplyPatch[];
  reason?: string;
}): Promise<{ ok: boolean; error?: string; confirmedCount?: number }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/health/staging-runs/${encodeURIComponent(input.runId)}/apply`, {
    method: "POST",
    cache: "no-store",
    headers,
    body: JSON.stringify({
      confirmedPatches: input.confirmedPatches,
      reason: input.reason ?? null,
    }),
  });
  const json = (await res.json()) as { ok: boolean; error?: string; confirmedCount?: number };
  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error || "Conferma fallita" };
  }
  return { ok: true, confirmedCount: json.confirmedCount };
}
