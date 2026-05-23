import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { canAccessAthleteData } from "@/lib/athlete/can-access-athlete-data";
import { requireAuthenticatedTrainingUser } from "@/lib/auth/training-route-auth";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { contractToPlannedWorkoutRow } from "@/lib/training/library/contract-to-planned-row";
import { insertSinglePlannedWorkout } from "@/lib/training/planned/insert-planned-workout";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Copia seduta pianificata su altra data/atleta (insert only — sorgente invariata).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      sourceId?: string;
      athleteId?: string;
      date?: string;
    };
    const sourceId = String(body.sourceId ?? "").trim();
    const athleteId = String(body.athleteId ?? "").trim();
    const date = String(body.date ?? "").trim().slice(0, 10);
    if (!sourceId || !athleteId || !date) {
      return NextResponse.json({ ok: false as const, error: "missing_fields" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteWriteContext(req, athleteId);
    const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);

    const { data: source, error: readErr } = await db
      .from("planned_workouts")
      .select("id, athlete_id, date, type, duration_minutes, tss_target, kcal_target, notes")
      .eq("id", sourceId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!source) {
      return NextResponse.json({ ok: false as const, error: "source_not_found" }, { status: 404, headers: NO_STORE });
    }

    const sourceAthleteId = String((source as { athlete_id?: string }).athlete_id ?? "").trim();
    const canReadSource = await canAccessAthleteData(rlsClient, userId, sourceAthleteId, null);
    if (!canReadSource) {
      return NextResponse.json({ ok: false as const, error: "forbidden_source" }, { status: 403, headers: NO_STORE });
    }

    const notes = (source as { notes?: string | null }).notes;
    const contract = parsePro2BuilderSessionFromNotes(notes);
    let row;
    if (contract) {
      row = contractToPlannedWorkoutRow({ athleteId, date, contract });
    } else {
      row = {
        athlete_id: athleteId,
        date,
        type: String((source as { type?: string }).type ?? "pro2_builder").slice(0, 120),
        duration_minutes: Number((source as { duration_minutes?: number }).duration_minutes ?? 60),
        tss_target: Number((source as { tss_target?: number }).tss_target ?? 0),
        kcal_target:
          (source as { kcal_target?: number | null }).kcal_target != null
            ? Number((source as { kcal_target: number }).kcal_target)
            : null,
        notes: notes ?? null,
      };
    }

    const { id } = await insertSinglePlannedWorkout(db, row);
    return NextResponse.json(
      { ok: true as const, athleteId, date, plannedWorkoutId: id, sourceId },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "planned_clone_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
