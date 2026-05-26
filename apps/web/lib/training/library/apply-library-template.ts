import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { contractToPlannedWorkoutRow } from "@/lib/training/library/contract-to-planned-row";
import {
  parseAndPreparePro2BuilderSessionContract,
  parsePro2BuilderSessionContract,
} from "@/lib/training/library/library-item-from-contract";
import { insertSinglePlannedWorkout } from "@/lib/training/planned/insert-planned-workout";
import type { CoachWorkoutLibraryItemRow } from "@/lib/training/library/coach-workout-library-types";
import { resolveLibraryApplyLoadScale } from "@/lib/training/library/resolve-library-apply-load-scale";
import { scaleLibraryContract } from "@/lib/training/library/scale-library-contract";
import { workoutArchetypeKeyFromContract } from "@/lib/training/library/workout-archetype-key";
import { insertAthleteArchetypeTrace } from "@/lib/training/library/athlete-workout-archetype-traces";

export async function loadCoachLibraryItem(
  db: SupabaseClient,
  coachUserId: string,
  itemId: string,
): Promise<CoachWorkoutLibraryItemRow | null> {
  const { data, error } = await db
    .from("coach_workout_library_items")
    .select("*")
    .eq("id", itemId.trim())
    .eq("coach_user_id", coachUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const contract = parsePro2BuilderSessionContract((data as CoachWorkoutLibraryItemRow).contract_json);
  if (!contract) throw new Error("invalid_library_contract");
  return { ...(data as CoachWorkoutLibraryItemRow), contract_json: contract };
}

export async function applyCoachLibraryTemplate(input: {
  db: SupabaseClient;
  coachUserId: string;
  itemId: string;
  athleteId: string;
  date: string;
  /** v1 default false — scaling twin/operational opt-in esplicito */
  applyScaling?: boolean;
  /** Anteprima modificata in UI (non persiste finché non si salva il template). */
  contractOverride?: Pro2BuilderSessionContract;
}): Promise<{
  plannedWorkoutId: string | null;
  contract: Pro2BuilderSessionContract;
  scalingHints?: string[];
  loadScalePct?: number;
}> {
  const item = await loadCoachLibraryItem(input.db, input.coachUserId, input.itemId);
  if (!item) throw new Error("library_item_not_found");

  const override = input.contractOverride
    ? parseAndPreparePro2BuilderSessionContract(input.contractOverride)
    : null;
  if (input.contractOverride && !override) {
    throw new Error("invalid_contract_override");
  }
  let contract = structuredClone(override ?? item.contract_json) as Pro2BuilderSessionContract;
  let scalingHints: string[] | undefined;
  let loadScalePct: number | undefined;

  if (input.applyScaling === true) {
    const archetypeKey = workoutArchetypeKeyFromContract(contract);
    const scaleResult = await resolveLibraryApplyLoadScale({
      db: input.db,
      athleteId: input.athleteId,
      date: input.date,
      archetypeKey,
    });
    contract = scaleLibraryContract(contract, scaleResult.loadScale);
    scalingHints = scaleResult.hints;
    loadScalePct = scaleResult.loadScalePct;
  }

  const row = contractToPlannedWorkoutRow({
    athleteId: input.athleteId,
    date: input.date,
    contract,
    libraryItemId: item.id,
  });
  const { id } = await insertSinglePlannedWorkout(input.db, row);

  if (id) {
    try {
      const archetypeKey = workoutArchetypeKeyFromContract(contract);
      await insertAthleteArchetypeTrace(input.db, {
        athleteId: input.athleteId,
        libraryItemId: item.id,
        plannedWorkoutId: id,
        archetypeKey,
        plannedTss: row.tss_target,
        executedTss: 0,
        source: "library_apply",
        metadata: {
          family: contract.family,
          applyScaling: input.applyScaling === true,
          loadScalePct: loadScalePct ?? 100,
        },
      });
    } catch {
      // best-effort — apply non deve fallire per trace write
    }
  }

  return {
    plannedWorkoutId: id,
    contract,
    scalingHints,
    loadScalePct,
  };
}
