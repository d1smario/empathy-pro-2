import { NextRequest, NextResponse } from "next/server";
import { RequestAuthError, requireRequestAthleteAccess } from "@/lib/auth/request-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { buildAdaptationGuidance } from "@/lib/adaptation/adaptation-guidance";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { toCanonicalPlannedWorkout } from "@/lib/empathy/adapters/training";
import { isMissingKnowledgeFoundationError } from "@/lib/knowledge/knowledge-foundation";
import { listKnowledgeExpansionTraceSummaries } from "@/lib/knowledge/knowledge-research-trace-store";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { resolveLatestRecoverySummary } from "@/lib/reality/recovery-summary";
import { buildTrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import { resolveAdaptationRegenerationLoop } from "@/lib/training/adaptation-regeneration-loop";
import { buildBioenergeticModulation } from "@/lib/training/bioenergetic-modulation";
import { buildMetabolicEfficiencyGenerativeModel } from "@/lib/bioenergetics/metabolic-efficiency-generative-model";
import { buildFunctionalFoodRecommendationsViewModel } from "@/lib/nutrition/functional-food-recommendations";
import { buildNutritionPathwayModulationViewModel } from "@/lib/nutrition/pathway-modulation-model";
import { extractDiaryAdaptiveSignals } from "@/lib/nutrition/diary-adaptive-signals";
import { buildNutritionPerformanceIntegration } from "@/lib/nutrition/performance-integration-scaler";

export const runtime = "nodejs";

// Full nutrition module context endpoint.
// This route aggregates physiology, twin, memory, execution, and planning inputs.
// Optional query: pathwayDate=YYYY-MM-DD (must be within from…to) → pathwayModulation + functionalFoodRecommendations (stessi builder del client).

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId", profile: null, physio: null, executed: [], planned: [] }, { status: 400 });
    }
    await requireRequestAthleteAccess(req, athleteId);
    const from = (req.nextUrl.searchParams.get("from") ?? "").trim();
    const to = (req.nextUrl.searchParams.get("to") ?? "").trim();
    if (!from || !to) {
      return NextResponse.json({ error: "Missing from/to", profile: null, physio: null, executed: [], planned: [] }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const [athleteMemory, execRes, plannedRes, recoverySummary, researchTraceSummaries] = await Promise.all([
      resolveAthleteMemory(athleteId),
      supabase
        .from("executed_workouts")
        .select("id, date, duration_minutes, tss, kcal, kj, trace_summary, lactate_mmoll, glucose_mmol, smo2")
        .eq("athlete_id", athleteId)
        .order("date", { ascending: false })
        .limit(30),
      supabase
        .from("planned_workouts")
        .select("id, date, type, duration_minutes, tss_target, kcal_target, notes")
        .eq("athlete_id", athleteId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true }),
      resolveLatestRecoverySummary(athleteId),
      listKnowledgeExpansionTraceSummaries(athleteId, {
        limit: 4,
        modules: ["nutrition", "training", "health"],
      }).catch((error) => {
        if (isMissingKnowledgeFoundationError(error)) return [];
        throw error;
      }),
    ]);
    const error =
      execRes.error?.message ??
      plannedRes.error?.message ??
      null;
    const profile = athleteMemory.profile
      ? {
          id: athleteMemory.profile.id,
          birth_date: athleteMemory.profile.birthDate ?? null,
          sex: athleteMemory.profile.sex ?? null,
          diet_type: athleteMemory.profile.dietType ?? null,
          intolerances: athleteMemory.profile.intolerances ?? null,
          allergies: athleteMemory.profile.allergies ?? null,
          food_preferences: athleteMemory.profile.foodPreferences ?? null,
          food_exclusions: athleteMemory.profile.foodExclusions ?? null,
          supplements: athleteMemory.profile.supplements ?? null,
          height_cm: athleteMemory.profile.heightCm ?? null,
          weight_kg: athleteMemory.profile.weightKg ?? null,
          body_fat_pct: athleteMemory.profile.bodyFatPct ?? null,
          muscle_mass_kg: athleteMemory.profile.muscleMassKg ?? null,
          lifestyle_activity_class: athleteMemory.profile.lifestyleActivityClass ?? null,
          routine_config: athleteMemory.profile.routineConfig ?? null,
          nutrition_config: athleteMemory.profile.nutritionConfig ?? null,
          supplement_config: athleteMemory.profile.supplementConfig ?? null,
        }
      : null;
    const physiologyState = athleteMemory.physiology;
    const twinState = athleteMemory.twin;
    const adaptationGuidance = buildAdaptationGuidance({
      expectedAdaptation: twinState?.expectedAdaptation ?? twinState?.adaptationScore ?? 0,
      observedAdaptation: twinState?.realAdaptation ?? twinState?.adaptationScore ?? 0,
      likelyDrivers: twinState?.likelyDrivers ?? [],
    });
    const operationalContext = buildTrainingDayOperationalContext({
      recoveryStatus: recoverySummary?.status ?? "unknown",
      trafficLight: adaptationGuidance.trafficLight,
      keepProgramUnchanged: adaptationGuidance.keepProgramUnchanged,
      reductionMinPct: adaptationGuidance.reductionMinPct,
      reductionMaxPct: adaptationGuidance.reductionMaxPct,
    });
    const adaptationLoop = await resolveAdaptationRegenerationLoop({
      athleteId,
      twinState,
      recoverySummary,
      operationalContext,
    });
    const bioenergeticModulation =
      physiologyState && twinState
        ? buildBioenergeticModulation({
            physiologyState,
            twinState,
            recoverySummary,
          })
        : null;

    const metabolicEfficiencyGenerativeModel = buildMetabolicEfficiencyGenerativeModel({
      adaptationGuidance,
      bioenergeticModulation,
      adaptationLoop,
      researchTraceSummaries,
    });
    const diarySignals = extractDiaryAdaptiveSignals({
      profile: athleteMemory.profile,
      diaryEntries: athleteMemory.nutrition.diary ?? [],
    });
    const nutritionPerformanceIntegration = buildNutritionPerformanceIntegration({
      bioenergeticModulation,
      adaptationGuidance,
      adaptationLoop,
      operationalContext,
      diarySignals,
    });

    const pathwayDateParam = (req.nextUrl.searchParams.get("pathwayDate") ?? "").trim();
    let pathwayModulation = null;
    let functionalFoodRecommendations = null;
    if (pathwayDateParam && pathwayDateParam >= from && pathwayDateParam <= to) {
      const rowsForDay = (plannedRes.data ?? []).filter((row) => row.date === pathwayDateParam);
      pathwayModulation = buildNutritionPathwayModulationViewModel({
        date: pathwayDateParam,
        plannedSessions: rowsForDay.map((row) => {
          const bs = parsePro2BuilderSessionFromNotes(row.notes);
          return {
            id: row.id,
            label: String(bs?.sessionName ?? bs?.discipline ?? row.type ?? "Sessione"),
            builderSession: bs,
          };
        }),
        physiology: physiologyState,
        twin: twinState,
      });
      functionalFoodRecommendations = buildFunctionalFoodRecommendationsViewModel(pathwayModulation.pathways);
    }

    return NextResponse.json({
      athleteId,
      from,
      to,
      profile,
      physio: {
        athlete_id: athleteId,
        ftp_watts: physiologyState?.physiologicalProfile.ftpWatts ?? null,
        lt1_watts: physiologyState?.physiologicalProfile.lt1Watts ?? null,
        lt2_watts: physiologyState?.physiologicalProfile.lt2Watts ?? null,
        v_lamax: physiologyState?.physiologicalProfile.vLamax ?? null,
        vo2max_ml_min_kg: physiologyState?.physiologicalProfile.vo2maxMlMinKg ?? null,
        baseline_hrv_ms: physiologyState?.physiologicalProfile.baselineHrvMs ?? null,
      },
      physiologyState,
      twinState,
      recoverySummary,
      adaptationGuidance,
      operationalContext,
      adaptationLoop,
      bioenergeticModulation,
      nutritionPerformanceIntegration,
      metabolicEfficiencyGenerativeModel,
      pathwayModulation,
      functionalFoodRecommendations,
      athleteMemory,
      executed: execRes.data ?? [],
      planned: (plannedRes.data ?? []).map((row) => {
        const builderSession = parsePro2BuilderSessionFromNotes(row.notes);
        const canonicalPlannedWorkout = toCanonicalPlannedWorkout({
          ...row,
          athlete_id: athleteId,
          adaptive_goal: builderSession?.adaptationTarget ?? null,
        });
        return {
          ...row,
          builderSession,
          canonicalPlannedWorkout,
          plannedDiscipline: builderSession?.discipline ?? row.type ?? null,
          plannedFamily: builderSession?.family ?? null,
          plannedAdaptationTarget: builderSession?.adaptationTarget ?? null,
        };
      }),
      researchTraceSummaries,
      error,
    });
  } catch (err) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ error: err.message, profile: null, physio: null, executed: [], planned: [] }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Nutrition module API error";
    return NextResponse.json({ error: message, profile: null, physio: null, executed: [], planned: [] }, { status: 500 });
  }
}

