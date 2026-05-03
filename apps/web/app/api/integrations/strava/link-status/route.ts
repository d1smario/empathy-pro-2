import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

/** Stato collegamento Strava (id atleta Strava mascherato, scope). Nessun token in risposta. */
export async function GET(req: NextRequest) {
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

    const { data, error } = await admin
      .from("vendor_oauth_links")
      .select("external_user_id, updated_at, scope")
      .eq("athlete_id", athleteId)
      .eq("vendor", "strava")
      .maybeSingle();

    if (error) {
      const hint =
        /vendor_oauth_links|does not exist|schema cache/i.test(error.message ?? "") || error.code === "42P01";
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          ...(hint
            ? { hint: "Applica la migration vendor_oauth (incluso 040_vendor_oauth_strava) e verifica SUPABASE_SERVICE_ROLE_KEY." }
            : {}),
        },
        { status: 500, headers: NO_STORE },
      );
    }

    if (!data) {
      return NextResponse.json({ linked: false as const }, { headers: NO_STORE });
    }

    const row = data as { external_user_id: string | null; updated_at: string; scope: string | null };
    const ext = typeof row.external_user_id === "string" ? row.external_user_id.trim() : "";
    const masked =
      !ext || ext.length <= 6 ? (ext ? "••••" : "—") : `${ext.slice(0, 3)}…${ext.slice(-4)}`;

    return NextResponse.json(
      {
        linked: true as const,
        stravaAthleteIdMasked: masked,
        updatedAt: row.updated_at,
        oauthScope: row.scope ?? null,
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
