import { NextRequest, NextResponse } from "next/server";
import { canAccessAthleteData } from "@/lib/athlete/can-access-athlete-data";
import { clampPlannedWorkoutRow, type PlannedWorkoutInsertPayload } from "@/lib/training/planned/clamp-planned-row";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Scrittura singola su `planned_workouts` — stesso percorso che userà Vyria dopo aver orchestrato le date.
 * Builder genera la sessione; questo endpoint la materializza sul calendario operativo.
 */
export async function POST(req: NextRequest) {
  const client = createSupabaseCookieClient();
  if (!client) {
    return NextResponse.json({ ok: false as const, error: "supabase_unconfigured" }, { status: 503, headers: NO_STORE });
  }

  const {
    data: { user },
    error: authErr,
  } = await client.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false as const, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const body = (await req.json()) as { row?: Partial<PlannedWorkoutInsertPayload> };
  const raw = body.row;
  if (!raw?.athlete_id || !raw.date || !raw.type) {
    return NextResponse.json({ ok: false as const, error: "missing_athlete_id_date_or_type" }, { status: 400, headers: NO_STORE });
  }

  const athleteId = String(raw.athlete_id).trim();
  const allowed = await canAccessAthleteData(client, user.id, athleteId, null);
  if (!allowed) {
    return NextResponse.json({ ok: false as const, error: "forbidden" }, { status: 403, headers: NO_STORE });
  }

  const row = clampPlannedWorkoutRow({
    athlete_id: athleteId,
    date: String(raw.date),
    type: String(raw.type),
    duration_minutes: Number(raw.duration_minutes ?? 0),
    tss_target: Number(raw.tss_target ?? 0),
    kcal_target: raw.kcal_target == null ? null : Number(raw.kcal_target),
    kj_target: raw.kj_target == null ? null : Number(raw.kj_target),
    notes: raw.notes == null ? null : String(raw.notes),
  });

  const insertPayload: Record<string, unknown> = {
    athlete_id: row.athlete_id,
    date: row.date,
    type: row.type,
    duration_minutes: row.duration_minutes,
    tss_target: row.tss_target,
    kcal_target: row.kcal_target,
    notes: row.notes,
  };
  if (row.kj_target != null) {
    insertPayload.kj_target = row.kj_target;
  }

  const { data: inserted, error } = await client.from("planned_workouts").insert(insertPayload).select("id").maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }

  const id = inserted && typeof (inserted as { id?: string }).id === "string" ? (inserted as { id: string }).id : null;

  return NextResponse.json({ ok: true as const, athleteId, plannedWorkoutId: id }, { headers: NO_STORE });
}
