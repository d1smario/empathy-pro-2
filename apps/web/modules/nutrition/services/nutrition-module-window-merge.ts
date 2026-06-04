type RowWithOptionalBuilderSession = {
  id: string;
  date?: string | null;
  builderSession?: unknown;
};

/** Merge planned/executed rows by id (background window expansion). */
export function mergeNutritionTrainingRowsById<T extends RowWithOptionalBuilderSession>(
  prev: T[],
  next: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const row of prev) byId.set(String(row.id), row);
  for (const row of next) {
    const id = String(row.id);
    const existing = byId.get(id);
    const prevBs = existing && "builderSession" in existing ? existing.builderSession : undefined;
    const nextBs = "builderSession" in row ? row.builderSession : undefined;
    if (existing && prevBs && !nextBs) {
      byId.set(id, { ...row, builderSession: prevBs } as T);
    } else {
      byId.set(id, row);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const da = String(a.date ?? "").slice(0, 10);
    const db = String(b.date ?? "").slice(0, 10);
    return da.localeCompare(db) || String(a.id).localeCompare(String(b.id));
  });
}

export function nutritionModuleWindowKeys(
  daysBack: number,
  daysForward: number,
  anchor = new Date(),
): { from: string; to: string } {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12, 0, 0);
  const end = new Date(start);
  start.setDate(start.getDate() - daysBack);
  end.setDate(end.getDate() + daysForward);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(start), to: fmt(end) };
}
