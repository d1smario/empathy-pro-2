import type { ViryaCalendarPlanSummary } from "@/modules/training/services/training-planned-api";

const STORAGE_PREFIX = "empathy_active_virya_plan_tag_";

export function readActiveViryaPlanTag(athleteId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(`${STORAGE_PREFIX}${athleteId.trim()}`);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

export function writeActiveViryaPlanTag(athleteId: string, tag: string | null): void {
  if (typeof window === "undefined") return;
  const key = `${STORAGE_PREFIX}${athleteId.trim()}`;
  try {
    if (!tag?.trim()) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, tag.trim());
  } catch {
    /* ignore quota */
  }
}

export { extractViryaTagFromPlannedNotes as extractViryaTagFromNotes } from "@/lib/training/virya/virya-planned-notes";

/** Piano VIRYA da mostrare come “attivo” (preferenza utente → giorno selezionato → più recente). */
export function resolveDefaultActiveViryaPlan(
  plans: ViryaCalendarPlanSummary[],
  selectedDate: string,
  persistedTag: string | null,
): ViryaCalendarPlanSummary | null {
  if (!plans.length) return null;
  if (persistedTag) {
    const hit = plans.find((p) => p.tag === persistedTag);
    if (hit) return hit;
  }
  const onDay = plans.filter((p) => selectedDate >= p.dateMin && selectedDate <= p.dateMax);
  if (onDay.length) {
    return [...onDay].sort((a, b) => b.sessionCount - a.sessionCount)[0]!;
  }
  return plans[0] ?? null;
}

export function inferViryaPlanFamilyLabel(planName: string): string {
  const n = planName.toLowerCase();
  if (n.includes("gym") || n.includes("forza") || n.includes("palestra")) return "Gym";
  if (n.includes("lifestyle")) return "Lifestyle";
  if (n.includes("tecnic")) return "Tecnico";
  if (n.includes("run") || n.includes("corsa")) return "Running";
  if (n.includes("bike") || n.includes("cicl") || n.includes("road")) return "Ciclismo";
  if (n.includes("swim") || n.includes("nuot")) return "Nuoto";
  return "Endurance";
}
