import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { loadUserAccessEntitlement } from "@/lib/billing/access-entitlement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/users/lookup?q=...
 * - q = email (parziale, case-insensitive) → max 25 risultati con stato entitlement.
 * Usato dalla console admin per concedere grants (cerca utente per email).
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
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) {
    return NextResponse.json({ ok: true as const, users: [] });
  }

  // Paginiamo gli utenti auth e filtriamo per email match (Supabase non offre LIKE su auth.users via API).
  const matches: Array<{ userId: string; email: string }> = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data: pageData, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
    }
    for (const u of pageData.users) {
      const email = (u.email ?? "").toLowerCase();
      if (email.includes(q)) matches.push({ userId: u.id, email });
      if (matches.length >= 25) break;
    }
    if (matches.length >= 25 || pageData.users.length < perPage) break;
    page += 1;
    if (page > 40) break;
  }

  // Per ogni match, carica entitlement (parallel).
  if (q.includes("@")) {
    matches.sort((a, b) => {
      const ae = a.email.toLowerCase() === q ? 0 : 1;
      const be = b.email.toLowerCase() === q ? 0 : 1;
      return ae - be;
    });
  }

  let enriched;
  try {
    enriched = await Promise.all(
    matches.map(async (m) => {
      const [entitlement, { data: profile }, { count: rosterAsCoachCount, error: rosterErr }] = await Promise.all([
        loadUserAccessEntitlement(admin, m.userId),
        admin
          .from("app_user_profiles")
          .select("role, platform_coach_status, is_platform_admin")
          .eq("user_id", m.userId)
          .maybeSingle(),
        admin
          .from("coach_athletes")
          .select("athlete_id", { count: "exact", head: true })
          .eq("coach_user_id", m.userId),
      ]);
      if (rosterErr) throw new Error(rosterErr.message);
      const profileRow =
        (profile as {
          role?: "private" | "coach" | null;
          platform_coach_status?: string | null;
          is_platform_admin?: boolean | null;
        } | null) ?? null;
      const role = profileRow?.role ?? null;
      const platformCoachStatus = profileRow?.platform_coach_status ?? null;
      const rosterCount = rosterAsCoachCount ?? 0;
      const coachConsoleOperational = role === "coach" && platformCoachStatus === "approved";
      return {
        userId: m.userId,
        email: m.email,
        role,
        platformCoachStatus,
        isPlatformAdmin: profileRow?.is_platform_admin === true,
        rosterAsCoachCount: rosterCount,
        rosterNeedsCoachActivation: rosterCount > 0 && !coachConsoleOperational,
        entitlement,
      };
    }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "lookup_failed";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, users: enriched });
}
