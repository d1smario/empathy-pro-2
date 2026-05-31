import type { AthleteMemory } from "@/lib/empathy/schemas/memory";
import { resolveBloodValuesFromHealth } from "@/lib/health/lab-marker-resolver";

export type BioDaySignalsLite = {
  diaryLoggedDays: number;
  hasBloodPanel: boolean;
  hasDiaryInWindow: boolean;
  /** 0–1 copertura assi bio day (lazy, no assembler completo). */
  coverageScore: number;
  suggestPeriChoBoost: boolean;
  rationale: string[];
};

/**
 * Segnali bio day leggeri da memoria già caricata — evita bioenergetic-day-assembler su ogni hit nutrition.
 */
export function deriveBioDaySignalsFromAthleteMemory(memory: AthleteMemory): BioDaySignalsLite {
  const diary = memory.nutrition?.diary ?? [];
  const diaryDates = new Set<string>();
  for (const row of diary) {
    const d = typeof row.date === "string" ? row.date.slice(0, 10) : typeof row.logged_at === "string" ? row.logged_at.slice(0, 10) : "";
    if (d) diaryDates.add(d);
  }
  const blood = resolveBloodValuesFromHealth(memory.health);
  const hasBloodPanel = blood != null && Object.keys(blood).length > 0;
  const diaryLoggedDays = diaryDates.size;
  const hasDiaryInWindow = diaryLoggedDays >= 2;

  let coverageScore = 0.2;
  if (hasDiaryInWindow) coverageScore += 0.35;
  if (hasBloodPanel) coverageScore += 0.25;
  if (memory.physiology) coverageScore += 0.12;
  if (memory.twin) coverageScore += 0.08;
  coverageScore = Math.min(1, coverageScore);

  const fuel = memory.twin?.glycogenStatus;
  const readiness = memory.twin?.readiness;
  const suggestPeriChoBoost =
    hasDiaryInWindow &&
    coverageScore >= 0.55 &&
    ((fuel != null && fuel < 48) || (readiness != null && readiness < 52));

  const rationale: string[] = [];
  if (suggestPeriChoBoost) {
    rationale.push(
      "Bio day lite: diario + segnali twin suggeriscono lieve incremento CHO peri (senza secondo assembler).",
    );
  }
  if (hasBloodPanel && !hasDiaryInWindow) {
    rationale.push("Bio day lite: panel lab presente ma diario scarso — copertura nutrizione parziale.");
  }

  return {
    diaryLoggedDays,
    hasBloodPanel,
    hasDiaryInWindow,
    coverageScore,
    suggestPeriChoBoost,
    rationale,
  };
}
