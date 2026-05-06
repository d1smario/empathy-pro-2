import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { persistExecutedWorkoutSeriesFromTrace } from "@/lib/training/import-series-persist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Backfill `executed_workout_series` partendo dai `trace_summary` già persistenti
 * negli `executed_workouts`. Idempotente grazie all'`onConflict` upsert nel persist
 * (vedi `persistExecutedWorkoutSeriesFromTrace`).
 *
 * Body JSON opzionale:
 *  - `athleteId` (string, obbligatorio)
 *  - `since` (YYYY-MM-DD): includi workout con `date >= since`
 *  - `until` (YYYY-MM-DD): includi workout con `date <= until`
 *  - `limit` (number, default 250, max 1000)
 *  - `skipIfAlreadyHasSeries` (default true): salta workout con già almeno una riga serie
 *
 * Risposta:
 *  - `{ ok: true, scanned, attempted, written, skipped, errors[] }`
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const athleteId = String(body.athleteId ?? "").trim();
  const since = typeof body.since === "string" && body.since.trim() ? body.since.trim() : null;
  const until = typeof body.until === "string" && body.until.trim() ? body.until.trim() : null;
  const limitRaw = typeof body.limit === "number" ? body.limit : 250;
  const limit = Math.max(1, Math.min(1000, Math.trunc(limitRaw)));
  const skipIfAlreadyHasSeries =
    typeof body.skipIfAlreadyHasSeries === "boolean" ? body.skipIfAlreadyHasSeries : true;

  if (!athleteId) {
    return NextResponse.json(
      { ok: false as const, error: "missing_athlete_id" },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const { db } = await requireAthleteWriteContext(req, athleteId);

    let q = db
      .from("executed_workouts")
      .select("id, date, trace_summary, source")
      .eq("athlete_id", athleteId)
      .order("date", { ascending: false })
      .limit(limit);

    if (since) q = q.gte("date", since);
    if (until) q = q.lte("date", until);

    const listRes = await q;
    if (listRes.error) {
      return NextResponse.json(
        { ok: false as const, error: listRes.error.message },
        { status: 500, headers: NO_STORE },
      );
    }

    type Row = {
      id: string;
      date: string;
      trace_summary: Record<string, unknown> | null;
      source: string | null;
    };
    const rows = (listRes.data ?? []) as Row[];

    let alreadyByWorkout = new Set<string>();
    if (skipIfAlreadyHasSeries && rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const existRes = await db
        .from("executed_workout_series")
        .select("executed_workout_id")
        .in("executed_workout_id", ids);
      if (!existRes.error && existRes.data) {
        alreadyByWorkout = new Set<string>(
          (existRes.data as Array<{ executed_workout_id: string }>).map((r) => r.executed_workout_id),
        );
      }
    }

    let scanned = 0;
    let attempted = 0;
    let written = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      scanned += 1;
      if (!row.trace_summary) {
        skipped += 1;
        continue;
      }
      if (skipIfAlreadyHasSeries && alreadyByWorkout.has(row.id)) {
        skipped += 1;
        continue;
      }
      const parserEngine =
        typeof row.trace_summary.parser_engine === "string"
          ? (row.trace_summary.parser_engine as string)
          : null;
      const parserVersion =
        typeof row.trace_summary.parser_version === "string"
          ? (row.trace_summary.parser_version as string)
          : null;

      try {
        const out = await persistExecutedWorkoutSeriesFromTrace({
          db,
          athleteId,
          executedWorkoutId: row.id,
          traceSummary: row.trace_summary,
          parserEngine,
          parserVersion,
          source: `backfill:${row.source ?? "unknown"}`,
        });
        attempted += out.attempted;
        written += out.written;
        skipped += out.skipped;
        if (out.errors.length > 0) {
          errors.push(`${row.id}: ${out.errors.join("; ")}`);
        }
      } catch (err) {
        errors.push(`${row.id}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    return NextResponse.json(
      {
        ok: true as const,
        athleteId,
        window: { since, until, limit },
        scanned,
        attempted,
        written,
        skipped,
        errors,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json(
        { ok: false as const, error: err.message },
        { status: err.status, headers: NO_STORE },
      );
    }
    const message = err instanceof Error ? err.message : "backfill_failed";
    return NextResponse.json(
      { ok: false as const, error: message },
      { status: 500, headers: NO_STORE },
    );
  }
}
