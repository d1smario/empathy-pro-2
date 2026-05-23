import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingRelationError } from "@/lib/supabase/missing-relation-error";

export type AthleteWorkoutArchetypeTraceRow = {
  id: string;
  athlete_id: string;
  library_item_id: string | null;
  planned_workout_id: string | null;
  executed_workout_id: string | null;
  archetype_key: string;
  planned_tss: number;
  executed_tss: number;
  adherence_pct: number;
  response_signal: "positive" | "neutral" | "negative";
  source: "planned_vs_executed" | "library_apply";
  observed_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AthleteWorkoutArchetypeTraceView = {
  id: string;
  athleteId: string;
  libraryItemId: string | null;
  plannedWorkoutId: string | null;
  executedWorkoutId: string | null;
  archetypeKey: string;
  plannedTss: number;
  executedTss: number;
  adherencePct: number;
  responseSignal: AthleteWorkoutArchetypeTraceRow["response_signal"];
  source: AthleteWorkoutArchetypeTraceRow["source"];
  observedAt: string;
  metadata: Record<string, unknown>;
};

export function mapArchetypeTraceRow(row: AthleteWorkoutArchetypeTraceRow): AthleteWorkoutArchetypeTraceView {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    libraryItemId: row.library_item_id,
    plannedWorkoutId: row.planned_workout_id,
    executedWorkoutId: row.executed_workout_id,
    archetypeKey: row.archetype_key,
    plannedTss: row.planned_tss,
    executedTss: row.executed_tss,
    adherencePct: Number(row.adherence_pct),
    responseSignal: row.response_signal,
    source: row.source,
    observedAt: row.observed_at,
    metadata: row.metadata ?? {},
  };
}

export function adherencePctFromTss(plannedTss: number, executedTss: number): number {
  if (plannedTss <= 0) return executedTss > 0 ? 100 : 0;
  return Math.round((executedTss / plannedTss) * 1000) / 10;
}

export function responseSignalFromAdherence(adherencePct: number): AthleteWorkoutArchetypeTraceRow["response_signal"] {
  if (adherencePct >= 90) return "positive";
  if (adherencePct < 70) return "negative";
  return "neutral";
}

export async function loadAthleteArchetypeTraces(
  db: SupabaseClient,
  athleteId: string,
  limit = 24,
): Promise<AthleteWorkoutArchetypeTraceView[]> {
  const { data, error } = await db
    .from("athlete_workout_archetype_traces")
    .select("*")
    .eq("athlete_id", athleteId.trim())
    .order("observed_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as AthleteWorkoutArchetypeTraceRow[]).map(mapArchetypeTraceRow);
}

export async function loadArchetypeTracesForKey(
  db: SupabaseClient,
  athleteId: string,
  archetypeKey: string,
  limit = 8,
): Promise<AthleteWorkoutArchetypeTraceView[]> {
  const { data, error } = await db
    .from("athlete_workout_archetype_traces")
    .select("*")
    .eq("athlete_id", athleteId.trim())
    .eq("archetype_key", archetypeKey.trim())
    .order("observed_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as AthleteWorkoutArchetypeTraceRow[]).map(mapArchetypeTraceRow);
}

export async function insertAthleteArchetypeTrace(
  db: SupabaseClient,
  row: {
    athleteId: string;
    libraryItemId?: string | null;
    plannedWorkoutId?: string | null;
    executedWorkoutId?: string | null;
    archetypeKey: string;
    plannedTss: number;
    executedTss: number;
    source: AthleteWorkoutArchetypeTraceRow["source"];
    observedAt?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<string | null> {
  const adherencePct = adherencePctFromTss(row.plannedTss, row.executedTss);
  const { data, error } = await db
    .from("athlete_workout_archetype_traces")
    .insert({
      athlete_id: row.athleteId.trim(),
      library_item_id: row.libraryItemId?.trim() || null,
      planned_workout_id: row.plannedWorkoutId?.trim() || null,
      executed_workout_id: row.executedWorkoutId?.trim() || null,
      archetype_key: row.archetypeKey.trim(),
      planned_tss: Math.max(0, Math.min(999, Math.round(row.plannedTss))),
      executed_tss: Math.max(0, Math.min(999, Math.round(row.executedTss))),
      adherence_pct: adherencePct,
      response_signal: responseSignalFromAdherence(adherencePct),
      source: row.source,
      observed_at: row.observedAt ?? new Date().toISOString(),
      metadata: row.metadata ?? {},
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (isMissingRelationError(error)) return null;
    throw new Error(error.message);
  }
  return data?.id != null ? String(data.id) : null;
}

export function preferredTagsFromTraces(traces: AthleteWorkoutArchetypeTraceView[]): string[] {
  const tags = new Set<string>();
  for (const t of traces) {
    if (t.responseSignal === "positive") tags.add(`archetype:${t.archetypeKey.slice(0, 8)}`);
    const family = typeof t.metadata.family === "string" ? t.metadata.family : null;
    if (family) tags.add(family);
  }
  return [...tags].slice(0, 12);
}
