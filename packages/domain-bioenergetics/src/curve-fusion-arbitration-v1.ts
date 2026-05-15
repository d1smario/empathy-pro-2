/**
 * Arbitraggio deterministico: pesi motore sim vs proposta AI (futura) + vincolo misura densa.
 *
 * **Strategia prodotto (fase corrente):** su curve simulate, l’AI supervisionata ha **quota iniziale
 * maggiore**; all’aumentare della ricchezza di contesto Empathy (pasto/seduta/lab/device) i pesi
 * **tendono al pareggio** (~50/50). Stream CGM / misura densa → **vince sempre la misura**.
 * Nessuna chiamata LLM in questo file: solo policy versionata per UI e merge futuro.
 */

import type {
  BioenergeticChannelCurveResolutionV1,
  BioenergeticCurveChannelIdV1,
  BioenergeticCurveGovernanceHintV1,
} from "@empathy/contracts";
import { BIOENERGETIC_CURVE_FUSION_CONTRACT_VERSION } from "@empathy/contracts";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Timeline generica (web o sim): basta `type` e `payload` opzionale. */
export type ArbitrationTimelineEventV1 = {
  type: string;
  payload?: Record<string, unknown>;
};

/**
 * Ricchezza contesto interno Empathy (0–1) da pasti macro, sedute, lab, export device.
 * Euristica v1: monotona, deterministica, auditabile.
 */
export function countTimelineMealsWithMacroSignalsV1(timeline: readonly ArbitrationTimelineEventV1[]): number {
  let n = 0;
  for (const ev of timeline) {
    if (ev.type !== "meal") continue;
    const c = ev.payload?.carbsG;
    const kcal = ev.payload?.kcal;
    const carbs = typeof c === "number" && Number.isFinite(c) ? c : 0;
    const kc = typeof kcal === "number" && Number.isFinite(kcal) ? kcal : 0;
    if (carbs > 3 || kc > 80) n += 1;
  }
  return n;
}

export function computeInternalContextRichness01(
  timeline: readonly ArbitrationTimelineEventV1[],
  biomarkerPanelCount: number,
): number {
  let mealMacros = 0;
  let mealsAny = 0;
  let sessions = 0;
  let deviceExports = 0;
  for (const ev of timeline) {
    if (ev.type === "meal") {
      mealsAny += 1;
      const c = ev.payload?.carbsG;
      const k = ev.payload?.kcal;
      const carbs = typeof c === "number" && Number.isFinite(c) ? c : 0;
      const kcal = typeof k === "number" && Number.isFinite(k) ? k : 0;
      if (carbs > 3 || kcal > 80) mealMacros += 1;
    } else if (ev.type === "planned_session" || ev.type === "executed_session") {
      sessions += 1;
    } else if (ev.type === "device_export") {
      deviceExports += 1;
    }
  }
  const labs = Math.max(0, biomarkerPanelCount);
  const r =
    0.12 +
    Math.min(0.34, mealMacros * 0.09) +
    Math.min(0.12, Math.max(0, mealsAny - mealMacros) * 0.04) +
    Math.min(0.28, sessions * 0.11) +
    Math.min(0.18, labs * 0.06) +
    Math.min(0.16, deviceExports * 0.035);
  return round3(clamp(r, 0, 1));
}

/**
 * Peso motore deterministico (0–1) da ricchezza contesto r∈[0,1]:
 * r=0 → ~12% motore (~88% slot AI); r=1 → ~50% motore (pareggio operativo).
 */
export function simBlendDeterministicWeightFromRichness01(r: number): number {
  const x = clamp(r, 0, 1);
  return round3(clamp(0.12 + 0.38 * x, 0.1, 0.52));
}

function governanceForSimBlendWeight(d: number): BioenergeticCurveGovernanceHintV1 {
  if (d < 0.405) return "ai_proposal_wins_when_available";
  if (d >= 0.43) return "deterministic_engine_wins";
  return "ai_proposal_wins_when_available";
}

function baseResolution(
  channelId: BioenergeticCurveChannelIdV1,
  governance: BioenergeticCurveGovernanceHintV1,
  deterministicWeight01: number,
  internalContextRichness01: number,
  rationaleIt: string[],
): BioenergeticChannelCurveResolutionV1 {
  const d = round3(clamp(deterministicWeight01, 0, 1));
  const ai = round3(clamp(1 - d, 0, 1));
  return {
    fusionContractVersion: BIOENERGETIC_CURVE_FUSION_CONTRACT_VERSION,
    channelId,
    governance,
    deterministicWeight01: d,
    aiProposalWeight01: ai,
    internalContextRichness01: round3(clamp(internalContextRichness01, 0, 1)),
    rationaleIt,
  };
}

/** Stream CGM (o simile): molti punti misurati → misura vince. */
export function arbitrateGlucoseCurveFusionV1(input: {
  hasDenseMeasuredStream: boolean;
  hasSparseLabPoint: boolean;
  internalContextRichness01: number;
}): BioenergeticChannelCurveResolutionV1 {
  if (input.hasDenseMeasuredStream) {
    return baseResolution(
      "glucose",
      "measurement_wins",
      0.98,
      input.internalContextRichness01,
      [
        "Stream misurato denso (es. CGM): priorità al dato Empathy, non al simulatore né a proposte AI.",
        "Fusione: slot AI disatteso salvo validazione esplicita su referto parallelo.",
      ],
    );
  }
  if (input.hasSparseLabPoint) {
    const r = input.internalContextRichness01;
    const d = round3(clamp(0.26 + 0.34 * r, 0.22, 0.58));
    const gov = governanceForSimBlendWeight(d);
    return baseResolution(
      "glucose",
      gov,
      d,
      r,
      [
        "Hold lab + sim: ancora simulatore; in fase iniziale resta quota AI significativa, che cala con contesto Empathy più ricco.",
        "Con stream CGM denso la policy passa automaticamente a misura Empathy.",
      ],
    );
  }
  const r = input.internalContextRichness01;
  const d = simBlendDeterministicWeightFromRichness01(r);
  const gov = governanceForSimBlendWeight(d);
  return baseResolution(
    "glucose",
    gov,
    d,
    r,
    [
      "Simulatore glucosio v1: fase prodotto — quota maggiore al canale AI supervisionato; con diario/sedute/lab/device più ricchi i pesi tendono al pareggio col motore.",
      "Il merge numerico AI avviene solo con payload validato; finché manca, la curva mostrata resta la sim con questa policy esplicita.",
    ],
  );
}

