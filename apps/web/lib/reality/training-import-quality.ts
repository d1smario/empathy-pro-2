import { summarizeCoverageMap } from "@/lib/data-sufficiency/coverage";
import { buildCoverageQualityNote } from "@/lib/reality/coverage-quality";

export function buildExecutedTrainingImportQuality(input: {
  channelCoverage: Record<string, number>;
}) {
  const coverageSummary = summarizeCoverageMap(input.channelCoverage, {
    power: "power_meter",
    hr: "heart_rate",
    speed: "gps_or_speed_stream",
    cadence: "cadence_sensor",
    altitude: "altitude_or_gps_elevation",
    temperature: "temperature_sensor",
  });
  const coveragePct =
    Object.values(input.channelCoverage).reduce((sum, value) => sum + value, 0) /
    Math.max(1, Object.keys(input.channelCoverage).length);
  const quality = buildCoverageQualityNote({
    coveragePct,
    completeLabel: "Import completo.",
    partialLabel: "Canali parziali: campionamento/device limitato.",
    lowCoverageLabel: "Copertura bassa dei canali principali.",
    missingChannels: coverageSummary.missingChannels,
    recommendedInputs: coverageSummary.recommendedInputs,
    fallbackRecommendedInputs: ["power_meter", "heart_rate"],
  });

  return {
    coveragePct,
    qualityStatus: quality.status,
    qualityNote: quality.note,
    missingChannels: coverageSummary.missingChannels,
    recommendedInputs: coverageSummary.recommendedInputs,
  };
}

export function buildPlannedTrainingImportQuality(input: {
  firstDate: string | null;
  rowCount: number;
  hasCoachNotes: boolean;
}) {
  const channelCoverage = {
    session_date: input.firstDate ? 100 : 0,
    session_rows: input.rowCount > 0 ? 100 : 0,
    structure_contract: input.rowCount > 0 ? 100 : 0,
    coach_notes: input.hasCoachNotes ? 100 : 0,
  };
  const missingChannels = Object.entries(channelCoverage)
    .filter(([, value]) => value <= 0)
    .map(([key]) => key);
  const recommendedInputs = missingChannels
    .map((key) =>
      key === "coach_notes"
        ? "coach_notes"
        : key === "session_date"
          ? "session_date"
          : key === "session_rows"
            ? "planned_sessions"
            : "builder_session_contract",
    )
    .filter((value, index, list) => list.indexOf(value) === index);
  const coveragePct =
    Object.values(channelCoverage).reduce((sum, value) => sum + value, 0) /
    Math.max(1, Object.keys(channelCoverage).length);
  const quality = buildCoverageQualityNote({
    coveragePct,
    completeLabel: "Import programmazione coach completo.",
    partialLabel: "Import programmazione coach parziale.",
    lowCoverageLabel: "Import programmazione coach a bassa copertura.",
    missingChannels,
    recommendedInputs,
    fallbackRecommendedInputs: ["planned_sessions", "session_date"],
  });

  return {
    channelCoverage,
    coveragePct,
    qualityStatus: quality.status,
    qualityNote: quality.note,
    missingChannels,
    recommendedInputs,
  };
}
