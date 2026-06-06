/**
 * @deprecated Usa POST /api/nutrition/intelligent-meal-plan con NUTRITION_MEAL_PLAN_ENGINE=v2|shadow.
 * Proxy di compatibilità per Anteprima V2.
 */
import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { prepareIntelligentMealPlanContext } from "@/lib/nutrition/intelligent-meal-plan-route-prep";
import { attachSolverBasisToAssembled } from "@/lib/nutrition/meal-plan-solver-basis";
import { buildMealPlanV2Preview } from "@/lib/nutrition/v2/build-meal-plan-v2-preview";
import { buildMealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import { mapV2PlanToV1AssembledCore } from "@/lib/nutrition/v2/map-v2-plan-to-v1-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
    }
    const athleteId = String(body.athleteId ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    }
    const { db } = await requireAthleteReadContext(req, athleteId);

    const prepared = await prepareIntelligentMealPlanContext(db, body);
    if ("error" in prepared) {
      return NextResponse.json({ error: prepared.error }, { status: prepared.status });
    }

    const { request, dietDay, plannedSessions, ftp, weightKg } = prepared;

    const preview = await buildMealPlanV2Preview(
      {
        request,
        weightKg,
        ftpWatts: ftp,
        lifestyleActivityClass:
          prepared.profileRow?.lifestyle_activity_class != null
            ? String(prepared.profileRow.lifestyle_activity_class)
            : null,
        dietDayMealsScalePct: dietDay.dayTypePct,
        plannedSessions,
        dietDay,
      },
      db,
    );

    const production = await buildMealPlanV2Production(
      {
        request,
        weightKg,
        ftpWatts: ftp,
        lifestyleActivityClass:
          prepared.profileRow?.lifestyle_activity_class != null
            ? String(prepared.profileRow.lifestyle_activity_class)
            : null,
        dietDayMealsScalePct: dietDay.dayTypePct,
        plannedSessions,
        dietDay,
      },
      db,
    );

    const v1CompatPreview = mapV2PlanToV1AssembledCore(production, request);

    const res = NextResponse.json({
      preview,
      v1CompatPreview: attachSolverBasisToAssembled(v1CompatPreview, request),
      v1FallbackAvailable: true,
      deprecated: "Usa /api/nutrition/intelligent-meal-plan con NUTRITION_MEAL_PLAN_ENGINE=v2",
    });
    res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    return res;
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Meal plan V2 error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
