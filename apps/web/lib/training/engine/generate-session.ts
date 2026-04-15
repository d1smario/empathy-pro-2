import { ADAPTATION_RULES, deriveLoadBand } from "@/lib/training/engine/engine-rules";
import { mergeTechnicalFocusIntoGoalRequest } from "@/lib/training/engine/technical-module-focus";
import {
  coerceMethodForEnduranceSport,
  inferDomainFromSport,
  pickExercisesForBlock,
} from "@/lib/training/engine/sport-translation";
import type {
  AdaptationTarget,
  AthleteMetabolicState,
  GeneratedSession,
  GymContractionEmphasis,
  SessionBlock,
  SessionGoalRequest,
  SessionMethod,
  TrainingDomain,
} from "@/lib/training/engine/types";

function augmentGymBlockCue(baseCue: string, contraction?: GymContractionEmphasis): string {
  if (!contraction || contraction === "standard") return baseCue;
  const tail: Record<Exclude<GymContractionEmphasis, "standard">, string> = {
    eccentric:
      "Modality: enfasi eccentrica / tempo-allungato (letteratura: sovraccarico controllato in allungamento)",
    isometric: "Modality: isometrie lunghe o pause strategiche (stabilità + tensione senza ciclo completo)",
    plyometric: "Modality: ciclo stiramento-accorciamento — qualità contatto / ammortamento (progressione carico)",
  };
  return `${baseCue} · ${tail[contraction]}`;
}

function coerceMainMethodForDomain(
  domain: TrainingDomain,
  adaptationTarget: AdaptationTarget,
  defaultMethod: SessionMethod,
): SessionMethod {
  if (domain === "mind_body") {
    if (adaptationTarget === "movement_quality" || adaptationTarget === "skill_transfer") return "technical_drill";
    if (
      adaptationTarget === "max_strength" ||
      adaptationTarget === "power_output" ||
      adaptationTarget === "neuromuscular_adaptation"
    )
      return "power_sets";
    return "flow_recovery";
  }
  if (domain === "team_sport" || domain === "combat") {
    if (defaultMethod === "steady" || defaultMethod === "flow_recovery") return "technical_drill";
    return defaultMethod;
  }
  return defaultMethod;
}

function coerceSecondaryMethodForDomain(
  domain: TrainingDomain,
  mainMethod: SessionMethod,
  ruleDefaultMethod: SessionMethod,
  sport: string,
): SessionMethod {
  if (domain === "mind_body") {
    if (mainMethod === "technical_drill") return "flow_recovery";
    return "technical_drill";
  }
  const base = ruleDefaultMethod === "strength_sets" ? "power_sets" : "mixed_circuit";
  let m = coerceMethodForEnduranceSport(base, sport);
  if ((domain === "team_sport" || domain === "combat") && m === "interval") return "repeated_sprint";
  return m;
}

function toBlockMinutes(total: number, ratio: number): number {
  return Math.max(4, Math.round(total * ratio));
}

function tssHintForLoad(loadBand: GeneratedSession["expectedLoad"]["loadBand"], minutes: number): number | null {
  const factor = loadBand === "low" ? 0.6 : loadBand === "moderate" ? 0.9 : loadBand === "high" ? 1.2 : 1.45;
  return Math.round(minutes * factor);
}

