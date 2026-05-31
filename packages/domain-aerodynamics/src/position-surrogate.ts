import type {
  AerodynamicsEquipmentSnapshot,
  AerodynamicsGeometryProfile,
  AerodynamicsPositionScenarioV1,
  AerodynamicsPositionSnapshot,
  AerodynamicsScenarioCompareV1,
} from "@empathy/contracts";

const CDA_MIN = 0.22;
const CDA_MAX = 0.42;
const DEFAULT_REFERENCE_SPEED_KPH = 45;
const AIR_DENSITY = 1.225;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function dragWatts(cdaM2: number, speedKph: number): number {
  const velocity = speedKph / 3.6;
  return 0.5 * AIR_DENSITY * cdaM2 * velocity ** 3;
}

function wattSavingsAtSpeed(input: {
  baselineCdaM2: number;
  optimizedCdaM2: number;
  speedKph: number;
}): number {
  return Math.max(0, dragWatts(input.baselineCdaM2, input.speedKph) - dragWatts(input.optimizedCdaM2, input.speedKph));
}

export function clampCdaM2(cdaM2: number): number {
  if (!Number.isFinite(cdaM2)) return CDA_MIN;
  return Math.min(CDA_MAX, Math.max(CDA_MIN, cdaM2));
}

export function applyPositionDelta(
  base: AerodynamicsPositionSnapshot,
  delta: Partial<AerodynamicsPositionSnapshot>,
): AerodynamicsPositionSnapshot {
  const out: AerodynamicsPositionSnapshot = { ...base };
  for (const key of Object.keys(delta) as Array<keyof AerodynamicsPositionSnapshot>) {
    const offset = delta[key];
    if (typeof offset !== "number" || !Number.isFinite(offset)) continue;
    const current = out[key];
    out[key] = typeof current === "number" ? current + offset : offset;
  }
  return out;
}

export function mergeEquipment(
  base: AerodynamicsEquipmentSnapshot,
  delta?: Partial<AerodynamicsEquipmentSnapshot>,
): AerodynamicsEquipmentSnapshot {
  if (!delta) return { ...base };
  return { ...base, ...delta };
}

export function estimateCdaFromPositionSurrogate(input: {
  position: AerodynamicsPositionSnapshot;
  geometry?: AerodynamicsGeometryProfile;
  equipment?: AerodynamicsEquipmentSnapshot;
  cdaSurrogateM2?: number;
}): number {
  if (typeof input.cdaSurrogateM2 === "number" && input.cdaSurrogateM2 > 0) {
    return clampCdaM2(input.cdaSurrogateM2);
  }

  const frontal = input.geometry?.frontalAreaM2 ?? 0.38;
  const torso = input.position.torsoAngleDeg ?? 12;
  const headDrop = input.position.headDropMm ?? 45;
  const elbow = input.position.elbowWidthMm ?? 350;
  const shoulder = input.position.shoulderWidthMm ?? 400;

  const anglePenalty = Math.max(0, ((Math.max(torso, 8) - 8) / 10) ** 2 * 0.015);
  const headPenalty = Math.max(0, (headDrop - 40) * 0.00008);
  const elbowPenalty = Math.max(0, Math.abs(elbow - 320) * 0.00003);
  const shoulderPenalty = Math.max(0, Math.abs(shoulder - 380) * 0.00002);
  const helmetBonus = input.equipment?.helmet === "aero" ? -0.008 : 0;
  const wheelsBonus = input.equipment?.wheels === "disc" ? -0.004 : 0;

  return clampCdaM2(
    frontal * 0.82 + anglePenalty + headPenalty + elbowPenalty + shoulderPenalty + helmetBonus + wheelsBonus,
  );
}

type ScenarioTemplate = {
  id: string;
  label: string;
  positionDelta?: Partial<AerodynamicsPositionSnapshot>;
  equipmentDelta?: Partial<AerodynamicsEquipmentSnapshot>;
};

const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  { id: "baseline", label: "Baseline CV" },
  { id: "torso_minus_3", label: "Torso −3°", positionDelta: { torsoAngleDeg: -3 } },
  { id: "torso_plus_3", label: "Torso +3°", positionDelta: { torsoAngleDeg: 3 } },
  { id: "head_drop_minus_20", label: "Head drop −20 mm", positionDelta: { headDropMm: -20 } },
  { id: "elbow_narrow_40", label: "Elbows −40 mm", positionDelta: { elbowWidthMm: -40 } },
  { id: "aero_helmet", label: "Aero helmet", equipmentDelta: { helmet: "aero" } },
];

