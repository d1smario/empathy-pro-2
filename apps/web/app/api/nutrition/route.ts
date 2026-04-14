import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { computeNutritionDailyEnergyModel } from "@/lib/nutrition/daily-energy-solver";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function emptyPlan(targetDate: string) {
  return {
    date: targetDate,
    calories: 0,
    carbsG: 0,
    proteinsG: 0,
    fatsG: 0,
    hydrationMl: 0,
  };
}

/** Macro giornalieri da `computeNutritionDailyEnergyModel` (quota pasti + ripartizione deterministica). */
function planFromEnergySolver(model: ReturnType<typeof computeNutritionDailyEnergyModel>) {
  const daily = Math.max(0, Math.round(model.totals.dailyKcal));
  const mealBudget = Math.max(0, Math.round(model.totals.mealsKcal));
  const carbsG = Math.round((mealBudget * 0.52) / 4);
  const proteinsG = Math.round((mealBudget * 0.22) / 4);
  const fatsG = Math.round((mealBudget * 0.26) / 9);
  const hydrationMl = Math.round(2000 + Math.max(0, model.training.durationMin) * 12);
  return {
    date: model.date,
    calories: daily,
    carbsG,
    proteinsG,
    fatsG,
    hydrationMl,
  };
}

// Lightweight nutrition day-plan endpoint: `nutrition_plans` esplicito, altrimenti solver da `planned_workouts` (stesso giorno).
// Full module context: `/api/nutrition/module`.

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    const date = (req.nextUrl.searchParams.get("date") ?? "").trim();
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const { db } = await requireAthleteReadContext(req, athleteId);

    const [{ data: planRow, error: planErr }, { data: plannedRows, error: plannedErr }] = await Promise.all([
      db
        .from("nutrition_plans")
        .select("date, kcal_target, carbs_g_target, proteins_g_target, fats_g_target, hydration_ml_target")
        .eq("athlete_id", athleteId)
        .eq("date", targetDate)
        .maybeSingle(),
      db
        .from("planned_workouts")
        .select("id, duration_minutes, tss_target, kcal_target")
        .eq("athlete_id", athleteId)
        .eq("date", targetDate),
    ]);

    if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500, headers: NO_STORE });
    if (plannedErr) return NextResponse.json({ error: plannedErr.message }, { status: 500, headers: NO_STORE });

    const sessions = plannedRows ?? [];
    const explicit = (planRow as Record<string, unknown> | null) ?? null;
    const explicitKcal = explicit != null ? Number(explicit.kcal_target ?? 0) : 0;

    if (explicit && explicitKcal > 0) {
      const plan = {
        date: String(explicit.date ?? targetDate),
        calories: explicitKcal,
        carbsG: Number(explicit.carbs_g_target ?? 0),
        proteinsG: Number(explicit.proteins_g_target ?? 0),
        fatsG: Number(explicit.fats_g_target ?? 0),
        hydrationMl: Number(explicit.hydration_ml_target ?? 0),
      };
      return NextResponse.json(
        {
          athleteId,
          plan,
          adherenceScore: 0,
          planSource: "nutrition_plans" as const,
          plannedSessionsCount: sessions.length,
        },
        { headers: NO_STORE },
      );
    }

    if (sessions.length > 0) {
      const memory = await resolveAthleteMemory(athleteId).catch(() => null);
      const profile = memory?.profile;
      const physio = memory?.physiology?.physiologicalProfile;
      const plannedTraining = sessions.map((r) => {
        const dur = Math.max(0, Number(r.duration_minutes) || 0);
        const tss = Math.max(0, Number(r.tss_target) || 0);
        const kcalDb = Number(r.kcal_target);
        const kcalTarget =
          Number.isFinite(kcalDb) && kcalDb > 0 ? Math.round(kcalDb) : tss > 0 ? Math.round(tss * 8) : dur > 0 ? Math.round(dur * 7) : 0;
        return {
          durationMinutes: dur,
          tssTarget: tss > 0 ? tss : undefined,
          kcalTarget: kcalTarget > 0 ? kcalTarget : undefined,
          avgPowerW: null,
        };
      });

      const model = computeNutritionDailyEnergyModel({
        athleteId,
        date: targetDate,
        birthDate: profile?.birthDate ?? null,
        sex: profile?.sex ?? null,
        heightCm: profile?.heightCm ?? null,
        weightKg: profile?.weightKg ?? null,
        bodyFatPct: profile?.bodyFatPct ?? null,
        ftpWatts: physio?.ftpWatts ?? null,
        vo2maxMlMinKg: physio?.vo2maxMlMinKg ?? null,
        lifestyleActivityClass: profile?.lifestyleActivityClass ?? "moderate",
        plannedTraining,
        recoveryStatus: "unknown",
      });

      return NextResponse.json(
        {
          athleteId,
          plan: planFromEnergySolver(model),
          adherenceScore: 0,
          planSource: "calendar_training_solver" as const,
          plannedSessionsCount: sessions.length,
        },
        { headers: NO_STORE },
      );
    }

    const plan = emptyPlan(targetDate);

    return NextResponse.json(
      {
        athleteId,
        plan,
        adherenceScore: 0,
        planSource: "none" as const,
        plannedSessionsCount: 0,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Nutrition API error";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

