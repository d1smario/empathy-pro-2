import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { buildEmpathyFuelingExportV1, serializeEmpathyFuelingExportV1 } from "@/lib/nutrition/fueling-device-export-v1";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import {
  StructuredExportUnsupportedError,
  exportStructuredTrainingFromContract,
} from "@/lib/training/planned-structured-export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function normalizeUuidParam(raw: string): string {
  return raw.trim().replace(/^\{|\}$/g, "").toLowerCase();
}

const EXPORT_FORMATS = new Set(["zwo", "fit_workout", "interval_csv", "fueling_json"]);

/**
 * Download export per seduta pianificata (Zwift ZWO, FIT workout Garmin, CSV intervalli, JSON fueling CIQ-ready).
 * Query: `athleteId` (UUID), `format` = zwo | fit_workout | interval_csv | fueling_json
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const plannedId = normalizeUuidParam(params.id ?? "");
    const athleteId = normalizeUuidParam(req.nextUrl.searchParams.get("athleteId") ?? "");
    const format = (req.nextUrl.searchParams.get("format") ?? "").trim().toLowerCase();

    if (!plannedId || !athleteId) {
      return NextResponse.json({ error: "Missing id or athleteId" }, { status: 400, headers: NO_STORE });
    }
    if (!EXPORT_FORMATS.has(format)) {
      return NextResponse.json(
        { error: "Invalid format. Use zwo | fit_workout | interval_csv | fueling_json" },
        { status: 400, headers: NO_STORE },
      );
    }

    const { db } = await requireAthleteReadContext(req, athleteId);
    const { data: row, error } = await db
      .from("planned_workouts")
      .select("id, athlete_id, date, duration_minutes, tss_target, kcal_target, notes")
      .eq("id", plannedId)
      .eq("athlete_id", athleteId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    }
    if (!row || typeof row !== "object") {
      return NextResponse.json({ error: "Planned workout not found" }, { status: 404, headers: NO_STORE });
    }

    const rec = row as Record<string, unknown>;
    const notes = typeof rec.notes === "string" ? rec.notes : null;
    const contract = parsePro2BuilderSessionFromNotes(notes);

    if (format === "fueling_json") {
      if (!contract) {
        return NextResponse.json(
          { error: "Nessun BUILDER_SESSION_JSON in notes: export fueling richiede il contratto sessione." },
          { status: 422, headers: NO_STORE },
        );
      }
      const dateStr = typeof rec.date === "string" ? rec.date.slice(0, 10) : "";
      const payload = buildEmpathyFuelingExportV1({
        sessionDate: dateStr,
        plannedWorkoutId: plannedId,
        contract,
        durationMinutesDb: rec.duration_minutes as number | null | undefined,
        tssTargetDb: rec.tss_target as number | null | undefined,
        kcalTargetDb: rec.kcal_target as number | null | undefined,
      });
      const body = serializeEmpathyFuelingExportV1(payload);
      const fn = `${(contract.sessionName || "fueling").replace(/[^\w\-]+/g, "_").slice(0, 64)}-fueling.json`;
      return new NextResponse(body, {
        status: 200,
        headers: {
          ...NO_STORE,
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fn}"`,
        },
      });
    }

    if (!contract) {
      return NextResponse.json(
        { error: "Nessun contratto Builder in notes per export strutturato (ZWO/FIT/CSV)." },
        { status: 422, headers: NO_STORE },
      );
    }

    const out = exportStructuredTrainingFromContract(contract, format as "zwo" | "fit_workout" | "interval_csv");
    const safeName = out.fileName.replace(/["\r\n]/g, "_");

    return new NextResponse(out.body as BodyInit, {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": out.contentType,
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    if (err instanceof StructuredExportUnsupportedError) {
      return NextResponse.json({ error: err.message }, { status: 422, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
