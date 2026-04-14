import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Fase 5 — ultime righe biomarker_panels (sintesi Health).
 */
export async function GET(req: NextRequest) {
  const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
  if (!athleteId) {
    return NextResponse.json(
      { ok: false as const, error: "missing_athleteId", panels: [] },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const { db } = await requireAthleteReadContext(req, athleteId);

    const { data, error } = await db
      .from("biomarker_panels")
      .select("id, type, sample_date, reported_at")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      return NextResponse.json(
        { ok: false as const, error: error.message, panels: [] },
        { status: 500, headers: NO_STORE },
      );
    }

    type Row = { id: string; type: string; sample_date: string | null; reported_at: string | null };
    return NextResponse.json(
      {
        ok: true as const,
        athleteId,
        panels: (data ?? []) as Row[],
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      if (err.status === 503) {
        return NextResponse.json(
          { ok: false as const, error: "supabase_unconfigured", panels: [] },
          { status: 503, headers: NO_STORE },
        );
      }
      if (err.status === 401) {
        return NextResponse.json(
          { ok: false as const, error: "unauthorized", panels: [] },
          { status: 401, headers: NO_STORE },
        );
      }
      if (err.status === 403) {
        return NextResponse.json(
          { ok: false as const, error: "forbidden", panels: [] },
          { status: 403, headers: NO_STORE },
        );
      }
      return NextResponse.json(
        { ok: false as const, error: err.message, panels: [] },
        { status: err.status, headers: NO_STORE },
      );
    }
    throw err;
  }
}
