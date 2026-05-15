import { NextResponse } from "next/server";
import { loadAdminAthleteActivityRollups } from "@/lib/admin/load-activity-rollups";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { loadUserAccessEntitlement } from "@/lib/billing/access-entitlement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GrantRow = {
  id: string;
  user_id: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
  granted_by_email: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
};

/**
 * GET /api/admin/users/[userId]/detail
 * Snapshot lettura: profilo app, entitlement, Stripe, grant, aggregati atleta.
 */
export async function GET(_req: Request, { params }: { params: { userId: string } }) {
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

  const userId = (params.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ ok: false as const, error: "userId mancante." }, { status: 400 });
  }

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user) {
    return NextResponse.json({ ok: false as const, error: authErr?.message ?? "Utente non trovato." }, { status: 404 });
  }
  const u = authUser.user;

  const [{ data: profile }, entitlement, { data: subs }, { data: grants }] = await Promise.all([
    admin
      .from("app_user_profiles")
      .select("role, platform_coach_status, is_platform_admin, athlete_id")
      .eq("user_id", userId)
      .maybeSingle(),
    loadUserAccessEntitlement(admin, userId),
    admin.from("billing_subscriptions").select("status, current_period_end, base_plan_id, updated_at").eq("user_id", userId),
    admin
      .from("subscription_grants")
      .select(
        "id, user_id, kind, starts_at, ends_at, note, granted_by_email, revoked_at, revoked_reason, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const prof = profile as {
    role?: string;
    platform_coach_status?: string | null;
    is_platform_admin?: boolean | null;
    athlete_id?: string | null;
  } | null;

  const athleteId = typeof prof?.athlete_id === "string" && prof.athlete_id.length > 0 ? prof.athlete_id : null;
  const activityMap = athleteId ? await loadAdminAthleteActivityRollups(admin, [athleteId]) : new Map();
  const activity = athleteId ? activityMap.get(athleteId) ?? null : null;

  const stripeSubscriptions = ((subs ?? []) as Array<Record<string, unknown>>).map((row) => ({
    status: typeof row.status === "string" ? row.status : "",
    currentPeriodEnd: typeof row.current_period_end === "string" ? row.current_period_end : null,
    basePlanId: typeof row.base_plan_id === "string" ? row.base_plan_id : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  }));

  return NextResponse.json({
    ok: true as const,
    user: {
      id: u.id,
      email: u.email ?? null,
      createdAt: u.created_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
    },
    profile: {
      role: prof?.role === "coach" || prof?.role === "private" ? prof.role : null,
      platformCoachStatus: prof?.platform_coach_status ?? null,
      isPlatformAdmin: prof?.is_platform_admin === true,
      athleteId,
    },
    entitlement,
    stripeSubscriptions,
    grants: (grants ?? []) as GrantRow[],
    activity,
  });
}
