import "server-only";

import type { Pro2RenderProfile } from "@/lib/training/builder/pro2-session-contract";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";
import { isUsableAthleteFtpWatts } from "@/lib/training/physiology/resolve-athlete-ftp-watts";

const DEFAULT_IMPORT_RENDER_PROFILE: Pro2RenderProfile = {
  intensityUnit: "watt",
  ftpW: 250,
  hrMax: 190,
  lengthMode: "time",
  speedRefKmh: 35,
};

function isUsableHrMax(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 100 && value <= 240;
}

/**
 * Profilo render per import strutturato: FTP/FC max da memoria fisiologica atleta quando disponibili.
 */
export async function resolveImportRenderProfileForAthlete(athleteId: string): Promise<Pro2RenderProfile> {
  if (!athleteId.trim()) return { ...DEFAULT_IMPORT_RENDER_PROFILE };
  try {
    const mem = await resolveAthleteMemorySlice(athleteId, { slice: "training" });
    const phys = mem?.physiology?.physiologicalProfile;
    const recovery = mem?.physiology?.recoveryProfile;
    const performance = mem?.physiology?.performanceProfile;
    const ftp = phys?.ftpWatts;
    const hrMax = recovery?.maxHrBpm ?? performance?.maxHrBpm;
    return {
      ...DEFAULT_IMPORT_RENDER_PROFILE,
      ftpW: isUsableAthleteFtpWatts(ftp) ? Math.round(ftp) : DEFAULT_IMPORT_RENDER_PROFILE.ftpW,
      hrMax: isUsableHrMax(hrMax) ? Math.round(hrMax) : DEFAULT_IMPORT_RENDER_PROFILE.hrMax,
    };
  } catch {
    return { ...DEFAULT_IMPORT_RENDER_PROFILE };
  }
}
