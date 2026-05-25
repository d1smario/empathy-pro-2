import { AEROBIC_STARTER_PRESETS, type AerobicStarterPreset } from "@/lib/training/library/starter-pack-aerobic";
import {
  catalogDisciplineSlug,
  viryaDisciplineToCatalogDiscipline,
} from "@/lib/training/virya/virya-catalog-discipline";

export type ViryaCatalogMatchRule = {
  /** presetId base o completo — risolti anche con prefisso disciplina */
  presetIds?: readonly string[];
  tagsAny?: readonly string[];
  tagsAll?: readonly string[];
  excludeTags?: readonly string[];
};

/** Archetipo VIRYA → pool template catalogo Empathy (stesso pack della libreria coach). */
export const VIRYA_ARCHETYPE_CATALOG_MATCH: Record<string, ViryaCatalogMatchRule> = {
  base_z2_volume: {
    presetIds: [
      "endurance_z2_75",
      "endurance_90_z2",
      "xcs_endurance_z2_90",
      "trl_endurance_z2_90",
      "cyc_z2_surges_8x1",
      "cyc_gran_fondo_sim",
      "long_z2_105",
    ],
    tagsAny: ["endurance", "z2", "long", "gran_fondo", "embedded", "xc_ski", "trail"],
  },
  base_z3_sweet: {
    presetIds: ["sweet_spot_2x20", "sweet_spot_3x12", "cyc_sweetspot_tier_3x15", "tempo_z3_2x12", "tempo_2x15_z3", "w4_sweet_2x18"],
    tagsAny: ["sweet_spot", "tempo", "z3", "cruise"],
  },
  base_torque_z3_neuro: {
    presetIds: ["force_4x8", "cyc_climb_force_5x6", "over_under_norwegian", "cyc_over_under_i3", "climbing_blocks"],
    tagsAny: ["force", "over_under", "climbing"],
  },
  base_threshold_intro: {
    presetIds: ["norwegian_5x3_z4", "threshold_3x12", "lactate_6x5_z4", "cyc_ramp_lt2_25"],
    tagsAny: ["norwegian", "threshold", "lactate", "ramp"],
  },
  build_z3_glycolytic_long: {
    presetIds: ["tempo_2x15_z3", "cyc_cruise_3x12", "z2_z3_progressive_90", "sweet_spot_3x12"],
    tagsAny: ["tempo", "cruise", "z3", "progressive"],
  },
  build_norwegian_z4: {
    presetIds: [
      "cyc_norwegian_tier_4x4",
      "cyc_norwegian_5x5_z4",
      "norwegian_2x4x4",
      "cyc_4x8_ftp",
      "cyc_tte_2x16",
      "cyc_lactate_2x20_deep",
      "w4_threshold_5x4",
      "cyc_w4_ftp_blocks_2x20",
    ],
    tagsAny: ["norwegian", "z4", "lactate", "ftp", "tte", "ladder"],
  },
  build_vo2_interval: {
    presetIds: [
      "cyc_vo2_tiered_5x5",
      "cyc_threshold_vo2_combo",
      "cyc_vo2_40_20_x10",
      "cyc_crit_sim",
      "vo2_5x5",
      "vo2_4x4",
      "interval_30_30_x20",
      "w4_vo2_double_tier",
      "cyc_w4_vo3max_6x3",
      "w4_micro_30_30_24",
    ],
    tagsAny: ["vo2", "intervals", "tier", "crit", "40-20", "30-30"],
  },
  build_lactate_z6_dense: {
    presetIds: [
      "cyc_billat_progression",
      "cyc_micro_bursts_20x30",
      "hit_tabata",
      "hit_40_20_x8",
      "anaerobic_8x45",
    ],
    tagsAny: ["hit", "billat", "anaerobic", "tabata", "micro"],
  },
  refine_polarized_z2: {
    presetIds: ["polarized_90", "cyc_polarized_split", "polarized_120", "w4_polarized_insert"],
    tagsAny: ["polarized"],
  },
  refine_vo2_z5: {
    presetIds: ["cyc_vo2_tiered_5x5", "vo2_5x5", "vo2_4x4", "interval_30_30_x20"],
    tagsAny: ["vo2"],
  },
  refine_sprint_z6_z7: {
    presetIds: ["sprint_6x30", "sprint_10x15", "neuromuscular_sprints", "cyc_sprint_leadout"],
    tagsAny: ["sprint", "neuromuscular"],
  },
  refine_lactate_max: {
    presetIds: ["cyc_descending_5_4_3_2_1", "lactate_2x15_z4", "cyc_mixed_quality_day"],
    tagsAny: ["lactate", "descending", "mixed"],
  },
  peak_openers_z2: {
    presetIds: ["race_openers_60", "cyc_ramp_openers", "endurance_pickups"],
    tagsAny: ["openers", "race", "ramp"],
  },
  peak_vo2_z6: {
    presetIds: ["vo2_4x4", "cyc_vo2_tiered_5x5", "vo2_5x3", "interval_20_40_x12"],
    tagsAny: ["vo2"],
  },
  peak_sprint_touch: {
    presetIds: ["sprint_6x30", "neuromuscular_sprints", "cyc_sprint_leadout"],
    tagsAny: ["sprint"],
  },
  peak_lactate_race_pace: {
    presetIds: ["tt_2x20", "tt_40k_sim", "run_marathon_pace", "threshold_2x20_ftp"],
    tagsAny: ["time_trial", "marathon", "threshold", "tt"],
  },
  deload_spin_z1_z2: {
    presetIds: ["recovery_45_z1", "xcs_deload_z1", "trl_deload_z1_z2", "active_recovery_30"],
    tagsAny: ["recovery", "deload"],
  },
  deload_endurance_flush: {
    presetIds: ["recovery_60_z1", "endurance_z2_75", "active_recovery_30"],
    tagsAny: ["recovery", "endurance"],
  },
  deload_connective: {
    presetIds: ["recovery_45_z1", "active_recovery_30"],
    tagsAny: ["recovery"],
  },
  deload_active_rest: {
    presetIds: ["active_recovery_30", "recovery_45_z1"],
    tagsAny: ["recovery", "micro"],
  },
  goal_override_recovery: {
    presetIds: ["recovery_45_z1", "recovery_60_z1", "active_recovery_30"],
    tagsAny: ["recovery"],
  },
  goal_override_vo2: {
    presetIds: ["cyc_vo2_tiered_5x5", "vo2_5x5", "vo2_4x4"],
    tagsAny: ["vo2"],
  },
  goal_override_threshold: {
    presetIds: ["norwegian_2x4x4", "cyc_norwegian_tier_4x4", "threshold_2x20_ftp"],
    tagsAny: ["norwegian", "threshold"],
  },
};

