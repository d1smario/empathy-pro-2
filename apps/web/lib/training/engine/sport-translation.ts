import { trainingDomainForPaletteSport } from "@/lib/training/sport-domain-map";
import { TRAINING_EXERCISE_LIBRARY } from "@/lib/training/engine/exercise-library";
import type {
  AdaptationTarget,
  ExerciseLibraryItem,
  GymContractionEmphasis,
  GymEquipmentChannel,
  GymGenerationProfile,
  SessionMethod,
  TrainingDomain,
} from "@/lib/training/engine/types";

function inferGymEquipmentChannels(item: ExerciseLibraryItem): GymEquipmentChannel[] {
  if (item.gymMeta?.channels?.length) return item.gymMeta.channels;
  const raw = item.equipment.map((x) => x.toLowerCase()).join(" ");
  const out = new Set<GymEquipmentChannel>();
  if (/(barbell|dumbbell|kettlebell|rack|trap.bar|olympic)/.test(raw)) out.add("free_weight");
  if (/(cable|pulley|lat.pull)/.test(raw)) out.add("cable");
  if (/(band|elastic)/.test(raw)) out.add("elastic");
  if (/(machine|smith|selector|leg.press|legpress)/.test(raw)) out.add("machine");
  if (
    /(bodyweight|pullup|pull-up|parallettes|dip.bar|calisthenics|rings)/.test(raw) ||
    item.equipment.includes("none") ||
    (item.equipment.length === 0 && item.domain === "gym")
  ) {
    out.add("bodyweight");
  }
  if (out.size === 0 && item.domain === "gym") out.add("free_weight");
  return [...out];
}

function inferGymContractions(item: ExerciseLibraryItem): GymContractionEmphasis[] {
  if (item.gymMeta?.contractions?.length) return item.gymMeta.contractions;
  const id = item.id.toLowerCase();
  const name = item.name.toLowerCase();
  const raw = item.equipment.join(" ").toLowerCase();
  const out: GymContractionEmphasis[] = ["standard"];
  if (/(iso|isometric|wall.sit|pause)/.test(id) || /isometric/.test(name)) out.push("isometric");
  if (/(plyo|jump|box.jump|bounds)/.test(id) || /pliometric/.test(name)) out.push("plyometric");
  if (/(eccentric|tempo|negative)/.test(id) || /eccentric/.test(name) || /tempo/.test(raw)) out.push("eccentric");
  return [...new Set(out)];
}

function gymProfileScore(item: ExerciseLibraryItem, profile: GymGenerationProfile | undefined): number {
  if (!profile || item.domain !== "gym") return 0;
  let bonus = 0;
  const wantEq = profile.equipmentChannels?.filter(Boolean) ?? [];
  if (wantEq.length) {
    const have = new Set(inferGymEquipmentChannels(item));
    const hits = wantEq.filter((c) => have.has(c)).length;
    if (hits === 0) return -4;
    bonus += hits * 2;
  }
  const c = profile.contraction;
  if (c && c !== "standard") {
    if (inferGymContractions(item).includes(c)) bonus += 3;
    else bonus -= 1;
  }
  return bonus;
}

/**
 * Evita che uno sport (es. cycling) riceva esercizi da altre discipline (yoga, sled, thruster)
 * solo perché il metodo del blocco ammette più domini.
 */
export function isExerciseCompatibleWithSport(item: ExerciseLibraryItem, sport: string): boolean {
  const s = sport.trim().toLowerCase();
  const tags = item.sportTags.map((t) => t.toLowerCase());
  const tagStr = tags.join(" ");
  const id = item.id.toLowerCase();
  const name = item.name.toLowerCase();

  const multisport = /(tri|ironman|duathlon|duath)/i.test(s);
  const cycling = /(cycl|bike|ciclismo|zwift|trainer|gran fondo|indoor)/i.test(s);
  const running =
    /(run|trail|marat|marathon|10k|5k|footing)/i.test(s) || (/\brunning\b/.test(s) && !cycling);

  const hasBikeTag = /(cycling|bike|indoor|rolling)/.test(tagStr) || /cycl/.test(id) || name.includes("cycl");

  if (cycling && !multisport) {
    if (item.domain === "mind_body" && !hasBikeTag) return false;
    if (["crossfit", "hyrox", "team_sport", "combat", "gym"].includes(item.domain) && !hasBikeTag) {
      return false;
    }
    if (item.domain === "endurance") return hasBikeTag;
    return false;
  }

  if (running && !multisport) {
    if (item.domain === "mind_body" && !/(yoga|pilates|mobility|run)/.test(tagStr)) return false;
    if (["crossfit", "hyrox"].includes(item.domain) && !/(run|trail)/.test(tagStr)) return false;
    if (item.domain === "endurance") {
      return /(run|walk|trail)/.test(tagStr) || /run|walk|jog/.test(id);
    }
    if (item.domain === "gym" && !tagStr.includes("run")) return false;
    return !["team_sport", "combat"].includes(item.domain) || /(run|trail)/.test(tagStr);
  }

  return true;
}

