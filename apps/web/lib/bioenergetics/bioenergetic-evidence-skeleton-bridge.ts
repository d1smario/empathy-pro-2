import type { BioenergeticAxisFluidEvidenceLinkV1 } from "@empathy/contracts";

/**
 * Profilo di match su `BioenergeticAxisFluidEvidenceLinkV1.axis.code` / `fluidProcess.code`
 * (seed `052_bioenergetic_evidence_axis_fluid_seed.sql`). Euristico educativo: estendere la mappa quando
 * il grafo skeleton o il banco DB crescono — un solo posto (roadmap 2.4).
 */
export type BioenergeticEvidenceSkeletonMatchProfileV1 = {
  axisCodes?: readonly string[];
  fluidCodes?: readonly string[];
};

/**
 * Etichette `nodeId` del report skeleton **e** `from`/`to` degli archi (v1) che compaiono nel grafo dichiarato.
 */
export const EVIDENCE_MATCH_BY_SKELETON_CONTEXT_V1: Readonly<
  Record<string, BioenergeticEvidenceSkeletonMatchProfileV1>
> = {
  sleep: { axisCodes: ["axis_hpa_cortisol"] },
  leptin_energy_balance: {
    axisCodes: ["axis_raas_aldosterone", "axis_natriuretic_anp_bnp"],
    fluidCodes: ["fluid_ecw_extracellular", "fluid_plasma_volume_shift"],
  },
  ghrelin: { axisCodes: ["axis_sympathoadrenal"], fluidCodes: ["fluid_gi_absorption"] },
  gh_pulse: { axisCodes: ["axis_sympathoadrenal", "axis_hpa_cortisol"] },
  insulin_demand: { fluidCodes: ["fluid_gi_absorption"], axisCodes: ["axis_adh_osmotic"] },
  lactate_glucose_shift: {
    axisCodes: ["axis_sympathoadrenal", "axis_autonomic_volume"],
    fluidCodes: ["fluid_transcapillary_shift", "fluid_sweat_electrolyte"],
  },
  cortisol_acth: { axisCodes: ["axis_hpa_cortisol", "axis_sympathoadrenal"] },
  fasting_interval: { axisCodes: ["axis_sympathoadrenal"] },
  meal_timing: { fluidCodes: ["fluid_gi_absorption"], axisCodes: ["axis_adh_osmotic"] },
  training_load: {
    axisCodes: ["axis_sympathoadrenal", "axis_autonomic_volume"],
    fluidCodes: ["fluid_sweat_electrolyte", "fluid_transcapillary_shift"],
  },
  stress_autonomic: { axisCodes: ["axis_sympathoadrenal", "axis_hpa_cortisol"] },
  igf1_lab: { axisCodes: ["axis_hpa_cortisol", "axis_natriuretic_anp_bnp"] },
} as const;

export function evidenceLinkMatchesSkeletonProfile(
  link: BioenergeticAxisFluidEvidenceLinkV1,
  profile: BioenergeticEvidenceSkeletonMatchProfileV1,
): boolean {
  const axisHit = profile.axisCodes?.includes(link.axis.code) ?? false;
  const fluidHit = profile.fluidCodes?.includes(link.fluidProcess.code) ?? false;
  return axisHit || fluidHit;
}

export function evidenceLinkCountForSkeletonNode(
  nodeId: string,
  links: readonly BioenergeticAxisFluidEvidenceLinkV1[],
): number {
  const profile = EVIDENCE_MATCH_BY_SKELETON_CONTEXT_V1[nodeId];
  if (!profile) return 0;
  let n = 0;
  for (const lk of links) {
    if (evidenceLinkMatchesSkeletonProfile(lk, profile)) n += 1;
  }
  return n;
}

/** Link distinti che toccano almeno uno dei due estremi dell'arco (dedup su `linkId`). */
export function evidenceLinkCountForSkeletonEdge(
  from: string,
  to: string,
  links: readonly BioenergeticAxisFluidEvidenceLinkV1[],
): number {
  const pf = EVIDENCE_MATCH_BY_SKELETON_CONTEXT_V1[from];
  const pt = EVIDENCE_MATCH_BY_SKELETON_CONTEXT_V1[to];
  const ids = new Set<string>();
  for (const lk of links) {
    if (pf && evidenceLinkMatchesSkeletonProfile(lk, pf)) ids.add(lk.linkId);
    if (pt && evidenceLinkMatchesSkeletonProfile(lk, pt)) ids.add(lk.linkId);
  }
  return ids.size;
}
