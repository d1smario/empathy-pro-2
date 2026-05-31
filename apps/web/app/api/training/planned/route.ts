import { NextRequest, NextResponse } from "next/server";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";
import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAthleteWriteContext,
  requireAuthenticatedTrainingUser,
  supabaseForAthleteTableRead,
} from "@/lib/auth/athlete-read-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clampPlannedWorkoutRow, type PlannedWorkoutInsertPayload } from "@/lib/training/planned/clamp-planned-row";
import {
  insertPlannedWorkoutRows,
  insertSinglePlannedWorkout,
} from "@/lib/training/planned/insert-planned-workout";
import {
  extractViryaTagFromPlannedNotes,
  ilikeContainsViryaTag,
  VIRYA_NOTES_ILIKE_MARKER,
} from "@/lib/training/virya/virya-planned-notes";

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

function calendarAuditSuffix(
  audit:
    | {
        source?: string;
        coachTraceIds?: string[];
        viryaRetuneMode?: string | null;
      }
    | undefined,
): string | null {
  if (!audit) return null;
  const ids = (audit.coachTraceIds ?? []).filter(Boolean).slice(0, 10);
  if (!ids.length && !audit.viryaRetuneMode && !audit.source) return null;
  const src = (audit.source ?? "unknown").replace(/\|/g, " ").slice(0, 80);
  const mode = (audit.viryaRetuneMode ?? "").replace(/\|/g, " ").slice(0, 80);
  return `\n[EMPATHY_CAL|src=${src}|mode=${mode}|tr=${ids.join(",")}]`;
}

