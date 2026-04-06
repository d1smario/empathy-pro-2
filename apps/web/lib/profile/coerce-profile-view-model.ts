import type { ProfileViewModel } from "@/api/profile/contracts";

/**
 * Normalizza la risposta `GET /api/profile` lato client (import dati profilo).
 * Evita crash se il payload è parziale o malformato.
 */
export function coerceProfileViewModel(raw: unknown, fallbackAthleteId: string): ProfileViewModel & { error?: string | null } {
  if (!raw || typeof raw !== "object") {
    return {
      athleteId: fallbackAthleteId,
      profile: null,
      physiology: null,
      physiologyState: null,
      athleteMemory: null,
      activity: { daysActive: 0, dayStreak: 0 },
      error: "Invalid profile response",
    };
  }
  const o = raw as Record<string, unknown>;
  const athleteId = typeof o.athleteId === "string" && o.athleteId.trim() ? o.athleteId.trim() : fallbackAthleteId;
  const activityRaw = o.activity;
  const daysActive =
    activityRaw && typeof activityRaw === "object" && typeof (activityRaw as { daysActive?: unknown }).daysActive === "number"
      ? Math.max(0, (activityRaw as { daysActive: number }).daysActive)
      : 0;
  const dayStreak =
    activityRaw && typeof activityRaw === "object" && typeof (activityRaw as { dayStreak?: unknown }).dayStreak === "number"
      ? Math.max(0, (activityRaw as { dayStreak: number }).dayStreak)
      : 0;

  return {
    athleteId,
    profile: o.profile === null || (typeof o.profile === "object" && !Array.isArray(o.profile)) ? (o.profile as ProfileViewModel["profile"]) : null,
    physiology:
      o.physiology === null || (typeof o.physiology === "object" && !Array.isArray(o.physiology))
        ? (o.physiology as ProfileViewModel["physiology"])
        : null,
    physiologyState: (o.physiologyState ?? null) as ProfileViewModel["physiologyState"],
    athleteMemory: (o.athleteMemory ?? null) as ProfileViewModel["athleteMemory"],
    physiologyCoverage: (o.physiologyCoverage ?? null) as ProfileViewModel["physiologyCoverage"],
    activity: { daysActive, dayStreak },
    error: typeof o.error === "string" ? o.error : null,
  };
}
