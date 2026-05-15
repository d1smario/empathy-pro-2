import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TargetRole = "private" | "coach";
type CoachStatus = "pending" | "approved" | "suspended";

/**
 * POST /api/admin/users/[userId]/app-profile
 * Service role: imposta ruolo atleta/coach e (se coach) stato piattaforma.
 * Non espone `is_platform_admin` (solo SQL / processi controllati).
 */
export async function POST(req: Request, { params }: { params: { userId: string } }) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY per aggiornamento admin." },
      { status: 503 },
    );
  }

  const userId = (params.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ ok: false as const, error: "userId mancante." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    targetRole?: string;
    platformCoachStatus?: string;
  };

  const targetRole = body.targetRole as TargetRole | undefined;
  if (targetRole !== "private" && targetRole !== "coach") {
    return NextResponse.json(
      { ok: false as const, error: "targetRole richiesto: private | coach." },
      { status: 400 },
    );
  }

  let platformCoachStatus: CoachStatus | null = null;
  if (targetRole === "coach") {
    const raw = body.platformCoachStatus as CoachStatus | undefined | null;
    if (raw === "pending" || raw === "approved" || raw === "suspended") {
      platformCoachStatus = raw;
    } else {
      platformCoachStatus = "pending";
    }
  }

  const { data: existing, error: selErr } = await admin
    .from("app_user_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (selErr) {
    return NextResponse.json({ ok: false as const, error: selErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json(
      { ok: false as const, error: "Profilo app mancante: l'utente deve aver completato almeno un accesso (ensure-profile)." },
      { status: 400 },
    );
  }

  const patch =
    targetRole === "private"
      ? { role: "private" as const, platform_coach_status: null as null }
      : { role: "coach" as const, platform_coach_status: platformCoachStatus };

  const { error: upErr } = await admin.from("app_user_profiles").update(patch).eq("user_id", userId);

  if (upErr) {
    return NextResponse.json({ ok: false as const, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true as const,
    userId,
    role: patch.role,
    platformCoachStatus: targetRole === "private" ? null : platformCoachStatus,
  });
}
