import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

export type CoachWorkoutLibraryFolderRow = {
  id: string;
  org_id: string;
  coach_user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type CoachWorkoutLibraryItemRow = {
  id: string;
  org_id: string;
  coach_user_id: string;
  folder_id: string | null;
  title: string;
  description: string;
  family: "aerobic" | "strength" | "technical" | "lifestyle";
  discipline: string;
  sport_tags: string[];
  duration_minutes: number;
  tss_target: number;
  contract_json: Pro2BuilderSessionContract;
  source_planned_workout_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CoachWorkoutLibraryItemView = {
  id: string;
  folderId: string | null;
  title: string;
  description: string;
  family: CoachWorkoutLibraryItemRow["family"];
  discipline: string;
  sportTags: string[];
  durationMinutes: number;
  tssTarget: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export function mapLibraryItemRow(row: CoachWorkoutLibraryItemRow): CoachWorkoutLibraryItemView {
  return {
    id: row.id,
    folderId: row.folder_id,
    title: row.title,
    description: row.description,
    family: row.family,
    discipline: row.discipline,
    sportTags: row.sport_tags ?? [],
    durationMinutes: row.duration_minutes,
    tssTarget: row.tss_target,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
