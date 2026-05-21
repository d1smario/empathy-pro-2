import type { AdminAthleteActivityRollup } from "@/lib/admin/load-activity-rollups";

export type PlatformModuleId = "training" | "nutrition" | "health" | "integrations" | "bioenergetics";

/** Numero massimo moduli tracciati nel report (per score UI). */
export const PLATFORM_REPORT_MODULE_COUNT = 5;

export type PlatformReportKpis = {
  totalAuthUsers: number;
  signInLast30Days: number;
  profilesTotal: number;
  coachesTotal: number;
  coachesPending: number;
  coachesApproved: number;
  coachesSuspended: number;
  athletesWithProfile: number;
  privateAccounts: number;
  rosterLinks: number;
  stripePaidUsers: number;
  grantActiveUsers: number;
  lowEngagementAthletes: number;
};

export type PlatformModuleAdoption = {
  moduleId: PlatformModuleId;
  athletesActive: number;
  athletesTotal: number;
  pct: number;
};

export type PlatformCoachAthleteRow = {
  athleteId: string;
  email: string | null;
  displayName: string | null;
  modulesUsed: PlatformModuleId[];
  engagementScore: number;
};

export type PlatformCoachReportRow = {
  coachUserId: string;
  email: string | null;
  platformCoachStatus: string | null;
  athleteCount: number;
  athletes: PlatformCoachAthleteRow[];
};

/** Coach referenziato in `coach_athletes` (può non avere ruolo coach in app_user_profiles). */
export type PlatformLinkedCoach = {
  userId: string;
  email: string | null;
  role: "private" | "coach" | null;
  platformCoachStatus: string | null;
  /** true solo se role=coach e platform_coach_status=approved (console roster operativa). */
  coachConsoleOperational: boolean;
};

/** Account con atleti in roster ma profilo non allineato (causa tipica: coach 0 ma rosterLinks > 0). */
export type PlatformRosterOperatorRow = {
  coachUserId: string;
  email: string | null;
  role: "private" | "coach" | null;
  platformCoachStatus: string | null;
  athleteCount: number;
  issue: "missing_coach_role" | "coach_pending" | "coach_suspended";
};

export type PlatformAthleteReportRow = {
  athleteId: string;
  email: string | null;
  displayName: string | null;
  linkedCoachCount: number;
  linkedCoaches: PlatformLinkedCoach[];
  modulesUsed: PlatformModuleId[];
  engagementScore: number;
  rollup: AdminAthleteActivityRollup | null;
  accountEmail: string | null;
  lastSignInAt: string | null;
};

export type PlatformReport = {
  generatedAt: string;
  rollupsAvailable: boolean;
  kpis: PlatformReportKpis;
  moduleAdoption: PlatformModuleAdoption[];
  coaches: PlatformCoachReportRow[];
  /** Roster presente ma ruolo/stato coach non consente la console — da correggere in «Ruolo utente». */
  rosterOperatorsNeedingFix: PlatformRosterOperatorRow[];
  athletes: PlatformAthleteReportRow[];
};
