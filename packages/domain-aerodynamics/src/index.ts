import type {
  AerodynamicsCdAEstimate,
  AerodynamicsOptimizationResult,
  AerodynamicsScores,
} from "@empathy/contracts";

export const DOMAIN = "@empathy/domain-aerodynamics" as const;
export const DOMAIN_TITLE = "Aerodynamics";
export const DOMAIN_SUMMARY =
  "Motore deterministico per CdA, drag, watt/time savings e scoring aerodinamico da test validati.";

export const DEFAULT_AIR_DENSITY_KG_M3 = 1.225;

export type DragPowerInput = {
  cdaM2: number;
  speedKph: number;
  airDensityKgM3?: number;
};

export type TimeSavingsInput = {
  baselineCdaM2: number;
  optimizedCdaM2: number;
  speedKph: number;
  durationSeconds: number;
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function kphToMetersPerSecond(speedKph: number): number {
  if (!Number.isFinite(speedKph) || speedKph < 0) {
    throw new RangeError("speedKph must be a non-negative finite number");
  }
  return speedKph / 3.6;
}

export function aerodynamicDragWatts(input: DragPowerInput): number {
  if (!Number.isFinite(input.cdaM2) || input.cdaM2 <= 0) {
    throw new RangeError("cdaM2 must be positive");
  }
  const rho = input.airDensityKgM3 ?? DEFAULT_AIR_DENSITY_KG_M3;
  if (!Number.isFinite(rho) || rho <= 0) {
    throw new RangeError("airDensityKgM3 must be positive");
  }
  const velocity = kphToMetersPerSecond(input.speedKph);
  return 0.5 * rho * input.cdaM2 * velocity ** 3;
}

export function buildCdAEstimate(input: {
  cdaM2: number;
  speedKph?: number;
  confidence01: number;
  method: AerodynamicsCdAEstimate["method"];
}): AerodynamicsCdAEstimate {
  const speedKph = input.speedKph;
  return {
    cdaM2: input.cdaM2,
    speedKph,
    dragWatts:
      typeof speedKph === "number"
        ? aerodynamicDragWatts({ cdaM2: input.cdaM2, speedKph })
        : undefined,
    confidence01: clamp01(input.confidence01),
    method: input.method,
  };
}

export function wattSavingsAtSpeed(input: {
  baselineCdaM2: number;
  optimizedCdaM2: number;
  speedKph: number;
  airDensityKgM3?: number;
}): number {
  const baseline = aerodynamicDragWatts({
    cdaM2: input.baselineCdaM2,
    speedKph: input.speedKph,
    airDensityKgM3: input.airDensityKgM3,
  });
  const optimized = aerodynamicDragWatts({
    cdaM2: input.optimizedCdaM2,
    speedKph: input.speedKph,
    airDensityKgM3: input.airDensityKgM3,
  });
  return Math.max(0, baseline - optimized);
}

export function estimateTimeSavingsSeconds(input: TimeSavingsInput): number {
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
    throw new RangeError("durationSeconds must be positive");
  }
  if (input.optimizedCdaM2 >= input.baselineCdaM2) return 0;
  // First-order cycling approximation: at fixed power, speed scales with CdA^(-1/3).
  const speedRatio = (input.baselineCdaM2 / input.optimizedCdaM2) ** (1 / 3);
  const optimizedDuration = input.durationSeconds / speedRatio;
  return Math.max(0, input.durationSeconds - optimizedDuration);
}

export function buildAerodynamicsOptimizationResult(input: {
  baselineCdaM2: number;
  optimizedCdaM2: number;
  referenceSpeedKph: number;
  confidence01: number;
  changedVariables: AerodynamicsOptimizationResult["changedVariables"];
}): AerodynamicsOptimizationResult {
  const wattSavingsAtReferenceSpeed = wattSavingsAtSpeed({
    baselineCdaM2: input.baselineCdaM2,
    optimizedCdaM2: input.optimizedCdaM2,
    speedKph: input.referenceSpeedKph,
  });
  return {
    baselineCdaM2: input.baselineCdaM2,
    optimizedCdaM2: input.optimizedCdaM2,
    deltaCdaM2: input.optimizedCdaM2 - input.baselineCdaM2,
    wattSavingsAtReferenceSpeed,
    timeSavingsSecondsPerHour: estimateTimeSavingsSeconds({
      baselineCdaM2: input.baselineCdaM2,
      optimizedCdaM2: input.optimizedCdaM2,
      speedKph: input.referenceSpeedKph,
      durationSeconds: 3600,
    }),
    changedVariables: input.changedVariables,
    confidence01: clamp01(input.confidence01),
  };
}

export function computeAerodynamicsScores(input: {
  cdaM2: number;
  optimizedCdaM2?: number;
  positionConfidence01?: number;
  equipmentConfidence01?: number;
}): AerodynamicsScores {
  const cdaScore01 = clamp01((0.42 - input.cdaM2) / 0.22);
  const optimized = input.optimizedCdaM2 ?? input.cdaM2;
  const improvement01 = input.cdaM2 > 0 ? clamp01((input.cdaM2 - optimized) / 0.08) : 0;
  const positionScore01 = clamp01(0.65 * cdaScore01 + 0.35 * improvement01);
  const equipmentScore01 = clamp01(input.equipmentConfidence01 ?? 0.5);
  const aeroEfficiency01 = clamp01(
    0.45 * cdaScore01 + 0.35 * positionScore01 + 0.2 * clamp01(input.positionConfidence01 ?? 0.5),
  );

  return {
    cdaScore01,
    positionScore01,
    equipmentScore01,
    aeroEfficiency01,
  };
}

export * from "./position-surrogate";
export * from "./course-projection";
