import type { AthleteMemory, PhysiologyState } from "../schemas";

export type ProfileViewModel = {
  athleteId: string;
  profile: Record<string, unknown> | null;
  physiology: Record<string, unknown> | null;
  physiologyState?: PhysiologyState | null;
  athleteMemory?: AthleteMemory | null;
  physiologyCoverage?: {
    physiologicalProfile: boolean;
    metabolicRun: boolean;
    lactateRun: boolean;
    performanceRun: boolean;
    biomarkerPanel: boolean;
  } | null;
  activity: {
    daysActive: number;
    dayStreak: number;
  };
};
