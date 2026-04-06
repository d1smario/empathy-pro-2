/**
 * Cache locale (localStorage) per rotazione amidi/proteine principali sulla settimana ISO.
 * I conteggi alimentano `weeklyStapleCounts` nel request del piano pasti deterministico.
 */

export type MealRotationWeekPayload = {
  v: 1;
  /** Data piano YYYY-MM-DD → chiavi staple (es. carb:pasta, prot:pollo) */
  byDate: Record<string, string[]>;
};

const STORAGE_PREFIX = "empathy:meal-rot:v1:";

/** Identificativo settimana ISO (anno + numero settimana), es. 2026-W13 */
export function isoWeekBucketId(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "invalid";
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1)).getTime();
  const weekNo = 1 + Math.round((firstThursday - yearStart) / 604800000);
  const y = target.getUTCFullYear();
  return `${y}-W${String(weekNo).padStart(2, "0")}`;
}

function storageKey(athleteId: string, weekId: string): string {
  return `${STORAGE_PREFIX}${athleteId}:${weekId}`;
}

export function readMealRotationWeekPayload(athleteId: string, weekId: string): MealRotationWeekPayload {
  if (typeof window === "undefined") return { v: 1, byDate: {} };
  try {
    const raw = window.localStorage.getItem(storageKey(athleteId, weekId));
    if (!raw) return { v: 1, byDate: {} };
    const j = JSON.parse(raw) as Partial<MealRotationWeekPayload>;
    if (j?.v !== 1 || !j.byDate || typeof j.byDate !== "object") return { v: 1, byDate: {} };
    return { v: 1, byDate: { ...j.byDate } };
  } catch {
    return { v: 1, byDate: {} };
  }
}

/** Somma occorrenze staple nella settimana, escludendo un giorno (es. oggi da rigenerare). */
export function aggregateStapleCountsForWeek(
  payload: MealRotationWeekPayload,
  excludePlanDate?: string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [date, staples] of Object.entries(payload.byDate)) {
    if (excludePlanDate && date === excludePlanDate) continue;
    if (!Array.isArray(staples)) continue;
    for (const s of staples) {
      const k = String(s).trim();
      if (!k || k.length > 80) continue;
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }
  return counts;
}

export function recordPlanDayStaples(
  athleteId: string,
  weekId: string,
  planDate: string,
  staples: string[],
): void {
  if (typeof window === "undefined" || !athleteId || !planDate) return;
  const key = storageKey(athleteId, weekId);
  const prev = readMealRotationWeekPayload(athleteId, weekId);
  prev.byDate[planDate] = [...new Set(staples.map((s) => String(s).trim()).filter(Boolean))];
  try {
    window.localStorage.setItem(key, JSON.stringify(prev));
  } catch {
    /* ignore quota */
  }
}
