export type TrainingImportIntent = "auto" | "executed" | "planned";

export function normalizeTrainingImportIntent(raw: unknown): TrainingImportIntent {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "planned" || s === "plan") return "planned";
  if (s === "auto") return "auto";
  return "executed";
}
