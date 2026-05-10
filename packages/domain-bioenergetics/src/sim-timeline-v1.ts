/** Evento timeline minimo per finestre pasto/seduta (compatibile con payload web). */
export type SimTimelineEventV1 = {
  ts: string;
  type: string;
  payload?: Record<string, unknown>;
};

export function hourFromIsoTs(ts: string): number | null {
  const m = ts.match(/T(\d{2}):/);
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null;
}

export function mealInhibitoryHours(timeline: readonly SimTimelineEventV1[]): Set<number> {
  const s = new Set<number>();
  for (const ev of timeline) {
    if (ev.type !== "meal") continue;
    const carbs = (ev.payload?.carbsG as number | undefined) ?? 0;
    if (typeof carbs !== "number" || carbs < 35) continue;
    const h = hourFromIsoTs(ev.ts);
    if (h == null) continue;
    s.add(h);
    s.add((h + 1) % 24);
  }
  return s;
}

export function activitySupportHours(timeline: readonly SimTimelineEventV1[]): Set<number> {
  const s = new Set<number>();
  for (const ev of timeline) {
    if (ev.type !== "executed_session" && ev.type !== "planned_session") continue;
    const h = hourFromIsoTs(ev.ts);
    if (h == null) continue;
    for (let d = -1; d <= 2; d += 1) s.add((h + d + 24) % 24);
  }
  return s;
}
