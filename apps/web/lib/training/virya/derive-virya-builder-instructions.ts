/**
 * VIRYA microciclo → istruzioni deterministiche per generateBuilderSession / materialize.
 */

import type { AdaptationTarget, TrainingDomain } from "@/lib/training/engine/types";
import {
  resolveAerobicViryaPrescription,
  type AerobicViryaPrescription,
  type ViryaMacroPhaseForAerobicPrescription,
} from "@/lib/training/engine/aerobic-virya-prescription";
import type { GymDayModule } from "@/lib/training/virya/gym-day-modules";
import { formatGymDistrictsLabel } from "@/lib/training/virya/gym-day-modules";
import type {
  LifestyleDayModule,
  TechnicalDayModule,
} from "@/lib/training/virya/virya-day-module-types";
import type {
  ViryaBuilderSessionBrief,
  ViryaSessionRole,
  ViryaSportFamily,
} from "@/lib/training/virya/virya-builder-session-brief";
import { mechanicalKjFromAvgPower, metabolicKcalFromMechanicalKj } from "@empathy/domain-physiology";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"] as const;

export type ViryaDerivedBuilderInstructions = {
  adaptationTarget: AdaptationTarget;
  domain: TrainingDomain;
  intensityHint: string;
  objectiveDetail: string;
  sessionMinutes: number;
  tss: number;
  kcal: number;
  aerobicPrescription?: AerobicViryaPrescription;
};

export function weekdayLabel(offset: number): string {
  return WEEKDAY_LABELS[Math.max(0, Math.min(6, Math.round(offset)))] ?? "—";
}

export function formatViryaBriefMetaLine(
  brief: ViryaBuilderSessionBrief,
  derived: ViryaDerivedBuilderInstructions,
  loadSum?: number,
): string {
  return [
    `microcycle=pattern:${brief.weekdayPatternId}`,
    `day=${weekdayLabel(brief.weekdayOffset)}`,
    `role=${brief.sessionRole}`,
    `load=${brief.loadTarget}`,
    `budget=${brief.weeklyBudgetLoad}`,
    loadSum != null ? `week_sum=${loadSum}` : null,
    `adapt=${derived.adaptationTarget}`,
    `domain=${derived.domain}`,
    `builder_min=${derived.sessionMinutes}`,
    `builder_tss=${derived.tss}`,
  ]
    .filter(Boolean)
    .join(";");
}

/** Proxy energetico da TSS target VIRYA (senza contratto) — stessa catena kJ→kcal del builder. */
export function kcalFromLoadTarget(load: number, durationMinutes = 60): number {
  const tss = Math.max(0, load);
  const sec = Math.max(60, Math.round(durationMinutes) * 60);
  const hours = sec / 3600;
  const ifN = hours > 0 ? Math.sqrt(Math.max(0, tss) / (hours * 100)) : 0;
  const powerW = Math.round(ifN * 250);
  const kj = mechanicalKjFromAvgPower(powerW, sec);
  return metabolicKcalFromMechanicalKj(kj);
}

export function gymDurationMinutesForBrief(
  role: ViryaSessionRole,
  gymPrimaryGoal: string | undefined,
): number {
  const goal = (gymPrimaryGoal ?? "").toLowerCase();
  if (role === "recovery") return 45;
  if (role === "quality") {
    if (/(potenza|rapid)/.test(goal)) return 55;
    if (/forza/.test(goal)) return 65;
    return 60;
  }
  if (/massa/.test(goal)) return 75;
  if (/definiz/.test(goal)) return 58;
  return 68;
}

export function deriveStrengthAdaptationForRole(
  module: GymDayModule,
  role: ViryaSessionRole,
  gymPrimaryGoal: string | undefined,
): AdaptationTarget {
  const objectiveText = `${gymPrimaryGoal ?? ""} ${module.districtObjective} ${module.methodology}`.toLowerCase();
  if (role === "volume") {
    if (/(definiz|circuit|resist)/.test(objectiveText)) return "lactate_clearance";
    if (/(massa|iper)/.test(objectiveText)) return "hypertrophy_sarcoplasmic";
    return "hypertrophy_mixed";
  }
  if (role === "recovery") return "recovery";
  if (/(potenza|rapid)/.test(objectiveText)) return "power_output";
  if (/(mobil|stretch|postural)/.test(objectiveText)) return "mobility_capacity";
  return "max_strength";
}

function deriveTechnicalAdaptation(module: TechnicalDayModule, role: ViryaSessionRole): AdaptationTarget {
  const objectiveText = module.objectives.join(" ").toLowerCase();
  if (role === "volume") return "skill_transfer";
  if (objectiveText.includes("recupero")) return "recovery";
  if (objectiveText.includes("aerobico")) return "mitochondrial_density";
  if (objectiveText.includes("anaerobico")) return "lactate_tolerance";
  if (objectiveText.includes("velocita")) return "power_output";
  return "lactate_tolerance";
}

function deriveLifestyleAdaptation(module: LifestyleDayModule): AdaptationTarget {
  const objectiveText = `${module.objective} ${module.practiceType}`.toLowerCase();
  if (/(recupero|stress|respir|medit)/.test(objectiveText)) return "recovery";
  if (/(mobil|flessibil)/.test(objectiveText)) return "mobility_capacity";
  return "movement_quality";
}

