import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function observationFromExportPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const ing = p.realityIngestion;
  if (!ing || typeof ing !== "object") return null;
  const obs = (ing as Record<string, unknown>).observation;
  return obs ?? null;
}

function domainFromExportPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const ing = p.realityIngestion;
  if (!ing || typeof ing !== "object") return null;
  const d = (ing as Record<string, unknown>).domain;
  return typeof d === "string" ? d : null;
}

/**
 * Lettura clip ingest: `executed_workouts` + opzionale `device_sync_exports` (WHOOP/Wahoo pull).
 *
 * Query: `athleteId` (obbligatorio), `from` / `to` (YYYY-MM-DD), `includeExports` (default `true`).
 */
export async function GET(req: NextRequest) {
  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
  if (!athleteId) {
    return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
  }

  try {
    await requireAthleteReadContext(req, athleteId);
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const fromParam = req.nextUrl.searchParams.get("from")?.trim() ?? "";
  const toParam = req.nextUrl.searchParams.get("to")?.trim() ?? "";
  const includeExports = (req.nextUrl.searchParams.get("includeExports") ?? "true").toLowerCase() !== "false";

  const now = new Date();
  const toDate = toParam && isIsoDate(toParam) ? toParam : now.toISOString().slice(0, 10);
  const fromFallback = new Date(now);
  fromFallback.setUTCDate(fromFallback.getUTCDate() - 30);
  const fromDate =
    fromParam && isIsoDate(fromParam) ? fromParam : fromFallback.toISOString().slice(0, 10);

  const fromTs = `${fromDate}T00:00:00.000Z`;
  const toTs = `${toDate}T23:59:59.999Z`;

  const supabase = createServerSupabaseClient();

  const { data: executedRows, error: exErr } = await supabase
    .from("executed_workouts")
    .select("id, date, source, external_id, trace_summary")
    .eq("athlete_id", athleteId)
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date", { ascending: false })
    .limit(200);

  if (exErr) {
    return NextResponse.json({ error: exErr.message }, { status: 500 });
  }

  const executedClips = (executedRows ?? []).map((row) => {
    const ts = row.trace_summary as Record<string, unknown> | null;
    const obs = ts && typeof ts === "object" && "observation" in ts ? ts.observation : null;
    return {
      kind: "executed_workout_clip" as const,
      id: row.id,
      date: row.date,
      source: row.source,
      external_id: row.external_id,
      observation: obs,
      parser_engine: ts && typeof ts.parser_engine === "string" ? ts.parser_engine : null,
    };
  });

  let exportClips: Array<{
    kind: "device_sync_export_clip";
    id: string;
    provider: string | null;
    created_at: string | null;
    external_ref: string | null;
    external_event_id: string | null;
    status: string | null;
    observation: unknown;
    ingestion_domain: string | null;
    sync_kind: string | null;
  }> = [];

  if (includeExports) {
    const { data: exportRows, error: expErr } = await supabase
      .from("device_sync_exports")
      .select("id, provider, external_ref, external_event_id, status, created_at, updated_at, payload, sync_kind")
      .eq("athlete_id", athleteId)
      .gte("created_at", fromTs)
      .lte("created_at", toTs)
      .order("created_at", { ascending: false })
      .limit(200);

    if (expErr) {
      return NextResponse.json({ error: expErr.message }, { status: 500 });
    }

    exportClips = (exportRows ?? []).map((row) => ({
      kind: "device_sync_export_clip" as const,
      id: row.id,
      provider: row.provider,
      created_at: row.created_at,
      external_ref: row.external_ref,
      external_event_id: row.external_event_id ?? null,
      status: row.status,
      observation: observationFromExportPayload(row.payload),
      ingestion_domain: domainFromExportPayload(row.payload),
      sync_kind: typeof row.sync_kind === "string" ? row.sync_kind : null,
    }));
  }

  return NextResponse.json({
    schemaVersion: "v1" as const,
    athleteId,
    window: { from: fromDate, to: toDate },
    /** Solo `executed_workouts` (stesso shape di prima). */
    clips: executedClips,
    ...(includeExports ? { device_sync_export_clips: exportClips } : {}),
  });
}
