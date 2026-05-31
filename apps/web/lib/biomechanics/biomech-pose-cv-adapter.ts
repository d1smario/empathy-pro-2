import type {
  BiomechanicsCameraPlane,
  BiomechanicsDiscipline,
  BiomechanicsJointAngleSample,
  BiomechanicsLandmark3D,
  BiomechanicsMovementPatternSummary,
  BiomechanicsRiskScores,
} from "@empathy/contracts";

import { isLabInlineMockEnabled, labInlinePoseProposal } from "@/lib/lab/lab-inline-mock-fixtures";

export const POSE_PROPOSAL_VERSION = "pose_proposal_v1" as const;

export type BiomechPoseCvRequest = {
  mediaDownloadUrl: string;
  athleteId: string;
  discipline: BiomechanicsDiscipline;
  cameraPlane: BiomechanicsCameraPlane;
  contentType: string;
};

export type BiomechPoseProposalV1 = {
  version: typeof POSE_PROPOSAL_VERSION;
  landmarks: BiomechanicsLandmark3D[];
  jointAngles: BiomechanicsJointAngleSample[];
  movementPatterns?: BiomechanicsMovementPatternSummary;
  riskScores?: BiomechanicsRiskScores;
  confidence01: number;
  provider: string;
  model?: string;
};

export type BiomechPoseCvErrorCode = "provider_unavailable" | "media_unreadable" | "low_confidence" | "invalid_response";

export class BiomechPoseCvError extends Error {
  readonly code: BiomechPoseCvErrorCode;

  constructor(code: BiomechPoseCvErrorCode, message: string) {
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

function parseLandmarks(raw: unknown): BiomechanicsLandmark3D[] {
  if (!Array.isArray(raw)) return [];
  const out: BiomechanicsLandmark3D[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row || typeof row.name !== "string") continue;
    const xMm = typeof row.xMm === "number" ? row.xMm : 0;
    const yMm = typeof row.yMm === "number" ? row.yMm : 0;
    out.push({
      name: row.name,
      xMm,
      yMm,
      zMm: typeof row.zMm === "number" ? row.zMm : undefined,
      confidence01: typeof row.confidence01 === "number" ? clamp01(row.confidence01) : undefined,
    });
  }
  return out;
}

function parseJointAngles(raw: unknown): BiomechanicsJointAngleSample[] {
  if (!Array.isArray(raw)) return [];
  const joints = new Set(["hip", "knee", "ankle", "shoulder", "elbow", "back", "neck"]);
  const sides = new Set(["left", "right", "midline"]);
  const out: BiomechanicsJointAngleSample[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row || typeof row.joint !== "string" || !joints.has(row.joint)) continue;
    if (typeof row.angleDeg !== "number" || !Number.isFinite(row.angleDeg)) continue;
    out.push({
      joint: row.joint as BiomechanicsJointAngleSample["joint"],
      side:
        typeof row.side === "string" && sides.has(row.side)
          ? (row.side as BiomechanicsJointAngleSample["side"])
          : undefined,
      angleDeg: row.angleDeg,
      phasePct: typeof row.phasePct === "number" ? row.phasePct : undefined,
      confidence01: typeof row.confidence01 === "number" ? clamp01(row.confidence01) : undefined,
    });
  }
  return out;
}

function parseMovementPatterns(raw: unknown): BiomechanicsMovementPatternSummary | undefined {
  const row = asRecord(raw);
  if (!row) return undefined;
  return {
    pelvicStability01: typeof row.pelvicStability01 === "number" ? clamp01(row.pelvicStability01) : undefined,
    kneeTracking01: typeof row.kneeTracking01 === "number" ? clamp01(row.kneeTracking01) : undefined,
    ankleDynamics01: typeof row.ankleDynamics01 === "number" ? clamp01(row.ankleDynamics01) : undefined,
    strideSymmetry01: typeof row.strideSymmetry01 === "number" ? clamp01(row.strideSymmetry01) : undefined,
    rangeOfMotion01: typeof row.rangeOfMotion01 === "number" ? clamp01(row.rangeOfMotion01) : undefined,
    compensationFlags: Array.isArray(row.compensationFlags)
      ? row.compensationFlags.filter((f): f is string => typeof f === "string")
      : undefined,
  };
}

