/**
 * EPI — Empathy Physiological Index engine (DETERMINISTIC, pure).
 *
 * No I/O, no Date.now, no AI: same inputs -> same output (certification requirement).
 * Composes 8 pillars (0–100) from canonical twin/internal-load/nutrition signals + the daily
 * subjective check-in, with an illness guard. See docs/LONGEVITY_FITNESS_INDEX_AND_COIN.md.
 *
 * This lives in apps/web/lib (colocated node:test) rather than a new workspace package to avoid
 * install/wiring churn, consistent with other deterministic engines under apps/web/lib.
 */

import {
  COIN_PER_EFFICIENT_DAY,
  EPI_ALGORITHM_VERSION,
  EPI_EFFICIENT_DAY_MIN_SCORE,
  EPI_PILLAR_IDS,
  EPI_PILLAR_WEIGHTS,
  type EpiDataTier,
  type EpiInputs,
  type EpiPillarId,
  type EpiPillarScore,
  type EpiResult,
} from "@/lib/empathy/schemas";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Average of present (non-null) sub-signals; null if none present. */
function avgPresent(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => isNum(v));
  if (!present.length) return null;
  return present.reduce((s, v) => s + v, 0) / present.length;
}

/** Positive 1–5 scale → 0–100 (5 best). */
function posScale(v: number | null | undefined): number | null {
  if (!isNum(v)) return null;
  return clamp(((v - 1) / 4) * 100, 0, 100);
}

/** Negative 1–5 scale → 0–100 (1 best, e.g. soreness/stress). */
function negScale(v: number | null | undefined): number | null {
  if (!isNum(v)) return null;
  return clamp(((5 - v) / 4) * 100, 0, 100);
}

type PillarComputation = { score: number | null; confidence: number };

function scoreActivityLoad(input: EpiInputs): PillarComputation {
  const subs: Array<number | null> = [];
  if (isNum(input.executionCompliancePct)) {
    const c = input.executionCompliancePct;
    // Reward compliance near 100; gently penalize large overreach (>115%).
    subs.push(c > 115 ? clamp(100 - (c - 115) * 0.6, 0, 100) : clamp(c, 0, 100));
  } else subs.push(null);
  if (isNum(input.fitnessChronic)) subs.push(clamp(input.fitnessChronic, 0, 100));
  else subs.push(null);
  if (isNum(input.activityStreakDays)) subs.push(clamp(input.activityStreakDays * 8, 0, 100));
  else subs.push(null);
  const score = avgPresent(subs);
  const present = subs.filter((v) => v != null).length;
  return { score, confidence: present === 0 ? 0 : clamp(0.4 + present * 0.2, 0, 1) };
}

function scoreRecovery(input: EpiInputs): PillarComputation {
  const subs = [input.readiness ?? null, input.recoveryCapacity ?? null, input.autonomicScore ?? null].map((v) =>
    isNum(v) ? clamp(v, 0, 100) : null,
  );
  const score = avgPresent(subs);
  const present = subs.filter((v) => v != null).length;
  return { score, confidence: present === 0 ? 0 : clamp(0.45 + present * 0.18, 0, 1) };
}

function scoreHrv(input: EpiInputs): PillarComputation {
  if (isNum(input.hrvMs) && isNum(input.hrvBaselineMs) && input.hrvBaselineMs > 0) {
    const ratio = input.hrvMs / input.hrvBaselineMs;
    // ratio 1 -> 50, 1.25 -> 100, 0.75 -> 0.
    return { score: clamp(50 + (ratio - 1) * 200, 0, 100), confidence: 0.85 };
  }
  if (isNum(input.autonomicScore)) {
    // Proxy via autonomic channel when no HRV baseline.
    return { score: clamp(input.autonomicScore, 0, 100), confidence: 0.5 };
  }
  return { score: null, confidence: 0 };
}

function scoreSleep(input: EpiInputs): PillarComputation {
  const subs = [input.sleepCircadianScore ?? null, input.sleepRecovery ?? null].map((v) =>
    isNum(v) ? clamp(v, 0, 100) : null,
  );
  const score = avgPresent(subs);
  const present = subs.filter((v) => v != null).length;
  return { score, confidence: present === 0 ? 0 : clamp(0.5 + present * 0.2, 0, 1) };
}

function scoreNutrition(input: EpiInputs): PillarComputation {
  const subs: Array<number | null> = [];
  if (isNum(input.energyAdequacyRatio)) {
    // 1.0 -> 100, deviation of 0.5 in either direction -> 0.
    subs.push(clamp(100 - Math.abs(input.energyAdequacyRatio - 1) * 200, 0, 100));
  } else subs.push(null);
  if (isNum(input.proteinGPerKg)) {
    // 1.6 g/kg target -> 100.
    subs.push(clamp((input.proteinGPerKg / 1.6) * 100, 0, 100));
  } else subs.push(null);
  const score = avgPresent(subs);
  const present = subs.filter((v) => v != null).length;
  return { score, confidence: present === 0 ? 0 : clamp(0.45 + present * 0.22, 0, 1) };
}

function scoreBodyFat(bodyFatPct: number, sex: EpiInputs["sex"]): number {
  // Peak score inside a healthy athletic range; fall off outside.
  const lo = sex === "female" ? 18 : 8;
  const hi = sex === "female" ? 28 : 20;
  if (bodyFatPct >= lo && bodyFatPct <= hi) return 100;
  const dist = bodyFatPct < lo ? lo - bodyFatPct : bodyFatPct - hi;
  return clamp(100 - dist * 6, 0, 100);
}

