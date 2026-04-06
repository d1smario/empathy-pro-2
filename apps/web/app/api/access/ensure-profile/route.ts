import { NextResponse } from "next/server";
import { coachOrgIdForDb } from "@/lib/coach-org-id";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Bootstrap profilo app + collegamento atleta (stesso contratto logico di V1).
 * Auth: cookie SSR (niente Bearer). Richiede RLS coerenti sullo stesso progetto Supabase di V1.
 */
async function resolveExistingAthleteId(
  supabase: NonNullable<ReturnType<typeof createSupabaseCookieClient>>,
  athleteId: string | null,
  email: string | null,
): Promise<string | null> {
  if (athleteId) {
    const { data } = await supabase.from("athlete_profiles").select("id").eq("id", athleteId).maybeSingle();
    if (data && typeof (data as { id?: string }).id === "string") {
      return (data as { id: string }).id;
    }
  }
  if (email) {
    const { data } = await supabase
      .from("athlete_profiles")
      .select("id")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data && typeof (data as { id?: string }).id === "string") {
      return (data as { id: string }).id;
    }
  }
  return null;
}

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

  const athleteId = (body.athleteId ?? "").trim() || null;
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

  let resolvedAthleteId = await resolveExistingAthleteId(supabase, athleteId ?? current?.athlete_id ?? null, email);

  if (role === "private" && !resolvedAthleteId) {
    const { data: inserted, error: insErr } = await supabase
      .from("athlete_profiles")
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        activity_level: "advanced",
        timezone: "Europe/Rome",
      })
      .select("id")
      .maybeSingle();
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    const row = inserted as { id?: string } | null;
    resolvedAthleteId = row?.id ?? null;
  }

  const nextRole = role;
  const nextAthleteId = nextRole === "private" ? resolvedAthleteId : null;
  const shouldUpsertProfile =
    !current || current.role !== nextRole || (current.athlete_id ?? null) !== (nextAthleteId ?? null);

  if (shouldUpsertProfile) {
    const { error: profileErr } = await supabase.from("app_user_profiles").upsert(
      {
        user_id: userId,
        role: nextRole,
        athlete_id: nextAthleteId,
      },
      { onConflict: "user_id" },
    );
    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }
  }

  if (nextRole === "coach" && resolvedAthleteId) {
    const orgId = coachOrgIdForDb();
    const { error: linkErr } = await supabase.from("coach_athletes").upsert(
      { org_id: orgId, coach_user_id: userId, athlete_id: resolvedAthleteId },
      { onConflict: "org_id,coach_user_id,athlete_id" },
    );
    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    status: current ? "existing" : "created",
    role: nextRole,
    athleteId: resolvedAthleteId,
  });
}
