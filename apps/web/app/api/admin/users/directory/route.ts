import { NextResponse } from "next/server";
import type { AdminDirectoryUserRow } from "@/lib/admin/user-directory-types";
import { loadAdminAthleteActivityRollups } from "@/lib/admin/load-activity-rollups";
import { listAllAuthUsers } from "@/lib/admin/list-all-auth-users";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { loadAccessEntitlementsForUserIds } from "@/lib/billing/access-entitlement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 50;

/**
 * GET /api/admin/users/directory?page=1&perPage=50
 * Pagina utenti auth + profilo + Stripe + entitlement + aggregati atleta (RPC 058).
 */
export async function GET(req: Request) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const page = Math.max(1, Math.min(200, Number(url.searchParams.get("page") ?? "1") || 1));
  const perPageRaw = Number(url.searchParams.get("perPage") ?? String(DEFAULT_PER_PAGE)) || DEFAULT_PER_PAGE;
  const perPage = Math.max(1, Math.min(MAX_PER_PAGE, perPageRaw));

  let allUsers;
  try {
    allUsers = await listAllAuthUsers(admin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore elenco utenti Auth.";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }

  const totalUsers = allUsers.length;
  const start = (page - 1) * perPage;
  const users = allUsers.slice(start, start + perPage);
  const userIds = users.map((u) => u.id);
  const batch = await loadAccessEntitlementsForUserIds(admin, userIds);

  const athleteIds = userIds
    .map((uid) => batch.get(uid)?.athleteId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const activityByAthlete = await loadAdminAthleteActivityRollups(admin, athleteIds);

  const rows: AdminDirectoryUserRow[] = users.map((u) => {
    const b = batch.get(u.id);
    const fallbackEnt = {
      hasOperatorAccess: false,
      hasAthleteAccess: false,
      source: "none" as const,
      validUntil: null,
      label: "Nessun piano attivo",
    };
    const athleteId = b?.athleteId ?? null;
    const activity = athleteId ? activityByAthlete.get(athleteId) ?? null : null;
    return {
      userId: u.id,
      email: u.email ?? null,
      createdAt: u.created_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
      role: b?.role ?? null,
      platformCoachStatus: b?.platformCoachStatus ?? null,
      isPlatformAdmin: b?.isPlatformAdmin ?? false,
      athleteId,
      stripeSubscriptions: b?.stripeSubscriptions ?? [],
      entitlement: b?.entitlement ?? fallbackEnt,
      activity,
    };
  });

  return NextResponse.json({
    ok: true as const,
    page,
    perPage,
    totalUsers,
    hasMore: start + perPage < totalUsers,
    users: rows,
  });
}
