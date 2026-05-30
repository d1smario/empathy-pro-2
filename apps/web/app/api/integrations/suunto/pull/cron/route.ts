import { type NextRequest, NextResponse } from "next/server";

import { runSuuntoPullCronBatch } from "@/lib/integrations/suunto-pull-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vercel Cron (GET) con Bearer CRON_SECRET o SUUNTO_PULL_RUN_SECRET. */
function authorizeCron(req: NextRequest): boolean {
  const auth = req.headers.get("authorization")?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  const pullSecret = process.env.SUUNTO_PULL_RUN_SECRET?.trim();
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
    const result = await runSuuntoPullCronBatch(limit);
    return NextResponse.json({ ok: true as const, via: "cron_get", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Esecuzione pull Suunto fallita.";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
