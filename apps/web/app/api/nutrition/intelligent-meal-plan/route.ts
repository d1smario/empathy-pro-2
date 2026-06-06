import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { buildDeterministicMealPlanFromRequest } from "@/lib/nutrition/deterministic-meal-plan-from-request";
import { prepareIntelligentMealPlanContext } from "@/lib/nutrition/intelligent-meal-plan-route-prep";
import { attachSolverBasisToAssembled } from "@/lib/nutrition/meal-plan-solver-basis";
import { buildMealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import { mapV2PlanToV1Response } from "@/lib/nutrition/v2/map-v2-plan-to-v1-response";
import {
  diffMealPlanEngines,
  logMealPlanEngineShadowDiff,
} from "@/lib/nutrition/v2/meal-plan-engine-shadow-log";
import { resolveNutritionMealPlanEngine } from "@/lib/nutrition/v2/resolve-nutrition-meal-plan-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function parseNutritionConfig(row: Record<string, unknown> | null): Record<string, unknown> | null {
  const nc = row?.nutrition_config;
  if (!nc || typeof nc !== "object" || Array.isArray(nc)) return null;
  return nc as Record<string, unknown>;
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

    const { request, profileRow, dietDay, plannedSessions, ftp, weightKg, performanceIntegration } = prepared;
    const engine = resolveNutritionMealPlanEngine(parseNutritionConfig(profileRow));

    let responseCore;

    if (engine === "v2") {
      const v2Production = await buildMealPlanV2Production(
        {
          request,
          weightKg,
          ftpWatts: ftp,
          lifestyleActivityClass:
            profileRow?.lifestyle_activity_class != null
              ? String(profileRow.lifestyle_activity_class)
              : null,
          dietDayMealsScalePct: dietDay.dayTypePct,
          plannedSessions,
          dietDay,
          performanceIntegration: performanceIntegration ?? null,
        },
        db,
      );
      responseCore = await mapV2PlanToV1Response(v2Production, request);
    } else if (engine === "shadow") {
      const [v1Core, v2Production] = await Promise.all([
        buildDeterministicMealPlanFromRequest(request),
        buildMealPlanV2Production(
          {
            request,
            weightKg,
            ftpWatts: ftp,
            lifestyleActivityClass:
              profileRow?.lifestyle_activity_class != null
                ? String(profileRow.lifestyle_activity_class)
                : null,
            dietDayMealsScalePct: dietDay.dayTypePct,
            plannedSessions,
            dietDay,
            performanceIntegration: performanceIntegration ?? null,
          },
          db,
        ),
      ]);
      const v2Core = await mapV2PlanToV1Response(v2Production, request);
      logMealPlanEngineShadowDiff(
        diffMealPlanEngines(v1Core, v2Core),
        athleteId,
        request.planDate,
      );
      responseCore = v1Core;
    } else {
      responseCore = await buildDeterministicMealPlanFromRequest(request);
    }

    const res = NextResponse.json(
      attachSolverBasisToAssembled(responseCore, {
        ...request,
        mealPlanSolverMeta: {
          ...request.mealPlanSolverMeta,
          integrationLeverLines: [
            ...request.mealPlanSolverMeta.integrationLeverLines,
            engine === "v2"
              ? "Motore Nutrition V2 (USDA FDC taggato + fueling substrati)."
              : engine === "shadow"
                ? "Shadow: V1 servito, V2 loggato."
                : "Motore Nutrition V1 (Mediterranean composer).",
          ].slice(0, 16),
        },
      }),
    );
    res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    return res;
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Intelligent meal plan error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
