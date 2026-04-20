import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Stato collegamento Garmin per atleta (solo maschera userId). Richiede auth + accesso atleta.
 */
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
      .from("garmin_athlete_links")
      .select("garmin_user_id, updated_at, scope, user_permissions")
      .eq("athlete_id", athleteId)
      .maybeSingle();

    if (error) {
      const missingTable =
        /garmin_athlete_links|does not exist|schema cache/i.test(error.message ?? "") ||
        error.code === "42P01";
      const missingPermissionsColumn =
        /user_permissions|42703|column/i.test(error.message ?? "") || error.code === "42703";
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          ...(missingTable
            ? {
                hint: "Applica su Supabase la migration 008_garmin_athlete_links.sql (o equivalente) e verifica SUPABASE_SERVICE_ROLE_KEY.",
              }
            : {}),
          ...(missingPermissionsColumn
            ? {
                hint: "Applica su Supabase la migration 013_garmin_athlete_links_user_permissions.sql.",
              }
            : {}),
        },
        { status: 500, headers: NO_STORE },
      );
    }
    if (!data) {
      return NextResponse.json({ linked: false as const }, { headers: NO_STORE });
    }

    const row = data as {
      garmin_user_id: string;
      updated_at: string;
      scope: string | null;
      user_permissions: unknown;
    };
    const g = row.garmin_user_id;
    const masked = g.length <= 8 ? "••••" : `${g.slice(0, 4)}…${g.slice(-4)}`;
    const granted =
      Array.isArray(row.user_permissions) && row.user_permissions.every((x) => typeof x === "string")
        ? (row.user_permissions as string[])
        : null;
    return NextResponse.json(
      {
        linked: true as const,
        garminUserIdMasked: masked,
        updatedAt: row.updated_at,
        /** Scope stringa dal token OAuth (Garmin). */
        oauthScope: row.scope ?? null,
        /**
         * Permessi Health API **concessi** (GET /rest/user/permissions). Garmin non espone elenco “negati”.
         * Per capire cosa manca: confronta con le capability abilitate nel portale per l’app.
         */
        userPermissionsGranted: granted,
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
