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
