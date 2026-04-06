/** Deterministic physiology engines — V1 parity over time. */
import type { PhysiologicalProfile, PhysiologyState } from "@empathy/contracts";

export const DOMAIN = "@empathy/domain-physiology" as const;
export const DOMAIN_TITLE = "Physiology";
export const DOMAIN_SUMMARY =
  "Profilo fisiologico e stato computato (metabolic / lactate / performance) — PhysiologyState da @empathy/contracts.";

export type { PhysiologicalProfile, PhysiologyState };

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Riga `physiological_profiles` (subset lettura calendario/twin). */
export type PhysiologicalProfileDbRow = {
  id: string;
  athlete_id: string;
  ftp_watts?: number | string | null;
  cp_watts?: number | string | null;
  lt1_watts?: number | string | null;
  lt1_heart_rate?: number | string | null;
  lt2_watts?: number | string | null;
  lt2_heart_rate?: number | string | null;
  v_lamax?: number | string | null;
  vo2max_ml_min_kg?: number | string | null;
  economy?: number | string | null;
  baseline_hrv_ms?: number | string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  updated_at?: string | null;
};

export function physiologicalProfileFromDbRow(row: PhysiologicalProfileDbRow): PhysiologicalProfile {
  const vf = row.valid_from ? String(row.valid_from).slice(0, 10) : undefined;
  const vt = row.valid_to ? String(row.valid_to).slice(0, 10) : undefined;
  return {
    id: row.id,
    athleteId: row.athlete_id,
    ftpWatts: num(row.ftp_watts),
    cpWatts: num(row.cp_watts),
    lt1Watts: num(row.lt1_watts),
    lt1HeartRate: num(row.lt1_heart_rate),
    lt2Watts: num(row.lt2_watts),
    lt2HeartRate: num(row.lt2_heart_rate),
    vLamax: num(row.v_lamax),
    vo2maxMlMinKg: num(row.vo2max_ml_min_kg),
    economy: num(row.economy),
    baselineHrvMs: num(row.baseline_hrv_ms),
    validFrom: vf as PhysiologicalProfile["validFrom"],
    validTo: vt as PhysiologicalProfile["validTo"],
    updatedAt: row.updated_at ?? undefined,
  };
}

export function formatPhysiologicalProfileStrip(p: PhysiologicalProfile): string {
  const bits: string[] = [];
  if (p.ftpWatts != null) bits.push(`FTP ${Math.round(p.ftpWatts)} W`);
  if (p.cpWatts != null) bits.push(`CP ${Math.round(p.cpWatts)} W`);
  if (p.vo2maxMlMinKg != null) bits.push(`VO₂max ${p.vo2maxMlMinKg.toFixed(1)}`);
  return bits.join(" · ") || "Dati fisiologici collegati al profilo atleta.";
}

/** True se le fonti minime per twin/nutrition sono presenti (solo flag `sources`). */
export function isPhysiologyCoreSourcesPresent(state: PhysiologyState): boolean {
  const s = state.sources;
  return s.physiologicalProfile && s.metabolicRun && s.lactateRun;
}
