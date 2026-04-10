import { NextRequest, NextResponse } from "next/server";
import { RequestAuthError, requireRequestAthleteAccess } from "@/lib/auth/request-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

export type HealthPanelTimelineRow = {
  id: string;
  type: string;
  sample_date: string | null;
  reported_at: string | null;
  source: string | null;
  values: Record<string, unknown> | null;
  created_at: string | null;
};

/**
 * Serie temporale panel per grafici Health e archivio (valori strutturati in `values` JSON).
 */
export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json(
        { ok: false as const, error: "missing_athleteId", panels: [] },
        { status: 400, headers: NO_STORE },
      );
    }

    await requireRequestAthleteAccess(req, athleteId);

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("biomarker_panels")
      .select("id, type, sample_date, reported_at, source, values, created_at")
      .eq("athlete_id", athleteId)
      .order("sample_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(48);

    if (error) {
      return NextResponse.json(
        { ok: false as const, error: error.message, panels: [] },
        { status: 500, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      {
        ok: true as const,
        athleteId,
        panels: (data ?? []) as HealthPanelTimelineRow[],
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json(
        { ok: false as const, error: err.message, panels: [] },
        { status: err.status, headers: NO_STORE },
      );
    }
    const message = err instanceof Error ? err.message : "Health timeline error";
    return NextResponse.json(
      { ok: false as const, error: message, panels: [] },
      { status: 500, headers: NO_STORE },
    );
  }
}