function changedVariables(
  baseline: AerodynamicsPositionSnapshot,
  candidate: AerodynamicsPositionSnapshot,
): Array<keyof AerodynamicsPositionSnapshot> {
  const keys: Array<keyof AerodynamicsPositionSnapshot> = [
    "torsoAngleDeg",
    "headDropMm",
    "elbowWidthMm",
    "shoulderWidthMm",
    "armExtensionDeg",
    "dropMm",
    "reachMm",
  ];
  return keys.filter((key) => {
    const a = baseline[key];
    const b = candidate[key];
    return typeof a === "number" && typeof b === "number" && Math.abs(a - b) > 1e-6;
  });
}

export function buildPositionScenarioMatrix(input: {
  baselinePosition: AerodynamicsPositionSnapshot;
  baselineEquipment: AerodynamicsEquipmentSnapshot;
  geometry?: AerodynamicsGeometryProfile;
  cdaSurrogateM2?: number;
  confidence01: number;
  referenceSpeedKph?: number;
  maxCandidates?: number;
}): AerodynamicsScenarioCompareV1 {
  const referenceSpeedKph = input.referenceSpeedKph ?? DEFAULT_REFERENCE_SPEED_KPH;
  const maxCandidates = input.maxCandidates ?? 8;
  const baselineCda = estimateCdaFromPositionSurrogate({
    position: input.baselinePosition,
    geometry: input.geometry,
    equipment: input.baselineEquipment,
    cdaSurrogateM2: input.cdaSurrogateM2,
  });

  const candidates: AerodynamicsPositionScenarioV1[] = [];

  for (const template of SCENARIO_TEMPLATES.slice(0, maxCandidates)) {
    const position = template.positionDelta
      ? applyPositionDelta(input.baselinePosition, template.positionDelta)
      : { ...input.baselinePosition };
    const equipment = mergeEquipment(input.baselineEquipment, template.equipmentDelta);
    const cdaM2 = estimateCdaFromPositionSurrogate({
      position,
      geometry: input.geometry,
      equipment,
      cdaSurrogateM2: template.id === "baseline" ? input.cdaSurrogateM2 : undefined,
    });
    const wattSavingsVsBaseline = wattSavingsAtSpeed({
      baselineCdaM2: baselineCda,
      optimizedCdaM2: cdaM2,
      speedKph: referenceSpeedKph,
    });

    candidates.push({
      id: template.id,
      label: template.label,
      position,
      equipment,
      cdaM2,
      wattSavingsVsBaseline,
      changedVariables: changedVariables(input.baselinePosition, position),
      confidence01: clamp01(input.confidence01 * (template.id === "baseline" ? 1 : 0.88)),
      method: "surrogate_model",
    });
  }

  const ranked = rankScenariosByWattSavings(candidates, baselineCda);
  const best = ranked.find((row) => row.id !== "baseline") ?? ranked[0]!;

  return {
    version: "aero_scenario_compare_v1",
    referenceSpeedKph,
    baselineScenarioId: "baseline",
    selectedScenarioId: best.id === "baseline" ? "baseline" : best.id,
    candidates: ranked,
  };
}

export function rankScenariosByWattSavings(
  candidates: AerodynamicsPositionScenarioV1[],
  baselineCdaM2: number,
): AerodynamicsPositionScenarioV1[] {
  return [...candidates].sort((a, b) => {
    if (a.id === "baseline") return -1;
    if (b.id === "baseline") return 1;
    const savingsA = wattSavingsAtSpeed({
      baselineCdaM2,
      optimizedCdaM2: a.cdaM2,
      speedKph: DEFAULT_REFERENCE_SPEED_KPH,
    });
    const savingsB = wattSavingsAtSpeed({
      baselineCdaM2,
      optimizedCdaM2: b.cdaM2,
      speedKph: DEFAULT_REFERENCE_SPEED_KPH,
    });
    return savingsB - savingsA;
  });
}

export function findScenarioById(
  compare: AerodynamicsScenarioCompareV1,
  scenarioId: string,
): AerodynamicsPositionScenarioV1 | null {
  return compare.candidates.find((row) => row.id === scenarioId) ?? null;
}
