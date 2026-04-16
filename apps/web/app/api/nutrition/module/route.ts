import { NextRequest, NextResponse } from "next/server";
import type { PlannedWorkoutDbRow } from "@empathy/domain-training";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import type { PlannedWorkoutDbRow as AdapterPlannedWorkoutDbRow } from "@/lib/empathy/adapters/training";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { toCanonicalPlannedWorkout } from "@/lib/empathy/adapters/training";
import { resolveOperationalSignalsBundle } from "@/lib/dashboard/resolve-operational-signals-bundle";
import { isMissingKnowledgeFoundationError } from "@/lib/knowledge/knowledge-foundation";
import { listKnowledgeExpansionTraceSummaries } from "@/lib/knowledge/knowledge-research-trace-store";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { resolveLatestRecoverySummary } from "@/lib/reality/recovery-summary";
import { buildMetabolicEfficiencyGenerativeModel } from "@/lib/bioenergetics/metabolic-efficiency-generative-model";
import { buildFunctionalFoodRecommendationsViewModel } from "@/lib/nutrition/functional-food-recommendations";
import { buildNutritionPathwayModulationViewModel } from "@/lib/nutrition/pathway-modulation-model";
import { firstWindowQueryError, queryPlannedExecutedWindow } from "@/lib/training/planned-executed-window-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full nutrition module context endpoint.
// This route aggregates physiology, twin, memory, execution, and planning inputs.
// Planned + executed nella finestra `from`…`to`: stessa query e stesso client DB di `GET /api/training/planned-window`
// (`requireAthleteReadContext` → service role se configurato).
// Optional query: pathwayDate=YYYY-MM-DD (must be within from…to) → pathwayModulation + functionalFoodRecommendations (stessi builder del client).

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId", profile: null, physio: null, executed: [], planned: [] }, { status: 400 });
    }
    const from = (req.nextUrl.searchParams.get("from") ?? "").trim();
    const to = (req.nextUrl.searchParams.get("to") ?? "").trim();
    if (!from || !to) {
      return NextResponse.json({ error: "Missing from/to", profile: null, physio: null, executed: [], planned: [] }, { status: 400 });
    }

    const { db } = await requireAthleteReadContext(req, athleteId);
    const [athleteMemory, trainingWindow, recoverySummary, researchTraceSummaries] = await Promise.all([
      resolveAthleteMemory(athleteId),
      queryPlannedExecutedWindow(db, athleteId, from, to),
      resolveLatestRecoverySummary(athleteId),
      listKnowledgeExpansionTraceSummaries(athleteId, {
        limit: 4,
        modules: ["nutrition", "training", "health"],
      }).catch((error) => {
        if (isMissingKnowledgeFoundationError(error)) return [];
        throw error;
      }),
    ]);
    const plannedRes = trainingWindow.planned;
    const execRes = trainingWindow.executed;
    const error = firstWindowQueryError(plannedRes, execRes);
    const plannedRaw = (plannedRes.data ?? []) as PlannedWorkoutDbRow[];
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
    const {
      adaptationGuidance,
      operationalContext,
      adaptationLoop,
      bioenergeticModulation,
      nutritionPerformanceIntegration,
    } = await resolveOperationalSignalsBundle({
      athleteId,
      athleteMemory,
      recoverySummary,
    });

    const metabolicEfficiencyGenerativeModel = buildMetabolicEfficiencyGenerativeModel({
      adaptationGuidance,
      bioenergeticModulation,
      adaptationLoop,
      researchTraceSummaries,
    });

    const pathwayDateParam = (req.nextUrl.searchParams.get("pathwayDate") ?? "").trim();
    let pathwayModulation = null;
    let functionalFoodRecommendations = null;
    if (pathwayDateParam && pathwayDateParam >= from && pathwayDateParam <= to) {
      const rowsForDay = plannedRaw.filter((row) => row.date.slice(0, 10) === pathwayDateParam);
      pathwayModulation = buildNutritionPathwayModulationViewModel({
        date: pathwayDateParam,
        plannedSessions: rowsForDay.map((row) => {
          const bs = parsePro2BuilderSessionFromNotes(row.notes ?? null);
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

    const res = NextResponse.json({
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
      planned: plannedRaw.map((row) => {
        const builderSession = parsePro2BuilderSessionFromNotes(row.notes ?? null);
        const adapterRow = row as unknown as AdapterPlannedWorkoutDbRow;
        const canonicalPlannedWorkout = toCanonicalPlannedWorkout({
          ...adapterRow,
          athlete_id: row.athlete_id,
          adaptive_goal: builderSession?.adaptationTarget ?? null,
        });
        return {
          ...row,
          builderSession,
          canonicalPlannedWorkout,
          plannedSessionName: builderSession?.sessionName ?? null,
          plannedDiscipline: builderSession?.discipline ?? row.type ?? null,
          plannedFamily: builderSession?.family ?? null,
          plannedAdaptationTarget: builderSession?.adaptationTarget ?? null,
        };
      }),
      researchTraceSummaries,
      error,
    });
    res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    return res;
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message, profile: null, physio: null, executed: [], planned: [] }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Nutrition module API error";
    return NextResponse.json({ error: message, profile: null, physio: null, executed: [], planned: [] }, { status: 500 });
  }
}

