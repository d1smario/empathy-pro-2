import type {
  AthleteAerodynamicsMemory,
  AthleteBiomechanicsMemory,
} from "@/lib/empathy/schemas";
import type {
  AerodynamicsScores,
  AerodynamicsTwinSnapshotV1,
  BiomechanicsEfficiencyScores,
  BiomechanicsRiskScores,
  BiomechanicsTwinSnapshotV1,
} from "@empathy/contracts";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function finite01(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function biomechanicsEfficiency(value: unknown): BiomechanicsEfficiencyScores | null {
  const row = asRecord(value);
  if (!row) return null;
  const biomechanicalEfficiency01 = finiteNumber(row.biomechanicalEfficiency01);
  const movementQuality01 = finiteNumber(row.movementQuality01);
  const symmetry01 = finiteNumber(row.symmetry01);
  const injuryRisk01 = finiteNumber(row.injuryRisk01);
  if (
    biomechanicalEfficiency01 === undefined ||
    movementQuality01 === undefined ||
    symmetry01 === undefined ||
    injuryRisk01 === undefined
  ) {
    return null;
  }
  return {
    biomechanicalEfficiency01: finite01(biomechanicalEfficiency01, 0),
    movementQuality01: finite01(movementQuality01, 0),
    symmetry01: finite01(symmetry01, 0),
    injuryRisk01: finite01(injuryRisk01, 0),
  };
}

function biomechanicsRisk(value: unknown): BiomechanicsRiskScores {
  const row = asRecord(value);
  if (!row) return {};
  return {
    kneeRisk01: finiteNumber(row.kneeRisk01),
    hipRisk01: finiteNumber(row.hipRisk01),
    lumbarRisk01: finiteNumber(row.lumbarRisk01),
    achillesRisk01: finiteNumber(row.achillesRisk01),
    cervicalRisk01: finiteNumber(row.cervicalRisk01),
  };
}

export function buildBiomechanicsMemoryFromSessionRows(
  athleteId: string,
  rows: Array<Record<string, unknown>>,
): AthleteBiomechanicsMemory {
  const snapshots: BiomechanicsTwinSnapshotV1[] = [];
  for (const row of rows) {
    const payload = asRecord(row.payload);
    const efficiencyScores = biomechanicsEfficiency(payload?.efficiencyScores);
    if (!payload || !efficiencyScores) continue;
    const computedAt =
      typeof row.recorded_at === "string"
        ? row.recorded_at
        : typeof row.created_at === "string"
          ? row.created_at
          : new Date(0).toISOString();
    snapshots.push({
      athleteId,
      computedAt,
      latestSessionImportId: typeof row.id === "string" ? row.id : undefined,
      disciplineCoverage: [],
      anthropometrics: asRecord(payload.anthropometrics) ?? undefined,
      movementPatterns: asRecord(payload.movementPatterns) ?? undefined,
      riskScores: biomechanicsRisk(payload.riskScores),
      efficiencyScores,
      correctiveActionTags: stringArray(payload.correctiveActionTags),
      confidence01: finite01(payload.confidence01, 0.5),
      algorithmVersion: typeof payload.algorithmVersion === "string" ? payload.algorithmVersion : "biomechanics_projection_v1",
    });
  }

  return {
    latestSnapshot: snapshots[0] ?? null,
    historicalEvolution: snapshots.slice(0, 12).map((snapshot) => ({
      computedAt: snapshot.computedAt,
      efficiencyScores: snapshot.efficiencyScores,
      riskScores: snapshot.riskScores,
      confidence01: snapshot.confidence01,
    })),
  };
}

function aeroScores(value: unknown): AerodynamicsScores | null {
  const row = asRecord(value);
  if (!row) return null;
  const cdaScore01 = finiteNumber(row.cdaScore01);
  const positionScore01 = finiteNumber(row.positionScore01);
  const equipmentScore01 = finiteNumber(row.equipmentScore01);
  const aeroEfficiency01 = finiteNumber(row.aeroEfficiency01);
  if (cdaScore01 === undefined || positionScore01 === undefined || equipmentScore01 === undefined || aeroEfficiency01 === undefined) {
    return null;
  }
  return {
    cdaScore01: finite01(cdaScore01, 0),
    positionScore01: finite01(positionScore01, 0),
    equipmentScore01: finite01(equipmentScore01, 0),
    aeroEfficiency01: finite01(aeroEfficiency01, 0),
  };
}

export function buildAerodynamicsMemoryFromTestRows(
  athleteId: string,
  rows: Array<Record<string, unknown>>,
): AthleteAerodynamicsMemory {
  const snapshots: AerodynamicsTwinSnapshotV1[] = [];
  for (const row of rows) {
    const cdaEstimate = asRecord(row.cda_estimate);
    const scores = aeroScores(row.scores);
    if (!cdaEstimate || !scores) continue;
    const currentCdaM2 = finiteNumber(cdaEstimate.cdaM2);
    const optimization = asRecord(row.optimization);
    snapshots.push({
      athleteId,
      computedAt:
        typeof row.recorded_at === "string"
          ? row.recorded_at
          : typeof row.created_at === "string"
            ? row.created_at
            : new Date(0).toISOString(),
      latestTestSessionId: typeof row.id === "string" ? row.id : undefined,
      currentCdaM2,
      optimizedCdaM2: finiteNumber(optimization?.optimizedCdaM2),
      equipment: asRecord(row.equipment) ?? {},
      position: asRecord(row.position) ?? {},
      scores,
      confidence01: finite01(cdaEstimate.confidence01, 0.5),
      algorithmVersion: typeof row.schema_version === "number" ? `aerodynamics_test_session_v${row.schema_version}` : "aerodynamics_projection_v1",
    });
  }

  return {
    latestSnapshot: snapshots[0] ?? null,
    historicalEvolution: snapshots.slice(0, 12).map((snapshot) => ({
      computedAt: snapshot.computedAt,
      currentCdaM2: snapshot.currentCdaM2,
      optimizedCdaM2: snapshot.optimizedCdaM2,
      scores: snapshot.scores,
      confidence01: snapshot.confidence01,
    })),
  };
}
