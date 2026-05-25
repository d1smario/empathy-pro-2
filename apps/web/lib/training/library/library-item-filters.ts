import type { CoachWorkoutLibraryItemRow } from "@/lib/training/library/coach-workout-library-types";

export const LIBRARY_FAMILY_OPTIONS = [
  { value: "", label: "Tutte le famiglie" },
  { value: "aerobic", label: "Aerobico" },
  { value: "strength", label: "Forza / gym" },
  { value: "technical", label: "Tecnico" },
  { value: "lifestyle", label: "Lifestyle" },
] as const;

export const LIBRARY_DISCIPLINE_OPTIONS = [
  { value: "", label: "Tutte le discipline" },
  { value: "Cycling", label: "Ciclismo" },
  { value: "Running", label: "Running" },
  { value: "Swimming", label: "Nuoto" },
  { value: "Canoe", label: "Canoa / kayak" },
  { value: "XC Ski", label: "Sci di fondo / XC" },
  { value: "Trail Running", label: "Trail / skyrunning" },
  { value: "Gym", label: "Gym" },
] as const;

/** Tag metodologici (metadata.tags + match su title/description). */
export const LIBRARY_METHODOLOGY_TAG_OPTIONS = [
  { value: "", label: "Tutte le metodologie" },
  { value: "z2", label: "Z2 · endurance" },
  { value: "z3", label: "Z3 · tempo / sweet spot" },
  { value: "z4", label: "Z4 · soglia" },
  { value: "vo2", label: "VO₂" },
  { value: "norwegian", label: "Norvegese" },
  { value: "polarized", label: "Polarizzato" },
  { value: "lactate", label: "Lattacido" },
  { value: "anaerobic", label: "Anaerobico" },
  { value: "hit", label: "HIT" },
  { value: "hypoxic", label: "Ipossico (sim)" },
  { value: "heat", label: "Caldo / temperatura" },
  { value: "time_trial", label: "Time trial" },
  { value: "sprint", label: "Sprint / neuromuscolare" },
  { value: "force", label: "Forza" },
  { value: "recovery", label: "Recupero" },
  { value: "30-30", label: "30″/30″" },
  { value: "20-40", label: "20″/40″" },
  { value: "xc_ski", label: "XC ski / nordico" },
  { value: "trail", label: "Trail / verticale" },
  { value: "double_pole", label: "Double pole" },
  { value: "vertical", label: "Vertical / D+" },
  { value: "skyrunning", label: "Skyrunning" },
  { value: "pyramid", label: "Piramide" },
  { value: "tier", label: "Tier / multi-blocco" },
] as const;

export const LIBRARY_VIRYA_PHASE_OPTIONS = [
  { value: "", label: "Tutte le fasi VIRYA" },
  { value: "base", label: "Base" },
  { value: "build", label: "Costruzione" },
  { value: "refine", label: "Rifinitura" },
  { value: "peak", label: "Forma" },
  { value: "deload", label: "Scarico" },
  { value: "second_peak", label: "Secondo picco" },
] as const;

export type LibraryItemFilterQuery = {
  q?: string;
  family?: string;
  discipline?: string;
  tag?: string;
  viryaPhase?: string;
  minDuration?: number;
  maxDuration?: number;
  minTss?: number;
  maxTss?: number;
};

function metaTags(meta: Record<string, unknown>): string[] {
  const raw = meta.tags;
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase());
}

function rowHaystack(row: CoachWorkoutLibraryItemRow): string {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const tags = metaTags(meta);
  const objective =
    typeof meta.virya_week_objective === "string" ? meta.virya_week_objective.toLowerCase() : "";
  const phase = typeof meta.virya_phase === "string" ? meta.virya_phase.toLowerCase() : "";
  return [
    row.title,
    row.description ?? "",
    row.discipline,
    ...(row.sport_tags ?? []),
    ...tags,
    objective,
    phase,
  ]
    .join(" ")
    .toLowerCase();
}

export function libraryRowMatchesTag(row: CoachWorkoutLibraryItemRow, tag: string): boolean {
  const needle = tag.trim().toLowerCase();
  if (!needle) return true;

  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const tags = metaTags(meta);
  if (tags.some((t) => t === needle || t.includes(needle))) return true;

  const hay = rowHaystack(row);
  if (hay.includes(needle)) return true;

  // Alias utili per filtri UI
  if (needle === "z3" && (hay.includes("sweet_spot") || hay.includes("tempo"))) return true;
  if (needle === "z4" && (hay.includes("threshold") || hay.includes("ftp") || hay.includes("soglia"))) return true;
  if (needle === "sprint" && (hay.includes("neuromuscular") || hay.includes("sprinter"))) return true;
  if (needle === "force" && (hay.includes("strength") || hay.includes("climbing") || hay.includes("hill"))) return true;
  if (needle === "heat" && hay.includes("temperature")) return true;
  if (needle === "trail" && (hay.includes("trail") || hay.includes("vertical") || hay.includes("skyrunning"))) return true;
  if (needle === "xc_ski" && (hay.includes("xc_ski") || hay.includes("nordic") || hay.includes("double_pole"))) return true;
  if (needle === "vertical" && (hay.includes("vertical") || hay.includes("d+") || hay.includes("uphill"))) return true;

  return false;
}

export function libraryRowMatchesViryaPhase(row: CoachWorkoutLibraryItemRow, viryaPhase: string): boolean {
  const phase = viryaPhase.trim().toLowerCase();
  if (!phase) return true;
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const rowPhase = typeof meta.virya_phase === "string" ? meta.virya_phase.toLowerCase() : "";
  const objective = typeof meta.virya_week_objective === "string" ? meta.virya_week_objective.toLowerCase() : "";
  return rowPhase === phase || objective.includes(phase);
}

export function filterCoachLibraryItemRows(
  rows: CoachWorkoutLibraryItemRow[],
  query: LibraryItemFilterQuery,
): CoachWorkoutLibraryItemRow[] {
  const q = query.q?.trim().toLowerCase() ?? "";
  const family = query.family?.trim() ?? "";
  const discipline = query.discipline?.trim() ?? "";
  const tag = query.tag?.trim() ?? "";
  const viryaPhase = query.viryaPhase?.trim() ?? "";

  return rows.filter((row) => {
    if (family && row.family !== family) return false;
    if (discipline && row.discipline.toLowerCase() !== discipline.toLowerCase()) return false;
    if (!libraryRowMatchesTag(row, tag)) return false;
    if (!libraryRowMatchesViryaPhase(row, viryaPhase)) return false;
    if (query.minDuration != null && row.duration_minutes < query.minDuration) return false;
    if (query.maxDuration != null && row.duration_minutes > query.maxDuration) return false;
    if (query.minTss != null && row.tss_target < query.minTss) return false;
    if (query.maxTss != null && row.tss_target > query.maxTss) return false;
    if (q) {
      const hay = rowHaystack(row);
      if (!hay.includes(q) && !row.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}
