import type { UnifiedExercisePurpose, UnifiedExerciseRecord } from "./types";

type Difficulty = UnifiedExerciseRecord["difficulty"];

type ExerciseSeed = {
  id: string;
  name: string;
  category: string;
  sportTags: string[];
  movementPattern: string;
  muscleGroups: string[];
  equipment: string[];
  difficulty?: Difficulty;
  primarySystem?: string;
  secondarySystem?: string;
  energySystem?: string;
  lactateImpact?: "low" | "medium" | "high";
  cnsLoad?: "low" | "medium" | "high";
  coordination?: string;
  balance?: string;
  technique?: string;
  purpose: UnifiedExercisePurpose;
};

const GENERATED_SOURCE = { source: "empathy_generated_block1" };

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/^-+|-+$/g, "");
}

function buildMetabolicGoals(
  energySystem: string,
  category: string,
  primarySystem: string,
): UnifiedExercisePurpose["metabolicGoals"] {
  const goals: string[] = [];
  if (energySystem.includes("aerobic")) goals.push("aerobic");
  if (energySystem.includes("alactic")) goals.push("anaerobic_alactic");
  if (energySystem.includes("lactic")) goals.push("anaerobic_lactic");
  if (energySystem.includes("mixed")) goals.push("mixed");
  if (category === "strength" || category === "accessory" || primarySystem.includes("hypertrophy")) goals.push("anabolic");
  if (category === "conditioning" || category === "endurance") goals.push("catabolic");
  if (primarySystem.includes("stability") || primarySystem.includes("mobility")) goals.push("recovery");
  return Array.from(new Set(goals.length ? goals : ["mixed"]));
}

function buildRecord(seed: ExerciseSeed): UnifiedExerciseRecord {
  const primarySystem = seed.primarySystem ?? "neuromuscular_strength";
  const energySystem = seed.energySystem ?? "mixed";
  return {
    id: `empathy-b1x-${seed.id}`,
    slug: slugify(seed.name),
    name: seed.name,
    category: seed.category,
    sportTags: seed.sportTags,
    movementPattern: seed.movementPattern,
    muscleGroups: seed.muscleGroups,
    equipment: seed.equipment,
    difficulty: seed.difficulty ?? "intermediate",
    physiology: {
      primarySystem,
      secondarySystem: seed.secondarySystem,
      energySystem,
      lactateImpact: seed.lactateImpact ?? "medium",
      cnsLoad: seed.cnsLoad ?? "medium",
    },
    skills: {
      coordination: seed.coordination ?? "medium",
      balance: seed.balance ?? "medium",
      technique: seed.technique ?? "medium",
    },
    purpose: {
      functionalGoals: Array.from(new Set(seed.purpose.functionalGoals)),
      metabolicGoals: Array.from(
        new Set(seed.purpose.metabolicGoals.length ? seed.purpose.metabolicGoals : buildMetabolicGoals(energySystem, seed.category, primarySystem)),
      ),
      technicalScope: seed.purpose.technicalScope,
      technicalSports: Array.from(new Set(seed.purpose.technicalSports)),
      technicalTags: Array.from(new Set(seed.purpose.technicalTags)),
    },
    provenance: [GENERATED_SOURCE],
  };
}

function strength(
  id: string,
  name: string,
  muscleGroups: string[],
  equipment: string[],
  sportTags: string[] = ["gym"],
  movementPattern = "strength_pattern",
  extras: Partial<ExerciseSeed> = {},
): UnifiedExerciseRecord {
  const energySystem = extras.energySystem ?? "mixed";
  return buildRecord({
    id,
    name,
    category: extras.category ?? "strength",
    sportTags,
    movementPattern,
    muscleGroups,
    equipment,
    difficulty: extras.difficulty,
    primarySystem: extras.primarySystem ?? "neuromuscular_strength",
    secondarySystem: extras.secondarySystem ?? (energySystem === "anaerobic_alactic" ? "anaerobic_alactic" : "anaerobic_lactic"),
    energySystem,
    lactateImpact: extras.lactateImpact ?? (energySystem === "anaerobic_alactic" ? "low" : "medium"),
    cnsLoad: extras.cnsLoad ?? "medium",
    coordination: extras.coordination ?? "medium",
    balance: extras.balance ?? "medium",
    technique: extras.technique ?? "medium",
    purpose: {
      functionalGoals: ["strength", ...(extras.purpose?.functionalGoals ?? [])],
      metabolicGoals: extras.purpose?.metabolicGoals ?? [],
      technicalScope: extras.purpose?.technicalScope ?? "generic",
      technicalSports: extras.purpose?.technicalSports ?? [],
      technicalTags: extras.purpose?.technicalTags ?? [],
    },
  });
}

