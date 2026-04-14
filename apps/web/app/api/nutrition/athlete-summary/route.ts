import { NextRequest, NextResponse } from "next/server";
import {
  nutritionConstraintsFromDbRow,
  nutritionPlanFromDbRow,
  type NutritionConstraintsDbRow,
  type NutritionPlanDbRow,
} from "@empathy/domain-nutrition";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Fase 5 — vincoli + ultimi piani nutrizione per atleta.
 */
export async function GET(req: NextRequest) {
  const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
  if (!athleteId) {
    return NextResponse.json(
      { ok: false as const, error: "missing_athleteId", constraints: null, plans: [] },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const { db } = await requireAthleteReadContext(req, athleteId);

    const [cRes, pRes] = await Promise.all([
      db.from("nutrition_constraints").select("*").eq("athlete_id", athleteId).maybeSingle(),
      db
        .from("nutrition_plans")
        .select("id, athlete_id, from_date, to_date, goal, constraints_snapshot, created_at, updated_at")
        .eq("athlete_id", athleteId)
        .order("from_date", { ascending: false })
        .limit(8),
    ]);

    const errMsg = cRes.error?.message ?? pRes.error?.message ?? null;
    if (errMsg) {
      return NextResponse.json(
        { ok: false as const, error: errMsg, constraints: null, plans: [] },
        { status: 500, headers: NO_STORE },
      );
    }

    const constraintsRow = cRes.data as NutritionConstraintsDbRow | null;
    const constraints = constraintsRow ? nutritionConstraintsFromDbRow(constraintsRow) : null;
    const plans = ((pRes.data ?? []) as NutritionPlanDbRow[]).map(nutritionPlanFromDbRow);

    return NextResponse.json(
      {
        ok: true as const,
        athleteId,
        constraints,
        plans,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      if (err.status === 503) {
        return NextResponse.json(
          { ok: false as const, error: "supabase_unconfigured", constraints: null, plans: [] },
          { status: 503, headers: NO_STORE },
        );
      }
      if (err.status === 401) {
        return NextResponse.json(
          { ok: false as const, error: "unauthorized", constraints: null, plans: [] },
          { status: 401, headers: NO_STORE },
        );
      }
      if (err.status === 403) {
        return NextResponse.json(
          { ok: false as const, error: "forbidden", constraints: null, plans: [] },
          { status: 403, headers: NO_STORE },
        );
      }
      return NextResponse.json(
        { ok: false as const, error: err.message, constraints: null, plans: [] },
        { status: err.status, headers: NO_STORE },
      );
    }
    throw err;
  }
}
