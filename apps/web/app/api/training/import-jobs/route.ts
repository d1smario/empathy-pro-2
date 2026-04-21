import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { mapRealityImportJobs } from "@/lib/reality/import-job-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" as const };

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.round(limitRaw))) : 20;
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId", jobs: [] }, { status: 400, headers: NO_STORE });
    }
    const { db } = await requireAthleteReadContext(req, athleteId);
    const { data, error } = await db
      .from("training_import_jobs")
      .select(
        "id, mode, source_format, source_vendor, parser_engine, parser_version, status, file_name, imported_workout_id, imported_planned_count, imported_date, quality_status, quality_note, channel_coverage, error_message, payload, created_at, updated_at",
      )
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        return NextResponse.json(
          {
            error: "Tabella training_import_jobs non presente: applica migrazioni training (Pro 2 014 o V1 016).",
            jobs: [],
          },
          { status: 503, headers: NO_STORE },
        );
      }
      return NextResponse.json({ error: error.message, jobs: [] }, { status: 500, headers: NO_STORE });
    }
    const jobs = mapRealityImportJobs((data ?? []) as Array<Record<string, unknown>>);
    return NextResponse.json({ athleteId, jobs }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message, jobs: [] }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Import jobs fetch failed";
    return NextResponse.json({ error: message, jobs: [] }, { status: 500, headers: NO_STORE });
  }
}
