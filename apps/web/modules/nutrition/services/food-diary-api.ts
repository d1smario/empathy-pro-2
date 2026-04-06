import type { FoodDiaryEntryViewModel, FoodDiaryListViewModel } from "@/api/nutrition/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";

export type FoodDiaryComplianceRow = {
  id: string;
  date: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
};

export async function fetchFoodDiary(input: {
  athleteId: string;
  from: string;
  to: string;
}): Promise<FoodDiaryListViewModel & { error?: string | null }> {
  const params = new URLSearchParams({
    athleteId: input.athleteId,
    from: input.from,
    to: input.to,
  });
  const res = await fetch(`/api/nutrition/diary?${params}`, {
    method: "GET",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
  });
  const payload = (await res.json().catch(() => ({}))) as FoodDiaryListViewModel & { error?: string };
  if (!res.ok) {
    return {
      athleteId: input.athleteId,
      from: input.from,
      to: input.to,
      entries: [],
      dayTotals: [],
      error: payload.error ?? "Caricamento diario fallito",
    };
  }
  return { ...payload, error: null };
}

export async function postFoodDiaryEntry(body: Record<string, unknown>): Promise<{
  entry?: FoodDiaryEntryViewModel;
  error?: string;
}> {
  const res = await fetch("/api/nutrition/diary", {
    method: "POST",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    entry?: FoodDiaryEntryViewModel;
    error?: string;
  };
  if (!res.ok) {
    return { error: payload.error ?? "Salvataggio voce fallito" };
  }
  return payload;
}

export async function deleteFoodDiaryEntry(input: { athleteId: string; id: string }): Promise<{
  ok?: boolean;
  error?: string;
}> {
  const params = new URLSearchParams({ athleteId: input.athleteId, id: input.id });
  const res = await fetch(`/api/nutrition/diary?${params}`, {
    method: "DELETE",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
  });
  const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok) {
    return { error: payload.error ?? "Eliminazione fallita" };
  }
  return { ok: true };
}

export function entriesToComplianceRows(entries: FoodDiaryEntryViewModel[]): FoodDiaryComplianceRow[] {
  return entries.map((e) => ({
    id: e.id,
    date: e.entryDate,
    kcal: e.kcal,
    carbs: e.carbsG,
    protein: e.proteinG,
    fat: e.fatG,
  }));
}
