export type MaxOxidateInput = {
  vo2LMin: number;
  bodyMassKg: number;
  powerW: number;
  ftpW: number;
  /**
   * Critical power (W) — tetto del flusso aerobico stazionario nel modello P = CP + W′/t.
   * Se assente si usa ~FTP come proxy conservativo (meglio passare CP da Metabolic Profile).
   */
  cpW?: number;
  efficiency: number;
  rer: number;
  smo2RestPct: number;
  smo2WorkPct: number;
  lactateMmolL: number;
  lactateTrendMmolH: number;
  hemoglobinGdL: number;
  sao2Pct: number;
  coreTempC?: number;
  /**
   * VO₂max (L/min) da Metabolic Profile o lab: innalza il soffitto di capacità ossidativa quando
   * `vo2LMin` è una lettura sottomassimale (es. stima da potenza).
   */
  oxidativeCeilingVo2LMin?: number;
};

export type MaxOxidateOutput = {
  vo2RelMlKgMin: number;
  oxidativePowerKw: number;
  oxidativeCapacityKcalMin: number;
  oxidativeCapacityChoGMin: number;
  oxidativeCapacityFatGMin: number;
  /** Domanda metabolica totale (tutta la potenza meccanica → energia). */
  requiredKcalMin: number;
  /** Domanda che deve essere coperta dal metabolismo ossidativo (min(P, CP) in logica CP). */
  oxidativeDemandKcalMin: number;
  /** Potenza con copertura primaria aerobica; sopra CP il resto è anaerobico (W′). */
  aerobicPowerDemandW: number;
  /** Stima potenza oltre CP (glicolisi + alattacida nel modello). */
  glycolyticPowerDemandW: number;
  utilizationRatioPct: number;
  extractionPct: number;
  centralDeliveryIndex: number;
  peripheralUtilizationIndex: number;
  bottleneckIndex: number;
  oxidativeBottleneckIndex: number;
  redoxStressIndex: number;
  nadhPressureIndex: number;
  reoxidationCapacityIndex: number;
  bottleneckType: "central_delivery" | "peripheral_utilization" | "glycolytic_pressure" | "balanced";
  state: string;
  intensityPctFtp: number;
  /** VO₂ (L/min) usato per la capacità ossidativa (dopo eventuale tetto profilo). */
  vo2ForCapacityLMin: number;
  /** V̇O₂ relativo (ml/kg/min) coerente con `vo2ForCapacityLMin`. */
  vo2CapacityRelMlKgMin: number;
  /** True se il tetto profilo ha aumentato il VO₂ rispetto alla sola lettura in input. */
  profileVo2maxCouplingActive: boolean;
  /** Quota di potenza coperta come flusso aerobico stazionario (≤CP) in %. */
  aerobicDemandPctOfPower: number;
  /** Capacità kcal/min da VO₂ for capacity, prima del fattore delivery/periferico (≈ grezzo). */
  oxidativeCapacityKcalMinGross: number;
  /** Domanda ossidativa vs capacità calcolata solo dalla lettura VO₂ in input (grezza). */
  utilizationVo2CoherencePct: number;
  /** Domanda energetica totale vs capacità ossidativa netta (totale/netta). */
  utilizationDeliveryStressPct: number;
  version: "max-oxidate-engine-v1.3";
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, digits = 3) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

