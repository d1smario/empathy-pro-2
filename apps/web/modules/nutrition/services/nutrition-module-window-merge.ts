/** Merge planned/executed rows by id (background window expansion). */
export function mergeNutritionTrainingRowsById<T extends { id: string; date?: string | null }>(
  prev: T[],
  next: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const row of prev) byId.set(String(row.id), row);
  for (const row of next) byId.set(String(row.id), row);
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
