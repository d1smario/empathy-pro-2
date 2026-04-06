import { NextRequest, NextResponse } from "next/server";
import { canAccessAthleteData } from "@/lib/athlete/can-access-athlete-data";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Fase 5 — ultime righe biomarker_panels (sintesi Health).
 */
export async function GET(req: NextRequest) {
  const client = createSupabaseCookieClient();
  if (!client) {
    return NextResponse.json(
      { ok: false as const, error: "supabase_unconfigured", panels: [] },
      { status: 503, headers: NO_STORE },
    );
  }

  const {
    data: { user },
    error: authErr,
  } = await client.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json(
      { ok: false as const, error: "unauthorized", panels: [] },
      { status: 401, headers: NO_STORE },
    );
  }

  const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
  if (!athleteId) {
    return NextResponse.json(
      { ok: false as const, error: "missing_athleteId", panels: [] },
      { status: 400, headers: NO_STORE },
    );
  }

  const allowed = await canAccessAthleteData(client, user.id, athleteId, null);
  if (!allowed) {
    return NextResponse.json(
      { ok: false as const, error: "forbidden", panels: [] },
      { status: 403, headers: NO_STORE },
    );
  }

  const { data, error } = await client
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
}
