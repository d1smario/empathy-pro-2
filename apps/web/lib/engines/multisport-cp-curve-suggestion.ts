/**
 * Suggerimento curva “tipo-CP” **multisport** → stessi 8 punti del Metabolic Lab (`5s` … `20m`)
 * come **W equivalenti ciclismo** per unificare la UI Physiology.
 *
 * - **Deterministico**: VO₂ da `estimateVo2FromDevice` (stesso stack del lab) dove serve velocità/pendenza.
 * - **Manuale**: nessun salvataggio qui; l’atleta/coach copia i numeri nel modulo come oggi per la curva CP.
 */

import { estimateVo2FromDevice, type SupportedSport } from "@/lib/engines/vo2-estimator";
import type { MultisportEngineSport } from "@/lib/engines/multisport-energy-engine";

export const MULTISPORT_CP_CURVE_LABELS = ["5s", "15s", "30s", "60s", "3m", "5m", "12m", "20m"] as const;
export type MultisportCpCurveLabel = (typeof MULTISPORT_CP_CURVE_LABELS)[number];

const LABEL_TO_SEC: Record<MultisportCpCurveLabel, number> = {
  "5s": 5,
  "15s": 15,
  "30s": 30,
  "60s": 60,
  "3m": 180,
  "5m": 300,
  "12m": 720,
  "20m": 1200,
};

/** Distanze “proxy” (m) associate a ogni punto durata — solo per costruire una curva coerente da gare / test. */
const LABEL_TO_DISTANCE_M: Record<MultisportCpCurveLabel, number> = {
  "5s": 60,
  "15s": 160,
  "30s": 300,
  "60s": 550,
  "3m": 1200,
  "5m": 2000,
  "12m": 4500,
  "20m": 8000,
};

const RER = 0.93;
const KCAL_PER_LO2 = 3.815 + 1.232 * RER;

export type MultisportCpCurveSuggestionMode =
  | "cycling_power_anchors"
  | "running_race_riegel"
  | "swimming_pace_riegel"
  | "velocity_sport_riegel"
  | "reference_w_phenotype";

export type MultisportCpCurveSuggestionInput = {
  sport: MultisportEngineSport;
  bodyMassKg: number;
  mode: MultisportCpCurveSuggestionMode;
  efficiency?: number | null;
  gradeFraction?: number | null;
  /** Mode cycling: almeno 2 coppie (durata s, W). */
  powerAnchors?: Array<{ durationSec: number; powerW: number }> | null;
  /** Mode running/swimming/ski: almeno 1 gara/test distanza (m) + tempo (s). */
  raceAnchors?: Array<{ distanceM: number; timeSec: number }> | null;
  /** Mode reference_w_phenotype: un solo “FTP multisport” (W equivalenti) + forma. */
  referenceWatts?: number | null;
  phenotype?: "oxidative" | "balanced" | "glycolytic" | null;
};

export type MultisportCpCurveSuggestionOutput = {
  modelVersion: "empathy-multisport-cp-suggestion-v0.1";
  cpCurveInputsW: Partial<Record<MultisportCpCurveLabel, number>>;
  vo2MlKgMinByLabel: Partial<Record<MultisportCpCurveLabel, number>>;
  notes: string[];
  /** Istruzione esplicita per flusso manuale nel lab Pro 2. */
  handoffHintIt: string;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, digits = 0) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

function mechanicalWFromVo2LMin(vo2LMin: number, efficiency: number): number {
  const eta = clamp(efficiency, 0.18, 0.32);
  return (Math.max(0, vo2LMin) * KCAL_PER_LO2 * 4186 * eta) / 60;
}

function toEstimatorSport(sport: MultisportEngineSport): SupportedSport {
  if (sport === "cycling") return "cycling";
  if (sport === "swimming") return "swimming";
  if (sport === "xc_ski" || sport === "ski_alpine") return "xc_ski";
  return "running";
}

