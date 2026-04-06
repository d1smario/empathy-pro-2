import type { Block1MusclePreset, UnifiedExerciseRecord } from "./types";

type Block1DistrictMeta = {
  label: string;
  aliases: string[];
  bodyRegion: "upper" | "lower" | "trunk" | "full_body";
};

type Block1DistrictKey =
  | Exclude<Block1MusclePreset, "" | "lower" | "upper_push" | "upper_pull" | "full">
  | "full_body";

const DISTRICTS: Record<Block1DistrictKey, Block1DistrictMeta> = {
  quadriceps: { label: "Quadricipiti", aliases: ["quadriceps", "quads", "upper_legs"], bodyRegion: "lower" },
  hamstrings: { label: "Femorali", aliases: ["hamstrings"], bodyRegion: "lower" },
  glutes: { label: "Glutei", aliases: ["glutes"], bodyRegion: "lower" },
  calves: { label: "Polpacci", aliases: ["calves", "lower_legs"], bodyRegion: "lower" },
  chest: { label: "Petto", aliases: ["chest", "pecs"], bodyRegion: "upper" },
  lats: { label: "Gran dorsale", aliases: ["lats", "latissimus"], bodyRegion: "upper" },
  upper_back: { label: "Schiena alta", aliases: ["upper_back", "back", "traps", "rear_delts"], bodyRegion: "upper" },
  shoulders: { label: "Spalle", aliases: ["shoulders", "delts", "deltoids"], bodyRegion: "upper" },
  biceps: { label: "Bicipiti", aliases: ["biceps", "bicep"], bodyRegion: "upper" },
  triceps: { label: "Tricipiti", aliases: ["triceps", "tricep"], bodyRegion: "upper" },
  forearms: { label: "Avambracci", aliases: ["forearms", "grip"], bodyRegion: "upper" },
  core: { label: "Core", aliases: ["core", "abdominals", "abs", "obliques", "waist"], bodyRegion: "trunk" },
  hip_flexors: { label: "Flessori anca", aliases: ["hip_flexors"], bodyRegion: "trunk" },
  posterior_chain: {
    label: "Catena posteriore",
    aliases: ["posterior_chain", "hamstrings", "glutes", "lower_back"],
    bodyRegion: "lower",
  },
  full_body: { label: "Full body", aliases: ["full_body", "total_body"], bodyRegion: "full_body" },
};

const PUSH_DISTRICTS: Block1DistrictKey[] = ["chest", "shoulders", "triceps"];
const PULL_DISTRICTS: Block1DistrictKey[] = ["lats", "upper_back", "biceps", "forearms"];
const LOWER_DISTRICTS: Block1DistrictKey[] = ["quadriceps", "hamstrings", "glutes", "calves", "posterior_chain"];

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

function normalizedMuscles(exercise: UnifiedExerciseRecord): string[] {
  return exercise.muscleGroups.map(normalize);
}

function includesAny(haystack: string[], needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(normalize(needle)));
}

export function matchesBlock1MusclePreset(exercise: UnifiedExerciseRecord, preset: Block1MusclePreset): boolean {
  if (!preset) return true;
  const muscles = normalizedMuscles(exercise);
  if (preset === "lower") return LOWER_DISTRICTS.some((key) => includesAny(muscles, DISTRICTS[key].aliases));
  if (preset === "upper_push") return PUSH_DISTRICTS.some((key) => includesAny(muscles, DISTRICTS[key].aliases));
  if (preset === "upper_pull") return PULL_DISTRICTS.some((key) => includesAny(muscles, DISTRICTS[key].aliases));
  if (preset === "full") return includesAny(muscles, DISTRICTS.full_body.aliases);
  return includesAny(muscles, DISTRICTS[preset].aliases);
}

