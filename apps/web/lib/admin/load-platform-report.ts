import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAdminAthleteActivityRollups } from "@/lib/admin/load-activity-rollups";
import { loadAdminAthleteTimeSeriesCounts } from "@/lib/admin/load-athlete-time-series-counts";
import {
  computeModuleAdoption,
  engagementScoreFromModules,
  modulesUsedFromRollup,
} from "@/lib/admin/platform-report-modules";
import type {
  PlatformAthleteReportRow,
  PlatformCoachReportRow,
  PlatformLinkedCoach,
  PlatformReport,
  PlatformRosterOperatorRow,
} from "@/lib/admin/platform-report-types";
import { listAllAuthUsers } from "@/lib/admin/list-all-auth-users";
import { loadAccessEntitlementsForUserIds } from "@/lib/billing/access-entitlement";

const ROLLUP_CHUNK = 250;
const ENTITLEMENT_CHUNK = 400;

type ProfileRow = {
  user_id: string;
  role: "private" | "coach" | null;
  platform_coach_status: string | null;
  athlete_id: string | null;
  is_platform_admin: boolean | null;
};

async function loadAuthUserIndex(admin: SupabaseClient): Promise<{
  emailByUserId: Map<string, string>;
  lastSignInByUserId: Map<string, string | null>;
  totalAuthUsers: number;
  signInLast30Days: number;
}> {
  const emailByUserId = new Map<string, string>();
  const lastSignInByUserId = new Map<string, string | null>();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let signInLast30Days = 0;

  const allUsers = await listAllAuthUsers(admin);
  for (const u of allUsers) {
    if (u.email) emailByUserId.set(u.id, u.email);
    const last = u.last_sign_in_at ?? null;
    lastSignInByUserId.set(u.id, last);
    if (last && new Date(last).getTime() >= cutoff) signInLast30Days += 1;
  }

  return {
    emailByUserId,
    lastSignInByUserId,
    totalAuthUsers: allUsers.length,
    signInLast30Days,
  };
}

async function loadRollupsBatched(
  admin: SupabaseClient,
  athleteIds: string[],
): Promise<{ rollups: Map<string, import("@/lib/admin/load-activity-rollups").AdminAthleteActivityRollup>; available: boolean }> {
  const rollups = new Map<string, import("@/lib/admin/load-activity-rollups").AdminAthleteActivityRollup>();
  let available = false;
  for (let i = 0; i < athleteIds.length; i += ROLLUP_CHUNK) {
    const chunk = athleteIds.slice(i, i + ROLLUP_CHUNK);
    const part = await loadAdminAthleteActivityRollups(admin, chunk);
    if (part.size > 0) available = true;
    for (const [k, v] of part) rollups.set(k, v);
  }
  return { rollups, available };
}

function athleteDisplayName(row: { first_name?: string | null; last_name?: string | null; email?: string | null }): string | null {
  const parts = [row.first_name, row.last_name].filter((x) => typeof x === "string" && x.trim()).map(String);
  if (parts.length) return parts.join(" ");
  return row.email?.trim() || null;
}

/**
 * Report piattaforma per console /admin (service role).
 * Aggrega profili, roster coach, rollup attività (058/059) e adozione moduli proxy.
 */
