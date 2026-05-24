import type { SupabaseClient } from "@supabase/supabase-js";
import {
  denormalizedFieldsFromContract,
  parseAndPreparePro2BuilderSessionContract,
  parsePro2BuilderSessionContract,
} from "@/lib/training/library/library-item-from-contract";

export const VIRYA_LIBRARY_EXPORT_FOLDER_NAME = "VIRYA · settimane tipo";

export type ViryaWeekLibrarySessionInput = {
  title: string;
  description?: string;
  contract: unknown;
  weekdayOffset?: number;
  metadata?: Record<string, unknown>;
};

export type ImportViryaWeekToLibraryResult = {
  folderId: string | null;
  imported: number;
  weekStart: string;
};

async function ensureViryaExportFolder(
  db: SupabaseClient,
  coachUserId: string,
  orgId: string,
): Promise<string | null> {
  const { data: existing } = await db
    .from("coach_workout_library_folders")
    .select("id")
    .eq("coach_user_id", coachUserId)
    .eq("name", VIRYA_LIBRARY_EXPORT_FOLDER_NAME)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return String(existing.id);

  const { data, error } = await db
    .from("coach_workout_library_folders")
    .insert({
      org_id: orgId,
      coach_user_id: coachUserId,
      name: VIRYA_LIBRARY_EXPORT_FOLDER_NAME,
      sort_order: 1,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id != null ? String(data.id) : null;
}

/**
 * Importa N sedute materializzate da VIRYA nella libreria coach (export-only, no calendario).
 */
export async function importViryaWeekToCoachLibrary(input: {
  db: SupabaseClient;
  coachUserId: string;
  orgId: string;
  folderId?: string | null;
  weekStart: string;
  viryaPlanName?: string;
  viryaPlanTag?: string;
  viryaPhase?: string;
  viryaWeekNumber?: number;
  weekObjectives?: string[];
  sessions: ViryaWeekLibrarySessionInput[];
}): Promise<ImportViryaWeekToLibraryResult> {
  const weekStart = input.weekStart.trim();
  if (!weekStart) throw new Error("missing_week_start");
  if (!input.sessions.length) throw new Error("no_sessions");

  const folderId =
    input.folderId?.trim() ||
    (await ensureViryaExportFolder(input.db, input.coachUserId, input.orgId));

  const sharedMeta: Record<string, unknown> = {
    source: "virya_week_export",
    virya_week_start: weekStart,
  };
  if (input.viryaPlanName?.trim()) sharedMeta.virya_plan_name = input.viryaPlanName.trim().slice(0, 200);
  if (input.viryaPlanTag?.trim()) sharedMeta.virya_plan_tag = input.viryaPlanTag.trim().slice(0, 120);
  if (input.viryaPhase?.trim()) sharedMeta.virya_phase = input.viryaPhase.trim().slice(0, 40);
  if (typeof input.viryaWeekNumber === "number" && Number.isFinite(input.viryaWeekNumber)) {
    sharedMeta.virya_week_number = input.viryaWeekNumber;
  }
  if (input.weekObjectives?.length) {
    sharedMeta.virya_week_objectives = input.weekObjectives.slice(0, 8);
    sharedMeta.virya_week_objective = input.weekObjectives.slice(0, 4).join("+");
  }

  let imported = 0;
  for (const session of input.sessions) {
    const contract = parseAndPreparePro2BuilderSessionContract(session.contract);
    if (!contract) throw new Error("invalid_contract");

    const title = String(session.title ?? contract.sessionName ?? "Seduta VIRYA").trim().slice(0, 200);
    if (!title) throw new Error("missing_title");

    const fields = denormalizedFieldsFromContract(contract);
    const description = String(session.description ?? "").trim().slice(0, 2000);
    const metadata: Record<string, unknown> = {
      ...sharedMeta,
      ...(session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata)
        ? session.metadata
        : {}),
    };
    if (typeof session.weekdayOffset === "number" && Number.isFinite(session.weekdayOffset)) {
      metadata.weekday_offset = session.weekdayOffset;
    }

    const { error } = await input.db.from("coach_workout_library_items").insert({
      org_id: input.orgId,
      coach_user_id: input.coachUserId,
      folder_id: folderId,
      title,
      description,
      family: fields.family,
      discipline: fields.discipline,
      sport_tags: fields.sportTags,
      duration_minutes: fields.durationMinutes,
      tss_target: fields.tssTarget,
      contract_json: contract,
      metadata,
    });
    if (error) throw new Error(error.message);
    imported += 1;
  }

  return { folderId, imported, weekStart };
}
