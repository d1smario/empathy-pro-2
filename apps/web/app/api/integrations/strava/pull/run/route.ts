import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { runStravaPullForAthlete } from "@/lib/integrations/strava-pull-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pull Strava activities (14d) -> device_sync_exports + executed_workouts.
 *
 * Body: `{ athleteId: string, perPage?: number }`
 * Auth: session atleta OR `Authorization: Bearer $STRAVA_PULL_RUN_SECRET`.
 */
export async function POST(req: NextRequest) {
  let athleteId = "";
  let perPage: number | undefined;
  try {
    const body = (await req.json()) as { athleteId?: string; perPage?: number };
    athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
    if (typeof body.perPage === "number" && Number.isFinite(body.perPage)) {
      perPage = Math.floor(body.perPage);
    }
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400 });
  }
  if (!athleteId) {
    return NextResponse.json({ ok: false as const, error: "Missing athleteId" }, { status: 400 });
  }
  const secret = process.env.STRAVA_PULL_RUN_SECRET?.trim();
  const auth = req.headers.get("authorization")?.trim();
  const cronAuth = Boolean(secret && auth === `Bearer ${secret}`);
  if (!cronAuth) {
    try {
      await requireAthleteReadContext(req, athleteId);
    } catch (e) {
      if (e instanceof AthleteReadContextError) {
        return NextResponse.json({ ok: false as const, error: e.message }, { status: e.status });
      }
      throw e;
    }
  }
  try {
    const result = await runStravaPullForAthlete({ athleteId, perPage });
    return NextResponse.json({ ok: true as const, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Strava pull fallito.";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