async function memoryOrNull(athleteId: string) {
  try {
    return await resolveAthleteMemorySlice(athleteId, { slice: "training" });
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
      generationAudit?: {
        source?: string;
        coachTraceIds?: string[];
        viryaRetuneMode?: string | null;
      };
    };

    if (Array.isArray(body.rows)) {
      const athleteId = (body.athleteId ?? body.rows[0]?.athlete_id ?? "").trim();
      if (!athleteId) {
        return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
      }
      const { db } = await requireAthleteWriteContext(req, athleteId);
      const auditSuffix = calendarAuditSuffix(body.generationAudit);
      const rowsForInsert = body.rows.map((row) => {
        if (!auditSuffix) return row;
        const mergedNotes = `${row.notes ?? ""}${auditSuffix}`.trim();
        return { ...row, notes: mergedNotes || null };
      });
      if (!rowsForInsert.length) {
        return NextResponse.json({ error: "rows is empty" }, { status: 400, headers: NO_STORE });
      }
      /**
       * Sostituzione piano VIRYA: rimuove le righe precedenti nello **stesso intervallo di date**
       * del batch. Usa un sotto-pattern con `[` **escapato**: in PostgreSQL ILIKE/LIKE `[` apre
       * una character class, quindi `[VIRYA:…]%` non matchava mai e le vecchie sedute non venivano cancellate.
       */
      if (body.replaceTag && body.athleteId) {
        const aid = String(body.athleteId);
        const dateStrs = rowsForInsert
          .map((p) => (typeof p.date === "string" ? p.date.trim() : ""))
          .filter(Boolean);
        if (dateStrs.length) {
          const minD = dateStrs.reduce((a, b) => (a < b ? a : b));
          const maxD = dateStrs.reduce((a, b) => (a > b ? a : b));
          const viryaMarker = VIRYA_NOTES_ILIKE_MARKER;
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
      const { ids, dedupeSkippedCount, replacedSameTypeCount } = await insertPlannedWorkoutRows(db, rowsForInsert);
      return NextResponse.json(
        {
          status: "ok" as const,
          insertedCount: ids.length,
          dedupeSkippedCount,
          replacedSameTypeCount,
          athleteMemory: await memoryOrNull(athleteId),
        },
        { headers: NO_STORE },
      );
    }

    if (!body.row) {
      return NextResponse.json({ error: "Missing row payload" }, { status: 400, headers: NO_STORE });
    }
    const aid = String(body.row.athlete_id ?? "").trim();
    const { db } = await requireAthleteWriteContext(req, aid);
    const auditSuffix = calendarAuditSuffix(body.generationAudit);
    const rowForInsert =
      auditSuffix && body.row
        ? { ...body.row, notes: `${body.row.notes ?? ""}${auditSuffix}`.trim() || null }
        : body.row;
    await insertSinglePlannedWorkout(db, rowForInsert);
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
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      athleteId?: string;
      /** Rimuove tutte le righe `planned_workouts` per atleta + data (duplicati builder/demo stesso giorno). */
      deleteAllOnDate?: string;
      /** Per sedute VIRYA: rimuove anche altre righe stesso giorno + stesso tag (duplicati ripubblicazione). */
      purgeViryaDayDuplicates?: boolean;
      /** Elimina tutte le righe con questo tag VIRYA (stesso effetto di DELETE /api/training/virya/plans). */
      deleteViryaPlanTag?: string;
    };
    let id = String(body.id ?? "").trim();
    let athleteIdHint = String(body.athleteId ?? "").trim();
    const deleteAllOnDate = String(body.deleteAllOnDate ?? "").trim().slice(0, 10);
    if (!id) {
      id = (req.nextUrl.searchParams.get("id") ?? "").trim();
    }
    if (!athleteIdHint) {
      athleteIdHint = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    }
    id = normalizeUuidParam(id);
    if (athleteIdHint) athleteIdHint = normalizeUuidParam(athleteIdHint);

    const { rlsClient } = await requireAuthenticatedTrainingUser(req);
    const adminOnce = createSupabaseAdminClient();
    const hadServiceRole = adminOnce != null;

    if (deleteAllOnDate && /^\d{4}-\d{2}-\d{2}$/.test(deleteAllOnDate)) {
      if (!athleteIdHint) {
        return NextResponse.json(
          { error: "Missing athleteId for deleteAllOnDate", errorCode: "planned_delete_day_missing_athlete" },
          { status: 400, headers: deleteProbeHeaders("bad_request_day_no_athlete") },
        );
      }
      const { db } = await requireAthleteWriteContext(req, athleteIdHint);
      const deleteDb = adminOnce ?? db;
      const { data: deletedRows, error: dayDelErr } = await deleteDb
        .from("planned_workouts")
        .delete()
        .eq("athlete_id", athleteIdHint)
        .eq("date", deleteAllOnDate)
        .select("id");
      if (dayDelErr) {
        return NextResponse.json(
          { error: dayDelErr.message, errorCode: "planned_delete_day_failed" },
          { status: 500, headers: deleteProbeHeaders("delete_day=error") },
        );
      }
      const deletedOnDateCount = deletedRows?.length ?? 0;
      const { data: remain, error: remainErr } = await deleteDb
        .from("planned_workouts")
        .select("id")
        .eq("athlete_id", athleteIdHint)
        .eq("date", deleteAllOnDate)
        .limit(1);
      if (remainErr) {
        return NextResponse.json(
          { error: remainErr.message, errorCode: "planned_delete_day_verify_failed" },
          { status: 500, headers: deleteProbeHeaders("delete_day_verify=error") },
        );
      }
      if (remain?.length) {
        return NextResponse.json(
          {
            error:
              "Restano sedute pianificate su questa data dopo DELETE giorno: verifica RLS o SUPABASE_SERVICE_ROLE_KEY su Vercel.",
            errorCode: "planned_delete_day_verify_failed",
            deletedOnDateCount,
          },
          { status: 409, headers: deleteProbeHeaders("delete_day_verify=still_there") },
        );
      }
      return NextResponse.json(
        {
          status: "ok" as const,
          deletedOnDateCount,
          date: deleteAllOnDate,
          athleteMemory: await memoryOrNull(athleteIdHint),
          deleteHints: { hadServiceRole, mode: "delete_all_on_date" },
        },
        { headers: deleteProbeHeaders(`delete_day=ok;n=${deletedOnDateCount}`) },
      );
    }

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400, headers: deleteProbeHeaders("bad_request_no_id") });
    }

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
          .select("id, athlete_id, date, notes")
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
            .select("id, athlete_id, date, notes")
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
      const probeDb = adminOnce ?? supabaseForAthleteTableRead(rlsClient);
      const { data: probeRows, error: readErr } = await probeDb
        .from("planned_workouts")
        .select("id, athlete_id, date, notes")
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
      /** Secondo DELETE sulla stessa id: riga già assente (es. eliminazione VIRYA bulk o primo click riuscito). */
      return NextResponse.json(
        {
          status: "ok" as const,
          alreadyDeleted: true as const,
          athleteMemory: athleteIdHint ? await memoryOrNull(athleteIdHint) : null,
          deleteHints: {
            scoped,
            global,
            hadServiceRole,
            scopedDbError: scopedDbError ?? null,
          },
        },
        { headers: deleteProbeHeaders(`${deleteProbe};delete=idempotent_miss`) },
      );
    }

    const { db } = await requireAthleteWriteContext(req, rowAthleteId);
    const deleteDb = adminOnce ?? db;

    let deletedViryaPlanRows = 0;
    const deleteViryaPlanTagBody = (body.deleteViryaPlanTag ?? "").trim();
    if (deleteViryaPlanTagBody.startsWith("[VIRYA:")) {
      const pattern = ilikeContainsViryaTag(deleteViryaPlanTagBody);
      const { data: planRows, error: planDelErr } = await deleteDb
        .from("planned_workouts")
        .delete()
        .eq("athlete_id", rowAthleteId)
        .ilike("notes", pattern)
        .select("id");
      if (planDelErr) {
        return NextResponse.json(
          { error: planDelErr.message, errorCode: "planned_virya_plan_purge_failed" },
          { status: 500, headers: deleteProbeHeaders(`${deleteProbe};virya_plan=error`) },
        );
      }
      deletedViryaPlanRows = planRows?.length ?? 0;
      deleteProbe = `${deleteProbe};virya_plan=${deletedViryaPlanRows}`;
      const { data: planRemain, error: planRemainErr } = await deleteDb
        .from("planned_workouts")
        .select("id")
        .eq("athlete_id", rowAthleteId)
        .ilike("notes", pattern)
        .limit(1);
      if (planRemainErr) {
        return NextResponse.json(
          { error: planRemainErr.message, errorCode: "virya_plan_delete_verify_failed" },
          { status: 500, headers: deleteProbeHeaders(`${deleteProbe};virya_verify=error`) },
        );
      }
      if (planRemain?.length) {
        return NextResponse.json(
          {
            error:
              "Dopo eliminazione piano VIRYA restano righe con lo stesso tag in planned_workouts (RLS o ripubblicazione).",
            errorCode: "virya_plan_delete_verify_failed",
            deletedViryaPlanRows,
          },
          { status: 409, headers: deleteProbeHeaders(`${deleteProbe};virya_verify=still_there`) },
        );
      }
    } else {
      const { data: deletedRows, error } = await deleteDb
        .from("planned_workouts")
        .delete()
        .eq("id", id)
        .eq("athlete_id", rowAthleteId)
        .select("id");
      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500, headers: deleteProbeHeaders(`${deleteProbe};delete=error`) },
        );
      }
      if (!deletedRows?.length) {
        return NextResponse.json(
          {
            error:
              "Delete non ha rimosso righe: RLS o athlete_id non allineato. Verifica coach_athletes / app_user_profiles.",
            errorCode: "planned_delete_noop",
            deleteHints: { scoped, global, hadServiceRole, rowAthleteId, athleteIdHint: athleteIdHint || null },
          },
          { status: 404, headers: deleteProbeHeaders(`${deleteProbe};delete=noop`) },
        );
      }

      const { data: verifyGone, error: verifyErr } = await deleteDb
        .from("planned_workouts")
        .select("id")
        .eq("id", id)
        .eq("athlete_id", rowAthleteId)
        .maybeSingle();
      if (verifyErr) {
        return NextResponse.json(
          { error: verifyErr.message, errorCode: "planned_delete_verify_failed" },
          { status: 500, headers: deleteProbeHeaders(`${deleteProbe};verify=error`) },
        );
      }
      if (verifyGone) {
        return NextResponse.json(
          {
            error:
              "La riga risulta ancora in planned_workouts dopo DELETE: possibile disallineamento RLS/service role.",
            errorCode: "planned_delete_verify_failed",
          },
          { status: 409, headers: deleteProbeHeaders(`${deleteProbe};verify=still_there`) },
        );
      }
    }

    let purgedViryaDayDuplicates = 0;
    if (body.purgeViryaDayDuplicates === true && row0) {
      const notes = typeof row0.notes === "string" ? row0.notes : "";
      const viryaTag = extractViryaTagFromPlannedNotes(notes);
      const dateKey = typeof row0.date === "string" ? row0.date.trim().slice(0, 10) : "";
      if (viryaTag && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        const { data: purged, error: purgeErr } = await deleteDb
          .from("planned_workouts")
          .delete()
          .eq("athlete_id", rowAthleteId)
          .eq("date", dateKey)
          .ilike("notes", ilikeContainsViryaTag(viryaTag))
          .neq("id", id)
          .select("id");
        if (purgeErr) {
          return NextResponse.json(
            { error: purgeErr.message, errorCode: "planned_virya_day_purge_failed" },
            { status: 500, headers: deleteProbeHeaders(`${deleteProbe};purge=error`) },
          );
        }
        purgedViryaDayDuplicates = purged?.length ?? 0;
      }
    }

    return NextResponse.json(
      {
        status: "ok" as const,
        athleteMemory: await memoryOrNull(rowAthleteId),
        purgedViryaDayDuplicates,
        deletedViryaPlanRows,
      },
      {
        headers: deleteProbeHeaders(
          `${deleteProbe};delete=ok;purge=${purgedViryaDayDuplicates};virya_plan_rows=${deletedViryaPlanRows}`,
        ),
      },
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