const SPORT_DOMAIN_HINTS: Array<{ match: RegExp; domain: TrainingDomain }> = [
  { match: /(crossfit|wod)/i, domain: "crossfit" },
  { match: /(hyrox)/i, domain: "hyrox" },
  {
    match: /(soccer|calcio|basket|basketball|pallavolo|volley|volleyball|tennis|rugby|handball)/i,
    domain: "team_sport",
  },
  { match: /(boxing|boxe|karate|mma|judo|muay)/i, domain: "combat" },
  { match: /(yoga|pilates|medit|breath|breathwork|mobility|stretch)/i, domain: "mind_body" },
  { match: /(gym|strength|powerlifting|bodybuilding)/i, domain: "gym" },
];

export function inferDomainFromSport(sport: string): TrainingDomain {
  const fromPalette = trainingDomainForPaletteSport(sport);
  if (fromPalette) return fromPalette;
  for (const hint of SPORT_DOMAIN_HINTS) {
    if (hint.match.test(sport)) return hint.domain;
  }
  return "endurance";
}

/**
 * Allineato al V1: per endurance puri, `mixed_circuit` (crossfit/hyrox) diventa `interval`
 * così la libreria e il filtro sport restano su lavoro aerobico/ripetute.
 */
export function coerceMethodForEnduranceSport(method: SessionMethod, sport: string): SessionMethod {
  const s = sport.trim().toLowerCase();
  const endurancePure =
    /(cycl|bike|ciclismo|zwift|trainer|gran fondo|indoor|run|running|trail|jog|marat|swim|nuoto)/i.test(s) &&
    !/(tri|ironman|duathlon|duath|crossfit|hyrox|wod)/i.test(s);
  if (!endurancePure) return method;
  if (method === "mixed_circuit") return "interval";
  return method;
}

const METHOD_TO_LIBRARY_DOMAIN: Record<SessionMethod, TrainingDomain[]> = {
  steady: ["endurance", "hyrox"],
  interval: ["endurance", "crossfit", "hyrox", "combat"],
  repeated_sprint: ["endurance", "team_sport", "combat"],
  strength_sets: ["gym", "hyrox", "crossfit"],
  power_sets: ["gym", "hyrox", "team_sport", "combat"],
  mixed_circuit: ["crossfit", "hyrox", "team_sport", "combat"],
  technical_drill: ["team_sport", "combat", "mind_body"],
  flow_recovery: ["mind_body", "endurance", "gym"],
};

export function pickExercisesForBlock(
  params: {
    sport: string;
    domain: TrainingDomain;
    method: SessionMethod;
    adaptationTarget: AdaptationTarget;
    gymProfile?: GymGenerationProfile;
  },
  limit = 3,
): ExerciseLibraryItem[] {
  const byDomain = TRAINING_EXERCISE_LIBRARY.filter((item) => {
    if (item.domain === params.domain) return true;
    return METHOD_TO_LIBRARY_DOMAIN[params.method].includes(item.domain);
  });

  let pool = byDomain.filter((item) => isExerciseCompatibleWithSport(item, params.sport));
  if (pool.length === 0) {
    pool = byDomain.filter((item) => item.domain === params.domain);
  }
  if (pool.length === 0) {
    pool = byDomain.filter((item) => item.domain === "endurance");
  }
  if (pool.length === 0) {
    pool = [...byDomain];
  }

  const sportToken = params.sport.trim().toLowerCase();
  const score = (item: ExerciseLibraryItem) => {
    let total = 0;
    if (item.sportTags.some((tag) => sportToken.includes(tag.toLowerCase()))) total += 3;
    if (item.physiology.adaptationTargets.includes(params.adaptationTarget)) total += 2;
    if (METHOD_TO_LIBRARY_DOMAIN[params.method].includes(item.domain)) total += 1;
    total += gymProfileScore(item, params.gymProfile);
    return total;
  };

  return pool.sort((a, b) => score(b) - score(a)).slice(0, limit);
}
