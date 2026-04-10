import { NextRequest, NextResponse } from "next/server";
import { RequestAuthError, requireRequestAthleteAccess } from "@/lib/auth/request-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId", results: [] }, { status: 400 });

    await requireRequestAthleteAccess(req, athleteId);

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("metabolic_lab_runs")
      .select("section, model_version, output_payload, created_at")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ error: error.message, results: [] }, { status: 500 });

    const latestBySection = new Map<string, Record<string, unknown>>();
    for (const row of data ?? []) {
      const section = String((row as Record<string, unknown>).section ?? "");
      if (!section || latestBySection.has(section)) continue;
      latestBySection.set(section, row as Record<string, unknown>);
    }

    const results = Array.from(latestBySection.values()).map((row) => ({
      engine:
        String(row.section) === "lactate_analysis"
          ? "lactate"
          : String(row.section) === "max_oxidate"
            ? "oxidation"
            : "metabolic",
      version: String(row.model_version ?? "unknown"),
      state: "available",
      values: (row.output_payload as Record<string, number | string>) ?? {},
    }));

    return NextResponse.json({
      athleteId,
      computedAt: new Date().toISOString(),
      results,
    });
  } catch (err) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ error: err.message, results: [] }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Physiology API error";
    return NextResponse.json({ error: message, results: [] }, { status: 500 });
  }
}

