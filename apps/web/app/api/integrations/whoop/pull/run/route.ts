import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { runWhoopPullForAthlete, type WhoopPullStreams } from "@/lib/integrations/whoop-pull-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pull WHOOP (sleep v2) → `device_sync_exports`.
 *
 * - **Sessione atleta**: `POST` JSON `{ "athleteId": "<uuid>", "limit"?: number, "maxCollectionPages"?: number, "streams"?: … }` (cookie auth).
 * - **Server-to-server** (opzionale): `Authorization: Bearer $WHOOP_PULL_RUN_SECRET` + stesso body
 *   (es. cron senza browser); richiede `WHOOP_PULL_RUN_SECRET` configurato.
 */
export async function POST(req: NextRequest) {
  let athleteId = "";
  let limit: number | undefined;
  let maxCollectionPages: number | undefined;
  let streams: WhoopPullStreams | null | undefined;
  try {
    const body = (await req.json()) as {
      athleteId?: string;
      limit?: number;
      maxCollectionPages?: number;
      streams?: WhoopPullStreams | null;
    };
    athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
    if (typeof body.limit === "number" && Number.isFinite(body.limit)) {
      limit = Math.floor(body.limit);
    }
    if (typeof body.maxCollectionPages === "number" && Number.isFinite(body.maxCollectionPages)) {
      maxCollectionPages = Math.floor(body.maxCollectionPages);
    }
    if (body.streams && typeof body.streams === "object") {
      streams = body.streams;
    }
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400 });
  }

  if (!athleteId) {
    return NextResponse.json({ ok: false as const, error: "Missing athleteId" }, { status: 400 });
  }

  const secret = process.env.WHOOP_PULL_RUN_SECRET?.trim();
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
    const result = await runWhoopPullForAthlete({ athleteId, limit, maxCollectionPages, streams });
    return NextResponse.json({ ok: true as const, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "WHOOP pull fallito.";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
