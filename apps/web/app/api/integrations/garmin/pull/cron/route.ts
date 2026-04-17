import { type NextRequest, NextResponse } from "next/server";

import { runGarminPullJobs } from "@/lib/integrations/garmin-pull-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * **Vercel Cron** invoca solo **GET** con `Authorization: Bearer <CRON_SECRET>` (variabile `CRON_SECRET` nel progetto Vercel).
 * Stessa logica di `POST …/pull/run`: accetta anche `Bearer <GARMIN_PULL_RUN_SECRET>` per test manuali.
 */
function authorizeCron(req: NextRequest): boolean {
  const auth = req.headers.get("authorization")?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  const pullSecret = process.env.GARMIN_PULL_RUN_SECRET?.trim();
  if (!auth?.startsWith("Bearer ")) return false;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  if (pullSecret && auth === `Bearer ${pullSecret}`) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 401 });
  }

  let limit = 5;
  const raw = req.nextUrl.searchParams.get("limit");
  if (raw != null) {
    const n = Number(raw);
    if (Number.isFinite(n)) limit = Math.min(25, Math.max(1, Math.floor(n)));
  }

  try {
    const result = await runGarminPullJobs(limit);
    return NextResponse.json({
      ok: true as const,
      via: "cron_get",
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
      errors: result.errors,
      activitiesUpserted: result.activitiesUpserted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Esecuzione pull fallita.";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