function expandPresetIdCandidates(baseId: string, catalogDiscipline: string): string[] {
  const slug = catalogDisciplineSlug(catalogDiscipline);
  const ids = new Set<string>([baseId, `${slug}_${baseId}`]);
  if (baseId.startsWith(`${slug}_`)) ids.add(baseId.slice(slug.length + 1));
  return [...ids];
}

function presetMatchesDiscipline(preset: AerobicStarterPreset, catalogDiscipline: string): boolean {
  return preset.discipline === catalogDiscipline;
}

function scorePreset(preset: AerobicStarterPreset, rule: ViryaCatalogMatchRule, catalogDiscipline: string): number {
  if (!presetMatchesDiscipline(preset, catalogDiscipline)) return -1;

  let score = 0;
  const tags = new Set(preset.tags.map((t) => t.toLowerCase()));

  if (rule.excludeTags?.some((t) => tags.has(t.toLowerCase()))) return -1;

  if (rule.presetIds?.length) {
    const wanted = new Set<string>();
    for (const id of rule.presetIds) {
      for (const candidate of expandPresetIdCandidates(id, catalogDiscipline)) {
        wanted.add(candidate);
      }
    }
    if (wanted.has(preset.presetId)) score += 100;
  }

  if (rule.tagsAll?.length) {
    if (!rule.tagsAll.every((t) => tags.has(t.toLowerCase()))) return -1;
    score += rule.tagsAll.length * 8;
  }

  if (rule.tagsAny?.length) {
    const hits = rule.tagsAny.filter((t) => tags.has(t.toLowerCase())).length;
    if (hits === 0 && !(rule.presetIds?.length && score >= 100)) return -1;
    score += hits * 12;
  }

  return score;
}

function presetsByCatalogDiscipline(catalogDiscipline: string): AerobicStarterPreset[] {
  return AEROBIC_STARTER_PRESETS.filter((p) => presetMatchesDiscipline(p, catalogDiscipline));
}

/**
 * Sceglie un template catalogo per archetipo VIRYA + disciplina + slot settimanale (rotazione).
 */
export function resolveViryaCatalogPreset(input: {
  archetypeId: string;
  discipline: string;
  sessionIndexInWeek: number;
}): AerobicStarterPreset | null {
  const catalogDiscipline = viryaDisciplineToCatalogDiscipline(input.discipline);
  const rule =
    VIRYA_ARCHETYPE_CATALOG_MATCH[input.archetypeId] ??
    VIRYA_ARCHETYPE_CATALOG_MATCH.base_z2_volume;

  const pool = presetsByCatalogDiscipline(catalogDiscipline);
  if (!pool.length) return null;

  const ranked = pool
    .map((preset) => ({ preset, score: scorePreset(preset, rule, catalogDiscipline) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score || a.preset.presetId.localeCompare(b.preset.presetId));

  if (!ranked.length) {
    const fallback = pool[input.sessionIndexInWeek % pool.length];
    return fallback ?? null;
  }

  const topScore = ranked[0]!.score;
  const topTier = ranked.filter((r) => r.score >= topScore - 5);
  const pick = topTier[input.sessionIndexInWeek % topTier.length];
  return pick?.preset ?? ranked[0]!.preset;
}
