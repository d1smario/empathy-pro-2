import { NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAthleteWriteContext,
} from "@/lib/auth/athlete-read-context";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function normalizeDateKey(input: string | null | undefined): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }
  return raw.slice(0, 10);
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateIso;
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inserimento manuale eseguito — parity V1 (`athleteMemory` dopo insert). */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      athlete_id?: string;
      date?: string;
      duration_minutes?: number;
      tss?: number;
      kcal?: number | null;
      subjective_notes?: string | null;
      source?: string;
      planned_workout_id?: string | null;
    };
    if (!body.athlete_id || !body.date) {
      return NextResponse.json({ error: "Missing athlete_id or date" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteWriteContext(req, body.athlete_id);
    const { error } = await db.from("executed_workouts").insert({
      athlete_id: body.athlete_id,
      date: body.date,
      duration_minutes: body.duration_minutes ?? 0,
      tss: body.tss ?? 0,
      kcal: body.kcal ?? null,
      subjective_notes: body.subjective_notes ?? null,
      source: body.source ?? "manual",
      planned_workout_id: body.planned_workout_id ?? null,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    }
    let athleteMemory: Awaited<ReturnType<typeof resolveAthleteMemory>> | null = null;
    let athleteMemoryError: string | null = null;
    try {
      athleteMemory = await resolveAthleteMemory(body.athlete_id);
    } catch (memErr) {
      athleteMemoryError = memErr instanceof Error ? memErr.message : "resolveAthleteMemory failed";
    }
    return NextResponse.json(
      {
        status: "ok" as const,
        athleteMemory,
        ...(athleteMemoryError ? { athleteMemoryError } : {}),
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Training executed POST failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

/** Cancellazione eseguito / duplicati import — parity V1 DELETE. */
export async function DELETE(req: NextRequest) {
  try {
    let id = (req.nextUrl.searchParams.get("id") ?? "").trim();
    let athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    let date = (req.nextUrl.searchParams.get("date") ?? "").trim();
    let importedFileName = (req.nextUrl.searchParams.get("importedFileName") ?? "").trim();
    if (!id || !athleteId) {
      const body = (await req.json().catch(() => ({}))) as {
        id?: string;
        athleteId?: string;
        date?: string;
        importedFileName?: string;
      };
      id = id || String(body.id ?? "").trim();
      athleteId = athleteId || String(body.athleteId ?? "").trim();
      date = date || String(body.date ?? "").trim();
      importedFileName = importedFileName || String(body.importedFileName ?? "").trim();
    }
    if (!id || !athleteId) {
      return NextResponse.json({ error: "Missing id or athleteId" }, { status: 400, headers: NO_STORE });
    }

    const { db: dbRead, rlsClient } = await requireAthleteReadContext(req, athleteId);

    const target = await dbRead
      .from("executed_workouts")
      .select("id, athlete_id, date, external_id, trace_summary")
      .eq("id", id)
      .limit(1)
      .maybeSingle();
    if (target.error) {
      return NextResponse.json({ error: target.error.message }, { status: 500, headers: NO_STORE });
    }
    if (!target.data) {
      return NextResponse.json({ error: "Workout non trovato." }, { status: 404, headers: NO_STORE });
    }

    const rowAthleteId = String(target.data.athlete_id);
    if (rowAthleteId !== athleteId.trim()) {
      return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
    }

    const dbWrite = createSupabaseAdminClient() ?? rlsClient;

    const trace =
      target.data.trace_summary && typeof target.data.trace_summary === "object"
        ? (target.data.trace_summary as Record<string, unknown>)
        : null;
    const rowImportedFileName =
      typeof trace?.imported_file_name === "string" ? trace.imported_file_name.trim() : "";
    const rowChecksum =
      typeof trace?.import_file_checksum_sha1 === "string" ? trace.import_file_checksum_sha1.trim() : "";
    const effectiveImportedFileName = importedFileName || rowImportedFileName;
    const effectiveDate = normalizeDateKey(date || String(target.data.date ?? ""));
    const nextDate = effectiveDate ? addDays(effectiveDate, 1) : "";
    const externalId = String(target.data.external_id ?? "").trim();

    let deletedIds: string[] = [];
    if (externalId) {
      const byExternal = await dbWrite
        .from("executed_workouts")
        .delete()
        .eq("athlete_id", rowAthleteId)
        .eq("external_id", externalId)
        .select("id");
      if (byExternal.error) {
        return NextResponse.json({ error: byExternal.error.message }, { status: 500, headers: NO_STORE });
      }
      deletedIds = (byExternal.data ?? []).map((row) => String((row as { id: string }).id));
    } else if (rowChecksum && effectiveDate) {
      const byChecksum = await dbWrite
        .from("executed_workouts")
        .delete()
        .eq("athlete_id", rowAthleteId)
        .filter("trace_summary->>import_file_checksum_sha1", "eq", rowChecksum)
        .gte("date", effectiveDate)
        .lt("date", nextDate)
        .select("id");
      if (byChecksum.error) {
        return NextResponse.json({ error: byChecksum.error.message }, { status: 500, headers: NO_STORE });
      }
      deletedIds = (byChecksum.data ?? []).map((row) => String((row as { id: string }).id));
    } else if (effectiveImportedFileName && effectiveDate) {
      const dupDelete = await dbWrite
        .from("executed_workouts")
        .delete()
        .eq("athlete_id", rowAthleteId)
        .filter("trace_summary->>imported_file_name", "eq", effectiveImportedFileName)
        .gte("date", effectiveDate)
        .lt("date", nextDate)
        .select("id");
      if (dupDelete.error) {
        return NextResponse.json({ error: dupDelete.error.message }, { status: 500, headers: NO_STORE });
      }
      deletedIds = (dupDelete.data ?? []).map((row) => String((row as { id: string }).id));
    } else {
      const singleDelete = await dbWrite
        .from("executed_workouts")
        .delete()
        .eq("id", id)
        .eq("athlete_id", rowAthleteId)
        .select("id");
      if (singleDelete.error) {
        return NextResponse.json({ error: singleDelete.error.message }, { status: 500, headers: NO_STORE });
      }
      deletedIds = (singleDelete.data ?? []).map((row) => String((row as { id: string }).id));
    }

    if (!deletedIds.length) {
      return NextResponse.json({ error: "Nessun record eliminato." }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json(
      {
        status: "ok" as const,
        deletedId: deletedIds[0],
        deletedIds,
        deletedCount: deletedIds.length,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Training executed DELETE failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
