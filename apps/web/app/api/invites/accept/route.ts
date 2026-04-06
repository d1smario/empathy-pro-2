import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { token?: string };

/**
 * Atleta loggato accetta invito: crea riga coach_athletes (coach invitante ↔ athlete_id del profilo utente).
 */
export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY sul server." },
      { status: 503 },
    );
  }

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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false as const, error: "Token mancante." }, { status: 400 });
  }

  const { data: invite, error: invErr } = await admin
    .from("coach_invitations")
    .select("id, org_id, inviting_coach_user_id, expires_at, consumed_at")
    .eq("token", token)
    .maybeSingle();

  if (invErr) {
    return NextResponse.json({ ok: false as const, error: invErr.message }, { status: 500 });
  }
  if (!invite) {
    return NextResponse.json({ ok: false as const, error: "Invito non trovato." }, { status: 404 });
  }

  const inv = invite as {
    id: string;
    org_id: string;
    inviting_coach_user_id: string;
    expires_at: string;
    consumed_at: string | null;
  };

  if (inv.consumed_at) {
    return NextResponse.json({ ok: false as const, error: "Invito già utilizzato." }, { status: 409 });
  }
  if (new Date(inv.expires_at) <= new Date()) {
    return NextResponse.json({ ok: false as const, error: "Invito scaduto." }, { status: 410 });
  }

  const { data: profile, error: profErr } = await cookieClient
    .from("app_user_profiles")
    .select("role, athlete_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json({ ok: false as const, error: profErr.message }, { status: 500 });
  }

  const prof = profile as { role?: string; athlete_id?: string | null } | null;
  if (prof?.role === "coach") {
    return NextResponse.json(
      { ok: false as const, error: "Gli account coach non possono accettare questo invito atleta." },
      { status: 403 },
    );
  }

  const athleteId = prof?.athlete_id?.trim() || null;
  if (!athleteId) {
    return NextResponse.json(
      {
        ok: false as const,
        error:
          "Nessun atleta collegato al profilo. Apri l’app da utente private e completa il profilo / ensure-profile prima di accettare.",
      },
      { status: 400 },
    );
  }

  const { error: linkErr } = await admin.from("coach_athletes").upsert(
    {
      org_id: inv.org_id,
      coach_user_id: inv.inviting_coach_user_id,
      athlete_id: athleteId,
    },
    { onConflict: "org_id,coach_user_id,athlete_id" },
  );

  if (linkErr) {
    return NextResponse.json({ ok: false as const, error: linkErr.message }, { status: 500 });
  }

  const { error: updErr } = await admin
    .from("coach_invitations")
    .update({
      consumed_at: new Date().toISOString(),
      consumed_by_user_id: user.id,
    })
    .eq("id", inv.id);

  if (updErr) {
    return NextResponse.json({ ok: false as const, error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true as const,
    orgId: inv.org_id,
    coachUserId: inv.inviting_coach_user_id,
    athleteId,
  });
}