function pickPrimaryDistrict(exercise: UnifiedExerciseRecord): Block1DistrictKey {
  const muscles = normalizedMuscles(exercise);
  const priority: Block1DistrictKey[] = [
    "full_body",
    "quadriceps",
    "hamstrings",
    "glutes",
    "calves",
    "chest",
    "lats",
    "upper_back",
    "shoulders",
    "biceps",
    "triceps",
    "forearms",
    "core",
    "hip_flexors",
    "posterior_chain",
  ];
  for (const key of priority) {
    if (includesAny(muscles, DISTRICTS[key].aliases)) return key;
  }
  return "full_body";
}

function secondaryDistricts(exercise: UnifiedExerciseRecord, primary: Block1DistrictKey): string[] {
  const muscles = normalizedMuscles(exercise);
  return Object.entries(DISTRICTS)
    .filter(([key, meta]) => key !== primary && includesAny(muscles, meta.aliases))
    .map(([key]) => DISTRICTS[key as Block1DistrictKey].label)
    .slice(0, 3);
}

export function classifyEquipmentClass(exercise: UnifiedExerciseRecord): string {
  const equipment = exercise.equipment.map(normalize);
  if (equipment.some((item) => ["barbell", "dumbbell", "kettlebell", "weight_plate"].includes(item))) return "Pesi liberi";
  if (equipment.includes("bodyweight") || equipment.includes("pullup_bar")) return "Corpo libero";
  if (equipment.some((item) => item.includes("machine") || item === "leg_press")) return "Macchinario";
  if (equipment.includes("cable")) return "Cavo";
  if (equipment.some((item) => item.includes("erg") || item === "rower" || item === "ski_erg")) return "Ergometro";
  if (equipment.includes("sled")) return "Sled";
  return "Misto";
}

export function classifyExerciseKind(exercise: UnifiedExerciseRecord): string {
  const category = normalize(exercise.category);
  const pattern = normalize(exercise.movementPattern);
  if (category === "skill") return "Skill";
  if (category === "conditioning" || category === "endurance") return "Conditioning";
  if (pattern.includes("carry") || pattern.includes("locomotion")) return "Locomozione";
  if (pattern.includes("push")) return "Spinta";
  if (pattern.includes("pull")) return "Trazione";
  if (pattern.includes("hinge")) return "Hip hinge";
  if (pattern.includes("squat")) return "Squat";
  return "Forza";
}

/** Canonical `catalogCategory` keys from classifyCatalogCategory — UI grouping order. */
export const BLOCK1_CATALOG_CATEGORY_ORDER = [
  "strength_foundation",
  "strength_accessory",
  "trunk_stability",
  "mixed_modal_conditioning",
  "sport_specific_skill",
] as const;

export function classifyCatalogCategory(exercise: UnifiedExerciseRecord): string {
  const category = normalize(exercise.category);
  const pattern = normalize(exercise.movementPattern);
  const primarySystem = normalize(exercise.physiology.primarySystem);
  const sportTags = exercise.sportTags.map(normalize);

  if (category === "skill") return "sport_specific_skill";
  if (category === "conditioning" || category === "endurance") return "mixed_modal_conditioning";
  if (primarySystem.includes("stability") || pattern.includes("core_control")) return "trunk_stability";
  if (
    sportTags.some((tag) => ["powerlifting", "crossfit", "hyrox", "weightlifting"].includes(tag)) &&
    (pattern.includes("technical") || pattern.includes("carry"))
  ) {
    return "sport_specific_skill";
  }
  if (category === "accessory") return "strength_accessory";
  return "strength_foundation";
}

export function describeBlock1Taxonomy(exercise: UnifiedExerciseRecord) {
  const primary = pickPrimaryDistrict(exercise);
  return {
    primaryDistrict: DISTRICTS[primary].label,
    secondaryDistricts: secondaryDistricts(exercise, primary),
    bodyRegion: DISTRICTS[primary].bodyRegion,
    equipmentClass: classifyEquipmentClass(exercise),
    exerciseKind: classifyExerciseKind(exercise),
    catalogCategory: classifyCatalogCategory(exercise),
  };
}
