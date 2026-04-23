import { NextResponse } from "next/server";
import type { AdminCoachRow } from "@/lib/admin/coach-list-types";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Elenco account coach (service role). Solo amministratori piattaforma.
 */
export async function GET() {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY per lettura admin." },
      { status: 503 },
    );
  }

  const { data: rows, error: rowsErr } = await admin
    .from("app_user_profiles")
    .select("user_id, platform_coach_status, updated_at")
    .eq("role", "coach")
    .order("updated_at", { ascending: false });

  if (rowsErr) {
    return NextResponse.json({ ok: false as const, error: rowsErr.message }, { status: 500 });
  }

  const emailByUserId = new Map<string, string>();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data: pageData, error: listErr } = await admin.auth.admin.listUsers({ page, perPage });
    if (listErr) {
      return NextResponse.json({ ok: false as const, error: listErr.message }, { status: 500 });
    }
    for (const u of pageData.users) {
      if (u.email) emailByUserId.set(u.id, u.email);
    }
    if (pageData.users.length < perPage) break;
    page += 1;
    if (page > 40) break;
  }

  const coaches: AdminCoachRow[] = (rows ?? []).map((r) => {
    const row = r as { user_id: string; platform_coach_status?: string | null; updated_at?: string | null };
    return {
      userId: row.user_id,
      email: emailByUserId.get(row.user_id) ?? null,
      platformCoachStatus: row.platform_coach_status ?? null,
      updatedAt: row.updated_at ?? null,
    };
  });

  return NextResponse.json({ ok: true as const, coaches });
}