function accessory(
  id: string,
  name: string,
  muscleGroups: string[],
  equipment: string[],
  sportTags: string[] = ["gym"],
  movementPattern = "accessory_pattern",
  extras: Partial<ExerciseSeed> = {},
): UnifiedExerciseRecord {
  return buildRecord({
    id,
    name,
    category: "accessory",
    sportTags,
    movementPattern,
    muscleGroups,
    equipment,
    difficulty: extras.difficulty ?? "beginner",
    primarySystem: extras.primarySystem ?? "hypertrophy",
    secondarySystem: extras.secondarySystem ?? "anaerobic_lactic",
    energySystem: extras.energySystem ?? "mixed",
    lactateImpact: extras.lactateImpact ?? "medium",
    cnsLoad: extras.cnsLoad ?? "low",
    coordination: extras.coordination ?? "low",
    balance: extras.balance ?? "low",
    technique: extras.technique ?? "low",
    purpose: {
      functionalGoals: extras.purpose?.functionalGoals ?? ["hypertrophy"],
      metabolicGoals: extras.purpose?.metabolicGoals ?? [],
      technicalScope: extras.purpose?.technicalScope ?? "generic",
      technicalSports: extras.purpose?.technicalSports ?? [],
      technicalTags: extras.purpose?.technicalTags ?? [],
    },
  });
}

function conditioning(
  id: string,
  name: string,
  muscleGroups: string[],
  equipment: string[],
  sportTags: string[],
  movementPattern = "locomotion",
  extras: Partial<ExerciseSeed> = {},
): UnifiedExerciseRecord {
  return buildRecord({
    id,
    name,
    category: extras.category ?? "conditioning",
    sportTags,
    movementPattern,
    muscleGroups,
    equipment,
    difficulty: extras.difficulty ?? "intermediate",
    primarySystem: extras.primarySystem ?? "anaerobic_lactic",
    secondarySystem: extras.secondarySystem ?? "neuromuscular_power",
    energySystem: extras.energySystem ?? "anaerobic_lactic",
    lactateImpact: extras.lactateImpact ?? "high",
    cnsLoad: extras.cnsLoad ?? "medium",
    coordination: extras.coordination ?? "medium",
    balance: extras.balance ?? "medium",
    technique: extras.technique ?? "medium",
    purpose: {
      functionalGoals: extras.purpose?.functionalGoals ?? ["muscular_endurance"],
      metabolicGoals: extras.purpose?.metabolicGoals ?? [],
      technicalScope: extras.purpose?.technicalScope ?? "generic",
      technicalSports: extras.purpose?.technicalSports ?? [],
      technicalTags: extras.purpose?.technicalTags ?? [],
    },
  });
}

function skill(
  id: string,
  name: string,
  muscleGroups: string[],
  equipment: string[],
  sportTags: string[],
  movementPattern = "technical_sequence",
  extras: Partial<ExerciseSeed> = {},
): UnifiedExerciseRecord {
  return buildRecord({
    id,
    name,
    category: "skill",
    sportTags,
    movementPattern,
    muscleGroups,
    equipment,
    difficulty: extras.difficulty ?? "advanced",
    primarySystem: extras.primarySystem ?? "coordination",
    secondarySystem: extras.secondarySystem ?? "neuromuscular_strength",
    energySystem: extras.energySystem ?? "anaerobic_alactic",
    lactateImpact: extras.lactateImpact ?? "low",
    cnsLoad: extras.cnsLoad ?? "medium",
    coordination: extras.coordination ?? "high",
    balance: extras.balance ?? "high",
    technique: extras.technique ?? "high",
    purpose: {
      functionalGoals: extras.purpose?.functionalGoals ?? ["coordination", "skill"],
      metabolicGoals: extras.purpose?.metabolicGoals ?? ["anaerobic_alactic"],
      technicalScope: extras.purpose?.technicalScope ?? "sport_specific",
      technicalSports: extras.purpose?.technicalSports ?? sportTags.filter((tag) => tag !== "gym"),
      technicalTags: extras.purpose?.technicalTags ?? ["technical_skill"],
    },
  });
}

