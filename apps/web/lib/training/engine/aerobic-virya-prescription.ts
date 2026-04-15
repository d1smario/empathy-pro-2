import type { AdaptationTarget } from "@/lib/training/engine/types";
import { pickAerobicSessionArchetype } from "@/lib/training/engine/aerobic-session-archetypes";

/**
 * Prescrizioni Virya (endurance): catalogo di **archetipi** (3–4 per fase) con scale durata/TSS,
 * poi materializzazione motore + `PRESET_*` per intervalli. Nessun LLM.
 */
export type ViryaMacroPhaseForAerobicPrescription =
  | "base"
  | "build"
  | "refine"
  | "peak"
  | "deload"
  | "second_peak";

export type AerobicViryaPrescription = {
  adaptationTarget: AdaptationTarget;
  intensityHint: string;
  objectiveDetail: string;
  archetypeId: string;
  archetypeLabelIt: string;
  durationScale: number;
  tssScale: number;
};

function goalOverrides(goalSummary: string): AerobicViryaPrescription | null {
  const g = goalSummary.toLowerCase();
  if (g.includes("recovery") || g.includes("recuper")) {
    return {
      adaptationTarget: "recovery",
      intensityHint: "Z1–Z2 attivo; volume basso; priorità autonomico e tessuto.",
      objectiveDetail: "override_goal=recovery",
      archetypeId: "goal_override_recovery",
      archetypeLabelIt: "Recupero (obiettivo piano)",
      durationScale: 1,
      tssScale: 1,
    };
  }
  if (/\bvo2\b|vo2max|z5|z6/i.test(g)) {
    return {
      adaptationTarget: "vo2_max_support",
      intensityHint:
        "PRESET_VO2_Z5 Z5–Z6 intervallato recuperi brevi 1:1–1:1.5; stimolo VO2max e glicolisi rapida (da obiettivo piano).",
      objectiveDetail: "override_goal=vo2",
      archetypeId: "goal_override_vo2",
      archetypeLabelIt: "VO2 (obiettivo piano)",
      durationScale: 1,
      tssScale: 1,
    };
  }
  if (/\blactat|lattat|\bsoglia\b|threshold/i.test(g)) {
    return {
      adaptationTarget: "lactate_tolerance",
      intensityHint:
        "PRESET_NORWEGIAN Z4 8–12 min con recuperi brevi Z1–Z2 (da obiettivo piano soglia / lattato).",
      objectiveDetail: "override_goal=threshold",
      archetypeId: "goal_override_threshold",
      archetypeLabelIt: "Soglia (obiettivo piano)",
      durationScale: 1,
      tssScale: 1,
    };
  }
  return null;
}

/**
 * Prescrizione completa per una seduta aerobica: archetipo catalogato + scale operative.
 */
export function resolveAerobicViryaPrescription(input: {
  viryaPhase: ViryaMacroPhaseForAerobicPrescription;
  goalSummary: string;
  weekObjectives: readonly string[];
  sessionIndexInWeek: number;
  sessionsInWeek: number;
}): AerobicViryaPrescription {
  const override = goalOverrides(input.goalSummary);
  if (override) return override;

  const arch = pickAerobicSessionArchetype({
    viryaPhase: input.viryaPhase,
    sessionIndexInWeek: input.sessionIndexInWeek,
    sessionsInWeek: input.sessionsInWeek,
    weekObjectives: input.weekObjectives,
  });

  return {
    adaptationTarget: arch.adaptationTarget,
    intensityHint: arch.intensityHint,
    objectiveDetail: `${arch.objectiveDetail} · archetypeId=${arch.id}`,
    archetypeId: arch.id,
    archetypeLabelIt: arch.labelIt,
    durationScale: arch.durationScale,
    tssScale: arch.tssScale,
  };
}
