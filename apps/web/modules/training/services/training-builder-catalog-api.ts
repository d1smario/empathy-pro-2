export type BuilderCatalogExerciseRow = {
  id: string;
  name: string;
  muscleGroup: string;
  catalogCategory: string;
  primaryDistrict: string;
  equipmentClass: string;
  exerciseKind: string;
  equipment: string;
  difficulty: string;
  mediaUrl: string;
  movementPattern: string;
  sportTags: string[];
};

export async function fetchUnifiedBuilderExercises(input: {
  sportTag: string;
  muscle?: string;
  limit?: number;
}): Promise<{ rows: BuilderCatalogExerciseRow[]; error?: string | null }> {
  const params = new URLSearchParams();
  params.set("sportTag", input.sportTag);
  if (input.muscle) params.set("muscle", input.muscle);
  if (input.limit != null) params.set("limit", String(input.limit));
  const res = await fetch(`/api/training/builder/unified-exercises?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return { rows: [], error: j.error ?? "Catalogo non disponibile" };
  }
  const payload = (await res.json()) as { rows?: BuilderCatalogExerciseRow[]; error?: string | null };
  return { rows: payload.rows ?? [], error: payload.error ?? null };
}
