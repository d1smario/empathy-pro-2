import type { RealityImportQualityStatus } from "@/lib/empathy/schemas";

export function qualityStatusFromCoveragePct(coveragePct: number | null | undefined): RealityImportQualityStatus {
  const value = typeof coveragePct === "number" && Number.isFinite(coveragePct) ? coveragePct : 0;
  if (value >= 70) return "OK";
  if (value >= 35) return "SPARSE";
  return "LOW_COVERAGE";
}

export function buildCoverageQualityNote(input: {
  coveragePct: number | null | undefined;
  completeLabel: string;
  partialLabel: string;
  lowCoverageLabel: string;
  missingChannels?: string[] | null;
  recommendedInputs?: string[] | null;
  fallbackRecommendedInputs?: string[];
}) {
  const status = qualityStatusFromCoveragePct(input.coveragePct);
  const missing = input.missingChannels?.join(", ") || "nessuno";
  const recommended =
    input.recommendedInputs?.join(", ") ||
    input.fallbackRecommendedInputs?.join(", ") ||
    "nessun input aggiuntivo";

  const note =
    status === "OK"
      ? input.completeLabel
      : status === "SPARSE"
        ? `${input.partialLabel} Mancano: ${missing}.`
        : `${input.lowCoverageLabel} Priorita acquisizione: ${recommended}.`;

  return { status, note };
}