function riegelTime(tRef: number, dRef: number, dTarget: number, exponent = 1.06): number {
  const safeRef = Math.max(1, dRef);
  const safeT = Math.max(1, tRef);
  return safeT * (Math.max(1, dTarget) / safeRef) ** exponent;
}

function pickReferenceRace(anchors: Array<{ distanceM: number; timeSec: number }>): { distanceM: number; timeSec: number } {
  const sorted = [...anchors].sort((a, b) => a.distanceM - b.distanceM);
  return sorted[Math.floor(sorted.length / 2)] ?? sorted[0]!;
}

function interpolateLogPower(durationSec: number, anchors: Array<{ durationSec: number; powerW: number }>): number {
  const a = [...anchors].filter((x) => x.durationSec > 0 && x.powerW > 0).sort((x, y) => x.durationSec - y.durationSec);
  if (!a.length) return 0;
  if (durationSec <= a[0].durationSec) {
    const r = durationSec / a[0].durationSec;
    return a[0].powerW * (r > 0 ? r ** -0.12 : 1);
  }
  if (durationSec >= a[a.length - 1]!.durationSec) {
    return a[a.length - 1]!.powerW;
  }
  for (let i = 0; i < a.length - 1; i += 1) {
    const p0 = a[i]!;
    const p1 = a[i + 1]!;
    if (durationSec >= p0.durationSec && durationSec <= p1.durationSec) {
      const u =
        (Math.log(durationSec) - Math.log(p0.durationSec)) / (Math.log(p1.durationSec) - Math.log(p0.durationSec));
      return p0.powerW + u * (p1.powerW - p0.powerW);
    }
  }
  return a[0]!.powerW;
}

function templateRatios(phenotype: "oxidative" | "balanced" | "glycolytic"): Record<MultisportCpCurveLabel, number> {
  if (phenotype === "glycolytic") {
    return { "5s": 2.85, "15s": 2.35, "30s": 2.0, "60s": 1.68, "3m": 1.22, "5m": 1.1, "12m": 1.02, "20m": 0.98 };
  }
  if (phenotype === "oxidative") {
    return { "5s": 2.15, "15s": 1.88, "30s": 1.65, "60s": 1.42, "3m": 1.12, "5m": 1.05, "12m": 1.0, "20m": 0.97 };
  }
  return { "5s": 2.45, "15s": 2.1, "30s": 1.82, "60s": 1.55, "3m": 1.16, "5m": 1.07, "12m": 1.0, "20m": 0.975 };
}

/**
 * Costruisce suggerimento curva CP (W) + VO₂ (ml/kg/min) per label — **non** persiste in DB.
 */
