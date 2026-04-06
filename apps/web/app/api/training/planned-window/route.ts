import { NextRequest, NextResponse } from "next/server";
import {
  executedWorkoutFromDbRow,
  plannedWorkoutFromDbRow,
  type ExecutedWorkoutDbRow,
  type PlannedWorkoutDbRow,
} from "@empathy/domain-training";
import { canAccessAthleteData } from "@/lib/athlete/can-access-athlete-data";
import { TrainingRouteAuthError, requireAuthenticatedTrainingUser, supabaseForTrainingReadAfterAuth } from "@/lib/auth/training-route-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const EMPTY = { planned: [] as const, executed: [] as const };

function addDays(isoDate: string, delta: number): string {
  const base = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setDate(base.getDate() + delta);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Finestra calendario: `planned_workouts` + `executed_workouts`.
 * Auth: cookie o `Authorization: Bearer` (parity V1); letture con service role se configurato.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);

    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    let from = (req.nextUrl.searchParams.get("from") ?? "").trim();
    let to = (req.nextUrl.searchParams.get("to") ?? "").trim();

    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (!from) from = addDays(todayIso, -7);
    if (!to) to = addDays(todayIso, 28);

    if (!athleteId) {
      return NextResponse.json(
        { ok: false as const, error: "missing_athleteId", ...EMPTY },
        { status: 400, headers: NO_STORE },
      );
    }

    const allowed = await canAccessAthleteData(rlsClient, userId, athleteId, null);
    if (!allowed) {
      return NextResponse.json(
        { ok: false as const, error: "forbidden", ...EMPTY },
        { status: 403, headers: NO_STORE },
      );
    }

    const db = supabaseForTrainingReadAfterAuth(rlsClient);

    const [plannedRes, executedRes] = await Promise.all([
      db
        .from("planned_workouts")
        .select("id, athlete_id, date, type, duration_minutes, tss_target, kj_target, kcal_target, notes")
        .eq("athlete_id", athleteId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true }),
      db
        .from("executed_workouts")
        .select(
          "id, athlete_id, date, duration_minutes, tss, planned_workout_id, source, kcal, kj, trace_summary, lactate_mmoll, glucose_mmol, smo2, subjective_notes, external_id",
        )
        .eq("athlete_id", athleteId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true }),
    ]);

    const errMsg = plannedRes.error?.message ?? executedRes.error?.message ?? null;
    if (errMsg) {
      return NextResponse.json(
        { ok: false as const, error: errMsg, ...EMPTY },
        { status: 500, headers: NO_STORE },
      );
    }

    const planned = ((plannedRes.data ?? []) as PlannedWorkoutDbRow[]).map(plannedWorkoutFromDbRow);
    const executed = ((executedRes.data ?? []) as ExecutedWorkoutDbRow[]).map(executedWorkoutFromDbRow);

    return NextResponse.json(
      {
        ok: true as const,
        from,
        to,
        athleteId,
        planned,
        executed,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof TrainingRouteAuthError) {
      return NextResponse.json(
        { ok: false as const, error: err.message, ...EMPTY },
        { status: err.status, headers: NO_STORE },
      );
    }
    const message = err instanceof Error ? err.message : "planned-window failed";
    return NextResponse.json(
      { ok: false as const, error: message, ...EMPTY },
      { status: 500, headers: NO_STORE },
    );
  }
}
