export type SupportedSport = "cycling" | "running" | "swimming" | "xc_ski";

export type Vo2EstimatorInput = {
  sport: SupportedSport;
  bodyMassKg: number;
  rer: number;
  efficiency?: number;
  powerW?: number;
  velocityMMin?: number;
  gradeFraction?: number;
};

export type Vo2EstimatorOutput = {
  vo2LMin: number;
  vo2MlKgMin: number;
  kcalPerLO2: number;
  method: string;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, digits = 3) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

/**
 * Device-first VO2 estimator.
 * Priority: objective external load (power/speed/grade), optional lab VO2 as override in UI.
 */
export function estimateVo2FromDevice(input: Vo2EstimatorInput): Vo2EstimatorOutput {
  const sport = input.sport;
  const mass = Math.max(35, input.bodyMassKg);
  const rer = clamp(input.rer, 0.7, 1.05);
  const eta = clamp(input.efficiency ?? 0.24, 0.05, 0.45);
  const powerW = Math.max(0, input.powerW ?? 0);
  const velocityMMin = Math.max(0, input.velocityMMin ?? 0);
  const grade = clamp(input.gradeFraction ?? 0, -0.2, 0.3);
  const kcalPerLO2 = 3.815 + 1.232 * rer;

  const vo2FromPramperoLMin =
    powerW > 0 ? ((powerW / eta) * 60) / (4186 * kcalPerLO2) : 0;

  let vo2MlKgMin = 3.5;
  let method = "resting_fallback";

  if (sport === "cycling" && powerW > 0) {
    // ACSM: VO2 (ml/kg/min) = 10.8 * W/kg + 7
    const vo2AcsM = 10.8 * (powerW / mass) + 7;
    const vo2AcsMLMin = (vo2AcsM * mass) / 1000;
    const blendLMin = 0.65 * vo2AcsMLMin + 0.35 * vo2FromPramperoLMin;
    vo2MlKgMin = (blendLMin * 1000) / mass;
    method = "cycling_acsm_prampero_blend";
  } else if (sport === "running" && velocityMMin > 0) {
    // ACSM running equation (flat + grade term).
    const vo2Run = 3.5 + 0.2 * velocityMMin + 0.9 * velocityMMin * Math.max(0, grade);
    if (powerW > 0) {
      // Running power approximation (Stryd-like range 15-18 ml/min per W).
      const vo2PowerMlKgMin = (16.5 * powerW) / mass;
      vo2MlKgMin = 0.7 * vo2Run + 0.3 * vo2PowerMlKgMin;
      method = "running_acsm_plus_power_blend";
    } else {
      vo2MlKgMin = vo2Run;
      method = "running_acsm_velocity_grade";
    }
  } else if (sport === "swimming" && velocityMMin > 0) {
    // Simplified hydrodynamic model: VO2 (ml/min) = a + b*v^3, v in m/s
    const vMs = velocityMMin / 60;
    const vo2MlMin = 300 + 2000 * (vMs ** 3);
    vo2MlKgMin = vo2MlMin / mass;
    method = "swimming_drag_cubic";
  } else if (sport === "xc_ski" && velocityMMin > 0) {
    // ACSM-like skiing approximation with grade correction.
    vo2MlKgMin = 3.5 + 0.3 * velocityMMin + 1.5 * velocityMMin * Math.max(0, grade);
    method = "xc_ski_velocity_grade";
  } else if (powerW > 0) {
    const fallbackMlKgMin = (vo2FromPramperoLMin * 1000) / mass;
    vo2MlKgMin = Math.max(3.5, fallbackMlKgMin);
    method = "power_prampero_fallback";
  }

  const vo2LMin = (vo2MlKgMin * mass) / 1000;
  return {
    vo2LMin: round(vo2LMin),
    vo2MlKgMin: round(vo2MlKgMin),
    kcalPerLO2: round(kcalPerLO2),
    method,
  };
}