function parseRiskScores(raw: unknown): BiomechanicsRiskScores | undefined {
  const row = asRecord(raw);
  if (!row) return undefined;
  const pick = (key: keyof BiomechanicsRiskScores) =>
    typeof row[key] === "number" ? clamp01(row[key] as number) : undefined;
  return {
    kneeRisk01: pick("kneeRisk01"),
    hipRisk01: pick("hipRisk01"),
    lumbarRisk01: pick("lumbarRisk01"),
    achillesRisk01: pick("achillesRisk01"),
    cervicalRisk01: pick("cervicalRisk01"),
  };
}

export function parseBiomechPoseProposalV1(json: unknown): BiomechPoseProposalV1 {
  const row = asRecord(json);
  if (!row || row.version !== POSE_PROPOSAL_VERSION) {
    throw new BiomechPoseCvError("invalid_response", "invalid_pose_proposal_version");
  }
  const jointAngles = parseJointAngles(row.jointAngles);
  if (!jointAngles.length) {
    throw new BiomechPoseCvError("invalid_response", "missing_joint_angles");
  }
  const confidence01 = clamp01(typeof row.confidence01 === "number" ? row.confidence01 : 0);
  if (confidence01 < MIN_CONFIDENCE) {
    throw new BiomechPoseCvError("low_confidence", "pose_confidence_below_threshold");
  }
  const provider = typeof row.provider === "string" && row.provider.trim() ? row.provider.trim() : "external";
  return {
    version: POSE_PROPOSAL_VERSION,
    landmarks: parseLandmarks(row.landmarks),
    jointAngles,
    movementPatterns: parseMovementPatterns(row.movementPatterns),
    riskScores: parseRiskScores(row.riskScores),
    confidence01,
    provider,
    model: typeof row.model === "string" ? row.model : undefined,
  };
}

export type FetchImpl = typeof fetch;

export async function extractBiomechPoseFromCv(
  input: BiomechPoseCvRequest,
  options?: { fetchImpl?: FetchImpl; apiUrl?: string; apiKey?: string; timeoutMs?: number },
): Promise<BiomechPoseProposalV1> {
  if (isLabInlineMockEnabled()) {
    return parseBiomechPoseProposalV1(labInlinePoseProposal());
  }

  const apiUrl = options?.apiUrl ?? readEnv("BIOMECH_POSE_CV_API_URL");
  const apiKey = options?.apiKey ?? readEnv("BIOMECH_POSE_CV_API_KEY");
  if (!apiUrl) {
    throw new BiomechPoseCvError("provider_unavailable", "BIOMECH_POSE_CV_API_URL not configured");
  }

  const timeoutMs = options?.timeoutMs ?? Number(readEnv("BIOMECH_POSE_CV_TIMEOUT_MS") ?? 120_000);
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
        version: "pose_request_v1",
        athleteId: input.athleteId,
        discipline: input.discipline,
        cameraPlane: input.cameraPlane,
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
        throw new BiomechPoseCvError(code, String(code));
      }
      throw new BiomechPoseCvError("provider_unavailable", `pose_cv_http_${res.status}`);
    }

    return parseBiomechPoseProposalV1(json);
  } catch (err) {
    if (err instanceof BiomechPoseCvError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new BiomechPoseCvError("provider_unavailable", "pose_cv_timeout");
    }
    throw new BiomechPoseCvError("provider_unavailable", err instanceof Error ? err.message : "pose_cv_failed");
  } finally {
    clearTimeout(timer);
  }
}
