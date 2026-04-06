import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { coachOrgIdForDb } from "@/lib/coach-org-id";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INVITE_TTL_DAYS = 7;

function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Crea invito (solo utenti con role coach in app_user_profiles).
 * Persistenza: service role + tabella coach_invitations.
 */
export async function POST() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Inviti: manca SUPABASE_SERVICE_ROLE_KEY sul server." },
      { status: 503 },
    );
  }

  const orgId = coachOrgIdForDb();

  const cookieClient = createSupabaseCookieClient();
  if (!cookieClient) {
    return NextResponse.json({ ok: false as const, error: "Supabase non configurato." }, { status: 503 });
  }

  const {
    data: { user },
    error: authErr,
  } = await cookieClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false as const, error: "Non autenticato." }, { status: 401 });
  }

  const { data: profile, error: profErr } = await cookieClient
    .from("app_user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json({ ok: false as const, error: profErr.message }, { status: 500 });
  }
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "coach") {
    return NextResponse.json({ ok: false as const, error: "Solo account con ruolo coach possono creare inviti." }, { status: 403 });
  }

  const token = newInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  const { error: insErr } = await admin.from("coach_invitations").insert({
    org_id: orgId,
    inviting_coach_user_id: user.id,
    token,
    expires_at: expiresAt.toISOString(),
  });

  if (insErr) {
    return NextResponse.json({ ok: false as const, error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true as const,
    token,
    expiresAt: expiresAt.toISOString(),
    ttlDays: INVITE_TTL_DAYS,
  });
}
