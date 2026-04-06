import type {
  RealityDomain,
  RealityImportQualityStatus,
  RealityIngestionEnvelope,
  RealitySourceKind,
} from "@/lib/empathy/schemas";
import { summarizeCoverageMap } from "@/lib/data-sufficiency/coverage";
import { normalizeRealityProvider } from "@/lib/reality/provider-utils";

type BuildRealityIngestionEnvelopeInput = {
  athleteId?: string;
  domain: RealityDomain;
  sourceKind: RealitySourceKind;
  provider?: string | null;
  sessionDate?: string | null;
  importedAt?: string;
  format?: string | null;
  device?: string | null;
  externalId?: string | null;
  fileName?: string | null;
  fileChecksumSha1?: string | null;
  parserEngine?: string | null;
  parserVersion?: string | null;
  qualityStatus?: string | null;
  qualityNote?: string | null;
  channelCoverage?: Record<string, number> | null;
  missingChannels?: string[] | null;
  recommendedInputs?: string[] | null;
  canonicalPreview?: Record<string, unknown> | null;
  rawRefs?: Record<string, unknown> | null;
};

function toQualityStatus(status?: string | null): RealityImportQualityStatus {
  const value = String(status ?? "").trim().toUpperCase();
  if (value === "OK" || value === "SPARSE" || value === "LOW_COVERAGE") {
    return value;
  }
  return "UNKNOWN";
}

export function buildRealityIngestionEnvelope(
  input: BuildRealityIngestionEnvelopeInput,
): RealityIngestionEnvelope {
  const summarizedCoverage = summarizeCoverageMap(input.channelCoverage ?? null);
  return {
    schemaVersion: "v1",
    domain: input.domain,
    sourceKind: input.sourceKind,
    provider: normalizeRealityProvider(input.provider),
    athleteId: input.athleteId,
    sessionDate: input.sessionDate ?? null,
    importedAt: input.importedAt ?? new Date().toISOString(),
    format: input.format ?? null,
    device: input.device ?? null,
    externalId: input.externalId ?? null,
    fileName: input.fileName ?? null,
    fileChecksumSha1: input.fileChecksumSha1 ?? null,
    parser: {
      engine: input.parserEngine ?? null,
      version: input.parserVersion ?? null,
    },
    quality: {
      status: toQualityStatus(input.qualityStatus),
      note: input.qualityNote ?? null,
      channelCoverage: input.channelCoverage ?? null,
      coveragePct: summarizedCoverage.coveragePct,
      missingChannels: input.missingChannels ?? summarizedCoverage.missingChannels,
      recommendedInputs: input.recommendedInputs ?? summarizedCoverage.recommendedInputs,
    },
    canonicalPreview: input.canonicalPreview ?? null,
    rawRefs: input.rawRefs ?? null,
  };
}
