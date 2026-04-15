/**
 * Origine dati **deterministica** per righe `planned_workouts` (non generativa).
 * Usata da `GET /api/training/planned-window` per tracciare demo SQL vs builder vs altro.
 */
export type PlannedWorkoutProvenance =
  | "demo_sql_mario"
  | "demo_sql_tagged"
  | "builder_pro2_engine"
  | "builder_session_contract"
  | "coach_program_file"
  | "manual_or_unknown";

export type PlannedWorkoutDbRowLike = {
  notes?: string | null;
  type?: string | null;
};

export function inferPlannedProvenance(row: PlannedWorkoutDbRowLike): PlannedWorkoutProvenance {
  const notes = String(row.notes ?? "");
  const n = notes.toLowerCase();
  const type = String(row.type ?? "").toLowerCase();

  if (n.includes("mario-rova-demo")) return "demo_sql_mario";
  if (n.includes("[demo_seed]") || n.includes("[demo_full]")) return "demo_sql_tagged";
  if (n.includes("[pro2_builder_engine]") || type.includes("pro2_builder")) return "builder_pro2_engine";
  if (n.includes("builder_session_json::")) return "builder_session_contract";
  if (n.includes("programmazione coach") || n.includes("coach program") || n.includes("import_planned"))
    return "coach_program_file";
  return "manual_or_unknown";
}

export function summarizeProvenanceCounts(rows: Array<{ provenance?: string }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = r.provenance ?? "manual_or_unknown";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Etichette corte per striscia calendario (solo lettura / diagnostica). */
const PROVENANCE_LABEL_IT: Record<string, string> = {
  demo_sql_mario: "Seed SQL (mario)",
  demo_sql_tagged: "Seed SQL [demo]",
  builder_pro2_engine: "Builder engine",
  builder_session_contract: "Builder (contract)",
  coach_program_file: "Import file coach",
  manual_or_unknown: "Manuale / altro",
};

export function formatPlannedProvenanceSummaryIt(
  summary: Partial<Record<string, number>> | null | undefined,
): string {
  if (!summary || Object.keys(summary).length === 0) return "nessun dato origine";
  const parts = Object.entries(summary)
    .filter(([, n]) => typeof n === "number" && n > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([k, n]) => `${PROVENANCE_LABEL_IT[k] ?? k}: ${n}`);
  return parts.length ? parts.join(" · ") : "nessun dato origine";
}
