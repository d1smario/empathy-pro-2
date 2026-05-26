import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import type { CoachWorkoutLibraryItemView } from "@/lib/training/library/coach-workout-library-types";

export type LibraryFolderView = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

export async function fetchCoachLibraryFolders(): Promise<{ folders: LibraryFolderView[]; error?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  const res = await fetch("/api/training/library/folders", { headers, credentials: "same-origin", cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; folders?: LibraryFolderView[]; error?: string };
  if (!res.ok || json.ok !== true) return { folders: [], error: json.error ?? "library_folders_failed" };
  return { folders: json.folders ?? [] };
}

export async function fetchCoachLibraryItems(input?: {
  folderId?: string;
  family?: string;
  discipline?: string;
  tag?: string;
  viryaPhase?: string;
  minDuration?: number;
  maxDuration?: number;
  minTss?: number;
  maxTss?: number;
  q?: string;
}): Promise<{ items: CoachWorkoutLibraryItemView[]; total?: number; error?: string }> {
  const params = new URLSearchParams();
  if (input?.folderId) params.set("folderId", input.folderId);
  if (input?.family) params.set("family", input.family);
  if (input?.discipline) params.set("discipline", input.discipline);
  if (input?.tag) params.set("tag", input.tag);
  if (input?.viryaPhase) params.set("viryaPhase", input.viryaPhase);
  if (input?.minDuration != null) params.set("minDuration", String(input.minDuration));
  if (input?.maxDuration != null) params.set("maxDuration", String(input.maxDuration));
  if (input?.minTss != null) params.set("minTss", String(input.minTss));
  if (input?.maxTss != null) params.set("maxTss", String(input.maxTss));
  if (input?.q) params.set("q", input.q);
  const headers = await buildSupabaseAuthHeaders();
  const res = await fetch(`/api/training/library/items?${params.toString()}`, {
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    items?: CoachWorkoutLibraryItemView[];
    total?: number;
    error?: string;
  };
  if (!res.ok || json.ok !== true) return { items: [], error: json.error ?? "library_items_failed" };
  return { items: json.items ?? [], total: json.total };
}

export async function saveCoachLibraryItem(input: {
  title: string;
  description?: string;
  folderId?: string | null;
  contract: Pro2BuilderSessionContract;
  sourcePlannedWorkoutId?: string | null;
}): Promise<{ ok: boolean; item?: CoachWorkoutLibraryItemView; error?: string }> {
  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch("/api/training/library/items", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    item?: CoachWorkoutLibraryItemView;
    error?: string;
  };
  if (!res.ok || json.ok !== true) return { ok: false, error: json.error ?? "library_save_failed" };
  return { ok: true, item: json.item };
}

export async function updateCoachLibraryItem(input: {
  itemId: string;
  contract: Pro2BuilderSessionContract;
  title?: string;
}): Promise<{ ok: boolean; item?: CoachWorkoutLibraryItemView; error?: string }> {
  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`/api/training/library/items/${encodeURIComponent(input.itemId)}`, {
    method: "PATCH",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({
      contract: input.contract,
      ...(input.title != null ? { title: input.title } : {}),
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    item?: CoachWorkoutLibraryItemView;
    error?: string;
  };
  if (!res.ok || json.ok !== true) return { ok: false, error: json.error ?? "library_update_failed" };
  return { ok: true, item: json.item };
}

export async function applyCoachLibraryItem(input: {
  itemId: string;
  athleteId: string;
  date: string;
  applyScaling?: boolean;
  contract?: Pro2BuilderSessionContract;
}): Promise<{
  ok: boolean;
  plannedWorkoutId?: string | null;
  scalingHints?: string[];
  loadScalePct?: number;
  error?: string;
}> {
  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`/api/training/library/items/${encodeURIComponent(input.itemId)}/apply`, {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({
      athleteId: input.athleteId,
      date: input.date,
      applyScaling: input.applyScaling === true,
      ...(input.contract ? { contract: input.contract } : {}),
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    plannedWorkoutId?: string | null;
    scalingHints?: string[];
    loadScalePct?: number;
    error?: string;
  };
  if (!res.ok || json.ok !== true) return { ok: false, error: json.error ?? "library_apply_failed" };
  return {
    ok: true,
    plannedWorkoutId: json.plannedWorkoutId ?? null,
    scalingHints: json.scalingHints,
    loadScalePct: json.loadScalePct,
  };
}

export async function fetchCoachLibraryItemContract(
  itemId: string,
): Promise<{ ok: boolean; contract?: Pro2BuilderSessionContract; title?: string; error?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  const res = await fetch(`/api/training/library/items/${encodeURIComponent(itemId)}`, {
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    contract?: Pro2BuilderSessionContract;
    item?: { title?: string };
    error?: string;
  };
  if (!res.ok || json.ok !== true || !json.contract) {
    return { ok: false, error: json.error ?? "library_item_fetch_failed" };
  }
  return { ok: true, contract: json.contract, title: json.item?.title };
}

export async function importViryaWeekToLibrary(input: {
  weekStart: string;
  viryaPlanName?: string;
  viryaPlanTag?: string;
  viryaPhase?: string;
  viryaWeekNumber?: number;
  weekObjectives?: string[];
  sessions: Array<{
    title: string;
    description?: string;
    contract: Pro2BuilderSessionContract;
    weekdayOffset?: number;
  }>;
}): Promise<{ ok: boolean; imported?: number; folderId?: string | null; error?: string }> {
  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch("/api/training/library/import-from-virya-week", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    imported?: number;
    folderId?: string | null;
    error?: string;
  };
  if (!res.ok || json.ok !== true) return { ok: false, error: json.error ?? "virya_week_import_failed" };
  return { ok: true, imported: json.imported, folderId: json.folderId };
}

export async function importEmpathyAerobicStarterPack(): Promise<{
  ok: boolean;
  imported?: number;
  updated?: number;
  skipped?: number;
  total?: number;
  error?: string;
}> {
  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch("/api/training/library/seed-starter-pack", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({ pack: "catalog_v2" }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    imported?: number;
    updated?: number;
    skipped?: number;
    total?: number;
    error?: string;
  };
  if (!res.ok || json.ok !== true) return { ok: false, error: json.error ?? "library_seed_failed" };
  return { ok: true, imported: json.imported, updated: json.updated, skipped: json.skipped, total: json.total };
}

export async function clonePlannedWorkout(input: {
  sourceId: string;
  athleteId: string;
  date: string;
}): Promise<{ ok: boolean; plannedWorkoutId?: string | null; error?: string }> {
  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch("/api/training/planned/clone", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    plannedWorkoutId?: string | null;
    error?: string;
  };
  if (!res.ok || json.ok !== true) return { ok: false, error: json.error ?? "planned_clone_failed" };
  return { ok: true, plannedWorkoutId: json.plannedWorkoutId ?? null };
}
