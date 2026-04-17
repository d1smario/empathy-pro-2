import { type NextRequest, NextResponse } from "next/server";

import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { ensureFreshGarminAccessTokenForAthlete } from "@/lib/integrations/garmin-access-token";
import { deleteGarminUserRegistration } from "@/lib/integrations/garmin-oauth2-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Scollega Garmin lato Empathy e best-effort lato Garmin (`DELETE …/user/registration`).
 * Richiede sessione + accesso all’atleta.
 */
export async function POST(req: NextRequest) {
  try {
    const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }

    await requireAthleteReadContext(req, athleteId);

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "service_role_unconfigured" }, { status: 503, headers: NO_STORE });
    }

    const { data: row, error: selErr } = await admin
      .from("garmin_athlete_links")
      .select("athlete_id, oauth_access_token")
      .eq("athlete_id", athleteId)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 500, headers: NO_STORE });
    }
    if (!row) {
      return NextResponse.json({ ok: true as const, disconnected: false }, { headers: NO_STORE });
    }

    let garminRemoteOk = false;
    const fresh = await ensureFreshGarminAccessTokenForAthlete(admin, athleteId);
    const access =
      "accessToken" in fresh
        ? fresh.accessToken
        : typeof (row as { oauth_access_token?: unknown }).oauth_access_token === "string"
          ? String((row as { oauth_access_token: string }).oauth_access_token).trim()
          : "";
    if (access) {
      const del = await deleteGarminUserRegistration(access);
      garminRemoteOk = del.ok;
    }

    const { error: delErr } = await admin.from("garmin_athlete_links").delete().eq("athlete_id", athleteId);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500, headers: NO_STORE });
    }

    return NextResponse.json(
      {
        ok: true as const,
        disconnected: true,
        garminPartnerDeregistered: garminRemoteOk,
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status, headers: NO_STORE });
    }
    throw e;
  }
}
