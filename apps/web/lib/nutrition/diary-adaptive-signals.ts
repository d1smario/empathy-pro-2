import type { AthleteProfile, LifestyleActivityClass } from "@/lib/empathy/schemas";

export type DiaryAdaptiveSignals = {
  windowDays: number;
  loggedDays: number;
  avgDailyKcal: number | null;
  avgDailyProteinG: number | null;
  avgDailyCarbsG: number | null;
  estimatedMaintenanceKcal: number | null;
  energyAdequacyRatio: number | null;
  proteinGPerKg: number | null;
  carbsGPerKg: number | null;
  confidence: "none" | "low" | "moderate" | "high";
};

function isoDateAddDays(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ageYearsFromBirthDate(birthDate: string | undefined): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const b = new Date(`${birthDate}T12:00:00.000Z`);
  if (Number.isNaN(b.getTime())) return null;
  const diff = Date.now() - b.getTime();
  return Math.max(14, Math.min(90, Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))));
}

function activityFactor(cls: LifestyleActivityClass | undefined): number {
  switch (cls) {
    case "sedentary":
      return 1.25;
    case "moderate":
      return 1.55;
    case "active":
      return 1.72;
    case "very_active":
      return 1.9;
    default:
      return 1.55;
  }
}

/** Rough maintenance for modulation (not clinical prescription). */
export function estimateMaintenanceKcalFromProfile(profile: AthleteProfile | null): number | null {
  if (!profile) return null;
  const w = profile.weightKg;
  const h = profile.heightCm;
  const age = ageYearsFromBirthDate(profile.birthDate);
  const af = activityFactor(profile.lifestyleActivityClass);
  if (w && h && age != null && profile.sex && (profile.sex === "male" || profile.sex === "female")) {
    const base =
      profile.sex === "male"
        ? 10 * w + 6.25 * h - 5 * age + 5
        : 10 * w + 6.25 * h - 5 * age - 161;
    return Math.max(1200, Math.round(base * af));
  }
  if (w && w > 30) {
    return Math.max(1400, Math.round(w * 31 * af));
  }
  return null;
}

/**
 * Aggregates real food diary rows into signals for training↔nutrition adaptive dials.
 * `diaryEntries` are raw Supabase-shaped rows (snake_case).
 */
export function extractDiaryAdaptiveSignals(input: {
  profile: AthleteProfile | null;
  diaryEntries: Array<Record<string, unknown>>;
  windowDays?: number;
}): DiaryAdaptiveSignals | null {
  const windowDays = Math.max(3, Math.min(14, Math.trunc(input.windowDays ?? 7) || 7));
  const entries = input.diaryEntries ?? [];
  if (!entries.length) return null;

  const end = utcTodayIso();
  const start = isoDateAddDays(end, -(windowDays - 1));
  const allowed = new Set<string>();
  for (let i = 0; i < windowDays; i += 1) {
    allowed.add(isoDateAddDays(start, i));
  }

  const byDay = new Map<string, { kcal: number; proteinG: number; carbsG: number }>();
  for (const row of entries) {
    const d = typeof row.entry_date === "string" ? row.entry_date.slice(0, 10) : "";
    if (!d || !allowed.has(d)) continue;
    const kcal = Number(row.kcal);
    const proteinG = Number(row.protein_g);
    const carbsG = Number(row.carbs_g);
    if (!Number.isFinite(kcal) && !Number.isFinite(proteinG)) continue;
    const cur = byDay.get(d) ?? { kcal: 0, proteinG: 0, carbsG: 0 };
    cur.kcal += Number.isFinite(kcal) ? kcal : 0;
    cur.proteinG += Number.isFinite(proteinG) ? proteinG : 0;
    cur.carbsG += Number.isFinite(carbsG) ? carbsG : 0;
    byDay.set(d, cur);
  }

  const loggedDays = byDay.size;
  if (!loggedDays) return null;

  let sumK = 0;
  let sumP = 0;
  let sumC = 0;
  for (const t of byDay.values()) {
    sumK += t.kcal;
    sumP += t.proteinG;
    sumC += t.carbsG;
  }

  const avgDailyKcal = sumK / loggedDays;
  const avgDailyProteinG = sumP / loggedDays;
  const avgDailyCarbsG = sumC / loggedDays;

  const maintenance = estimateMaintenanceKcalFromProfile(input.profile);
  const energyAdequacyRatio =
    maintenance && maintenance > 0 && avgDailyKcal > 0 ? avgDailyKcal / maintenance : null;

  const wKg = input.profile?.weightKg;
  const proteinGPerKg =
    wKg && wKg > 35 && Number.isFinite(avgDailyProteinG) ? avgDailyProteinG / wKg : null;
  const carbsGPerKg =
    wKg && wKg > 35 && Number.isFinite(avgDailyCarbsG) ? avgDailyCarbsG / wKg : null;

  const confidence: DiaryAdaptiveSignals["confidence"] =
    loggedDays >= 6 ? "high" : loggedDays >= 4 ? "moderate" : loggedDays >= 2 ? "low" : "low";

  return {
    windowDays,
    loggedDays,
    avgDailyKcal: Math.round(avgDailyKcal * 10) / 10,
    avgDailyProteinG: Math.round(avgDailyProteinG * 10) / 10,
    avgDailyCarbsG: Math.round(avgDailyCarbsG * 10) / 10,
    estimatedMaintenanceKcal: maintenance,
    energyAdequacyRatio: energyAdequacyRatio != null ? Math.round(energyAdequacyRatio * 1000) / 1000 : null,
    proteinGPerKg: proteinGPerKg != null ? Math.round(proteinGPerKg * 100) / 100 : null,
    carbsGPerKg: carbsGPerKg != null ? Math.round(carbsGPerKg * 100) / 100 : null,
    confidence,
  };
}
