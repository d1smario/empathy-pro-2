import { type NextRequest, NextResponse } from "next/server";

import {
  authorizeGarminPullEndpointBearer,
  garminPullEndpointSecretConfigured,
} from "@/lib/integrations/garmin-pull-endpoint-auth";
import { runGarminPullJobs } from "@/lib/integrations/garmin-pull-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * **Vercel Cron** invoca solo **GET** con `Authorization: Bearer <CRON_SECRET>` (variabile `CRON_SECRET` nel progetto Vercel).
 * Rete di sicurezza sulla coda: le push avviano anche un pull immediato in background (vedi push route + `waitUntil`).
 * Stessa logica di `POST …/pull/run`: `Bearer <CRON_SECRET>` o `Bearer <GARMIN_PULL_RUN_SECRET>`.
 */
export async function GET(req: NextRequest) {
  if (
    !garminPullEndpointSecretConfigured() ||
    !authorizeGarminPullEndpointBearer(req)
  ) {
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
      activityBlobsStored: result.activityBlobsStored,
      wellnessExportsUpserted: result.wellnessExportsUpserted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Esecuzione pull fallita.";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
