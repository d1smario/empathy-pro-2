import { NextRequest, NextResponse } from "next/server";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { requireAuthenticatedTrainingUser } from "@/lib/auth/training-route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clampPlannedWorkoutRow, type PlannedWorkoutInsertPayload } from "@/lib/training/planned/clamp-planned-row";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

type PlannedWorkoutPayload = PlannedWorkoutInsertPayload;

function toInsertRecord(row: PlannedWorkoutInsertPayload): Record<string, unknown> {
  const r = clampPlannedWorkoutRow(row);
  const p: Record<string, unknown> = {
    athlete_id: r.athlete_id,
    date: r.date,
    type: r.type,
    duration_minutes: r.duration_minutes,
    tss_target: r.tss_target,
    kcal_target: r.kcal_target,
    notes: r.notes,
  };
  if (r.kj_target != null) p.kj_target = r.kj_target;
  return p;
}

async function memoryOrNull(athleteId: string) {
  try {
    return await resolveAthleteMemory(athleteId);
  } catch {
    return null;
  }
}

/** V1-parity: batch replace (Virya) o insert singolo; clamp Pro2 al posto del guardrail V1. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      row?: PlannedWorkoutPayload;
      rows?: PlannedWorkoutPayload[];
      replaceTag?: string;
      athleteId?: string;
    };

    if (Array.isArray(body.rows)) {
      const athleteId = (body.athleteId ?? body.rows[0]?.athlete_id ?? "").trim();
      if (!athleteId) {
        return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
      }
      const { db } = await requireAthleteWriteContext(req, athleteId);
      const payloads = body.rows.map((row) => toInsertRecord(row));
      if (!payloads.length) {
        return NextResponse.json({ error: "rows is empty" }, { status: 400, headers: NO_STORE });
      }
      if (body.replaceTag && body.athleteId) {
        const tag = String(body.replaceTag);
        const { error: delErr } = await db
          .from("planned_workouts")
          .delete()
          .eq("athlete_id", body.athleteId)
          .ilike("notes", `${tag}%`);
        if (delErr) {
          return NextResponse.json({ error: delErr.message }, { status: 500, headers: NO_STORE });
        }
      }
      const { error: insertErr } = await db.from("planned_workouts").insert(payloads);
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500, headers: NO_STORE });
      }
      return NextResponse.json(
        { status: "ok" as const, athleteMemory: await memoryOrNull(athleteId) },
        { headers: NO_STORE },
      );
    }

    if (!body.row) {
      return NextResponse.json({ error: "Missing row payload" }, { status: 400, headers: NO_STORE });
    }
    const aid = String(body.row.athlete_id ?? "").trim();
    const { db } = await requireAthleteWriteContext(req, aid);
    const insertPayload = toInsertRecord(body.row);
    const { error } = await db.from("planned_workouts").insert(insertPayload);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    }
    return NextResponse.json(
      { status: "ok" as const, athleteMemory: await memoryOrNull(aid) },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Training planned POST failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id?: string;
      athleteId?: string;
      patch?: Partial<PlannedWorkoutPayload>;
    };
    if (!body.id || !body.athleteId || !body.patch) {
      return NextResponse.json({ error: "Missing id, athleteId or patch" }, { status: 400, headers: NO_STORE });
    }
    const { db } = await requireAthleteWriteContext(req, body.athleteId);
    const { data: updatedRows, error } = await db
      .from("planned_workouts")
      .update(body.patch)
      .eq("id", body.id)
      .eq("athlete_id", body.athleteId)
      .select("id");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    }
    if (!updatedRows?.length) {
      return NextResponse.json(
        { error: "Planned workout not found or not updatable for this athlete" },
        { status: 404, headers: NO_STORE },
      );
    }
    return NextResponse.json(
      { status: "ok" as const, athleteMemory: await memoryOrNull(body.athleteId) },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Training planned PATCH failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; athleteId?: string };
    let id = String(body.id ?? "").trim();
    if (!id) {
      id = (req.nextUrl.searchParams.get("id") ?? "").trim();
    }
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400, headers: NO_STORE });
    }

    /**
     * Risoluzione per `id` sola: il client può inviare un `athleteId` (contesto UI) che non coincide con
     * `planned_workouts.athlete_id` della riga (localStorage stale, merge profili). Prima leggevamo solo
     * con la coppia body → 0 righe eliminate. Qui usiamo l’athlete_id reale della riga dopo auth.
     */
    const { rlsClient } = await requireAuthenticatedTrainingUser(req);
    const probeDb = createSupabaseAdminClient() ?? rlsClient;
    const { data: existing, error: readErr } = await probeDb
      .from("planned_workouts")
      .select("id, athlete_id")
      .eq("id", id)
      .maybeSingle();
    if (readErr) {
      return NextResponse.json({ error: readErr.message }, { status: 500, headers: NO_STORE });
    }
    const rowAthleteId = typeof existing?.athlete_id === "string" ? existing.athlete_id.trim() : "";
    if (!existing?.id || !rowAthleteId) {
      return NextResponse.json(
        { error: "Planned workout not found or not deletable for this athlete" },
        { status: 404, headers: NO_STORE },
      );
    }

    const { db } = await requireAthleteWriteContext(req, rowAthleteId);
    const { data: deletedRows, error } = await db
      .from("planned_workouts")
      .delete()
      .eq("id", id)
      .eq("athlete_id", rowAthleteId)
      .select("id");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    }
    if (!deletedRows?.length) {
      return NextResponse.json(
        { error: "Planned workout not found or not deletable for this athlete" },
        { status: 404, headers: NO_STORE },
      );
    }
    return NextResponse.json(
      { status: "ok" as const, athleteMemory: await memoryOrNull(rowAthleteId) },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Training planned DELETE failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