export function arbitrateLactateCurveFusionV1(input: {
  hasDenseMeasuredStream: boolean;
  hasSparseLabPoint: boolean;
  internalContextRichness01: number;
}): BioenergeticChannelCurveResolutionV1 {
  if (input.hasDenseMeasuredStream) {
    return baseResolution(
      "lactate",
      "measurement_wins",
      0.97,
      input.internalContextRichness01,
      ["Stream lattato misurato: priorità al dato Empathy."],
    );
  }
  if (input.hasSparseLabPoint) {
    const r = input.internalContextRichness01;
    const d = round3(clamp(0.24 + 0.34 * r, 0.2, 0.56));
    const gov = governanceForSimBlendWeight(d);
    return baseResolution(
      "lactate",
      gov,
      d,
      r,
      [
        "Hold lab + sim lattato: stessa logica fase iniziale — AI con quota maggiore che converge al pareggio con arricchimento contesto.",
      ],
    );
  }
  const r = input.internalContextRichness01;
  const d = simBlendDeterministicWeightFromRichness01(r);
  const gov = governanceForSimBlendWeight(d);
  return baseResolution(
    "lactate",
    gov,
    d,
    r,
    [
      "Simulatore lattato v1: fase prodotto — priorità iniziale alla curva AI supervisionata; con più segnali Empathy i pesi tendono al pareggio col motore.",
    ],
  );
}

export function arbitrateInsulinProxyCurveFusionV1(mealMacrosCount: number): BioenergeticChannelCurveResolutionV1 {
  const mealR = round3(clamp(mealMacrosCount / 5.5, 0, 1));
  const d = simBlendDeterministicWeightFromRichness01(mealR);
  const gov = governanceForSimBlendWeight(d);
  return baseResolution(
    "insulin_proxy",
    gov,
    d,
    mealR,
    [
      "Proxy insulina v1 (sim): fase iniziale con peso maggiore al canale AI; più pasti con macro → tendenza al pareggio col kernel+timeline.",
      "Non è insulina ematica; merge AI solo con schema validato.",
    ],
  );
}

function nominalHormoneCurveRationaleIt(
  channelId: "cortisol" | "acth" | "tsh" | "ft4" | "gh" | "ghrelin" | "igf1" | "leptin",
): string[] {
  if (channelId === "cortisol" || channelId === "acth") {
    return [
      "Diurna ormonale v1 (sim educativa, forme separate ACTH vs cortisolo): non è campionamento seriato; in fase prodotto prevale la quota AI, che si pareggia al crescere del contesto Empathy.",
      "Con valore lab misurato (hold) la policy passa a misura Empathy.",
    ];
  }
  if (channelId === "tsh" || channelId === "ft4") {
    return [
      "Asse tiroideo nominale TSH/FT4 (v1 educativa): modulazione diurna leggera, non profilo da campionamento seriato; stessa governance di fusione degli altri ormoni nominali.",
      "Con valore lab misurato (hold) la policy passa a misura Empathy.",
    ];
  }
  if (channelId === "gh" || channelId === "ghrelin") {
    return [
      "GH/ghrelina nominali v1: timeline pasti/sedute pesa ghrelina e burst GH educativi; non profilo pulsatile da campionamento seriato. Coerente con skeleton endocrino-metabolico quando presente.",
      "Con valore lab misurato (hold) la policy passa a misura Empathy.",
    ];
  }
  return [
    "IGF-1 / leptina nominali v1: IGF-1 con oscillazione educativa molto attenuata; leptina modulata da carico prandiale in timeline (non leptina seriata). Governance fusione allineata agli altri canali ormonali nominali.",
    "Con valore lab misurato (hold) la policy passa a misura Empathy.",
  ];
}

/** Diurna nominale (ormoni vari): come gli altri sim, AI inizialmente in vantaggio → pareggio con ricchezza contesto. */
export function arbitrateNominalHormoneCurveFusionV1(
  channelId: "cortisol" | "acth" | "tsh" | "ft4" | "gh" | "ghrelin" | "igf1" | "leptin",
  internalContextRichness01: number,
): BioenergeticChannelCurveResolutionV1 {
  const r = round3(clamp(internalContextRichness01, 0, 1));
  const d = simBlendDeterministicWeightFromRichness01(r);
  const gov = governanceForSimBlendWeight(d);
  return baseResolution(channelId, gov, d, r, nominalHormoneCurveRationaleIt(channelId));
}

export function arbitrateLabHoldHormoneCurveFusionV1(
  channelId: "cortisol" | "acth" | "tsh" | "ft4" | "gh" | "ghrelin" | "igf1" | "leptin",
): BioenergeticChannelCurveResolutionV1 {
  return baseResolution(
    channelId,
    "measurement_wins",
    0.94,
    0.35,
    ["Valore lab singolo replicato (hold): priorità al referto rispetto a diurna nominale."],
  );
}
