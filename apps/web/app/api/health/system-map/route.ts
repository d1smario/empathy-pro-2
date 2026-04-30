import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    const { db } = await requireAthleteReadContext(req, athleteId);

    const [nodesRes, edgesRes, responsesRes, stagingRes] = await Promise.all([
      db
        .from("athlete_system_nodes")
        .select("id, node_key, area, label, state, observed_at, created_at")
        .eq("athlete_id", athleteId)
        .order("observed_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("athlete_system_edges")
        .select("id, from_node_key, to_node_key, effect_sign, confidence, evidence_refs, rule_key, rule_version, time_window, metadata, observed_at, created_at")
        .eq("athlete_id", athleteId)
        .order("observed_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(260),
      db
        .from("bioenergetics_responses")
        .select("id, response_key, category, title, description, trigger_refs, mitigation_refs, severity, confidence, observed_at, created_at")
        .eq("athlete_id", athleteId)
        .order("observed_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(120),
      db
        .from("interpretation_staging_runs")
        .select("id, domain, status, confidence, created_at, source_refs")
        .eq("athlete_id", athleteId)
        .in("domain", ["health", "physiology", "bioenergetics", "cross_module"])
        .in("status", ["ready", "pending_validation", "draft"])
        .order("created_at", { ascending: false })
        .limit(24),
    ]);

    const handleOptional = (res: { data: unknown; error: { message?: string; code?: string } | null }) => {
      if (!res.error) return (res.data ?? []) as Array<Record<string, unknown>>;
      const msg = res.error.message ?? "";
      const code = String(res.error.code ?? "");
      if (code === "42P01" || msg.includes("does not exist")) return [];
      throw new Error(res.error.message);
    };

    const nodes = handleOptional(nodesRes);
    const edges = handleOptional(edgesRes);
    const responses = handleOptional(responsesRes);
    const stagingRuns = handleOptional(stagingRes);

    return NextResponse.json(
      {
        ok: true as const,
        athleteId,
        systemMap: {
          nodes,
          edges,
          bioenergeticsResponses: responses,
          stagingRuns,
        },
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "health_system_map_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
