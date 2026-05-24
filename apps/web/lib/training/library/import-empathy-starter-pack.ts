import type { SupabaseClient } from "@supabase/supabase-js";
import { denormalizedFieldsFromContract } from "@/lib/training/library/library-item-from-contract";
import {
  EMPATHY_AEROBIC_STARTER_FOLDER_NAME,
  EMPATHY_AEROBIC_STARTER_PACK_ID,
  empathyAerobicStarterContracts,
} from "@/lib/training/library/starter-pack-aerobic";

export type ImportStarterPackResult = {
  folderId: string | null;
  imported: number;
  updated: number;
  skipped: number;
  total: number;
};

async function findExistingItemByPresetId(
  db: SupabaseClient,
  coachUserId: string,
  presetId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await db
    .from("coach_workout_library_items")
    .select("id")
    .eq("coach_user_id", coachUserId)
    .contains("metadata", { starterPack: EMPATHY_AEROBIC_STARTER_PACK_ID, presetId })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id != null ? { id: String(data.id) } : null;
}

async function ensureStarterFolder(
  db: SupabaseClient,
  coachUserId: string,
  orgId: string,
): Promise<string | null> {
  const { data: existing } = await db
    .from("coach_workout_library_folders")
    .select("id")
    .eq("coach_user_id", coachUserId)
    .eq("name", EMPATHY_AEROBIC_STARTER_FOLDER_NAME)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return String(existing.id);

  const { data, error } = await db
    .from("coach_workout_library_folders")
    .insert({
      org_id: orgId,
      coach_user_id: coachUserId,
      name: EMPATHY_AEROBIC_STARTER_FOLDER_NAME,
      sort_order: 0,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id != null ? String(data.id) : null;
}

async function existingPresetIds(
  db: SupabaseClient,
  coachUserId: string,
): Promise<Set<string>> {
  const { data, error } = await db
    .from("coach_workout_library_items")
    .select("metadata")
    .eq("coach_user_id", coachUserId)
    .contains("metadata", { starterPack: EMPATHY_AEROBIC_STARTER_PACK_ID });
  if (error) throw new Error(error.message);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const meta = (row as { metadata?: Record<string, unknown> }).metadata;
    const presetId = typeof meta?.presetId === "string" ? meta.presetId : null;
    if (presetId) ids.add(presetId);
  }
  return ids;
}

/**
 * Import idempotente del pack Empathy aerobic nella libreria del coach.
 * Template già presenti (stesso presetId) vengono aggiornati (contratto + sessionInterpretation).
 */
export async function importEmpathyAerobicStarterPack(input: {
  db: SupabaseClient;
  coachUserId: string;
  orgId: string;
}): Promise<ImportStarterPackResult> {
  const folderId = await ensureStarterFolder(input.db, input.coachUserId, input.orgId);
  const have = await existingPresetIds(input.db, input.coachUserId);
  const templates = empathyAerobicStarterContracts();

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const { preset, contract } of templates) {
    const fields = denormalizedFieldsFromContract(contract);
    const metadata: Record<string, unknown> = {
      starterPack: EMPATHY_AEROBIC_STARTER_PACK_ID,
      presetId: preset.presetId,
      tags: preset.tags,
    };
    if (preset.viryaWeekObjective) {
      metadata.virya_week_objective = preset.viryaWeekObjective;
    }

    if (have.has(preset.presetId)) {
      const existing = await findExistingItemByPresetId(input.db, input.coachUserId, preset.presetId);
      if (!existing) {
        skipped += 1;
        continue;
      }
      const { error } = await input.db
        .from("coach_workout_library_items")
        .update({
          folder_id: folderId,
          title: preset.title,
          description: preset.description,
          family: fields.family,
          discipline: fields.discipline,
          sport_tags: fields.sportTags,
          duration_minutes: fields.durationMinutes,
          tss_target: fields.tssTarget,
          contract_json: contract,
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("coach_user_id", input.coachUserId);
      if (error) throw new Error(error.message);
      updated += 1;
      continue;
    }

    const { error } = await input.db.from("coach_workout_library_items").insert({
      org_id: input.orgId,
      coach_user_id: input.coachUserId,
      folder_id: folderId,
      title: preset.title,
      description: preset.description,
      family: fields.family,
      discipline: fields.discipline,
      sport_tags: fields.sportTags,
      duration_minutes: fields.durationMinutes,
      tss_target: fields.tssTarget,
      contract_json: contract,
      metadata,
    });
    if (error) throw new Error(error.message);
    have.add(preset.presetId);
    imported += 1;
  }

  return { folderId, imported, updated, skipped, total: templates.length };
}
