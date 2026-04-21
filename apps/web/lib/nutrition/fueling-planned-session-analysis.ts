import type { PhysiologyState } from "@/lib/empathy/schemas/physiology";
import { computeLactateEngine, type LactateEngineOutput } from "@/lib/engines/lactate-engine";
import { intensityToRelativeLoad } from "@/lib/training/builder/pro2-intensity";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import {
  effectivePlannedWorkoutNutritionMetrics,
  pro2BuilderContractToChartSegments,
} from "@/lib/training/builder/pro2-session-notes";

export type FuelingPlannedSessionInputRow = {
  id: string;
  title: string;
  durationMinutesDb?: number | null;
  tssTargetDb?: number | null;
  kcalTargetDb?: number | null;
  builderSession?: Pro2BuilderSessionContract | null;
};

export type PlannedFuelingSessionSubstrateSnapshot = {
  estimatedIntensityPctFtp: number;
  lactateProducedG: number;
  glucoseFromCoriG: number;
  glucoseNetFromCoriG: number;
  exogenousOxidizedG: number;
  choAvailableG: number;
  glycolyticSharePct: number;
  gutPathwayRisk: LactateEngineOutput["gutPathwayRisk"];
  bloodDeliveryPctOfIngested: number;
  glycogenCombustedNetG: number;
  glucoseRequiredForStrategyG: number;
};

export type PlannedFuelingSessionAnalysis = {
  id: string;
  title: string;
  durationMin: number;
  tss: number;
  kcal: number;
  /** Peso relativo carico CHO (kcal) per split intra tra sessioni */
  dayChoEnergyWeight: number;
  lactateModel: LactateEngineOutput;
  substrate: PlannedFuelingSessionSubstrateSnapshot;
  physiologicalIntent: string[];
  nutritionSupports: string[];
  inhibitorsAndRisks: string[];
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, digits = 1) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

