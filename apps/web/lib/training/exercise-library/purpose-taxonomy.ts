import type { UnifiedExerciseRecord } from "./types";

export type FunctionalGoal =
  | "strength"
  | "power"
  | "hypertrophy"
  | "mobility"
  | "stability_neuro"
  | "muscular_endurance"
  | "coordination"
  | "skill";

export type MetabolicGoal =
  | "aerobic"
  | "anaerobic_alactic"
  | "anaerobic_lactic"
  | "mixed"
  | "anabolic"
  | "catabolic"
  | "recovery";

export type TechnicalScope = "generic" | "sport_specific";

export type DerivedExercisePurpose = {
  functionalGoals: FunctionalGoal[];
  metabolicGoals: MetabolicGoal[];
  technicalScope: TechnicalScope;
  technicalSports: string[];
  technicalTags: string[];
};

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function hasAny(haystack: string[], needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(normalize(needle)));
}

export function deriveExercisePurpose(record: UnifiedExerciseRecord): DerivedExercisePurpose {
  const category = normalize(record.category);
  const movement = normalize(record.movementPattern);
  const primarySystem = normalize(record.physiology.primarySystem);
  const energySystem = normalize(record.physiology.energySystem);
  const sportTags = record.sportTags.map(normalize);
  const equipment = record.equipment.map(normalize);

  const functionalGoals: FunctionalGoal[] = [];
  if (primarySystem.includes("strength")) functionalGoals.push("strength");
  if (primarySystem.includes("power") || movement.includes("jump") || movement.includes("landing")) functionalGoals.push("power");
  if (primarySystem.includes("hypertrophy") || category === "accessory") functionalGoals.push("hypertrophy");
  if (primarySystem.includes("stability") || movement.includes("core_control")) functionalGoals.push("stability_neuro");
  if (primarySystem.includes("coordination") || category === "skill") functionalGoals.push("coordination", "skill");
  if (primarySystem.includes("endurance") || category === "conditioning" || category === "endurance") {
    functionalGoals.push("muscular_endurance");
  }
  if (movement.includes("flow") || movement.includes("mobility")) functionalGoals.push("mobility");
  if (!functionalGoals.length) functionalGoals.push("strength");

  const metabolicGoals: MetabolicGoal[] = [];
  if (energySystem.includes("aerobic")) metabolicGoals.push("aerobic");
  if (energySystem.includes("alactic")) metabolicGoals.push("anaerobic_alactic");
  if (energySystem.includes("lactic")) metabolicGoals.push("anaerobic_lactic");
  if (energySystem.includes("mixed")) metabolicGoals.push("mixed");
  if (category === "strength" || category === "accessory" || primarySystem.includes("hypertrophy")) metabolicGoals.push("anabolic");
  if (category === "conditioning" || category === "endurance") metabolicGoals.push("catabolic");
  if (primarySystem.includes("stability") && record.physiology.lactateImpact === "low") metabolicGoals.push("recovery");
  if (!metabolicGoals.length) metabolicGoals.push("mixed");

  const technicalSports = uniq(
    sportTags.filter((tag) => !["gym", "performance", "general"].includes(tag)),
  );
  const technicalTags: string[] = [];

  const isCrossfitSpecific =
    sportTags.includes("crossfit") &&
    (category === "skill" ||
      hasAny(equipment, ["wall_target", "pullup_bar"]) ||
      hasAny([movement], ["jump_landing"]));
  const isHyroxSpecific =
    sportTags.includes("hyrox") &&
    (hasAny(equipment, ["sled", "rower", "ski_erg", "rope"]) || movement.includes("locomotion"));
  const isPowerliftingSpecific =
    sportTags.includes("powerlifting") &&
    (record.slug.includes("squat") || record.slug.includes("bench") || record.slug.includes("deadlift"));

  if (category === "skill") technicalTags.push("technical_skill");
  if (isCrossfitSpecific) technicalTags.push("mixed_modal_specific");
  if (isHyroxSpecific) technicalTags.push("race_specific");
  if (isPowerliftingSpecific) technicalTags.push("strength_sport_specific");

  const technicalScope: TechnicalScope = technicalTags.length || technicalSports.length > 1 || isCrossfitSpecific || isHyroxSpecific || isPowerliftingSpecific
    ? "sport_specific"
    : "generic";

  return {
    functionalGoals: uniq(functionalGoals),
    metabolicGoals: uniq(metabolicGoals),
    technicalScope,
    technicalSports,
    technicalTags: uniq(technicalTags),
  };
}
