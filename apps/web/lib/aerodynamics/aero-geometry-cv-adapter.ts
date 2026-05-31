import type {
  AerodynamicsCameraMode,
  AerodynamicsEquipmentSnapshot,
  AerodynamicsGeometryProfile,
  AerodynamicsPositionSnapshot,
} from "@empathy/contracts";

import { isLabInlineMockEnabled, labInlineGeometryProposal } from "@/lib/lab/lab-inline-mock-fixtures";

export const GEOMETRY_PROPOSAL_VERSION = "geometry_proposal_v1" as const;

export type AeroGeometryCvRequest = {
  mediaDownloadUrl: string;
  athleteId: string;
  cameraMode: AerodynamicsCameraMode;
  contentType: string;
};

export type AeroGeometryProposalV1 = {
  version: typeof GEOMETRY_PROPOSAL_VERSION;
  position: AerodynamicsPositionSnapshot;
  geometry?: AerodynamicsGeometryProfile;
  equipment: AerodynamicsEquipmentSnapshot;
  cdaSurrogateM2?: number;
  confidence01: number;
  provider: string;
  model?: string;
};

export type AeroGeometryCvErrorCode = "provider_unavailable" | "media_unreadable" | "low_confidence" | "invalid_response";

export class AeroGeometryCvError extends Error {
  readonly code: AeroGeometryCvErrorCode;

  constructor(code: AeroGeometryCvErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const MIN_CONFIDENCE = 0.35;

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parsePosition(raw: unknown): AerodynamicsPositionSnapshot {
  const row = asRecord(raw);
  if (!row) return {};
  const num = (key: keyof AerodynamicsPositionSnapshot) =>
    typeof row[key] === "number" && Number.isFinite(row[key]) ? (row[key] as number) : undefined;
  return {
    shoulderWidthMm: num("shoulderWidthMm"),
    elbowWidthMm: num("elbowWidthMm"),
    headDropMm: num("headDropMm"),
    torsoAngleDeg: num("torsoAngleDeg"),
    armExtensionDeg: num("armExtensionDeg"),
    dropMm: num("dropMm"),
    reachMm: num("reachMm"),
    confidence01: typeof row.confidence01 === "number" ? clamp01(row.confidence01) : undefined,
  };
}

function parseGeometry(raw: unknown): AerodynamicsGeometryProfile | undefined {
  const row = asRecord(raw);
  if (!row) return undefined;
  const num = (key: keyof AerodynamicsGeometryProfile) =>
    typeof row[key] === "number" && Number.isFinite(row[key]) ? (row[key] as number) : undefined;
  return {
    frontalAreaM2: num("frontalAreaM2"),
    projectedAreaM2: num("projectedAreaM2"),
    wettedAreaProxyM2: num("wettedAreaProxyM2"),
    bodyVolumeProxyL: num("bodyVolumeProxyL"),
    confidence01: typeof row.confidence01 === "number" ? clamp01(row.confidence01) : undefined,
  };
}

function parseEquipment(raw: unknown): AerodynamicsEquipmentSnapshot {
  const row = asRecord(raw);
  if (!row) return {};
  return {
    helmet: typeof row.helmet === "string" ? row.helmet : null,
    wheels: typeof row.wheels === "string" ? row.wheels : null,
    frame: typeof row.frame === "string" ? row.frame : null,
    cockpit: typeof row.cockpit === "string" ? row.cockpit : null,
    clothing: typeof row.clothing === "string" ? row.clothing : null,
    bottles: Array.isArray(row.bottles) ? row.bottles.filter((b): b is string => typeof b === "string") : null,
  };
}

export function parseAeroGeometryProposalV1(json: unknown): AeroGeometryProposalV1 {
  const row = asRecord(json);
  if (!row || row.version !== GEOMETRY_PROPOSAL_VERSION) {
    throw new AeroGeometryCvError("invalid_response", "invalid_geometry_proposal_version");
  }
  const confidence01 = clamp01(typeof row.confidence01 === "number" ? row.confidence01 : 0);
  if (confidence01 < MIN_CONFIDENCE) {
    throw new AeroGeometryCvError("low_confidence", "geometry_confidence_below_threshold");
  }
  const cdaSurrogateM2 =
    typeof row.cdaSurrogateM2 === "number" && Number.isFinite(row.cdaSurrogateM2) ? row.cdaSurrogateM2 : undefined;
  const geometry = parseGeometry(row.geometry);
  if (cdaSurrogateM2 === undefined && !geometry?.frontalAreaM2) {
    throw new AeroGeometryCvError("invalid_response", "missing_geometry_or_cda_surrogate");
  }
  const provider = typeof row.provider === "string" && row.provider.trim() ? row.provider.trim() : "external";
  return {
    version: GEOMETRY_PROPOSAL_VERSION,
    position: parsePosition(row.position),
    geometry,
    equipment: parseEquipment(row.equipment),
    cdaSurrogateM2,
    confidence01,
    provider,
    model: typeof row.model === "string" ? row.model : undefined,
  };
}

export type FetchImpl = typeof fetch;

export async function extractAeroGeometryFromCv(
  input: AeroGeometryCvRequest,
  options?: { fetchImpl?: FetchImpl; apiUrl?: string; apiKey?: string; timeoutMs?: number },
): Promise<AeroGeometryProposalV1> {
  if (isLabInlineMockEnabled()) {
    return parseAeroGeometryProposalV1(labInlineGeometryProposal());
  }

  const apiUrl = options?.apiUrl ?? readEnv("AERO_GEOMETRY_CV_API_URL");
  const apiKey = options?.apiKey ?? readEnv("AERO_GEOMETRY_CV_API_KEY");
  if (!apiUrl) {
    throw new AeroGeometryCvError("provider_unavailable", "AERO_GEOMETRY_CV_API_URL not configured");
  }

  const timeoutMs = options?.timeoutMs ?? Number(readEnv("AERO_GEOMETRY_CV_TIMEOUT_MS") ?? 120_000);
  const fetchImpl = options?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const res = await fetchImpl(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        version: "geometry_request_v1",
        athleteId: input.athleteId,
        cameraMode: input.cameraMode,
        contentType: input.contentType,
        mediaDownloadUrl: input.mediaDownloadUrl,
      }),
      signal: controller.signal,
    });

    const json = (await res.json().catch(() => ({}))) as unknown;
    if (!res.ok) {
      const errRow = asRecord(json);
      const code = typeof errRow?.error === "string" ? errRow.error : "provider_unavailable";
      if (code === "media_unreadable" || code === "low_confidence") {
        throw new AeroGeometryCvError(code, String(code));
      }
      throw new AeroGeometryCvError("provider_unavailable", `aero_cv_http_${res.status}`);
    }

    return parseAeroGeometryProposalV1(json);
  } catch (err) {
    if (err instanceof AeroGeometryCvError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AeroGeometryCvError("provider_unavailable", "aero_cv_timeout");
    }
    throw new AeroGeometryCvError("provider_unavailable", err instanceof Error ? err.message : "aero_cv_failed");
  } finally {
    clearTimeout(timer);
  }
}
