/**
 * Fueling V2 — intra da consumo CHO in seduta (substrati), non da % kcal training.
 * Z1/Z2: CHO minoritario → integrazione orale più bassa; alta intensità: CHO dominante → integrazione alta.
 */

import { substrateTotalsForSession } from "@/lib/nutrition/v2/substrate-rates";

export type SubstrateFuelingSession = {
  sessionLabel: string;
  avgPowerW: number;
  durationH: number;
  choBurnedG: number;
  fatBurnedG: number;
  proBurnedG: number;
  /** Quota energetica della seduta coperta da CHO (0–1). */
  choEnergyShare: number;
  /** Frazione del CHO bruciato da sostituire oralmente in intra. */
  intraChoReplaceFraction: number;
  preChoG: number;
  intraChoG: number;
  postChoG: number;
  preKcal: number;
  intraKcal: number;
  postKcal: number;
  evidenceMaxChoGPerH: number;
  intraChoGPerH: number;
};

export type SubstrateFuelingPlan = {
  algorithmVersion: "substrate_fueling_v1";
  sessions: SubstrateFuelingSession[];
  totals: {
    preChoG: number;
    intraChoG: number;
    postChoG: number;
    fuelingKcal: number;
    oralTrainingKcal: number;
    /** kcal training non coperte oralmente (ossidazione lipidica endogena). */
    endogenousFatKcal: number;
  };
  provenance: string[];
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round(n: number, d = 1): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** Quota del CHO bruciato da reintegrare durante l'esercizio (non % kcal totali seduta). */
export function intraChoReplaceFractionFromEnergyShare(choEnergyShare: number): number {
  const s = clamp(choEnergyShare, 0, 1);
  if (s >= 0.88) return 0.85;
  if (s >= 0.78) return 0.75;
  if (s >= 0.65) return 0.65;
  if (s >= 0.52) return 0.55;
  return 0.45;
}

function evidenceMaxChoGPerHour(durationMin: number, choEnergyShare: number): number {
  const h = durationMin / 60;
  if (h < 0.75) return 30;
  if (h < 2) return choEnergyShare >= 0.85 ? 90 : 60;
  if (h < 3) return choEnergyShare >= 0.85 ? 110 : 75;
  return choEnergyShare >= 0.85 ? 120 : 90;
}

export function computeSubstrateFuelingPlan(input: {
  sessions: Array<{ label: string; avgPowerW: number; durationMin: number }>;
  ftpW?: number;
  weightKg?: number;
}): SubstrateFuelingPlan {
  const ftp = Math.max(120, input.ftpW ?? 250);
  const weightKg = Math.max(45, input.weightKg ?? 70);
  const sessions: SubstrateFuelingSession[] = [];
  const provenance: string[] = [
    "Fueling intra: frazione del CHO bruciato in seduta (substrati), non % kcal training.",
    "Alta intensità (CHO ≈ energia) → replace fino ~85%; Z1/Z2 (CHO 50–65%) → replace ~45–55%.",
    "Cap intra g/h da durata + intensità (evidence band). Pre/post = CHO mirato, non split % kcal training.",
  ];

  for (const s of input.sessions) {
    const totals = substrateTotalsForSession(s.avgPowerW, s.durationMin, { ftpW: ftp });
    const choKcal = totals.choG * 4;
    const fatKcal = totals.fatG * 9;
    const proKcal = totals.proG * 4;
    const substrateKcal = choKcal + fatKcal + proKcal;
    const choEnergyShare = substrateKcal > 0 ? choKcal / substrateKcal : 0.5;
    const replaceFrac = intraChoReplaceFractionFromEnergyShare(choEnergyShare);
    const maxPerH = evidenceMaxChoGPerHour(s.durationMin, choEnergyShare);
    let intraChoG = round(totals.choG * replaceFrac);
    const intraCap = round(maxPerH * totals.durationH);
    if (intraChoG > intraCap) {
      intraChoG = intraCap;
      provenance.push(
        `Sessione ${s.label.slice(0, 40)}: intra CHO capped a ${maxPerH} g/h × ${totals.durationH} h.`,
      );
    }

    const preChoG =
      s.durationMin >= 45 ? round(clamp(weightKg * 0.35, 20, 70)) : round(clamp(weightKg * 0.2, 10, 40));
    const postChoG = round(totals.choG * clamp(0.22 + choEnergyShare * 0.12, 0.2, 0.38));

    const preKcal = round(preChoG * 4, 0);
    const intraKcal = round(intraChoG * 4, 0);
    const postKcal = round(postChoG * 4, 0);

    sessions.push({
      sessionLabel: s.label,
      avgPowerW: s.avgPowerW,
      durationH: totals.durationH,
      choBurnedG: totals.choG,
      fatBurnedG: totals.fatG,
      proBurnedG: totals.proG,
      choEnergyShare: round(choEnergyShare, 2),
      intraChoReplaceFraction: replaceFrac,
      preChoG,
      intraChoG,
      postChoG,
      preKcal,
      intraKcal,
      postKcal,
      evidenceMaxChoGPerH: maxPerH,
      intraChoGPerH: totals.durationH > 0 ? round(intraChoG / totals.durationH) : 0,
    });
  }

  const preChoG = round(sessions.reduce((sum, x) => sum + x.preChoG, 0));
  const intraChoG = round(sessions.reduce((sum, x) => sum + x.intraChoG, 0));
  const postChoG = round(sessions.reduce((sum, x) => sum + x.postChoG, 0));
  const fuelingKcal = Math.round(preChoG * 4 + intraChoG * 4 + postChoG * 4);
  const fatKcalTotal = sessions.reduce((sum, x) => sum + x.fatBurnedG * 9, 0);
  const proKcalTotal = sessions.reduce((sum, x) => sum + x.proBurnedG * 4, 0);
  const choNotOral = sessions.reduce(
    (sum, x) => sum + (x.choBurnedG - x.intraChoG) * 4,
    0,
  );

  return {
    algorithmVersion: "substrate_fueling_v1",
    sessions,
    totals: {
      preChoG,
      intraChoG,
      postChoG,
      fuelingKcal,
      oralTrainingKcal: fuelingKcal,
      endogenousFatKcal: Math.round(fatKcalTotal + proKcalTotal + choNotOral),
    },
    provenance,
  };
}
