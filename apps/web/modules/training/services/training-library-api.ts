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
  q?: string;
}): Promise<{ items: CoachWorkoutLibraryItemView[]; error?: string }> {
  const params = new URLSearchParams();
  if (input?.folderId) params.set("folderId", input.folderId);
  if (input?.family) params.set("family", input.family);
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
    error?: string;
  };
  if (!res.ok || json.ok !== true) return { items: [], error: json.error ?? "library_items_failed" };
  return { items: json.items ?? [] };
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

export async function applyCoachLibraryItem(input: {
  itemId: string;
  athleteId: string;
  date: string;
  applyScaling?: boolean;
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

export async function importEmpathyAerobicStarterPack(): Promise<{
  ok: boolean;
  imported?: number;
  skipped?: number;
  total?: number;
  error?: string;
}> {
  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch("/api/training/library/seed-starter-pack", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({ pack: "aerobic_v1" }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    imported?: number;
    skipped?: number;
    total?: number;
    error?: string;
  };
  if (!res.ok || json.ok !== true) return { ok: false, error: json.error ?? "library_seed_failed" };
  return { ok: true, imported: json.imported, skipped: json.skipped, total: json.total };
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