export function computeMaxOxidateEngine(input: MaxOxidateInput): MaxOxidateOutput {
  const vo2 = Math.max(0.2, input.vo2LMin);
  const bodyMass = Math.max(35, input.bodyMassKg);
  const powerW = Math.max(0, input.powerW);
  const ftpW = Math.max(1, input.ftpW);
  const eta = clamp(input.efficiency, 0.16, 0.35);
  const rer = clamp(input.rer, 0.72, 1.05);
  const smo2Rest = clamp(input.smo2RestPct, 35, 90);
  const smo2Work = clamp(input.smo2WorkPct, 5, 85);
  const lactateMmolL = clamp(input.lactateMmolL, 0.3, 20);
  const lactateTrend = clamp(input.lactateTrendMmolH, -6, 12);
  const hb = clamp(input.hemoglobinGdL, 9, 18);
  const sao2 = clamp(input.sao2Pct, 85, 100);
  const coreTempC = clamp(input.coreTempC ?? 37.4, 35.5, 40.2);

  const intensityPctFtp = (powerW / ftpW) * 100;
  const vo2Rel = (vo2 * 1000) / bodyMass;

  const cpW = Math.max(1, input.cpW ?? ftpW * 0.97);
  const aerobicPowerDemandW = powerW <= cpW ? powerW : cpW;
  const glycolyticPowerDemandW = Math.max(0, powerW - cpW);
  const aerobicDemandPctOfPower = powerW > 1 ? clamp((100 * aerobicPowerDemandW) / powerW, 0, 100) : 0;

  const ceilV = input.oxidativeCeilingVo2LMin;
  const profileVo2maxCouplingActive =
    ceilV != null && Number.isFinite(ceilV) && ceilV >= 0.35 && vo2 < ceilV * 0.97;
  const vo2ForCapacity =
    ceilV != null && Number.isFinite(ceilV) && ceilV >= 0.35 ? Math.max(vo2, ceilV * 0.88) : vo2;
  const vo2CapacityRelMlKgMin = (vo2ForCapacity * 1000) / bodyMass;

  // Equivalent energetic rate from VO2 and RER (capacità = tetto profilo se utile).
  const kcalPerLO2 = 3.9 + 1.1 * rer;
  const oxidativeCapacityKcalMinRaw = vo2ForCapacity * kcalPerLO2;
  const oxidativePowerKw = (vo2 * 20.9) / 60;

  // Peripheral extraction from NIRS (SmO2 drop).
  const extractionPct = clamp(((smo2Rest - smo2Work) / smo2Rest) * 100, 0, 85);
  const extractionFactor = clamp(extractionPct / 35, 0.55, 1.35);

  // Central O2 delivery proxy from Hb and arterial saturation.
  const arterialO2Content = 1.34 * hb * (sao2 / 100); // mL O2 / dL blood
  const centralDeliveryIndex = clamp(arterialO2Content / 20, 0.6, 1.15);

  // Peripheral mitochondrial utilization degrades with high/accelerating lactate.
  const peripheralUtilizationIndex = clamp(
    0.82 * extractionFactor - 0.06 * Math.max(0, lactateMmolL - 4) - 0.03 * Math.max(0, lactateTrend - 1.5),
    0.5,
    1.1
  );

  const effectiveCapacityFactor = clamp(0.52 * centralDeliveryIndex + 0.48 * peripheralUtilizationIndex, 0.55, 1.05);
  const oxidativeCapacityKcalMinGross = oxidativeCapacityKcalMinRaw;
  const oxidativeCapacityKcalMin = oxidativeCapacityKcalMinRaw * effectiveCapacityFactor;
  const requiredKcalMin = (powerW / eta) * 60 / 4184;
  const oxidativeDemandKcalMin = (aerobicPowerDemandW / eta) * 60 / 4184;

  const rawReadingCapacityKcalMin = vo2 * kcalPerLO2 * effectiveCapacityFactor;
  const utilizationVo2CoherencePct = (oxidativeDemandKcalMin / Math.max(0.1, rawReadingCapacityKcalMin)) * 100;
  const utilizationDeliveryStressPct = (requiredKcalMin / Math.max(0.1, oxidativeCapacityKcalMin)) * 100;

  const choFraction = clamp(
    0.45 + 0.0035 * Math.max(0, intensityPctFtp - 70) + 0.025 * Math.max(0, lactateMmolL - 2),
    0.35,
    0.95
  );
  const oxidativeCapacityChoGMin = (oxidativeCapacityKcalMin * choFraction) / 4;
  const oxidativeCapacityFatGMin = (oxidativeCapacityKcalMin * (1 - choFraction)) / 9;
  const utilizationRatioPct = (oxidativeDemandKcalMin / Math.max(0.1, oxidativeCapacityKcalMin)) * 100;

  const centralScore = clamp((1 - centralDeliveryIndex) * 1.25 + Math.max(0, 92 - sao2) / 20, 0, 1);
  const peripheralScore = clamp((1 - peripheralUtilizationIndex) + Math.max(0, 25 - extractionPct) / 60, 0, 1);
  const glycolyticScore = clamp(
    0.5 * Math.max(0, intensityPctFtp - 100) / 30 + 0.5 * Math.max(0, lactateTrend) / 5,
    0,
    1
  );

  const bottleneckIndex = Math.max(centralScore, peripheralScore, glycolyticScore);
  let bottleneckType: MaxOxidateOutput["bottleneckType"] = "balanced";
  if (bottleneckIndex >= 0.2) {
    if (centralScore >= peripheralScore && centralScore >= glycolyticScore) bottleneckType = "central_delivery";
    else if (peripheralScore >= centralScore && peripheralScore >= glycolyticScore) bottleneckType = "peripheral_utilization";
    else bottleneckType = "glycolytic_pressure";
  }

  const state =
    bottleneckType === "central_delivery"
      ? "Bottleneck centrale: delivery O2 limitante"
      : bottleneckType === "peripheral_utilization"
        ? "Bottleneck periferico: utilizzo mitocondriale limitante"
        : bottleneckType === "glycolytic_pressure"
          ? "Pressione glicolitica elevata sopra la capacita ossidativa"
          : "Sistema bilanciato: nessun collo di bottiglia dominante";

  // Redox proxy block:
  // - NADH pressure rises with intensity, lactate, rising lactate trend, and high RER.
  // - Reoxidation capacity falls when peripheral/central O2 handling is limited.
  const nadhPressureIndex = clamp(
    0.35 * clamp((intensityPctFtp - 78) / 32, 0, 1) +
      0.25 * clamp((lactateMmolL - 2.2) / 4.8, 0, 1) +
      0.2 * clamp(lactateTrend / 5, 0, 1) +
      0.2 * clamp((rer - 0.86) / 0.16, 0, 1),
    0,
    1,
  );
  const thermalPenalty = clamp((coreTempC - 38.4) / 1.2, 0, 1) * 0.12;
  const reoxidationCapacityIndex = clamp(
    0.55 * peripheralUtilizationIndex + 0.35 * centralDeliveryIndex + 0.1 * extractionFactor - thermalPenalty,
    0,
    1.2,
  );
  const redoxStressIndex = clamp(
    ((nadhPressureIndex - reoxidationCapacityIndex + 0.55) / 1.55) * 100,
    0,
    100,
  );
  const oxidativeBottleneckIndex = clamp(
    (0.6 * bottleneckIndex + 0.4 * Math.max(0, (utilizationRatioPct - 90) / 50)) * 100,
    0,
    100,
  );

  return {
    vo2RelMlKgMin: round(vo2Rel),
    oxidativePowerKw: round(oxidativePowerKw),
    oxidativeCapacityKcalMin: round(oxidativeCapacityKcalMin),
    oxidativeCapacityChoGMin: round(oxidativeCapacityChoGMin),
    oxidativeCapacityFatGMin: round(oxidativeCapacityFatGMin),
    requiredKcalMin: round(requiredKcalMin),
    oxidativeDemandKcalMin: round(oxidativeDemandKcalMin),
    aerobicPowerDemandW: round(aerobicPowerDemandW),
    glycolyticPowerDemandW: round(glycolyticPowerDemandW),
    utilizationRatioPct: round(utilizationRatioPct),
    extractionPct: round(extractionPct),
    centralDeliveryIndex: round(centralDeliveryIndex),
    peripheralUtilizationIndex: round(peripheralUtilizationIndex),
    bottleneckIndex: round(bottleneckIndex),
    oxidativeBottleneckIndex: round(oxidativeBottleneckIndex),
    redoxStressIndex: round(redoxStressIndex),
    nadhPressureIndex: round(nadhPressureIndex),
    reoxidationCapacityIndex: round(reoxidationCapacityIndex),
    bottleneckType,
    state,
    intensityPctFtp: round(intensityPctFtp),
    vo2ForCapacityLMin: round(vo2ForCapacity, 3),
    vo2CapacityRelMlKgMin: round(vo2CapacityRelMlKgMin),
    profileVo2maxCouplingActive,
    aerobicDemandPctOfPower: round(aerobicDemandPctOfPower),
    oxidativeCapacityKcalMinGross: round(oxidativeCapacityKcalMinGross),
    utilizationVo2CoherencePct: round(utilizationVo2CoherencePct),
    utilizationDeliveryStressPct: round(utilizationDeliveryStressPct),
    version: "max-oxidate-engine-v1.3",
  };
}