function n(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/** Stessa logica di `buildEffectiveDayTrainingContext` / TSS·h → proxy %FTP. */
export function estimateIntensityPctFtpFromTssDuration(tss: number, durationMin: number): number {
  const hours = Math.max(0.25, durationMin / 60);
  const tssPerHour = Math.max(0, tss) / hours;
  return round(clamp(Math.sqrt(Math.max(0, tssPerHour) / 100) * 100, 55, 120), 1);
}

function estimateRerFromIntensity(intensityPctFtp: number): number {
  return clamp(0.82 + (intensityPctFtp - 60) * 0.0033, 0.78, 1.02);
}

function estimateVo2LMinFromPower(powerW: number, ftpW: number, efficiency: number, rer: number): number {
  const eta = clamp(efficiency, 0.18, 0.32);
  const kcalPerL = 3.9 + 1.1 * rer;
  const implied = ((powerW / eta) * 60) / 4184 / kcalPerL;
  const cap = Math.max(1.2, (ftpW / eta) * 60 * 1.35) / 4184 / kcalPerL;
  return clamp(implied, 0.25, cap);
}

function gutRiskRank(r: LactateEngineOutput["gutPathwayRisk"]): number {
  if (r === "high") return 2;
  if (r === "moderate") return 1;
  return 0;
}

function gutRiskFromRank(rank: number): LactateEngineOutput["gutPathwayRisk"] {
  if (rank >= 2) return "high";
  if (rank >= 1) return "moderate";
  return "low";
}

/**
 * Somma più esecuzioni del motore lattato (uno per segmento Builder con potenza di zona),
 * per non collassare 180′ con picchi Z5/Z6 in una sola media TSS→FTP.
 */
function mergeLactateEngineOutputs(
  parts: Array<{ out: LactateEngineOutput; durationMin: number }>,
): LactateEngineOutput {
  if (!parts.length) {
    throw new Error("mergeLactateEngineOutputs: empty");
  }
  const totalMin = parts.reduce((s, p) => s + p.durationMin, 0);
  const wDur = (i: number) => parts[i].durationMin / Math.max(1e-6, totalMin);

  let energyDemandKcal = 0;
  let aerobicKcal = 0;
  let anaerobicKcal = 0;
  let intensityPctNum = 0;
  let choKcal = 0;
  let nonChoKcal = 0;
  let glycogenCombustedGrossG = 0;
  let lactateProducedG = 0;
  let lactateFromAnaerobicGlycolysisG = 0;
  let lactateFromAerobicGlycolysisG = 0;
  let lactateOxidizedG = 0;
  let lactateCoriG = 0;
  let lactateAccumG = 0;
  let glucoseFromCoriG = 0;
  let coriCostKcal = 0;
  let glucoseNetFromCoriG = 0;
  let choIngestedTotalG = 0;
  let choAfterAbsorptionG = 0;
  let choAvailableG = 0;
  let exogenousOxidizedG = 0;
  let microbiotaSequestrationG = 0;
  let choIntoBloodstreamG = 0;
  let bloodDeliveryNum = 0;
  let bloodDeliveryDenom = 0;
  let microbiotaPredationPct = 0;
  let effectiveSequestrationPct = 0;
  let microbiotaDysbiosisScore = 0;
  let gutStressScore = 0;
  let fermentationLoadScore = 0;
  let gutAbsorptionYieldPctOfIngestedNum = 0;
  let gutAbsorptionYieldDenom = 0;
  let glycogenCombustedNetG = 0;
  let glucoseRequiredForStrategyG = 0;
  let maxGutRisk = 0;
  let profileMetabolicCouplingActive = false;
  let profileAnaerobicMax = 0;
  let bloodGlucoseNum = 0;
  let bloodGlucoseW = 0;

  for (let i = 0; i < parts.length; i += 1) {
    const { out: o, durationMin: dm } = parts[i];
    const w = wDur(i);
    energyDemandKcal += o.energyDemandKcal;
    aerobicKcal += o.aerobicKcal;
    anaerobicKcal += o.anaerobicKcal;
    intensityPctNum += o.intensityPctFtp * w;
    choKcal += o.choKcal;
    nonChoKcal += o.nonChoKcal;
    glycogenCombustedGrossG += o.glycogenCombustedGrossG;
    lactateProducedG += o.lactateProducedG;
    lactateFromAnaerobicGlycolysisG += o.lactateFromAnaerobicGlycolysisG;
    lactateFromAerobicGlycolysisG += o.lactateFromAerobicGlycolysisG;
    lactateOxidizedG += o.lactateOxidizedG;
    lactateCoriG += o.lactateCoriG;
    lactateAccumG += o.lactateAccumG;
    glucoseFromCoriG += o.glucoseFromCoriG;
    coriCostKcal += o.coriCostKcal;
    glucoseNetFromCoriG += o.glucoseNetFromCoriG;
    choIngestedTotalG += o.choIngestedTotalG;
    choAfterAbsorptionG += o.choAfterAbsorptionG;
    choAvailableG += o.choAvailableG;
    exogenousOxidizedG += o.exogenousOxidizedG;
    microbiotaSequestrationG += o.microbiotaSequestrationG;
    choIntoBloodstreamG += o.choIntoBloodstreamG;
    if (o.choIngestedTotalG > 0.01) {
      bloodDeliveryNum += o.bloodDeliveryPctOfIngested * o.choIngestedTotalG;
      bloodDeliveryDenom += o.choIngestedTotalG;
    }
    microbiotaPredationPct += o.microbiotaPredationPctOfIngested * w;
    effectiveSequestrationPct += o.effectiveSequestrationPct * w;
    microbiotaDysbiosisScore += o.microbiotaDysbiosisScore * w;
    gutStressScore += o.gutStressScore * w;
    fermentationLoadScore += o.fermentationLoadScore * w;
    if (o.choIngestedTotalG > 0.01) {
      gutAbsorptionYieldPctOfIngestedNum += o.gutAbsorptionYieldPctOfIngested * o.choIngestedTotalG;
      gutAbsorptionYieldDenom += o.choIngestedTotalG;
    }
    glycogenCombustedNetG += o.glycogenCombustedNetG;
    glucoseRequiredForStrategyG += o.glucoseRequiredForStrategyG;
    maxGutRisk = Math.max(maxGutRisk, gutRiskRank(o.gutPathwayRisk));
    profileMetabolicCouplingActive = profileMetabolicCouplingActive || o.profileMetabolicCouplingActive;
    profileAnaerobicMax = Math.max(profileAnaerobicMax, o.profileAnaerobicModulation01);
    const bg = o.bloodGlucoseMmolL;
    if (bg != null && Number.isFinite(bg)) {
      bloodGlucoseNum += bg * w;
      bloodGlucoseW += w;
    }
  }

  const lp = Math.max(1e-9, lactateProducedG);
  const lactateFateOxidationPct = round((lactateOxidizedG / lp) * 100, 1);
  const lactateFateCoriPct = round((lactateCoriG / lp) * 100, 1);
  const lactateFateAccumPct = round((lactateAccumG / lp) * 100, 1);
  const glycolyticSharePct =
    energyDemandKcal > 0 ? round((choKcal / energyDemandKcal) * 100, 1) : parts[0].out.glycolyticSharePct;
  const gutAbsorptionYieldPctOfIngested =
    gutAbsorptionYieldDenom > 0 ? round(gutAbsorptionYieldPctOfIngestedNum / gutAbsorptionYieldDenom, 1) : 0;
  const bloodDeliveryPctOfIngested =
    bloodDeliveryDenom > 0 ? round(bloodDeliveryNum / bloodDeliveryDenom, 1) : parts[0].out.bloodDeliveryPctOfIngested;

  return {
    energyDemandKcal: round(energyDemandKcal),
    aerobicKcal: round(aerobicKcal),
    anaerobicKcal: round(anaerobicKcal),
    intensityPctFtp: round(intensityPctNum, 1),
    choKcal: round(choKcal),
    nonChoKcal: round(nonChoKcal),
    glycolyticSharePct,
    glycogenCombustedGrossG: round(glycogenCombustedGrossG),
    lactateProducedG: round(lactateProducedG),
    lactateFromAnaerobicGlycolysisG: round(lactateFromAnaerobicGlycolysisG),
    lactateFromAerobicGlycolysisG: round(lactateFromAerobicGlycolysisG),
    lactateOxidizedG: round(lactateOxidizedG),
    lactateCoriG: round(lactateCoriG),
    lactateAccumG: round(lactateAccumG),
    lactateFateOxidationPct,
    lactateFateCoriPct,
    lactateFateAccumPct,
    glucoseFromCoriG: round(glucoseFromCoriG),
    coriCostKcal: round(coriCostKcal),
    glucoseNetFromCoriG: round(glucoseNetFromCoriG),
    choIngestedTotalG: round(choIngestedTotalG),
    choAfterAbsorptionG: round(choAfterAbsorptionG),
    choAvailableG: round(choAvailableG),
    exogenousOxidizedG: round(exogenousOxidizedG),
    microbiotaSequestrationG: round(microbiotaSequestrationG),
    choIntoBloodstreamG: round(choIntoBloodstreamG),
    bloodDeliveryPctOfIngested,
    microbiotaPredationPctOfIngested: round(microbiotaPredationPct, 1),
    effectiveSequestrationPct: round(effectiveSequestrationPct, 1),
    gutAbsorptionYieldPctOfIngested,
    microbiotaDysbiosisScore: round(microbiotaDysbiosisScore, 3),
    gutStressScore: round(gutStressScore, 3),
    fermentationLoadScore: round(fermentationLoadScore, 3),
    gutPathwayRisk: gutRiskFromRank(maxGutRisk),
    glycogenCombustedNetG: round(glycogenCombustedNetG),
    glucoseRequiredForStrategyG: round(glucoseRequiredForStrategyG),
    profileMetabolicCouplingActive,
    profileAnaerobicModulation01: round(clamp(profileAnaerobicMax, 0, 1.2), 3),
    ...(bloodGlucoseW > 0.01 ? { bloodGlucoseMmolL: round(bloodGlucoseNum / bloodGlucoseW, 2) } : {}),
    version: "lactate-engine-v1.5",
  };
}

function buildFuelingCopyFromLactateModel(lm: LactateEngineOutput): {
  physiologicalIntent: string[];
  nutritionSupports: string[];
  inhibitorsAndRisks: string[];
} {
  const physiologicalIntent: string[] = [];
  const nutritionSupports: string[] = [];
  const inhibitorsAndRisks: string[] = [];

  physiologicalIntent.push(
    `Modello lattato: ~${round(lm.intensityPctFtp)}% FTP, quota energetica CHO ~${round(lm.glycolyticSharePct)}% (stima motore)`,
  );

  if (lm.lactateProducedG > 38) {
    physiologicalIntent.push("Produzione lattato stimata elevata: domanda glucidica muscolare alta");
  } else if (lm.lactateProducedG > 20) {
    physiologicalIntent.push("Carico glicolitico moderato-alto sulla sessione pianificata");
  } else {
    physiologicalIntent.push("Profilo prevalentemente aerobico per durata e intensità stimata");
  }

  if (lm.glucoseFromCoriG > 14) {
    nutritionSupports.push(
      `Riciclo Cori (glucosio da riconversione lattato) ~${round(lm.glucoseFromCoriG)} g equivalenti — quota endogena rilevante`,
    );
  } else if (lm.glucoseFromCoriG > 6) {
    nutritionSupports.push(`Apporto Cori moderato ~${round(lm.glucoseFromCoriG)} g glucosio equivalente`);
  }

  if (lm.exogenousOxidizedG > 10) {
    nutritionSupports.push(
      `CHO esogena ossidata ~${round(lm.exogenousOxidizedG)} g con tariffa intra attuale (assorbimento + tetto ossidativo)`,
    );
  } else if (lm.exogenousOxidizedG > 3) {
    nutritionSupports.push(`Ossidazione CHO esogena contenuta ~${round(lm.exogenousOxidizedG)} g — margine per aumentare frazionamento`);
  }

  const gap = lm.glucoseRequiredForStrategyG - lm.choAvailableG;
  if (gap > 28) {
    nutritionSupports.push("Gap glucosio strategico: aumentare CHO intra o migliorare tolleranza (diluizione / mix)");
  } else if (gap > 12) {
    nutritionSupports.push("Disponibilità CHO assorbita vicina al fabbisogno glicogeno stimato");
  }

  if (lm.gutPathwayRisk === "high") {
    inhibitorsAndRisks.push("Rischio via intestinale elevato (modello): ridurre osmolalità o diluire le prese");
  } else if (lm.gutPathwayRisk === "moderate") {
    inhibitorsAndRisks.push("Carico intestinale moderato: preferire bevande + gel alternati e acqua sufficiente");
  }

  if (lm.lactateAccumG > lm.lactateOxidizedG * 0.55) {
    inhibitorsAndRisks.push("Accumulo lattato netto alto vs ossidazione stimata: attenzione a picchi ripetuti senza recovery");
  }

  if (lm.bloodDeliveryPctOfIngested > 0 && lm.bloodDeliveryPctOfIngested < 72) {
    inhibitorsAndRisks.push(
      `Delivery ematico CHO ingerito stimato ~${round(lm.bloodDeliveryPctOfIngested)}% — verificare pratica e microbiota`,
    );
  }

  return { physiologicalIntent, nutritionSupports, inhibitorsAndRisks };
}

/**
 * Per ogni sessione pianificata: motore lattato/gut deterministico (stessa pipeline fisiologia).
 * Se c’è un contratto Builder con segmenti (zone), esegue il motore **per segmento** (potenza da Zx)
 * e somma i risultati; altrimenti usa la stima TSS+durata → %FTP media (fallback legacy).
 */
export function analyzePlannedSessionsForFueling(input: {
  sessions: FuelingPlannedSessionInputRow[];
  weightKg: number;
  ftpWatts: number;
  physiology: PhysiologyState | null;
  choIngestedGH: number;
}): PlannedFuelingSessionAnalysis[] {
  const ftp = Math.max(1, input.ftpWatts);
  const wKg = input.weightKg > 30 ? input.weightKg : 72;
  const lac = input.physiology?.lactateProfile;
  const met = input.physiology?.metabolicProfile;

  const producedG = lac?.lactateProducedG;
  const oxidizedG = lac?.lactateOxidizedG;
  const coriG = lac?.lactateCoriG;
  const oxFromMass =
    typeof producedG === "number" &&
    producedG > 1e-6 &&
    typeof oxidizedG === "number" &&
    Number.isFinite(oxidizedG)
      ? (oxidizedG / producedG) * 100
      : null;
  const coriFromMass =
    typeof producedG === "number" &&
    producedG > 1e-6 &&
    typeof coriG === "number" &&
    Number.isFinite(coriG)
      ? (coriG / producedG) * 100
      : null;

  const oxidationPct = clamp(n(lac?.lactateFateOxidationPct, oxFromMass ?? 70), 35, 88);
  const coriPct = clamp(n(lac?.lactateFateCoriPct, coriFromMass ?? 18), 6, 50);

  const gutAbsorptionPct = clamp(n(lac?.gutAbsorptionYieldPctOfIngested, 88), 55, 98);
  const microbiotaSequestrationPct = clamp(n(lac?.effectiveSequestrationPct, 6), 0, 30);

  const efficiency = clamp(0.234 + (100 - wKg) * 0.0004, 0.2, 0.28);

  const lv = (lac?.latestValues ?? {}) as Record<string, unknown>;
  const gutTrainingPct = clamp(n(lv.gut_training_pct, 60), 35, 95);
  const smo2Rest = clamp(n(lv.smo2_rest_pct, n(lv.smo2_rest, 68)), 45, 85);
  const smo2Work = clamp(n(lv.smo2_work_pct, n(lv.smo2_work, 52)), 25, 80);

  const readOpt = (key: string): number | undefined => {
    const v = lv[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return undefined;
  };
  const coreTempC = readOpt("core_temp_c");
  const candidaOvergrowthPct = readOpt("candida_overgrowth_pct");
  const bifidobacteriaPct = readOpt("bifidobacteria_pct");
  const akkermansiaPct = readOpt("akkermansia_pct");
  const butyrateProducersPct = readOpt("butyrate_producers_pct");
  const endotoxinRiskPct = readOpt("endotoxin_risk_pct");

  const cpRaw = met?.cpWatts;
  const wpRaw = met?.wPrimeJ;
  const vlRaw = met?.vLamax;
  const cpW = typeof cpRaw === "number" && cpRaw > 40 ? cpRaw : undefined;
  const wPrimeJ = typeof wpRaw === "number" && wpRaw > 1000 ? wpRaw : undefined;
  const glycolyticIndexProxy = typeof vlRaw === "number" && vlRaw >= 0.28 ? vlRaw : undefined;

  const out: PlannedFuelingSessionAnalysis[] = [];

  for (const row of input.sessions) {
    const m = effectivePlannedWorkoutNutritionMetrics({
      durationMinutesDb: row.durationMinutesDb,
      tssTargetDb: row.tssTargetDb,
      kcalTargetDb: row.kcalTargetDb,
      builderSession: row.builderSession ?? null,
      weightKg: wKg,
    });

    const durationMin = Math.max(1, m.durationMinutes);
    const contract = row.builderSession ?? null;

    /** Potenza per segmento da zone Builder (Z5/Z6 ecc.); evita collasso in un’unica %FTP da TSS. */
    const segmentPowerBlocks = (() => {
      if (!contract) return [] as Array<{ durationMin: number; powerW: number }>;
      const segments = pro2BuilderContractToChartSegments(contract);
      const blocks: Array<{ durationMin: number; powerW: number }> = [];
      for (const s of segments) {
        const dm = Math.max(0.25, s.durationSeconds / 60);
        const label = (s.intensityLabel || "Z3").trim();
        const rel = intensityToRelativeLoad(label);
        blocks.push({ durationMin: dm, powerW: ftp * rel });
      }
      const segSum = blocks.reduce((a, b) => a + b.durationMin, 0);
      const remainder = Math.max(0, durationMin - segSum);
      if (remainder >= 0.75) {
        blocks.push({ durationMin: remainder, powerW: ftp * intensityToRelativeLoad("Z2") });
      }
      const totalAfterFill = blocks.reduce((a, b) => a + b.durationMin, 0);
      const coverage = totalAfterFill <= 0 ? 0 : totalAfterFill / durationMin;
      /** Serve almeno un minimo di struttura Builder reale (non solo “filler” Z2). */
      const builderCoreMin = Math.max(0, segSum);
      const builderCoreRatio = durationMin > 0 ? builderCoreMin / durationMin : 0;
      if (blocks.length === 0 || coverage < 0.85 || builderCoreRatio < 0.06) return [];
      return blocks;
    })();

    let lm: LactateEngineOutput;

    if (segmentPowerBlocks.length > 0) {
      const totalSegMin = segmentPowerBlocks.reduce((s, b) => s + b.durationMin, 0);
      const parts: Array<{ out: LactateEngineOutput; durationMin: number }> = [];
      for (const b of segmentPowerBlocks) {
        const intensityPctBlock = (b.powerW / ftp) * 100;
        const rer = estimateRerFromIntensity(intensityPctBlock);
        const vo2LMin = estimateVo2LMinFromPower(b.powerW, ftp, efficiency, rer);
        const choSlice =
          totalSegMin > 0 ? Math.max(0, input.choIngestedGH * (b.durationMin / totalSegMin)) : Math.max(0, input.choIngestedGH);
        const blockLm = computeLactateEngine({
          durationMin: b.durationMin,
          powerW: b.powerW,
          ftpW: ftp,
          efficiency,
          vo2LMin,
          rer,
          smo2Rest,
          smo2Work,
          lactateOxidationPct: oxidationPct,
          coriPct,
          choIngestedGH: choSlice,
          gutAbsorptionPct,
          microbiotaSequestrationPct,
          gutTrainingPct,
          coreTempC,
          candidaOvergrowthPct: candidaOvergrowthPct != null && candidaOvergrowthPct > 0 ? candidaOvergrowthPct : undefined,
          bifidobacteriaPct: bifidobacteriaPct != null && bifidobacteriaPct > 0 ? bifidobacteriaPct : undefined,
          akkermansiaPct: akkermansiaPct != null && akkermansiaPct > 0 ? akkermansiaPct : undefined,
          butyrateProducersPct: butyrateProducersPct != null && butyrateProducersPct > 0 ? butyrateProducersPct : undefined,
          endotoxinRiskPct: endotoxinRiskPct != null && endotoxinRiskPct > 0 ? endotoxinRiskPct : undefined,
          cpW,
          wPrimeJ,
          glycolyticIndexProxy,
        });
        parts.push({ out: blockLm, durationMin: b.durationMin });
      }
      lm = mergeLactateEngineOutputs(parts);
    } else {
      const intensityPct = estimateIntensityPctFtpFromTssDuration(m.tss, durationMin);
      const powerW = ftp * (intensityPct / 100);
      const rer = estimateRerFromIntensity(intensityPct);
      const vo2LMin = estimateVo2LMinFromPower(powerW, ftp, efficiency, rer);
      lm = computeLactateEngine({
        durationMin,
        powerW,
        ftpW: ftp,
        efficiency,
        vo2LMin,
        rer,
        smo2Rest,
        smo2Work,
        lactateOxidationPct: oxidationPct,
        coriPct,
        choIngestedGH: Math.max(0, input.choIngestedGH),
        gutAbsorptionPct,
        microbiotaSequestrationPct,
        gutTrainingPct,
        coreTempC,
        candidaOvergrowthPct: candidaOvergrowthPct != null && candidaOvergrowthPct > 0 ? candidaOvergrowthPct : undefined,
        bifidobacteriaPct: bifidobacteriaPct != null && bifidobacteriaPct > 0 ? bifidobacteriaPct : undefined,
        akkermansiaPct: akkermansiaPct != null && akkermansiaPct > 0 ? akkermansiaPct : undefined,
        butyrateProducersPct: butyrateProducersPct != null && butyrateProducersPct > 0 ? butyrateProducersPct : undefined,
        endotoxinRiskPct: endotoxinRiskPct != null && endotoxinRiskPct > 0 ? endotoxinRiskPct : undefined,
        cpW,
        wPrimeJ,
        glycolyticIndexProxy,
      });
    }

    const copy = buildFuelingCopyFromLactateModel(lm);
    if (segmentPowerBlocks.length > 0) {
      copy.physiologicalIntent.unshift(
        `Strategia substrati: somma motore lattato su ${segmentPowerBlocks.length} segmenti Builder (zone), non solo media da TSS.`,
      );
    }
    const dayChoEnergyWeight = Math.max(0, lm.choKcal);

    out.push({
      id: row.id,
      title: row.title,
      durationMin,
      tss: m.tss,
      kcal: m.kcal,
      dayChoEnergyWeight,
      lactateModel: lm,
      substrate: {
        estimatedIntensityPctFtp: lm.intensityPctFtp,
        lactateProducedG: lm.lactateProducedG,
        glucoseFromCoriG: lm.glucoseFromCoriG,
        glucoseNetFromCoriG: lm.glucoseNetFromCoriG,
        exogenousOxidizedG: lm.exogenousOxidizedG,
        choAvailableG: lm.choAvailableG,
        glycolyticSharePct: lm.glycolyticSharePct,
        gutPathwayRisk: lm.gutPathwayRisk,
        bloodDeliveryPctOfIngested: lm.bloodDeliveryPctOfIngested,
        glycogenCombustedNetG: lm.glycogenCombustedNetG,
        glucoseRequiredForStrategyG: lm.glucoseRequiredForStrategyG,
      },
      physiologicalIntent: copy.physiologicalIntent,
      nutritionSupports: copy.nutritionSupports,
      inhibitorsAndRisks: copy.inhibitorsAndRisks,
    });
  }

  return out;
}
