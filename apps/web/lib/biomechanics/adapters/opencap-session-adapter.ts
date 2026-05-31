import type { BiomechanicsDiscipline } from "@empathy/contracts";

import {
  parseBiomechPoseProposalV1,
  POSE_PROPOSAL_VERSION,
  type BiomechPoseProposalV1,
} from "@/lib/biomechanics/biomech-pose-cv-adapter";
import { parseOpenCapMotToJointAngles } from "@/lib/biomechanics/adapters/opencap-mot-mapper";
import { isLabInlineMockEnabled, labInlinePoseProposal } from "@/lib/lab/lab-inline-mock-fixtures";

export type OpenCapImportRequest = {
  externalSessionId: string;
  athleteId: string;
  discipline: BiomechanicsDiscipline;
};

export type OpenCapImportErrorCode =
  | "provider_unavailable"
  | "session_not_found"
  | "invalid_response"
  | "low_confidence";

export class OpenCapImportError extends Error {
  readonly code: OpenCapImportErrorCode;

  constructor(code: OpenCapImportErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export async function fetchOpenCapPoseProposal(input: OpenCapImportRequest): Promise<BiomechPoseProposalV1> {
  if (isLabInlineMockEnabled()) {
    return parseBiomechPoseProposalV1(labInlinePoseProposal("opencap"));
  }

  const baseUrl = readEnv("OPENCAP_API_BASE_URL");
  if (!baseUrl) {
    throw new OpenCapImportError("provider_unavailable", "OpenCap sidecar non configurato (OPENCAP_API_BASE_URL).");
  }

  const apiKey = readEnv("OPENCAP_API_TOKEN");
  const timeoutMs = Number.parseInt(process.env.OPENCAP_API_TIMEOUT_MS ?? "120000", 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/session/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        version: "opencap_import_v1",
        sessionId: input.externalSessionId,
        athleteId: input.athleteId,
        discipline: input.discipline,
      }),
      signal: controller.signal,
    });

    const body = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const err = asRecord(body)?.error;
      if (err === "session_not_found") {
        throw new OpenCapImportError("session_not_found", "Sessione OpenCap non trovata.");
      }
      throw new OpenCapImportError("invalid_response", `OpenCap sidecar HTTP ${res.status}`);
    }

    const row = asRecord(body);
    if (row?.poseProposal) {
      const proposalRow = asRecord(row.poseProposal) ?? {};
      return parseBiomechPoseProposalV1({ ...proposalRow, provider: "opencap" });
    }

    const motText = typeof row?.motText === "string" ? row.motText : null;
    if (motText) {
      const parsed = parseOpenCapMotToJointAngles(motText);
      if (parsed.jointAngles.length < 1) {
        throw new OpenCapImportError("low_confidence", "MOT OpenCap senza angoli mappabili.");
      }
      return {
        version: POSE_PROPOSAL_VERSION,
        confidence01: 0.72,
        provider: "opencap",
        model: "opensim_ik_v1",
        jointAngles: parsed.jointAngles,
        landmarks: [],
      };
    }

    throw new OpenCapImportError("invalid_response", "Risposta OpenCap sidecar non valida.");
  } catch (err) {
    if (err instanceof OpenCapImportError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new OpenCapImportError("provider_unavailable", "Timeout OpenCap sidecar.");
    }
    throw new OpenCapImportError(
      "provider_unavailable",
      err instanceof Error ? err.message : "OpenCap sidecar non raggiungibile.",
    );
  } finally {
    clearTimeout(timer);
  }
}
