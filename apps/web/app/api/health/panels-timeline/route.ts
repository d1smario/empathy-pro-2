import { NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAuthenticatedTrainingUser,
} from "@/lib/auth/athlete-read-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

export type HealthPanelTimelineRow = {
  id: string;
  type: string;
  sample_date: string | null;
  reported_at: string | null;
  source: string | null;
  values: Record<string, unknown> | null;
  created_at: string | null;
};

/**
 * Diagnostica leggera quando una richiesta viene rifiutata (403 / 401):
 * espone solo dati che appartengono all'utente autenticato (la sua riga
 * `app_user_profiles.athlete_id` e l'`athleteId` richiesto), così la UI può
 * spiegare un eventuale mismatch tra atleta attivo client e profilo server.
 */
async function buildForbiddenDiagnostics(
  req: NextRequest,
  requestedAthleteId: string,
): Promise<{ requestedAthleteId: string; userProfileAthleteId?: string | null; userId?: string }>
{
  const out: {
    requestedAthleteId: string;
    userProfileAthleteId?: string | null;
    userId?: string;
  } = { requestedAthleteId };
  try {
    const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);
    out.userId = userId;
    const { data } = await rlsClient
      .from("app_user_profiles")
      .select("athlete_id")
      .eq("user_id", userId)
      .maybeSingle();
    const aupAthleteId = (data as { athlete_id?: string | null } | null)?.athlete_id ?? null;
    out.userProfileAthleteId = aupAthleteId;
  } catch {
    // se anche l'auth fallisce, lasciamo soltanto il requestedAthleteId
  }
  return out;
}

/**
 * Serie temporale panel per grafici Health e archivio (valori strutturati in `values` JSON).
 */
export async function GET(req: NextRequest) {
  const requestedAthleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
  try {
    if (!requestedAthleteId) {
      return NextResponse.json(
        { ok: false as const, error: "missing_athleteId", panels: [] },
        { status: 400, headers: NO_STORE },
      );
    }

    const { db } = await requireAthleteReadContext(req, requestedAthleteId);

    const { data, error } = await db
      .from("biomarker_panels")
      .select("id, type, sample_date, reported_at, source, values, created_at")
      .eq("athlete_id", requestedAthleteId)
      .order("sample_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(48);

    if (error) {
      return NextResponse.json(
        { ok: false as const, error: error.message, panels: [], requestedAthleteId },
        { status: 500, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      {
        ok: true as const,
        athleteId: requestedAthleteId,
        panels: (data ?? []) as HealthPanelTimelineRow[],
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      const diag =
        err.status === 401 || err.status === 403
          ? await buildForbiddenDiagnostics(req, requestedAthleteId)
          : { requestedAthleteId };
      return NextResponse.json(
        { ok: false as const, error: err.message, panels: [], ...diag },
        { status: err.status, headers: NO_STORE },
      );
    }
    const message = err instanceof Error ? err.message : "Health timeline error";
    return NextResponse.json(
      { ok: false as const, error: message, panels: [], requestedAthleteId },
      { status: 500, headers: NO_STORE },
    );
  }
}