export function computeMultisportCpCurveSuggestion(input: MultisportCpCurveSuggestionInput): MultisportCpCurveSuggestionOutput {
  const mass = clamp(input.bodyMassKg, 35, 120);
  const eta = input.efficiency ?? 0.24;
  const grade = clamp(input.gradeFraction ?? 0, -0.12, 0.22);
  const notes: string[] = [];
  const cpCurveInputsW: Partial<Record<MultisportCpCurveLabel, number>> = {};
  const vo2MlKgMinByLabel: Partial<Record<MultisportCpCurveLabel, number>> = {};

  const handoffHintIt =
    "Copia manualmente i valori W nella scheda Metabolic profile (curva CP) e verifica il VO₂; poi Salva snapshot come oggi. I numeri sono W equivalenti ciclismo + VO₂ deterministico da velocità/pendenza.";

  const fillFromVelocity = (label: MultisportCpCurveLabel, velocityMps: number, estSport: SupportedSport) => {
    const vMin = Math.max(0, velocityMps) * 60;
    const vo2 = estimateVo2FromDevice({
      sport: estSport,
      bodyMassKg: mass,
      rer: RER,
      efficiency: eta,
      velocityMMin: vMin,
      gradeFraction: grade,
    });
    const w = mechanicalWFromVo2LMin(vo2.vo2LMin, eta);
    cpCurveInputsW[label] = round(clamp(w, 40, 1200));
    vo2MlKgMinByLabel[label] = vo2.vo2MlKgMin;
  };

  if (input.mode === "cycling_power_anchors") {
    const anchors = input.powerAnchors ?? [];
    if (anchors.length < 2) {
      notes.push("cycling_power_anchors richiede almeno 2 coppie durata/W.");
      return { modelVersion: "empathy-multisport-cp-suggestion-v0.1", cpCurveInputsW, vo2MlKgMinByLabel, notes, handoffHintIt };
    }
    notes.push("Curva da anchor misurati: interpolazione log-log tra punti noti.");
    for (const label of MULTISPORT_CP_CURVE_LABELS) {
      const sec = LABEL_TO_SEC[label];
      const p = interpolateLogPower(sec, anchors);
      if (p > 0) {
        cpCurveInputsW[label] = round(p);
        const vo2 = estimateVo2FromDevice({
          sport: "cycling",
          bodyMassKg: mass,
          rer: RER,
          efficiency: eta,
          powerW: p,
        });
        vo2MlKgMinByLabel[label] = vo2.vo2MlKgMin;
      }
    }
    return { modelVersion: "empathy-multisport-cp-suggestion-v0.1", cpCurveInputsW, vo2MlKgMinByLabel, notes, handoffHintIt };
  }

  if (input.mode === "reference_w_phenotype") {
    const ref = input.referenceWatts;
    if (ref == null || ref < 80 || !Number.isFinite(ref)) {
      notes.push("reference_w_phenotype richiede referenceWatts ≥ 80 (W equivalenti).");
      return { modelVersion: "empathy-multisport-cp-suggestion-v0.1", cpCurveInputsW, vo2MlKgMinByLabel, notes, handoffHintIt };
    }
    const phen = input.phenotype ?? "balanced";
    const ratios = templateRatios(phen);
    notes.push(`Template fenotipo "${phen}" su reference ${Math.round(ref)} W — solo orientamento, da validare al lab.`);
    for (const label of MULTISPORT_CP_CURVE_LABELS) {
      const p = ref * ratios[label];
      cpCurveInputsW[label] = round(p);
      const vo2 = estimateVo2FromDevice({
        sport: "cycling",
        bodyMassKg: mass,
        rer: RER,
        efficiency: eta,
        powerW: p,
      });
      vo2MlKgMinByLabel[label] = vo2.vo2MlKgMin;
    }
    return { modelVersion: "empathy-multisport-cp-suggestion-v0.1", cpCurveInputsW, vo2MlKgMinByLabel, notes, handoffHintIt };
  }

  const raceAnchors = input.raceAnchors ?? [];
  if (
    (input.mode === "running_race_riegel" ||
      input.mode === "swimming_pace_riegel" ||
      input.mode === "velocity_sport_riegel") &&
    raceAnchors.length >= 1
  ) {
    const ref = pickReferenceRace(raceAnchors);
    const est: SupportedSport =
      input.mode === "swimming_pace_riegel" ? "swimming" : toEstimatorSport(input.sport);
    notes.push(
      `Riegel su gara di riferimento ${ref.distanceM} m in ${ref.timeSec} s → velocità proxy per ogni punto curva (${input.mode}).`,
    );
    for (const label of MULTISPORT_CP_CURVE_LABELS) {
      const d = LABEL_TO_DISTANCE_M[label];
      const t = riegelTime(ref.timeSec, ref.distanceM, d);
      const v = d / Math.max(0.5, t);
      fillFromVelocity(label, v, est);
    }
    return { modelVersion: "empathy-multisport-cp-suggestion-v0.1", cpCurveInputsW, vo2MlKgMinByLabel, notes, handoffHintIt };
  }

  notes.push("Input insufficiente: scegli mode + anchor (cycling) o gare (running/swimming/ski) o referenceW+phenotype.");
  return { modelVersion: "empathy-multisport-cp-suggestion-v0.1", cpCurveInputsW, vo2MlKgMinByLabel, notes, handoffHintIt };
}