export function generateTrainingSession(
  request: SessionGoalRequest,
  athlete: AthleteMetabolicState,
): GeneratedSession {
  const requestEffective = mergeTechnicalFocusIntoGoalRequest(request);
  const rule = ADAPTATION_RULES[requestEffective.adaptationTarget];
  const domain = requestEffective.domain || inferDomainFromSport(requestEffective.sport);
  const distribution = rule.phaseDistribution[requestEffective.phase];
  const effectiveLoad = deriveLoadBand(rule.baseLoadBand, athlete);
  const hintTrim = requestEffective.intensityHint?.trim() ?? "";
  const requestedIntensityCue = hintTrim || rule.intensityCue;
  /** Hint con token Virya `PRESET_*` è per il blocco principale; warm/cool restano autonomici. */
  const flowRecoveryCue =
    /PRESET_/i.test(hintTrim) || !hintTrim
      ? "Z1–Z2 progressive activation / breathing-led; low neuromuscular stress"
      : hintTrim;
  const requestedTssHint =
    Number.isFinite(Number(requestEffective.tssTargetHint)) && Number(requestEffective.tssTargetHint) > 0
      ? Math.round(Number(requestEffective.tssTargetHint))
      : null;

  const mainMethod = coerceMainMethodForDomain(domain, requestEffective.adaptationTarget, rule.defaultMethod);
  const legacySecondary = coerceMethodForEnduranceSport(
    rule.defaultMethod === "strength_sets" ? "power_sets" : "mixed_circuit",
    requestEffective.sport,
  );
  const secondaryMethod = coerceSecondaryMethodForDomain(domain, mainMethod, rule.defaultMethod, requestEffective.sport);
  const domainShapedMethods =
    domain === "mind_body" || domain === "team_sport" || domain === "combat"
      ? mainMethod !== rule.defaultMethod || secondaryMethod !== legacySecondary
      : false;

  const blockTemplates: Array<{
    label: string;
    ratio: number;
    method: SessionMethod;
    target: SessionGoalRequest["adaptationTarget"];
  }> = [
    { label: "Warm-up", ratio: distribution[0], method: "flow_recovery" as const, target: "recovery" as const },
    {
      label: "Main block",
      ratio: distribution[1],
      method: mainMethod,
      target: requestEffective.adaptationTarget,
    },
    {
      label: "Secondary block",
      ratio: distribution[2],
      method: secondaryMethod,
      target: requestEffective.adaptationTarget,
    },
    { label: "Cool-down", ratio: distribution[3], method: "flow_recovery" as const, target: "recovery" as const },
  ];

  const gymProfile = domain === "gym" ? requestEffective.gymProfile : undefined;

  const blocks: SessionBlock[] = blockTemplates.map((tmpl, idx) => {
    const exercises = pickExercisesForBlock(
      {
        sport: requestEffective.sport,
        domain,
        method: tmpl.method,
        adaptationTarget: tmpl.target,
        gymProfile,
      },
      tmpl.label === "Main block" ? 4 : 2,
    );
    const mainCue =
      tmpl.method === "flow_recovery"
        ? flowRecoveryCue
        : domain === "gym" && gymProfile?.contraction
          ? augmentGymBlockCue(requestedIntensityCue, gymProfile.contraction)
          : requestedIntensityCue;
    return {
      order: idx + 1,
      label: tmpl.label,
      method: tmpl.method,
      targetSystem: tmpl.method === "flow_recovery" ? "mobility" : rule.targetSystem,
      durationMinutes: toBlockMinutes(requestEffective.sessionMinutes, tmpl.ratio),
      intensityCue: mainCue,
      expectedAdaptation: tmpl.target,
      exerciseIds: exercises.map((x) => x.id),
    };
  });

  return {
    sport: requestEffective.sport,
    domain,
    goalLabel: requestEffective.goalLabel,
    physiologicalTarget: requestEffective.adaptationTarget,
    expectedLoad: {
      loadBand: effectiveLoad,
      tssHint: requestedTssHint ?? tssHintForLoad(effectiveLoad, requestEffective.sessionMinutes),
    },
    blocks,
    rationale: [
      `Goal-first: selected adaptation target '${requestEffective.adaptationTarget}' before exercise selection.`,
      `Applied ${requestEffective.phase} phase distribution to split warm-up/main/secondary/cool-down.`,
      `Sport translation mapped method blocks to ${requestEffective.sport} exercise candidates.`,
      domainShapedMethods
        ? `Domain '${domain}' shaped main/secondary methods (mind-body / field-court / combat) to avoid pure endurance block templates where inappropriate.`
        : "",
      `Load adjusted with readiness (${athlete.readinessScore}) and fatigue (${athlete.fatigueScore}).`,
      requestEffective.intensityHint ? `Intensity hint honored: ${requestEffective.intensityHint}.` : "",
      requestedTssHint ? `Daily TSS target hint honored: ${requestedTssHint}.` : "",
      requestEffective.objectiveDetail ? `Objective detail: ${requestEffective.objectiveDetail}.` : "",
      request.technicalModuleFocus
        ? "Macro C: applied modular technical focus (work phase + game context + athletic qualities) to session cues."
        : "",
      gymProfile?.equipmentChannels?.length
        ? `Gym equipment filter: ${gymProfile.equipmentChannels.join(", ")}.`
        : "",
      gymProfile?.contraction && gymProfile.contraction !== "standard"
        ? `Gym contraction emphasis: ${gymProfile.contraction}.`
        : "",
    ].filter((entry): entry is string => Boolean(entry)),
  };
}
