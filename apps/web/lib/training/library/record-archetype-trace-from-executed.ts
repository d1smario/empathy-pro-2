import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import {
  insertAthleteArchetypeTrace,
} from "@/lib/training/library/athlete-workout-archetype-traces";
import { workoutArchetypeKeyFromContract } from "@/lib/training/library/workout-archetype-key";

const LIBRARY_META_PREFIX = "[PRO2_BUILDER_LIBRARY]";

function parseLibraryMetaFromNotes(notes: string | null | undefined): {
  libraryItemId: string | null;
  family: string | null;
} {
  if (!notes) return { libraryItemId: null, family: null };
  const firstLine = notes.split("\n")[0]?.trim() ?? "";
  if (!firstLine.startsWith(LIBRARY_META_PREFIX)) {
    return { libraryItemId: null, family: null };
  }
  try {
    const meta = JSON.parse(firstLine.slice(LIBRARY_META_PREFIX.length)) as {
      libraryItemId?: string;
      family?: string;
    };
    return {
      libraryItemId: typeof meta.libraryItemId === "string" ? meta.libraryItemId : null,
      family: typeof meta.family === "string" ? meta.family : null,
    };
  } catch {
    return { libraryItemId: null, family: null };
  }
}

/**
 * Best-effort: confronto planned vs executed → traccia archetype in memoria atleta.
 * Failure non blocca ingest executed.
 */
export async function recordArchetypeTraceFromExecuted(input: {
  db: SupabaseClient;
  athleteId: string;
  plannedWorkoutId: string;
  executedWorkoutId: string;
  executedTss: number;
  observedAt?: string;
}): Promise<{ id: string; archetypeKey: string } | null> {
  const { data: planned, error } = await input.db
    .from("planned_workouts")
    .select("id, athlete_id, tss_target, notes")
    .eq("id", input.plannedWorkoutId.trim())
    .eq("athlete_id", input.athleteId.trim())
    .maybeSingle();
  if (error || !planned) return null;

  const notes = (planned as { notes?: string | null }).notes;
  const contract = parsePro2BuilderSessionFromNotes(notes);
  if (!contract) return null;

  const archetypeKey = workoutArchetypeKeyFromContract(contract);
  const libMeta = parseLibraryMetaFromNotes(notes);
  const plannedTss = Math.max(0, Number((planned as { tss_target?: number }).tss_target ?? contract.summary?.tss ?? 0));

  const id = await insertAthleteArchetypeTrace(input.db, {
    athleteId: input.athleteId,
    libraryItemId: libMeta.libraryItemId,
    plannedWorkoutId: input.plannedWorkoutId,
    executedWorkoutId: input.executedWorkoutId,
    archetypeKey,
    plannedTss,
    executedTss: Math.max(0, input.executedTss),
    source: "planned_vs_executed",
    observedAt: input.observedAt,
    metadata: {
      family: libMeta.family ?? contract.family,
      discipline: contract.discipline ?? "",
    },
  });
  if (!id) return null;

  return { id, archetypeKey };
}
