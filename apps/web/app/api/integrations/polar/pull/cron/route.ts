import { type NextRequest, NextResponse } from "next/server";

import { runPolarPullCronBatch } from "@/lib/integrations/polar-pull-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * **Vercel Cron** invoca solo **GET** con `Authorization: Bearer <CRON_SECRET>`.
 * Accetta anche `Bearer <POLAR_PULL_RUN_SECRET>` per test manuali.
 */
function authorizeCron(req: NextRequest): boolean {
  const auth = req.headers.get("authorization")?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  const pullSecret = process.env.POLAR_PULL_RUN_SECRET?.trim();
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
    const result = await runPolarPullCronBatch(limit);
    return NextResponse.json({
      ok: true as const,
      via: "cron_get",
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Esecuzione pull Polar fallita.";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
