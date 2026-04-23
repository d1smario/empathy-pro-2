import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CoachAction = "approve" | "suspend" | "pending";

function actionToStatus(action: CoachAction): "approved" | "suspended" | "pending" {
  if (action === "approve") return "approved";
  if (action === "suspend") return "suspended";
  return "pending";
}

/**
 * Aggiorna `platform_coach_status` per un utente coach (service role).
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

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action as CoachAction | undefined;
  if (action !== "approve" && action !== "suspend" && action !== "pending") {
    return NextResponse.json({ ok: false as const, error: "action non valida (approve | suspend | pending)." }, { status: 400 });
  }

  const status = actionToStatus(action);

  const { data: prof, error: selErr } = await admin
    .from("app_user_profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr) {
    return NextResponse.json({ ok: false as const, error: selErr.message }, { status: 500 });
  }
  if ((prof as { role?: string } | null)?.role !== "coach") {
    return NextResponse.json({ ok: false as const, error: "L’utente non ha ruolo coach." }, { status: 400 });
  }

  const { error: upErr } = await admin
    .from("app_user_profiles")
    .update({ platform_coach_status: status })
    .eq("user_id", userId)
    .eq("role", "coach");

  if (upErr) {
    return NextResponse.json({ ok: false as const, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, userId, platformCoachStatus: status });
}
