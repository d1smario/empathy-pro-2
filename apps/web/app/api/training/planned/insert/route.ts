import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import type { PlannedWorkoutInsertPayload } from "@/lib/training/planned/clamp-planned-row";
import { insertSinglePlannedWorkout } from "@/lib/training/planned/insert-planned-workout";
import { purgeViryaPlannedWorkoutsOnDay } from "@/lib/training/planned/purge-virya-planned-on-day";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Scrittura singola su `planned_workouts` — stesso percorso che userà Vyria dopo aver orchestrato le date.
 * Builder genera la sessione; questo endpoint la materializza sul calendario operativo.
 * Insert via contesto write canonico dopo verifica accesso atleta.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { row?: Partial<PlannedWorkoutInsertPayload> };
    const raw = body.row;
    if (!raw?.athlete_id || !raw.date || !raw.type) {
      return NextResponse.json({ ok: false as const, error: "missing_athlete_id_date_or_type" }, { status: 400, headers: NO_STORE });
    }

    const athleteId = String(raw.athlete_id).trim();
    const { db } = await requireAthleteWriteContext(req, athleteId);
    const row: PlannedWorkoutInsertPayload = {
      athlete_id: athleteId,
      date: String(raw.date),
      type: String(raw.type),
      duration_minutes: Number(raw.duration_minutes ?? 0),
      tss_target: Number(raw.tss_target ?? 0),
      kcal_target: raw.kcal_target == null ? null : Number(raw.kcal_target),
      kj_target: raw.kj_target == null ? null : Number(raw.kj_target),
      notes: raw.notes == null ? null : String(raw.notes),
    };

    const notesText = row.notes ?? "";
    const isBuilderInsert =
      notesText.includes("[PRO2_BUILDER") || notesText.includes("BUILDER_SESSION_JSON");
    let purgedViryaOnDay = 0;
    const purgeViryaOnDay = (raw as { purge_virya_on_day?: boolean }).purge_virya_on_day;
    if (isBuilderInsert && purgeViryaOnDay !== false) {
      const purge = await purgeViryaPlannedWorkoutsOnDay(db, athleteId, row.date);
      purgedViryaOnDay = purge.purgedCount;
    }

    const { id, dedupeSkipped, replacedSameTypeCount } = await insertSinglePlannedWorkout(db, row);

    return NextResponse.json(
      {
        ok: true as const,
        athleteId,
        plannedWorkoutId: id,
        purgedViryaOnDay,
        dedupeSkipped: dedupeSkipped === true,
        replacedSameTypeCount: replacedSameTypeCount ?? 0,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "planned insert failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