function scoreBodyComposition(input: EpiInputs): PillarComputation {
  const subs: Array<number | null> = [];
  if (isNum(input.bodyFatPct)) subs.push(scoreBodyFat(input.bodyFatPct, input.sex ?? null));
  else subs.push(null);
  if (isNum(input.phaseAngleScore)) subs.push(clamp(input.phaseAngleScore, 0, 100));
  else subs.push(null);
  const score = avgPresent(subs);
  const present = subs.filter((v) => v != null).length;
  return { score, confidence: present === 0 ? 0 : clamp(0.4 + present * 0.2, 0, 1) };
}

function scoreProtocolAdherence(input: EpiInputs): PillarComputation {
  if (isNum(input.adherencePct)) {
    const base = clamp(input.adherencePct, 0, 100);
    return { score: base, confidence: 0.7 };
  }
  if (input.hasActivePlan === true) {
    // Has a plan but no measured adherence yet -> neutral baseline, low confidence.
    return { score: 60, confidence: 0.35 };
  }
  return { score: null, confidence: 0 };
}

function subjectiveCheckinPresent(input: EpiInputs): boolean {
  return [input.subjEnergy, input.subjMood, input.subjSleepQuality, input.subjSoreness, input.subjStress].some((v) =>
    isNum(v),
  );
}

function scoreSubjectiveWellness(input: EpiInputs): PillarComputation {
  const subs = [
    posScale(input.subjEnergy),
    posScale(input.subjMood),
    posScale(input.subjSleepQuality),
    negScale(input.subjSoreness),
    negScale(input.subjStress),
  ];
  const score = avgPresent(subs);
  const present = subs.filter((v) => v != null).length;
  return { score, confidence: present === 0 ? 0 : clamp(0.4 + present * 0.14, 0, 1) };
}

const PILLAR_COMPUTERS: Record<EpiPillarId, (input: EpiInputs) => PillarComputation> = {
  activity_load: scoreActivityLoad,
  recovery: scoreRecovery,
  hrv: scoreHrv,
  sleep: scoreSleep,
  nutrition: scoreNutrition,
  body_composition: scoreBodyComposition,
  protocol_adherence: scoreProtocolAdherence,
  subjective_wellness: scoreSubjectiveWellness,
};

function dataTierFromCoverage(coverage: number, availableCount: number): EpiDataTier {
  if (availableCount === 0) return "none";
  if (coverage >= 0.8) return "extended";
  if (coverage >= 0.55) return "standard";
  if (coverage >= 0.3) return "minimal";
  return "minimal";
}

/**
 * Deterministic EPI computation. Missing inputs reduce coverage/confidence; they never throw and
 * never silently zero the index. Illness flags suspend the efficiency target (illness guard).
 */
export function computeEpi(input: EpiInputs): EpiResult {
  const illnessFlags = Array.isArray(input.illnessFlags)
    ? input.illnessFlags.filter((f): f is string => typeof f === "string" && f.trim() !== "")
    : [];
  const illnessDay = illnessFlags.length > 0;

  const pillars: EpiPillarScore[] = [];
  const pillarsAvailable: EpiPillarId[] = [];
  const pillarsMissing: EpiPillarId[] = [];

  // First pass: raw scores + base weights for available pillars.
  const raw: Array<{ pillar: EpiPillarId; score: number | null; baseWeight: number; confidence: number }> = [];
  for (const pillar of EPI_PILLAR_IDS) {
    const { score, confidence } = PILLAR_COMPUTERS[pillar](input);
    raw.push({ pillar, score, baseWeight: EPI_PILLAR_WEIGHTS[pillar], confidence });
    if (score != null) pillarsAvailable.push(pillar);
    else pillarsMissing.push(pillar);
  }

  const availableBaseWeightSum = raw.filter((r) => r.score != null).reduce((s, r) => s + r.baseWeight, 0);
  // Coverage = share of the total weight that is actually measured.
  const coverage = availableBaseWeightSum; // weights sum to 1 by design.

  let weightedScore = 0;
  let weightedConfidence = 0;
  for (const r of raw) {
    const effectiveWeight = r.score != null && availableBaseWeightSum > 0 ? r.baseWeight / availableBaseWeightSum : 0;
    pillars.push({
      pillar: r.pillar,
      score: r.score != null ? round(r.score, 1) : null,
      weight: round(effectiveWeight, 4),
      available: r.score != null,
      confidence: round(r.confidence, 3),
    });
    if (r.score != null) {
      weightedScore += effectiveWeight * r.score;
      weightedConfidence += effectiveWeight * r.confidence;
    }
  }

  const score = pillarsAvailable.length ? round(clamp(weightedScore, 0, 100), 1) : 0;
  // Overall confidence blends per-pillar confidence with how much of the model is covered.
  const confidence = pillarsAvailable.length ? round(clamp(weightedConfidence * (0.5 + 0.5 * coverage), 0, 1), 3) : 0;
  const dataTier = dataTierFromCoverage(coverage, pillarsAvailable.length);

  const checkinPresent = subjectiveCheckinPresent(input);
  const efficientDay = !illnessDay && checkinPresent && score >= EPI_EFFICIENT_DAY_MIN_SCORE && pillarsAvailable.length > 0;
  const coinAwardForDay = efficientDay ? COIN_PER_EFFICIENT_DAY : 0;

  return {
    athleteId: input.athleteId,
    asOf: input.asOf,
    algorithmVersion: EPI_ALGORITHM_VERSION,
    score,
    confidence,
    dataTier,
    illnessDay,
    efficientDay,
    coinAwardForDay,
    pillars,
    provenance: {
      pillarsAvailable,
      pillarsMissing,
      subjectiveCheckinPresent: checkinPresent,
      illnessFlags,
    },
  };
}
