import type { AdminAthleteActivityRollup } from "@/lib/admin/load-activity-rollups";
import type { PlatformModuleId } from "@/lib/admin/platform-report-types";

export function modulesUsedFromRollup(
  r: AdminAthleteActivityRollup | null | undefined,
  timeSeriesSampleCount = 0,
): PlatformModuleId[] {
  if (!r && timeSeriesSampleCount <= 0) return [];
  const out: PlatformModuleId[] = [];
  const training =
    (r?.executedWorkoutsCount ?? 0) > 0 ||
    (r?.plannedWorkoutsCount ?? 0) > 0 ||
    (r?.trainingImportJobsCount ?? 0) > 0;
  const nutrition = (r?.foodDiaryEntriesCount ?? 0) > 0;
  const health = (r?.biomarkerPanelsCount ?? 0) > 0 || (r?.interpretationStagingRunsCount ?? 0) > 0;
  const integrations =
    r?.garminAthleteLinked ||
    (r?.deviceSyncExportsCount ?? 0) > 0 ||
    (r?.garminActivityBlobsCount ?? 0) > 0 ||
    (r?.garminPullJobsTotal ?? 0) > 0;
  const bioenergetics = timeSeriesSampleCount > 0 || (r?.interpretationStagingRunsCount ?? 0) > 0;
  if (training) out.push("training");
  if (nutrition) out.push("nutrition");
  if (health) out.push("health");
  if (integrations) out.push("integrations");
  if (bioenergetics) out.push("bioenergetics");
  return out;
}

export function engagementScoreFromModules(modules: PlatformModuleId[]): number {
  return modules.length;
}

export function computeModuleAdoption(
  athleteIds: string[],
  rollups: Map<string, AdminAthleteActivityRollup>,
  timeSeriesCounts: Map<string, number>,
): Array<{ moduleId: PlatformModuleId; athletesActive: number; athletesTotal: number; pct: number }> {
  const total = athleteIds.length;
  const counts: Record<PlatformModuleId, number> = {
    training: 0,
    nutrition: 0,
    health: 0,
    integrations: 0,
    bioenergetics: 0,
  };
  for (const aid of athleteIds) {
    const mods = modulesUsedFromRollup(rollups.get(aid), timeSeriesCounts.get(aid) ?? 0);
    for (const m of mods) counts[m] += 1;
  }
  return (Object.keys(counts) as PlatformModuleId[]).map((moduleId) => {
    const athletesActive = counts[moduleId];
    const pct = total > 0 ? Math.round((athletesActive / total) * 1000) / 10 : 0;
    return { moduleId, athletesActive, athletesTotal: total, pct };
  });
}
