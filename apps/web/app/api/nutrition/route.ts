import { NextRequest, NextResponse } from "next/server";
import { RequestAuthError, requireRequestAthleteAccess } from "@/lib/auth/request-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

// Lightweight nutrition day-plan endpoint.
// Full module context is served by `/api/nutrition/module`.

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    await requireRequestAthleteAccess(req, athleteId);

    const date = (req.nextUrl.searchParams.get("date") ?? "").trim();
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("nutrition_plans")
      .select("date, kcal_target, carbs_g_target, proteins_g_target, fats_g_target, hydration_ml_target")
      .eq("athlete_id", athleteId)
      .eq("date", targetDate)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const row = (data as Record<string, unknown> | null) ?? null;
    const plan = row
      ? {
          date: String(row.date ?? targetDate),
          calories: Number(row.kcal_target ?? 0),
          carbsG: Number(row.carbs_g_target ?? 0),
          proteinsG: Number(row.proteins_g_target ?? 0),
          fatsG: Number(row.fats_g_target ?? 0),
          hydrationMl: Number(row.hydration_ml_target ?? 0),
        }
      : {
          date: targetDate,
          calories: 0,
          carbsG: 0,
          proteinsG: 0,
          fatsG: 0,
          hydrationMl: 0,
        };

    return NextResponse.json({ athleteId, plan, adherenceScore: 0 });
  } catch (err) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Nutrition API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

