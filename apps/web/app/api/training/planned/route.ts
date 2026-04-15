import { NextRequest, NextResponse } from "next/server";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAthleteWriteContext,
} from "@/lib/auth/athlete-read-context";
import {
  requireAuthenticatedTrainingUser,
  supabaseForTrainingReadAfterAuth,
} from "@/lib/auth/training-route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clampPlannedWorkoutRow, type PlannedWorkoutInsertPayload } from "@/lib/training/planned/clamp-planned-row";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function deleteProbeHeaders(probe: string): Record<string, string> {
  return { ...NO_STORE, "x-empathy-delete-probe": probe };
}

/** Allinea a ciò che PostgREST/UUID accettano (copia da UI, graffe, maiuscole). */
function normalizeUuidParam(raw: string): string {
  return raw.trim().replace(/^\{|\}$/g, "").toLowerCase();
}

function athleteIdFromRow(row: Record<string, unknown>): string {
  const v = row.athlete_id ?? row.athleteId;
  return typeof v === "string" ? normalizeUuidParam(v) : "";
}

function idFromRow(row: Record<string, unknown>): string {
  const v = row.id;
  return typeof v === "string" ? normalizeUuidParam(v) : "";
}

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
      /**
       * Sostituzione piano VIRYA: rimuove le righe precedenti nello **stesso intervallo di date**
       * del batch. Usa un sotto-pattern con `[` **escapato**: in PostgreSQL ILIKE/LIKE `[` apre
       * una character class, quindi `[VIRYA:…]%` non matchava mai e le vecchie sedute non venivano cancellate.
       */
      if (body.replaceTag && body.athleteId) {
        const aid = String(body.athleteId);
        const dateStrs = payloads
          .map((p) => {
            const d = (p as { date?: unknown }).date;
            return typeof d === "string" ? d.trim() : "";
          })
          .filter(Boolean);
        if (dateStrs.length) {
          const minD = dateStrs.reduce((a, b) => (a < b ? a : b));
          const maxD = dateStrs.reduce((a, b) => (a > b ? a : b));
          const viryaMarker = "%\\[VIRYA:%";
          const { error: delErr } = await db
            .from("planned_workouts")
            .delete()
            .eq("athlete_id", aid)
            .gte("date", minD)
            .lte("date", maxD)
            .ilike("notes", viryaMarker);
          if (delErr) {
            return NextResponse.json({ error: delErr.message }, { status: 500, headers: NO_STORE });
          }
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
  let deleteProbe = "init";
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; athleteId?: string };
    let id = String(body.id ?? "").trim();
    let athleteIdHint = String(body.athleteId ?? "").trim();
    if (!id) {
      id = (req.nextUrl.searchParams.get("id") ?? "").trim();
    }
    if (!athleteIdHint) {
      athleteIdHint = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    }
    id = normalizeUuidParam(id);
    if (athleteIdHint) athleteIdHint = normalizeUuidParam(athleteIdHint);
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400, headers: deleteProbeHeaders("bad_request_no_id") });
    }

    const { rlsClient } = await requireAuthenticatedTrainingUser(req);
    const adminOnce = createSupabaseAdminClient();
    const hadServiceRole = adminOnce != null;

    /**
     * 1) `requireAthleteReadContext` + stesso stack lettura training (`admin ?? rls`) di planned-window.
     * 2) Se strict (id + athlete_id) fallisce, retry solo `id` ma accettiamo la riga solo se `athlete_id` coincide col hint
     *    (evita delete cross-atleta; risolve mismatch maiuscole/spazi su UUID).
     * 3) Fallback globale: **stesso** `supabaseForTrainingReadAfterAuth(rls)` della lettura modulo — non usare solo `rlsClient`
     *    se il service role è attivo (prima il global usava `rlsClient` e poteva divergere dal client di finestra).
     */
    let scoped: "skip" | "hit" | "hit_relaxed" | "miss" | "err" | "db_err" | "wrong_athlete" = athleteIdHint
      ? "miss"
      : "skip";
    let scopedDbError: string | undefined;
    let row0: Record<string, unknown> | null = null;
    if (athleteIdHint) {
      try {
        const { db } = await requireAthleteReadContext(req, athleteIdHint);
        const strict = await db
          .from("planned_workouts")
          .select("id, athlete_id")
          .eq("id", id)
          .eq("athlete_id", athleteIdHint)
          .limit(1);
        if (strict.error) {
          scopedDbError = strict.error.message;
          scoped = "db_err";
        } else if (strict.data?.[0]) {
          row0 = strict.data[0] as Record<string, unknown>;
          scoped = "hit";
        }
        if (!row0) {
          const relaxed = await db
            .from("planned_workouts")
            .select("id, athlete_id")
            .eq("id", id)
            .limit(1);
          if (relaxed.error) {
            scopedDbError = scopedDbError ?? relaxed.error.message;
            scoped = "db_err";
          } else if (relaxed.data?.[0]) {
            const r = relaxed.data[0] as Record<string, unknown>;
            if (athleteIdFromRow(r) === athleteIdHint) {
              row0 = r;
              scoped = "hit_relaxed";
            } else {
              scoped = "wrong_athlete";
            }
          } else if (scoped !== "db_err") {
            scoped = "miss";
          }
        }
      } catch {
        scoped = "err";
        /* hint non accessibile: si tenta il fallback globale */
      }
    }

    let global: "skip" | "hit" | "miss" | "error" = "skip";
    if (!row0) {
      if (scoped === "wrong_athlete") {
        deleteProbe = `scoped=${scoped};global=skip`;
        return NextResponse.json(
          {
            error:
              "Esiste una riga con questo id ma per un altro atleta: l’athleteId inviato non coincide con planned_workouts.athlete_id.",
            errorCode: "planned_id_wrong_athlete",
          },
          { status: 403, headers: deleteProbeHeaders(deleteProbe) },
        );
      }
      const probeDb = adminOnce ?? supabaseForTrainingReadAfterAuth(rlsClient);
      const { data: probeRows, error: readErr } = await probeDb
        .from("planned_workouts")
        .select("id, athlete_id")
        .eq("id", id)
        .limit(1);
      if (readErr) {
        deleteProbe = `scoped=${scoped};global=error`;
        return NextResponse.json({ error: readErr.message }, { status: 500, headers: deleteProbeHeaders(deleteProbe) });
      }
      row0 = (probeRows?.[0] ?? null) as Record<string, unknown> | null;
      global = row0 ? "hit" : "miss";
    } else {
      global = "skip";
    }
    deleteProbe = `scoped=${scoped};global=${global}`;
    const rowId = row0 ? idFromRow(row0) : "";
    const rowAthleteId = row0 ? athleteIdFromRow(row0) : "";
    if (!rowId || !rowAthleteId) {
      return NextResponse.json(
        {
          error:
            "Nessuna riga planned_workouts con questo id. Confronta l’id con la risposta GET /api/training/planned-window (stessa sessione); in produzione verifica NEXT_PUBLIC_SUPABASE_URL e che SUPABASE_SERVICE_ROLE_KEY sia impostata se usi letture training con service role.",
          errorCode: "planned_probe_empty",
          deleteHints: {
            scoped,
            global,
            hadServiceRole,
            scopedDbError: scopedDbError ?? null,
          },
        },
        { status: 404, headers: deleteProbeHeaders(deleteProbe) },
      );
    }

    const { db } = await requireAthleteWriteContext(req, rowAthleteId);
    /**
     * Dopo il gate su `rowAthleteId`, cancelliamo solo per PK `id` (come insert materializza una riga per id).
     * Un secondo `.eq("athlete_id", …)` può dare 0 righe se c’è disallineamento tipo/formato pur con accesso ok.
     */
    const { data: deletedRows, error } = await db.from("planned_workouts").delete().eq("id", id).select("id");
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: deleteProbeHeaders(`${deleteProbe};delete=error`) },
      );
    }
    if (!deletedRows?.length) {
      return NextResponse.json(
        {
          error: "Delete non ha rimosso righe: controlla RLS/policies su planned_workouts per il ruolo usato dall’API.",
          errorCode: "planned_delete_noop",
        },
        { status: 404, headers: deleteProbeHeaders(`${deleteProbe};delete=noop`) },
      );
    }
    return NextResponse.json(
      { status: "ok" as const, athleteMemory: await memoryOrNull(rowAthleteId) },
      { headers: deleteProbeHeaders(`${deleteProbe};delete=ok`) },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status, headers: deleteProbeHeaders(`exception|${deleteProbe}`) },
      );
    }
    const message = err instanceof Error ? err.message : "Training planned DELETE failed";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: deleteProbeHeaders(`exception|${deleteProbe}`) },
    );
  }
}
