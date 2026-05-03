import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { runWahooPullForAthlete } from "@/lib/integrations/wahoo-pull-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pull Wahoo (`/v1/workouts`) → `device_sync_exports`.
 *
 * Body: `{ "athleteId": "<uuid>", "perPage"?: number }`.
 * Auth: sessione atleta oppure `Authorization: Bearer $WAHOO_PULL_RUN_SECRET`.
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

  const secret = process.env.WAHOO_PULL_RUN_SECRET?.trim();
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
    const result = await runWahooPullForAthlete({ athleteId, perPage });
    return NextResponse.json({ ok: true as const, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Wahoo pull fallito.";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