function viryaDomainForSession(family: ViryaSportFamily, discipline: string): TrainingDomain {
  if (family === "strength") return "gym";
  if (family === "lifestyle") return "mind_body";
  if (family === "technical") {
    return ["Boxe", "Karate", "Judo", "Muay Thai"].includes(discipline) ? "combat" : "team_sport";
  }
  return "endurance";
}

function aerobicRoleScale(role: ViryaSessionRole): { durationScale: number; tssScale: number } {
  if (role === "quality") return { durationScale: 1.05, tssScale: 1.22 };
  if (role === "recovery") return { durationScale: 0.88, tssScale: 0.72 };
  return { durationScale: 1, tssScale: 0.58 };
}

export function deriveViryaBuilderInstructions(input: {
  brief: ViryaBuilderSessionBrief;
  gymModule?: GymDayModule;
  technicalModule?: TechnicalDayModule;
  lifestyleModule?: LifestyleDayModule;
}): ViryaDerivedBuilderInstructions {
  const { brief } = input;
  const tss = Math.max(1, Math.round(brief.loadTarget));
  const kcal = kcalFromLoadTarget(tss);
  const weekObjectives = brief.weekObjectives ?? [];
  const roleTag = `slot_role=${brief.sessionRole}`;
  const dayTag = `weekday=${weekdayLabel(brief.weekdayOffset)}`;

  if (brief.family === "strength" && input.gymModule) {
    const gymDay = input.gymModule;
    const adaptationTarget = deriveStrengthAdaptationForRole(
      gymDay,
      brief.sessionRole,
      brief.gymPrimaryGoal,
    );
    const sessionMinutes = gymDurationMinutesForBrief(brief.sessionRole, brief.gymPrimaryGoal);
    const roleHint =
      brief.sessionRole === "quality"
        ? "Seduta qualità · carico neuromuscolare / forza"
        : brief.sessionRole === "recovery"
          ? "Recupero attivo · volume ridotto"
          : "Seduta volume · ipertrofia / lavoro accessorio";
    return {
      adaptationTarget,
      domain: "gym",
      intensityHint: `${roleHint} · ${gymDay.methodology} · ${gymDay.districtObjective}`,
      objectiveDetail: `${formatGymDistrictsLabel(gymDay)} / ${gymDay.exerciseType} · ${roleTag} · ${dayTag}`,
      sessionMinutes,
      tss,
      kcal,
    };
  }

  if (brief.family === "technical" && input.technicalModule) {
    const technicalDay = input.technicalModule;
    const sessionMinutes =
      brief.sessionRole === "quality" ? 90 : brief.sessionRole === "recovery" ? 50 : 70;
    return {
      adaptationTarget: deriveTechnicalAdaptation(technicalDay, brief.sessionRole),
      domain: viryaDomainForSession("technical", brief.discipline),
      intensityHint: `${technicalDay.intensity} · ${technicalDay.methodology} · ${roleTag}`,
      objectiveDetail: `${technicalDay.objectives.join(" > ")} · ${dayTag}`,
      sessionMinutes,
      tss,
      kcal,
    };
  }

  if (brief.family === "lifestyle" && input.lifestyleModule) {
    const lifestyleDay = input.lifestyleModule;
    return {
      adaptationTarget: deriveLifestyleAdaptation(lifestyleDay),
      domain: "mind_body",
      intensityHint: `RPE ${lifestyleDay.intensityRpe} · ${lifestyleDay.breathingCadence}`,
      objectiveDetail: `${lifestyleDay.practiceType} · ${lifestyleDay.objective} · ${dayTag}`,
      sessionMinutes: 50,
      tss: Math.max(8, Math.round(tss * 0.85)),
      kcal: kcalFromLoadTarget(Math.max(8, Math.round(tss * 0.85))),
    };
  }

  const preset = resolveAerobicViryaPrescription({
    viryaPhase: brief.phase as ViryaMacroPhaseForAerobicPrescription,
    goalSummary: brief.objective ?? "",
    weekObjectives,
    sessionIndexInWeek: brief.slotIndex,
    sessionsInWeek: brief.sessionsInWeek,
  });
  const roleScale = aerobicRoleScale(brief.sessionRole);
  const scaledPrescription: AerobicViryaPrescription = {
    ...preset,
    durationScale: preset.durationScale * roleScale.durationScale,
    tssScale: preset.tssScale * roleScale.tssScale,
    objectiveDetail: `${preset.objectiveDetail} · ${roleTag} · ${dayTag}`,
  };
  const baseMinutes = Math.max(28, Math.round((tss / 0.9) * 1.1));
  const sessionMinutes = Math.max(28, Math.round(baseMinutes * scaledPrescription.durationScale));
  const adjustedTss = Math.max(12, Math.round(tss * scaledPrescription.tssScale));
  return {
    adaptationTarget: scaledPrescription.adaptationTarget,
    domain: "endurance",
    intensityHint: scaledPrescription.intensityHint,
    objectiveDetail: [
      brief.objective ?? brief.methodology ?? "periodized endurance",
      scaledPrescription.objectiveDetail,
      scaledPrescription.archetypeLabelIt ? `model=${scaledPrescription.archetypeLabelIt}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    sessionMinutes,
    tss: adjustedTss,
    kcal: kcalFromLoadTarget(adjustedTss),
    aerobicPrescription: scaledPrescription,
  };
}
