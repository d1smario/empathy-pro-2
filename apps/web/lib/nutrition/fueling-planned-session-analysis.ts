import type { PhysiologyState } from "@/lib/empathy/schemas/physiology";
import { computeLactateEngine, type LactateEngineOutput } from "@/lib/engines/lactate-engine";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { effectivePlannedWorkoutNutritionMetrics } from "@/lib/training/builder/pro2-session-notes";

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
 * Per ogni sessione pianificata: motore lattato/gut deterministico (stessa pipeline fisiologia)
 * con potenza da TSS+durata e CHO intra dalla tariffa fueling del giorno.
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
    const intensityPct = estimateIntensityPctFtpFromTssDuration(m.tss, durationMin);
    const powerW = ftp * (intensityPct / 100);
    const rer = estimateRerFromIntensity(intensityPct);
    const vo2LMin = estimateVo2LMinFromPower(powerW, ftp, efficiency, rer);

    const lm = computeLactateEngine({
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

    const copy = buildFuelingCopyFromLactateModel(lm);
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
        estimatedIntensityPctFtp: intensityPct,
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