export const BLOCK1_GENERATED_EXERCISES: UnifiedExerciseRecord[] = [
  ...[
    ["hacksquat", "Hack Squat", ["quadriceps", "glutes"], ["machine"]],
    ["beltsquat", "Belt Squat", ["quadriceps", "glutes"], ["machine", "belt"]],
    ["pendulumsquat", "Pendulum Squat", ["quadriceps", "glutes"], ["machine"]],
    ["smithsquat", "Smith Machine Squat", ["quadriceps", "glutes"], ["machine"]],
    ["heelselevatedsquat", "Heels-Elevated Squat", ["quadriceps", "glutes"], ["bodyweight", "dumbbell"]],
    ["landminesquat", "Landmine Squat", ["quadriceps", "glutes", "core"], ["barbell", "landmine"]],
    ["zerchersquat", "Zercher Squat", ["quadriceps", "glutes", "core"], ["barbell"]],
    ["safetybarsquat", "Safety Bar Squat", ["quadriceps", "glutes", "core"], ["barbell", "rack"], ["gym", "powerlifting"]],
    ["reverselunge", "Reverse Lunge", ["quadriceps", "glutes"], ["dumbbell", "barbell"]],
    ["laterallunge", "Lateral Lunge", ["glutes", "quadriceps", "adductors"], ["bodyweight", "dumbbell"]],
    ["cossacksquat", "Cossack Squat", ["glutes", "quadriceps", "adductors"], ["bodyweight"]],
    ["stepdown", "Step-Down", ["quadriceps", "glutes"], ["bodyweight", "bench"]],
    ["pistolsquat", "Pistol Squat", ["quadriceps", "glutes", "core"], ["bodyweight"], ["gym", "crossfit"]],
    ["spanishsquat", "Spanish Squat", ["quadriceps"], ["band"]],
    ["cyclistsquat", "Cyclist Squat", ["quadriceps"], ["bodyweight", "dumbbell"]],
    ["trapbardeadlift", "Trap Bar Deadlift", ["posterior_chain", "glutes", "quadriceps"], ["trap_bar"], ["gym", "hyrox"]],
    ["deficitdeadlift", "Deficit Deadlift", ["posterior_chain", "hamstrings", "glutes"], ["barbell"], ["gym", "powerlifting"]],
    ["sumodeadlift", "Sumo Deadlift", ["posterior_chain", "glutes", "adductors"], ["barbell"], ["gym", "powerlifting"]],
    ["stifflegdeadlift", "Stiff-Leg Deadlift", ["hamstrings", "posterior_chain"], ["barbell", "dumbbell"]],
    ["nordiccurl", "Nordic Curl", ["hamstrings"], ["bodyweight"]],
    ["glutehamraise", "Glute-Ham Raise", ["hamstrings", "glutes"], ["machine"]],
    ["seatedlegcurl", "Seated Leg Curl", ["hamstrings"], ["machine"]],
    ["singlelegpress", "Single-Leg Press", ["quadriceps", "glutes"], ["leg_press"]],
    ["singlelegextension", "Single-Leg Extension", ["quadriceps"], ["machine"]],
    ["cablepullthrough", "Cable Pull-Through", ["glutes", "hamstrings"], ["cable"]],
    ["frogpump", "Frog Pump", ["glutes"], ["bodyweight", "dumbbell"]],
    ["donkeycalfraise", "Donkey Calf Raise", ["calves"], ["machine", "bodyweight"]],
    ["tibialisraise", "Tibialis Raise", ["calves"], ["bodyweight", "machine"]],
    ["smithsplitsquat", "Smith Split Squat", ["quadriceps", "glutes"], ["machine"]],
    ["frontfootelevatedsplit", "Front-Foot Elevated Split Squat", ["quadriceps", "glutes"], ["dumbbell", "bench"]],
  ].map(([id, name, muscles, equipment, sports]) =>
    strength(id as string, name as string, muscles as string[], equipment as string[], (sports as string[] | undefined) ?? ["gym"], (name as string).toLowerCase().includes("deadlift") || (id as string).includes("curl") ? "hinge" : "squat"),
  ),

  ...[
    ["inclinebarbellpress", "Incline Barbell Press", ["chest", "shoulders", "triceps"], ["barbell", "bench"], ["gym"]],
    ["declinebenchpress", "Decline Bench Press", ["chest", "triceps"], ["barbell", "bench"], ["gym"]],
    ["dumbbellbenchpress", "Dumbbell Bench Press", ["chest", "shoulders", "triceps"], ["dumbbell", "bench"], ["gym"]],
    ["dumbbellshoulderpress", "Dumbbell Shoulder Press", ["shoulders", "triceps", "core"], ["dumbbell"], ["gym"]],
    ["arnoldpress", "Arnold Press", ["shoulders", "triceps"], ["dumbbell"], ["gym"]],
    ["landminepress", "Landmine Press", ["shoulders", "chest", "core"], ["barbell", "landmine"], ["gym"]],
    ["pushpress", "Push Press", ["shoulders", "triceps", "quadriceps"], ["barbell", "dumbbell"], ["crossfit", "gym"]],
    ["machineshoulderpress", "Machine Shoulder Press", ["shoulders", "triceps"], ["machine"], ["gym"]],
    ["smithbenchpress", "Smith Bench Press", ["chest", "triceps", "shoulders"], ["machine", "bench"], ["gym"]],
    ["floorpress", "Floor Press", ["chest", "triceps"], ["barbell", "dumbbell"], ["gym", "powerlifting"]],
    ["neutralgripdbpress", "Neutral-Grip Dumbbell Press", ["chest", "triceps"], ["dumbbell", "bench"], ["gym"]],
    ["cablechestpress", "Cable Chest Press", ["chest", "triceps", "shoulders"], ["cable"], ["gym"]],
    ["ringpushup", "Ring Push-Up", ["chest", "triceps", "core"], ["rings", "bodyweight"], ["gym", "crossfit"]],
    ["pikepushup", "Pike Push-Up", ["shoulders", "triceps", "core"], ["bodyweight"], ["gym"]],
    ["handstandpushup", "Handstand Push-Up", ["shoulders", "triceps", "core"], ["bodyweight"], ["crossfit", "gym"]],
    ["inclinepushup", "Incline Push-Up", ["chest", "triceps"], ["bodyweight", "bench"], ["gym"]],
    ["declinepushup", "Decline Push-Up", ["chest", "shoulders", "triceps"], ["bodyweight", "bench"], ["gym"]],
    ["assisteddip", "Assisted Dip", ["chest", "triceps", "shoulders"], ["machine"], ["gym"]],
    ["machinefly", "Machine Fly", ["chest"], ["machine"], ["gym"]],
    ["lowtohighfly", "Low-to-High Cable Fly", ["chest", "shoulders"], ["cable"], ["gym"]],
    ["hightolowfly", "High-to-Low Cable Fly", ["chest"], ["cable"], ["gym"]],
    ["platefrontraise", "Plate Front Raise", ["shoulders"], ["weight_plate"], ["gym"]],
    ["benchdip", "Bench Dip", ["triceps", "shoulders"], ["bench", "bodyweight"], ["gym"]],
    ["overheadtricepsext", "Overhead Triceps Extension", ["triceps"], ["dumbbell", "cable"], ["gym"]],
    ["cableoverheadtriceps", "Cable Overhead Triceps Extension", ["triceps"], ["cable"], ["gym"]],
    ["dumbbellkickback", "Dumbbell Kickback", ["triceps"], ["dumbbell"], ["gym"]],
    ["jmpress", "JM Press", ["triceps", "chest"], ["barbell", "bench"], ["gym", "powerlifting"]],
    ["guillotinepress", "Guillotine Press", ["chest", "shoulders"], ["barbell", "bench"], ["gym"]],
  ].map(([id, name, muscles, equipment, sports]) =>
    strength(id as string, name as string, muscles as string[], equipment as string[], sports as string[], "push"),
  ),

  ...[
    ["chinup", "Chin-Up", ["lats", "biceps", "core"], ["bodyweight", "pullup_bar"], ["gym"]],
    ["assistedpullup", "Assisted Pull-Up", ["lats", "biceps"], ["machine"], ["gym"]],
    ["neutralgrippulldown", "Neutral-Grip Pulldown", ["lats", "biceps"], ["cable", "machine"], ["gym"]],
    ["singlearmpulldown", "Single-Arm Pulldown", ["lats", "biceps"], ["cable"], ["gym"]],
    ["singlearmrow", "Single-Arm Dumbbell Row", ["lats", "upper_back", "biceps"], ["dumbbell", "bench"], ["gym"]],
    ["sealrow", "Seal Row", ["upper_back", "lats", "biceps"], ["barbell", "bench"], ["gym"]],
    ["invertedrow", "Inverted Row", ["upper_back", "lats", "biceps"], ["bodyweight", "barbell"], ["gym"]],
    ["meadowsrow", "Meadows Row", ["lats", "upper_back"], ["barbell", "landmine"], ["gym"]],
    ["machinehighrow", "Machine High Row", ["upper_back", "lats"], ["machine"], ["gym"]],
    ["machinelowrow", "Machine Low Row", ["lats", "upper_back"], ["machine"], ["gym"]],
    ["cablepullover", "Cable Pullover", ["lats", "upper_back"], ["cable"], ["gym"]],
    ["machinepullover", "Machine Pullover", ["lats", "chest"], ["machine"], ["gym"]],
    ["shrug", "Barbell Shrug", ["upper_back", "forearms"], ["barbell", "dumbbell"], ["gym"]],
    ["inclinecurl", "Incline Curl", ["biceps"], ["dumbbell", "bench"], ["gym"]],
    ["concentrationcurl", "Concentration Curl", ["biceps"], ["dumbbell"], ["gym"]],
    ["spidercurl", "Spider Curl", ["biceps"], ["dumbbell", "bench"], ["gym"]],
    ["cablecurl", "Cable Curl", ["biceps", "forearms"], ["cable"], ["gym"]],
    ["preacherhammercurl", "Preacher Hammer Curl", ["biceps", "forearms"], ["dumbbell", "bench"], ["gym"]],
    ["wristcurl", "Wrist Curl", ["forearms"], ["barbell", "dumbbell"], ["gym"]],
    ["reversewristcurl", "Reverse Wrist Curl", ["forearms"], ["barbell", "dumbbell"], ["gym"]],
    ["zottmancurl", "Zottman Curl", ["biceps", "forearms"], ["dumbbell"], ["gym"]],
    ["trapbarshrug", "Trap Bar Shrug", ["upper_back", "forearms"], ["trap_bar"], ["gym"]],
    ["yraise", "Y Raise", ["upper_back", "shoulders"], ["dumbbell", "cable"], ["gym"]],
    ["bandpullapart", "Band Pull-Apart", ["upper_back", "shoulders"], ["band"], ["gym"]],
    ["scappullup", "Scap Pull-Up", ["lats", "upper_back"], ["bodyweight", "pullup_bar"], ["gym", "crossfit"]],
    ["widegripseatedrow", "Wide-Grip Seated Row", ["upper_back", "lats"], ["cable"], ["gym"]],
    ["ropehammercurl", "Rope Hammer Curl", ["biceps", "forearms"], ["cable"], ["gym"]],
    ["rackpull", "Rack Pull", ["posterior_chain", "upper_back"], ["barbell", "rack"], ["gym", "powerlifting"]],
  ].map(([id, name, muscles, equipment, sports]) =>
    strength(id as string, name as string, muscles as string[], equipment as string[], sports as string[], "pull"),
  ),

  ...[
    ["deadbug", "Dead Bug", ["core"], ["bodyweight"], ["gym"]],
    ["hollowhold", "Hollow Hold", ["core"], ["bodyweight"], ["gym", "crossfit"]],
    ["pallofpress", "Pallof Press", ["core", "obliques"], ["cable", "band"], ["gym"]],
    ["sideplank", "Side Plank", ["core", "obliques"], ["bodyweight"], ["gym"]],
    ["weightedsitup", "Weighted Sit-Up", ["core", "hip_flexors"], ["bodyweight", "weight_plate"], ["gym"]],
    ["hanginglegraise", "Hanging Leg Raise", ["core", "hip_flexors"], ["pullup_bar", "bodyweight"], ["gym", "crossfit"]],
    ["cablecrunch", "Cable Crunch", ["core"], ["cable"], ["gym"]],
    ["reversecrunch", "Reverse Crunch", ["core", "hip_flexors"], ["bodyweight"], ["gym"]],
    ["mountainclimber", "Mountain Climber", ["core", "hip_flexors"], ["bodyweight"], ["gym", "crossfit"]],
    ["birddog", "Bird Dog", ["core", "glutes"], ["bodyweight"], ["gym"]],
    ["suitcasecarry", "Suitcase Carry", ["core", "forearms"], ["dumbbell", "kettlebell"], ["gym", "hyrox"]],
    ["waitercarry", "Waiter Carry", ["core", "shoulders"], ["dumbbell", "kettlebell"], ["gym"]],
    ["stirthepot", "Stir the Pot", ["core", "shoulders"], ["exercise_ball"], ["gym"]],
    ["bodysaw", "Body Saw", ["core", "shoulders"], ["bodyweight", "slide_disc"], ["gym"]],
    ["dragonflag", "Dragon Flag", ["core", "hip_flexors"], ["bodyweight", "bench"], ["gym"]],
    ["landminerotation", "Landmine Rotation", ["core", "obliques"], ["barbell", "landmine"], ["gym"]],
    ["woodchop", "Wood Chop", ["core", "obliques"], ["cable"], ["gym"]],
    ["backextension", "Back Extension", ["posterior_chain", "glutes"], ["machine", "bodyweight"], ["gym"]],
    ["supermanhold", "Superman Hold", ["posterior_chain", "core"], ["bodyweight"], ["gym"]],
    ["openhagenadduction", "Copenhagen Adduction", ["core", "adductors"], ["bodyweight", "bench"], ["gym"]],
  ].map(([id, name, muscles, equipment, sports]) =>
    accessory(id as string, name as string, muscles as string[], equipment as string[], sports as string[], "core_control", {
      primarySystem: ["pallofpress", "bodysaw", "sideplank", "birddog", "openhagenadduction"].includes(id as string) ? "stability" : "stability",
      purpose: {
        functionalGoals: ["stability_neuro"],
        metabolicGoals: ["recovery"],
        technicalScope: "generic",
        technicalSports: [],
        technicalTags: [],
      },
    }),
  ),

  ...[
    ["assaultbike", "Assault Bike Sprint", ["full_body"], ["air_bike"], ["crossfit", "hyrox"]],
    ["echobike", "Echo Bike", ["full_body"], ["air_bike"], ["crossfit", "hyrox"]],
    ["battle ropes", "Battle Ropes", ["shoulders", "core", "full_body"], ["rope"], ["gym", "crossfit"]],
    ["shuttlerun", "Shuttle Run", ["full_body", "calves"], ["bodyweight"], ["hyrox", "crossfit", "gym"]],
    ["bearcrawl", "Bear Crawl", ["core", "shoulders", "full_body"], ["bodyweight"], ["crossfit", "gym"]],
    ["crabwalk", "Crab Walk", ["core", "shoulders", "glutes"], ["bodyweight"], ["gym"]],
    ["boxstepover", "Box Step-Over", ["quadriceps", "glutes", "core"], ["plyo_box", "bodyweight"], ["hyrox", "crossfit"]],
    ["broadjump", "Broad Jump", ["glutes", "quadriceps", "calves"], ["bodyweight"], ["crossfit", "gym"]],
    ["sleddragbackward", "Backward Sled Drag", ["quadriceps", "calves"], ["sled", "rope"], ["hyrox", "gym"]],
    ["sandbagcarry", "Sandbag Carry", ["core", "full_body"], ["sandbag"], ["hyrox", "crossfit"]],
    ["sandbaglunge", "Sandbag Lunge", ["quadriceps", "glutes", "core"], ["sandbag"], ["hyrox", "crossfit"]],
    ["devilpress", "Devil Press", ["full_body", "shoulders", "core"], ["dumbbell"], ["crossfit"]],
    ["dumbbellsnatch", "Dumbbell Snatch", ["full_body", "shoulders", "glutes"], ["dumbbell"], ["crossfit", "gym"]],
    ["powerclean", "Power Clean", ["full_body", "posterior_chain"], ["barbell"], ["crossfit", "weightlifting"]],
    ["hangpowerclean", "Hang Power Clean", ["full_body", "posterior_chain"], ["barbell"], ["crossfit", "weightlifting"]],
    ["wallwalk", "Wall Walk", ["shoulders", "core"], ["bodyweight"], ["crossfit"]],
    ["skibound", "Ski Bound", ["glutes", "calves", "core"], ["bodyweight"], ["hyrox", "gym"]],
    ["medballslam", "Medicine Ball Slam", ["core", "lats", "full_body"], ["medicine_ball"], ["crossfit", "gym"]],
    ["cleanandjerk", "Clean and Jerk", ["full_body", "shoulders", "glutes"], ["barbell"], ["crossfit", "weightlifting"]],
    ["snatchbalance", "Snatch Balance", ["full_body", "shoulders", "quadriceps"], ["barbell"], ["crossfit", "weightlifting"]],
  ].map(([id, name, muscles, equipment, sports]) =>
    (() => {
      const sportTags = sports as string[];
      return conditioning(
        String(id).replace(/\s+/g, ""),
        String(name),
        muscles as string[],
        equipment as string[],
        sportTags,
        ["broadjump", "skibound"].includes(String(id).replace(/\s+/g, "")) ? "jump_landing" : "locomotion",
        {
          purpose: {
            functionalGoals: ["muscular_endurance", ...(String(name).includes("Jump") || String(name).includes("Clean") || String(name).includes("Snatch") ? ["power"] : [])],
            metabolicGoals: [],
            technicalScope: sportTags.includes("crossfit") || sportTags.includes("hyrox") ? "sport_specific" : "generic",
            technicalSports: sportTags.filter((tag) => tag !== "gym"),
            technicalTags: sportTags.includes("hyrox") ? ["race_specific"] : sportTags.includes("crossfit") ? ["mixed_modal_specific"] : [],
          },
          energySystem: sportTags.includes("hyrox") ? "mixed" : undefined,
        },
      );
    })(),
  ),

  ...[
    skill("competitionsquat", "Competition Squat", ["quadriceps", "glutes", "core"], ["barbell", "rack"], ["powerlifting"], "squat", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["anaerobic_alactic", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength",
      secondarySystem: "anaerobic_alactic",
    }),
    skill("competitionbench", "Competition Bench Press", ["chest", "triceps", "shoulders"], ["barbell", "bench"], ["powerlifting"], "push", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["anaerobic_alactic", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength",
      secondarySystem: "anaerobic_alactic",
    }),
    skill("competitiondeadlift", "Competition Deadlift", ["posterior_chain", "glutes"], ["barbell"], ["powerlifting"], "hinge", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["anaerobic_alactic", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength",
      secondarySystem: "anaerobic_alactic",
    }),
    skill("pinsquat", "Pin Squat", ["quadriceps", "glutes", "core"], ["barbell", "rack"], ["powerlifting"], "squat", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["anaerobic_alactic", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength",
    }),
    skill("boardpress", "Board Press", ["chest", "triceps"], ["barbell", "bench"], ["powerlifting"], "push", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["mixed", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength",
    }),
    skill("spotopress", "Spoto Press", ["chest", "triceps", "shoulders"], ["barbell", "bench"], ["powerlifting"], "push", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["mixed", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength",
    }),
    skill("blockpull", "Block Pull", ["posterior_chain", "glutes"], ["barbell", "blocks"], ["powerlifting"], "hinge", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["anaerobic_alactic", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength",
    }),
    skill("pausedeadlift", "Pause Deadlift", ["posterior_chain", "glutes"], ["barbell"], ["powerlifting"], "hinge", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["mixed", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength",
    }),
    skill("burpeebroadjump", "Burpee Broad Jump", ["full_body", "quadriceps", "core"], ["bodyweight"], ["hyrox"], "jump_landing", {
      purpose: { functionalGoals: ["power", "muscular_endurance"], metabolicGoals: ["anaerobic_lactic", "catabolic"], technicalScope: "sport_specific", technicalSports: ["hyrox"], technicalTags: ["race_specific"] },
      primarySystem: "anaerobic_lactic",
      secondarySystem: "neuromuscular_power",
      coordination: "high",
      balance: "medium",
      technique: "medium",
    }),
    skill("sandbagfrontcarry", "Sandbag Front Carry", ["core", "full_body"], ["sandbag"], ["hyrox"], "carry", {
      purpose: { functionalGoals: ["strength", "muscular_endurance"], metabolicGoals: ["mixed", "catabolic"], technicalScope: "sport_specific", technicalSports: ["hyrox"], technicalTags: ["race_specific"] },
      primarySystem: "neuromuscular_strength",
      secondarySystem: "aerobic",
    }),
    skill("sleddrag", "Sled Drag", ["posterior_chain", "forearms", "quadriceps"], ["sled", "rope"], ["hyrox"], "carry", {
      purpose: { functionalGoals: ["strength", "muscular_endurance"], metabolicGoals: ["mixed", "catabolic"], technicalScope: "sport_specific", technicalSports: ["hyrox"], technicalTags: ["race_specific"] },
      primarySystem: "neuromuscular_strength",
      secondarySystem: "aerobic",
    }),
    skill("muscleup", "Muscle-Up", ["lats", "triceps", "core"], ["rings", "pullup_bar"], ["crossfit"], "technical_sequence", {
      purpose: { functionalGoals: ["coordination", "skill", "strength"], metabolicGoals: ["anaerobic_alactic"], technicalScope: "sport_specific", technicalSports: ["crossfit"], technicalTags: ["technical_skill", "mixed_modal_specific"] },
    }),
    skill("chesttobar", "Chest-to-Bar Pull-Up", ["lats", "biceps", "core"], ["pullup_bar", "bodyweight"], ["crossfit"], "technical_sequence", {
      purpose: { functionalGoals: ["coordination", "skill", "strength"], metabolicGoals: ["anaerobic_alactic"], technicalScope: "sport_specific", technicalSports: ["crossfit"], technicalTags: ["technical_skill", "mixed_modal_specific"] },
    }),
    skill("doubleunder", "Double Under", ["calves", "full_body"], ["rope", "bodyweight"], ["crossfit"], "technical_sequence", {
      purpose: { functionalGoals: ["coordination", "skill", "muscular_endurance"], metabolicGoals: ["aerobic", "catabolic"], technicalScope: "sport_specific", technicalSports: ["crossfit"], technicalTags: ["technical_skill", "mixed_modal_specific"] },
      energySystem: "aerobic",
      primarySystem: "coordination",
    }),
    skill("sandbagshouldering", "Sandbag Shouldering", ["full_body", "glutes", "core"], ["sandbag"], ["hyrox", "crossfit"], "technical_sequence", {
      purpose: { functionalGoals: ["strength", "power", "skill"], metabolicGoals: ["mixed", "catabolic"], technicalScope: "sport_specific", technicalSports: ["hyrox", "crossfit"], technicalTags: ["race_specific", "mixed_modal_specific"] },
      primarySystem: "neuromuscular_power",
      secondarySystem: "neuromuscular_strength",
    }),
    skill("wallballshot", "Wall Ball Shot", ["quadriceps", "shoulders", "core"], ["medicine_ball", "wall_target"], ["crossfit", "hyrox"], "technical_sequence", {
      purpose: { functionalGoals: ["coordination", "power", "muscular_endurance"], metabolicGoals: ["anaerobic_lactic", "catabolic"], technicalScope: "sport_specific", technicalSports: ["crossfit", "hyrox"], technicalTags: ["mixed_modal_specific", "race_specific"] },
      primarySystem: "anaerobic_lactic",
      secondarySystem: "neuromuscular_power",
    }),
  ],
];
