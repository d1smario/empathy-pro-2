import { NextRequest, NextResponse } from "next/server";
import { RequestAuthError, requireRequestAthleteAccess } from "@/lib/auth/request-auth";
import { buildDeterministicMealPlanFromRequest } from "@/lib/nutrition/deterministic-meal-plan-from-request";
import { filterIntelligentMealPlanRequestFoods } from "@/lib/nutrition/meal-plan-profile-food-filter";
import { applyMealSlotRulesToIntelligentMealPlanRequest } from "@/lib/nutrition/meal-slot-food-rules";
import { attachSolverBasisToAssembled } from "@/lib/nutrition/meal-plan-solver-basis";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";

export const runtime = "nodejs";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function sanitizeWeeklyStapleCounts(raw: unknown): Record<string, number> | undefined {
  if (!isRecord(raw)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== "string" || k.length > 72) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 21) continue;
    out[k] = Math.min(21, Math.floor(v));
  }
  return Object.keys(out).length ? out : undefined;
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
    await requireRequestAthleteAccess(req, athleteId);

    const plan = body.plan as unknown;
    if (!isRecord(plan)) {
      return NextResponse.json({ error: "Missing plan" }, { status: 400 });
    }

    const weekly = sanitizeWeeklyStapleCounts(plan.weeklyStapleCounts);
    const planMerged: IntelligentMealPlanRequest = {
      ...(plan as IntelligentMealPlanRequest),
      ...(weekly ? { weeklyStapleCounts: weekly } : {}),
    };

    const request = applyMealSlotRulesToIntelligentMealPlanRequest(
      filterIntelligentMealPlanRequestFoods(planMerged),
    );
    if (request.athleteId !== athleteId) {
      return NextResponse.json({ error: "athleteId mismatch" }, { status: 400 });
    }
    if (!Array.isArray(request.slots) || request.slots.length !== 5) {
      return NextResponse.json({ error: "plan.slots must have 5 entries (breakfast, lunch, dinner, snack_am, snack_pm)" }, { status: 400 });
    }
    if (
      !request.mealPlanSolverMeta ||
      typeof request.mealPlanSolverMeta.dailyMealsKcalTotal !== "number" ||
      !Array.isArray(request.mealPlanSolverMeta.integrationLeverLines)
    ) {
      return NextResponse.json({ error: "plan.mealPlanSolverMeta obbligatorio (dailyMealsKcalTotal + integrationLeverLines)" }, { status: 400 });
    }

    /** Solo assemblaggio deterministico: nessun LLM (generative core EMPATHY — AI non genera piani pasto). */
    const assembled = buildDeterministicMealPlanFromRequest(request);
    return NextResponse.json(attachSolverBasisToAssembled(assembled, request));
  } catch (err) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Intelligent meal plan error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
