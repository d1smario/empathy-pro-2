"use client";

import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";

export async function deleteExecutedWorkout(input: {
  id: string;
  athleteId: string;
  date?: string;
  importedFileName?: string;
}) {
  const params = new URLSearchParams({ id: input.id, athleteId: input.athleteId });
  if (input.date) params.set("date", input.date);
  if (input.importedFileName) params.set("importedFileName", input.importedFileName);

  const response = await fetch(`/api/training/executed?${params}`, {
    method: "DELETE",
    headers: await buildSupabaseAuthHeaders(),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Eliminazione eseguito non riuscita");
  }
  return payload as { status?: string; deletedCount?: number; deletedIds?: string[] };
}