export async function loadPlatformReport(admin: SupabaseClient): Promise<PlatformReport> {
  const [{ data: profilesRaw, error: profErr }, { data: linksRaw, error: linkErr }, authIndex] = await Promise.all([
    admin.from("app_user_profiles").select("user_id, role, platform_coach_status, athlete_id, is_platform_admin"),
    admin.from("coach_athletes").select("coach_user_id, athlete_id"),
    loadAuthUserIndex(admin),
  ]);

  if (profErr) throw new Error(profErr.message);
  if (linkErr) throw new Error(linkErr.message);

  const profiles = (profilesRaw ?? []) as ProfileRow[];
  const profileByUserId = new Map(profiles.map((p) => [p.user_id, p]));
  const links = (linksRaw ?? []) as Array<{ coach_user_id: string; athlete_id: string }>;

  const linkedCoachDetail = (coachUserId: string): PlatformLinkedCoach => {
    const prof = profileByUserId.get(coachUserId);
    const role = prof?.role ?? null;
    const platformCoachStatus = prof?.platform_coach_status ?? null;
    return {
      userId: coachUserId,
      email: authIndex.emailByUserId.get(coachUserId) ?? null,
      role,
      platformCoachStatus,
      coachConsoleOperational: role === "coach" && platformCoachStatus === "approved",
    };
  };

  const athleteIdSet = new Set<string>();
  const userIdByAthlete = new Map<string, string>();
  for (const p of profiles) {
    if (p.athlete_id) {
      athleteIdSet.add(p.athlete_id);
      userIdByAthlete.set(p.athlete_id, p.user_id);
    }
  }
  const coachIdsByAthlete = new Map<string, Set<string>>();
  const athletesByCoach = new Map<string, string[]>();
  for (const l of links) {
    if (!l.coach_user_id || !l.athlete_id) continue;
    athleteIdSet.add(l.athlete_id);
    const set = coachIdsByAthlete.get(l.athlete_id) ?? new Set<string>();
    set.add(l.coach_user_id);
    coachIdsByAthlete.set(l.athlete_id, set);
    const arr = athletesByCoach.get(l.coach_user_id) ?? [];
    if (!arr.includes(l.athlete_id)) arr.push(l.athlete_id);
    athletesByCoach.set(l.coach_user_id, arr);
  }

  const athleteIds = [...athleteIdSet];
  const athleteMeta = new Map<
    string,
    { id: string; email?: string | null; first_name?: string | null; last_name?: string | null }
  >();
  if (athleteIds.length > 0) {
    const { data: athleteRows, error: athleteErr } = await admin
      .from("athlete_profiles")
      .select("id, email, first_name, last_name")
      .in("id", athleteIds);
    if (athleteErr) throw new Error(athleteErr.message);
    for (const r of (athleteRows ?? []) as Array<{
      id: string;
      email?: string | null;
      first_name?: string | null;
      last_name?: string | null;
    }>) {
      athleteMeta.set(r.id, r);
    }
  }

  const [{ rollups, available: rollupsAvailable }, timeSeriesCounts] = await Promise.all([
    loadRollupsBatched(admin, athleteIds),
    loadAdminAthleteTimeSeriesCounts(admin, athleteIds),
  ]);

  const profileUserIds = profiles.map((p) => p.user_id);
  let stripePaidUsers = 0;
  let grantActiveUsers = 0;
  for (let i = 0; i < profileUserIds.length; i += ENTITLEMENT_CHUNK) {
    const chunk = profileUserIds.slice(i, i + ENTITLEMENT_CHUNK);
    const batch = await loadAccessEntitlementsForUserIds(admin, chunk);
    for (const entry of batch.values()) {
      if (entry.entitlement.source === "stripe_paid") stripePaidUsers += 1;
      if (entry.entitlement.source === "grant_active") grantActiveUsers += 1;
    }
  }

  let coachesTotal = 0;
  let coachesPending = 0;
  let coachesApproved = 0;
  let coachesSuspended = 0;
  let privateAccounts = 0;
  for (const p of profiles) {
    if (p.role === "coach") {
      coachesTotal += 1;
      const st = p.platform_coach_status ?? "pending";
      if (st === "approved") coachesApproved += 1;
      else if (st === "suspended") coachesSuspended += 1;
      else coachesPending += 1;
    } else if (p.role === "private") privateAccounts += 1;
  }

  const moduleAdoption = computeModuleAdoption(athleteIds, rollups, timeSeriesCounts);

  let lowEngagementAthletes = 0;
  const athletes: PlatformAthleteReportRow[] = athleteIds.map((athleteId) => {
    const meta = athleteMeta.get(athleteId);
    const rollup = rollups.get(athleteId) ?? null;
    const tsCount = timeSeriesCounts.get(athleteId) ?? 0;
    const modulesUsed = modulesUsedFromRollup(rollup, tsCount);
    const engagementScore = engagementScoreFromModules(modulesUsed);
    if (engagementScore === 0) lowEngagementAthletes += 1;
    const uid = userIdByAthlete.get(athleteId);
    const coachIds = [...(coachIdsByAthlete.get(athleteId) ?? [])];
    return {
      athleteId,
      email: meta?.email ?? null,
      displayName: meta ? athleteDisplayName(meta) : null,
      linkedCoachCount: coachIds.length,
      linkedCoaches: coachIds.map(linkedCoachDetail),
      modulesUsed,
      engagementScore,
      rollup,
      accountEmail: uid ? authIndex.emailByUserId.get(uid) ?? null : null,
      lastSignInAt: uid ? authIndex.lastSignInByUserId.get(uid) ?? null : null,
    };
  });

  athletes.sort((a, b) => {
    if (a.engagementScore !== b.engagementScore) return a.engagementScore - b.engagementScore;
    return (a.email ?? a.athleteId).localeCompare(b.email ?? b.athleteId);
  });

  const coachProfiles = profiles.filter((p) => p.role === "coach");
  const coaches: PlatformCoachReportRow[] = coachProfiles.map((p) => {
    const athleteList = athletesByCoach.get(p.user_id) ?? [];
    const athleteRowsForCoach = athleteList.map((aid) => {
      const row = athletes.find((a) => a.athleteId === aid);
      const rollup = rollups.get(aid) ?? null;
      const tsCount = timeSeriesCounts.get(aid) ?? 0;
      const modulesUsed = modulesUsedFromRollup(rollup, tsCount);
      const meta = athleteMeta.get(aid);
      return {
        athleteId: aid,
        email: meta?.email ?? row?.email ?? null,
        displayName: meta ? athleteDisplayName(meta) : row?.displayName ?? null,
        modulesUsed,
        engagementScore: engagementScoreFromModules(modulesUsed),
      };
    });
    athleteRowsForCoach.sort((a, b) => b.engagementScore - a.engagementScore);
    return {
      coachUserId: p.user_id,
      email: authIndex.emailByUserId.get(p.user_id) ?? null,
      platformCoachStatus: p.platform_coach_status ?? "pending",
      athleteCount: athleteRowsForCoach.length,
      athletes: athleteRowsForCoach,
    };
  });

  coaches.sort((a, b) => {
    const rank = (s: string | null) => (s === "pending" ? 0 : s === "suspended" ? 1 : 2);
    const d = rank(a.platformCoachStatus) - rank(b.platformCoachStatus);
    if (d !== 0) return d;
    return b.athleteCount - a.athleteCount;
  });

  const rosterOperatorsNeedingFix: PlatformRosterOperatorRow[] = [];
  for (const [coachUserId, athleteList] of athletesByCoach) {
    const prof = profileByUserId.get(coachUserId);
    const role = prof?.role ?? null;
    const st = prof?.platform_coach_status ?? null;
    let issue: PlatformRosterOperatorRow["issue"] | null = null;
    if (role !== "coach") issue = "missing_coach_role";
    else if (st === "suspended") issue = "coach_suspended";
    else if (st !== "approved") issue = "coach_pending";
    if (!issue) continue;
    rosterOperatorsNeedingFix.push({
      coachUserId,
      email: authIndex.emailByUserId.get(coachUserId) ?? null,
      role,
      platformCoachStatus: st,
      athleteCount: athleteList.length,
      issue,
    });
  }
  rosterOperatorsNeedingFix.sort((a, b) => b.athleteCount - a.athleteCount);

  return {
    generatedAt: new Date().toISOString(),
    rollupsAvailable: rollupsAvailable,
    kpis: {
      totalAuthUsers: authIndex.totalAuthUsers,
      signInLast30Days: authIndex.signInLast30Days,
      profilesTotal: profiles.length,
      coachesTotal,
      coachesPending,
      coachesApproved,
      coachesSuspended,
      athletesWithProfile: athleteIds.length,
      privateAccounts,
      rosterLinks: links.length,
      stripePaidUsers,
      grantActiveUsers,
      lowEngagementAthletes,
    },
    moduleAdoption,
    coaches,
    rosterOperatorsNeedingFix,
    athletes,
  };
}
