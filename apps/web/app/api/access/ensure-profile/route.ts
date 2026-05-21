import { NextResponse } from "next/server";
import { bootstrapAppUserProfile } from "@/lib/auth/bootstrap-app-user-profile";
import { resolveBootstrapRole } from "@/lib/auth/resolve-bootstrap-role";
import { coachOperationalApproved } from "@/lib/platform-coach-status";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Bootstrap profilo app + collegamento atleta (stesso contratto logico di V1).
 * Auth: cookie SSR (niente Bearer). Richiede RLS coerenti sullo stesso progetto Supabase di V1.
 */
export async function POST(req: Request) {
  const supabase = createSupabaseCookieClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    userId?: string;
    role?: "private" | "coach";
    athleteId?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
  const userId = (body.userId ?? "").trim();
  const requestedRole = body.role ?? "private";
  if (!userId || userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const explicitAthleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const athleteIdBody = explicitAthleteId || null;
  const email = String(body.email ?? "").trim().toLowerCase() || null;
  const firstName = String(body.firstName ?? "").trim() || null;
  const lastName = String(body.lastName ?? "").trim() || null;

  const { data: existing, error: existingErr } = await supabase
    .from("app_user_profiles")
    .select("role, athlete_id, platform_coach_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }

  const current = existing as {
    role: "private" | "coach";
    athlete_id: string | null;
    platform_coach_status?: string | null;
  } | null;

  const role = resolveBootstrapRole(requestedRole, current);

  const athleteIdForBootstrap =
    role === "coach" ? athleteIdBody : athleteIdBody ?? current?.athlete_id ?? null;

  const result = await bootstrapAppUserProfile(supabase, {
    userId,
    role,
    email,
    firstName,
    lastName,
    athleteId: athleteIdForBootstrap,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const { data: after } = await supabase
    .from("app_user_profiles")
    .select("role, athlete_id, platform_coach_status")
    .eq("user_id", userId)
    .maybeSingle();
  const rowAfter = after as {
    role?: "private" | "coach";
    athlete_id?: string | null;
    platform_coach_status?: string | null;
  } | null;
  const effectiveRole = rowAfter?.role === "coach" ? "coach" : "private";
  const resolvedAthleteId = effectiveRole === "private" ? (rowAfter?.athlete_id ?? null) : null;
  const platformCoachStatus = rowAfter?.platform_coach_status ?? null;

  return NextResponse.json({
    status: current ? "existing" : "created",
    role: effectiveRole,
    requestedRole,
    roleLockedFromDowngrade: requestedRole === "private" && effectiveRole === "coach",
    athleteId: resolvedAthleteId,
    platformCoachStatus,
    coachOperationalApproved: coachOperationalApproved(effectiveRole, platformCoachStatus),
  });
}
