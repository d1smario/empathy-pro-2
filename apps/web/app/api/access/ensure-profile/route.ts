import { NextResponse } from "next/server";
import { bootstrapAppUserProfile } from "@/lib/auth/bootstrap-app-user-profile";
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
  const role = body.role ?? "private";
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
    .select("role, athlete_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }

  const current = existing as { role: "private" | "coach"; athlete_id: string | null } | null;

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

  const { data: after } = await supabase.from("app_user_profiles").select("athlete_id").eq("user_id", userId).maybeSingle();
  const rowAfter = after as { athlete_id?: string | null } | null;
  const resolvedAthleteId = role === "private" ? (rowAfter?.athlete_id ?? null) : null;

  return NextResponse.json({
    status: current ? "existing" : "created",
    role,
    athleteId: resolvedAthleteId,
  });
}
