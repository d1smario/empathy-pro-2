import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { runPolarPullForAthlete, type PolarPullStreams } from "@/lib/integrations/polar-pull-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pull Polar (exercises, sleep, nightly-recharge) → `device_sync_exports`.
 *
 * - **Sessione atleta**: `POST` JSON `{ "athleteId": "<uuid>", "streams"?: { exercise?, sleep?, recharge? } }`.
 * - **Server-to-server**: `Authorization: Bearer $POLAR_PULL_RUN_SECRET` + stesso body.
 * - **Vercel Cron**: `GET /api/integrations/polar/pull/cron` con `Bearer $CRON_SECRET` o `$POLAR_PULL_RUN_SECRET`.
 */
export async function POST(req: NextRequest) {
  let athleteId = "";
  let streams: PolarPullStreams | null | undefined;
  try {
    const body = (await req.json()) as { athleteId?: string; streams?: PolarPullStreams | null };
    athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
    if (body.streams && typeof body.streams === "object") {
      streams = body.streams;
    }
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400 });
  }

  if (!athleteId) {
    return NextResponse.json({ ok: false as const, error: "Missing athleteId" }, { status: 400 });
  }

  const secret = process.env.POLAR_PULL_RUN_SECRET?.trim();
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
    const result = await runPolarPullForAthlete({ athleteId, streams });
    return NextResponse.json({ ok: true as const, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Polar pull fallito.";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
