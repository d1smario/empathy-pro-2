import { NextRequest, NextResponse } from "next/server";
import type { PlannedWorkoutDbRow } from "@empathy/domain-training";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import type { PlannedWorkoutDbRow as AdapterPlannedWorkoutDbRow } from "@/lib/empathy/adapters/training";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { toCanonicalPlannedWorkout } from "@/lib/empathy/adapters/training";
import { resolveOperationalSignalsBundle } from "@/lib/dashboard/resolve-operational-signals-bundle";
import { isMissingKnowledgeFoundationError } from "@/lib/knowledge/knowledge-foundation";
import { listKnowledgeExpansionTraceSummaries } from "@/lib/knowledge/knowledge-research-trace-store";
import { COACH_APPLICATION_EVIDENCE_SOURCE } from "@/lib/memory/coach-application-traces";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";
import { resolveLatestRecoverySummary } from "@/lib/reality/recovery-summary";
import { buildMetabolicEfficiencyGenerativeModel } from "@/lib/bioenergetics/metabolic-efficiency-generative-model";
import { buildFunctionalFoodRecommendationsViewModel } from "@/lib/nutrition/functional-food-recommendations";
import { buildFunctionalMealSelectorViewModel } from "@/lib/nutrition/functional-meal-selector";
import { buildNutritionPathwayModulationViewModel } from "@/lib/nutrition/pathway-modulation-model";
import { buildHealthLabPathwayBridge } from "@/lib/nutrition/health-lab-pathway-bridge";
import { buildEvidencePathwayBridge } from "@/lib/nutrition/evidence-pathway-bridge";
import { buildMultiscalePathwayBridge } from "@/lib/nutrition/multiscale-pathway-bridge";
import { buildHealthPanelModulatorBridge } from "@/lib/nutrition/health-panel-modulator-bridge";
import { buildNutrientInterrogationViewModel } from "@/lib/nutrition/build-nutrient-interrogation-view-model";
import { buildActiveNutrientTargets } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";
import {
  mergeResearchTraceSummaries,
  plansToSyncFromMultiscaleActivation,
} from "@/lib/knowledge/multiscale-research-plan";
import { syncResearchTracePlans } from "@/lib/knowledge/virya-research-trace-sync";
import { buildCrossDomainInterpretationRoadmapV1 } from "@/lib/nutrition/cross-domain-interpretation-roadmap";
import {
  mergeNutritionModuleProfileWithAthleteProfileRow,
  type NutritionModuleFlatProfile,
} from "@/lib/nutrition/nutrition-module-profile-merge";
import { buildNutritionModuleDailyEnergyModel } from "@/lib/nutrition/nutrition-module-daily-energy";
import { firstWindowQueryError, queryPlannedExecutedWindow } from "@/lib/training/planned-executed-window-query";
import { resolveEmpathyInterrogationBundle } from "@/lib/interpretation/resolve-empathy-interrogation-bundle";
import type { EmpathyInterrogationBundle } from "@empathy/contracts";
import { ServerTiming, serverTimingNow } from "@/lib/http/server-timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveModuleMode(req: NextRequest): "full" | "pathway" | "light" {
  const raw = (req.nextUrl.searchParams.get("mode") ?? "").trim().toLowerCase();
  if (raw === "pathway") return "pathway";
  if (raw === "light") return "light";
  return "full";
}

function wantsHeavyModuleSections(req: NextRequest): boolean {
  const raw = (req.nextUrl.searchParams.get("includeHeavy") ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

// Full nutrition module context endpoint.
// This route aggregates physiology, twin, memory, execution, and planning inputs.
// Planned + executed nella finestra `from`…`to`: stessa query e stesso client DB di `GET /api/training/planned-window`
// (`requireAthleteReadContext` → service role se configurato).
// Optional query: pathwayDate=YYYY-MM-DD (must be within from…to) → pathwayModulation + functionalFoodRecommendations (stessi builder del client).

function buildNutritionApplicationDirective(
  patches: Awaited<ReturnType<typeof resolveOperationalSignalsBundle>>["approvedApplicationPatches"],
  coachNutritionEvidence: { count: number; lines: string[] },
) {
  const applied = patches.filter((patch) => patch.status === "applied");
  const pending = patches.filter((patch) => patch.status === "pending");
  /** L2 staging: applied patches hanno priorità; pending come fallback. */
  const active = [...applied, ...pending.filter((p) => !applied.some((a) => a.id === p.id))];
  const text = active.map((patch) => `${patch.target} ${patch.action} ${patch.reason ?? ""}`.toLowerCase()).join(" ");
  const coachText = coachNutritionEvidence.lines.join(" ").toLowerCase();
  const mergedText = `${text} ${coachText}`;
  const focus = [
    mergedText.includes("redox") ? "redox_support" : null,
    mergedText.includes("iron") || mergedText.includes("ferro") || mergedText.includes("ferritin")
      ? "iron_absorption_support"
      : null,
    mergedText.includes("gut") || mergedText.includes("microbiota") || mergedText.includes("assorb") ? "gut_absorption_tolerance" : null,
    mergedText.includes("fuel") || mergedText.includes("cho") || mergedText.includes("glycogen") ? "fueling_timing" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    appliedCount: applied.length,
    pendingCount: pending.length,
    coachValidatedMemoryCount: coachNutritionEvidence.count,
    coachValidatedMemoryLines: coachNutritionEvidence.lines,
    focus: focus.length ? focus : ["baseline_support"],
    stagingPatchActions: active.slice(0, 6).map((p) => ({
      status: p.status,
      target: p.target,
      action: p.action,
    })),
    solverPolicy: "do_not_override_kcal_macro_catalog" as const,
    timingPolicy: "coach_validated_context_for_pre_peri_post" as const,
    rationale: [
      active.length ? `${active.length} decisioni nutrition/fueling lette da manual_actions.` : "Nessuna decisione nutrition/fueling attiva.",
      coachNutritionEvidence.count
        ? `${coachNutritionEvidence.count} voci memoria coach validate (athlete_coach_application_traces → evidence).`
        : "Nessuna memoria coach nutrizionale recente.",
      "Usare come contesto per timing, cofattori, esclusioni temporanee e spiegazione; non sostituisce USDA/solver.",
    ],
  };
}

export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  const t0 = serverTimingNow();
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

    const tAuth = serverTimingNow();
    const { db } = await requireAthleteReadContext(req, athleteId);
    timing.mark("auth", tAuth, "athlete read context");
    const mode = resolveModuleMode(req);
    const includeHeavy = wantsHeavyModuleSections(req);
    const pathwayDateParam = (req.nextUrl.searchParams.get("pathwayDate") ?? "").trim();

    /** `pathway`: query solo il giorno pathway (non tutta la finestra from…to). */
    let windowFrom = from;
    let windowTo = to;
    if (
      mode === "pathway" &&
      pathwayDateParam &&
      pathwayDateParam >= from &&
      pathwayDateParam <= to
    ) {
      windowFrom = pathwayDateParam;
      windowTo = pathwayDateParam;
    }

    const [athleteMemory, trainingWindow, recoverySummary, profileAnthroRes, researchTraceSummaries] =
      await Promise.all([
        resolveAthleteMemorySlice(athleteId, { slice: "nutrition" }),
        (async () => {
          const tWindow = serverTimingNow();
          const result = await queryPlannedExecutedWindow(db, athleteId, windowFrom, windowTo, undefined, {
            includeTraceSummary: mode === "pathway" && windowFrom === windowTo,
          });
          timing.mark("window", tWindow, "planned executed window");
          return result;
        })(),
        resolveLatestRecoverySummary(athleteId),
        db
          .from("athlete_profiles")
          .select(
            "birth_date, sex, height_cm, weight_kg, body_fat_pct, muscle_mass_kg, nutrition_config, routine_config, preferred_meal_count",
          )
          .eq("id", athleteId)
          .maybeSingle(),
        includeHeavy
          ? listKnowledgeExpansionTraceSummaries(athleteId, {
              limit: 4,
              modules: ["nutrition", "training", "health"],
            }).catch((error) => {
              if (isMissingKnowledgeFoundationError(error)) return [];
              throw error;
            })
          : Promise.resolve([]),
      ]);
    const plannedRes = trainingWindow.planned;
    const execRes = trainingWindow.executed;
    const error = firstWindowQueryError(plannedRes, execRes);
    const plannedRaw = (plannedRes.data ?? []) as PlannedWorkoutDbRow[];
    const profileFromMemory: NutritionModuleFlatProfile | null = athleteMemory.profile
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
          preferred_meal_count: athleteMemory.profile.preferredMealCount ?? null,
        }
      : null;

    const profileAnthroRow: Record<string, unknown> | null = profileAnthroRes.error
      ? null
      : ((profileAnthroRes.data ?? null) as Record<string, unknown> | null);
    const profile = mergeNutritionModuleProfileWithAthleteProfileRow(
      athleteId,
      profileFromMemory,
      profileAnthroRow && typeof profileAnthroRow === "object" && !Array.isArray(profileAnthroRow)
        ? (profileAnthroRow as Record<string, unknown>)
        : null,
    );
    const physiologyState = athleteMemory.physiology;
    const twinState = athleteMemory.twin;
    let adaptationGuidance: Awaited<ReturnType<typeof resolveOperationalSignalsBundle>>["adaptationGuidance"] | null = null;
    let operationalContext: Awaited<ReturnType<typeof resolveOperationalSignalsBundle>>["operationalContext"] | null = null;
    let adaptationLoop: Awaited<ReturnType<typeof resolveOperationalSignalsBundle>>["adaptationLoop"] | null = null;
    let bioenergeticModulation: Awaited<ReturnType<typeof resolveOperationalSignalsBundle>>["bioenergeticModulation"] | null = null;
    let nutritionPerformanceIntegration:
      | Awaited<ReturnType<typeof resolveOperationalSignalsBundle>>["nutritionPerformanceIntegration"]
      | null = null;
    let approvedApplicationPatches: Awaited<ReturnType<typeof resolveOperationalSignalsBundle>>["approvedApplicationPatches"] = [];
    let nutritionApprovedPatches: Awaited<ReturnType<typeof resolveOperationalSignalsBundle>>["approvedApplicationPatches"] = [];
    let nutritionApplicationDirective: ReturnType<typeof buildNutritionApplicationDirective> | null = null;

    if (mode === "full") {
      const bundle = await resolveOperationalSignalsBundle({
        athleteId,
        athleteMemory,
        recoverySummary,
      });
      adaptationGuidance = bundle.adaptationGuidance;
      operationalContext = bundle.operationalContext;
      adaptationLoop = bundle.adaptationLoop;
      bioenergeticModulation = bundle.bioenergeticModulation;
      nutritionPerformanceIntegration = bundle.nutritionPerformanceIntegration;
      approvedApplicationPatches = bundle.approvedApplicationPatches;
      nutritionApprovedPatches = approvedApplicationPatches.filter((patch) => {
        const target = patch.target.toLowerCase();
        return target.includes("nutrition") || target.includes("fueling") || target.includes("redox") || target.includes("gut");
      });
      const coachNutritionEvidence = (athleteMemory.evidenceMemory?.items ?? [])
        .filter(
          (item) =>
            item.source === COACH_APPLICATION_EVIDENCE_SOURCE &&
            (item.module === "nutrition" || (item.domain ?? "").toLowerCase().includes("nutrition")),
        )
        .slice(0, 6)
        .map((item) => item.title ?? item.summary ?? "coach_memory")
        .filter(Boolean);
      nutritionApplicationDirective = buildNutritionApplicationDirective(nutritionApprovedPatches, {
        count: coachNutritionEvidence.length,
        lines: coachNutritionEvidence,
      });
    }

    let pathwayModulation = null;
    let functionalFoodRecommendations = null;
    let functionalMealSelector = null;
    let dailyEnergyModel = null;
    let multiscaleBridge: ReturnType<typeof buildMultiscalePathwayBridge> = null;
    let healthLabBridge: ReturnType<typeof buildHealthLabPathwayBridge> | null = null;
    let healthPanelModulators: ReturnType<typeof buildHealthPanelModulatorBridge> | null = null;
    let researchTracesResolved = researchTraceSummaries;
    let multiscaleResearchSynced = false;
    let empathyInterrogationBundle: EmpathyInterrogationBundle | null = null;

    const metabolicEfficiencyGenerativeModel =
      includeHeavy && adaptationGuidance && bioenergeticModulation && adaptationLoop
      ? buildMetabolicEfficiencyGenerativeModel({
          adaptationGuidance,
          bioenergeticModulation,
          adaptationLoop,
          researchTraceSummaries,
        })
      : null;

    if (pathwayDateParam && pathwayDateParam >= from && pathwayDateParam <= to) {
      healthLabBridge = buildHealthLabPathwayBridge(athleteMemory.health);
      multiscaleBridge = buildMultiscalePathwayBridge({
        physiology: physiologyState,
        twin: twinState,
      });
      healthPanelModulators = buildHealthPanelModulatorBridge(athleteMemory.health);
      const rowsForDay = plannedRaw.filter((row) => row.date.slice(0, 10) === pathwayDateParam);
      const firstPlannedRow = rowsForDay[0];

      if (includeHeavy && multiscaleBridge) {
        const plansToSync = plansToSyncFromMultiscaleActivation(
          {
            athleteId,
            anchorDate: pathwayDateParam,
            bridge: multiscaleBridge,
            plannedWorkoutId: firstPlannedRow?.id ?? null,
          },
          researchTracesResolved,
        );
        if (plansToSync.length) {
          try {
            const synced = await syncResearchTracePlans(plansToSync);
            researchTracesResolved = mergeResearchTraceSummaries(researchTracesResolved, synced, 4);
            multiscaleResearchSynced = synced.length > 0;
          } catch (error) {
            if (!isMissingKnowledgeFoundationError(error)) {
              console.error("multiscale research trace sync failed", error);
            }
          }
        }
      }

      const evidenceBridge = buildEvidencePathwayBridge({
        evidenceItems: athleteMemory.evidenceMemory?.items ?? [],
        researchTraces: includeHeavy ? researchTracesResolved : [],
      });
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
        healthLabBridge,
        evidenceBridge,
        multiscaleBridge,
      });
      functionalFoodRecommendations = buildFunctionalFoodRecommendationsViewModel(pathwayModulation.pathways);
      functionalMealSelector = buildFunctionalMealSelectorViewModel({
        date: pathwayDateParam,
        pathwayModulation,
        foodRecommendations: functionalFoodRecommendations,
        nutritionPerformanceIntegration,
        approvedNutritionPatches: nutritionApprovedPatches,
        applicationDirective: nutritionApplicationDirective
          ? {
              focus: nutritionApplicationDirective.focus,
              coachValidatedMemoryCount: nutritionApplicationDirective.coachValidatedMemoryCount,
              coachValidatedMemoryLines: nutritionApplicationDirective.coachValidatedMemoryLines,
            }
          : null,
        adaptationLoop,
        recoverySummary,
        twin: twinState,
      });
      dailyEnergyModel = buildNutritionModuleDailyEnergyModel({
        athleteId,
        planDate: pathwayDateParam,
        profile,
        physiologyFtp: physiologyState?.physiologicalProfile.ftpWatts ?? null,
        physiologyVo2: physiologyState?.physiologicalProfile.vo2maxMlMinKg ?? null,
        plannedRowsForDay: rowsForDay,
        recoverySummary,
        nutritionPerformanceIntegration,
      });

      if (pathwayModulation) {
        const plannedSessionsForInterrogation = rowsForDay.map((row) => {
          const bs = parsePro2BuilderSessionFromNotes(row.notes ?? null);
          return {
            label: String(bs?.sessionName ?? bs?.discipline ?? row.type ?? "Sessione"),
            adaptationTarget: bs?.adaptationTarget ?? null,
          };
        });
        empathyInterrogationBundle = resolveEmpathyInterrogationBundle({
          athleteId,
          anchorDate: pathwayDateParam,
          plannedSessions: plannedSessionsForInterrogation,
          pathwayModulation,
          multiscaleBridge,
          healthLabBridge,
          healthPanelModulators,
          recoverySummary,
          nutritionPerformanceIntegration,
          dailyEnergyModel,
        });
      }
    }

    if (mode === "pathway") {
      timing.mark("total", t0, "nutrition module pathway");
      const res = NextResponse.json({
        athleteId,
        from,
        to,
        profile,
        physio: null,
        physiologyState: null,
        twinState: null,
        recoverySummary: null,
        adaptationGuidance: null,
        operationalContext: null,
        adaptationLoop: null,
        bioenergeticModulation: null,
        nutritionPerformanceIntegration: null,
        approvedApplicationPatches: [],
        nutritionApprovedPatches: [],
        nutritionApplicationDirective: null,
        metabolicEfficiencyGenerativeModel: null,
        pathwayModulation,
        functionalFoodRecommendations,
        functionalMealSelector,
        dailyEnergyModel,
        executed: [],
        planned: [],
        researchTraceSummaries: [],
        crossDomainInterpretationRoadmap: null,
        nutrientInterrogation: null,
        interrogationMap: empathyInterrogationBundle?.interrogationMap ?? null,
        applicationPlaybook: empathyInterrogationBundle?.applicationPlaybook ?? null,
        error: null,
      });
      res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
      timing.applyTo(res.headers);
      return res;
    }

    const roadmapAnchorDate =
      pathwayDateParam && pathwayDateParam >= from && pathwayDateParam <= to ? pathwayDateParam : from;
    const roadmapPlannedSessions =
      pathwayDateParam && pathwayDateParam >= from && pathwayDateParam <= to
        ? plannedRaw
            .filter((row) => row.date.slice(0, 10) === pathwayDateParam)
            .map((row) => {
              const bs = parsePro2BuilderSessionFromNotes(row.notes ?? null);
              return {
                label: String(bs?.sessionName ?? bs?.discipline ?? row.type ?? "Sessione"),
                adaptationTarget: bs?.adaptationTarget ?? null,
              };
            })
        : [];

    const nutrientInterrogation =
      includeHeavy && pathwayModulation
        ? buildNutrientInterrogationViewModel({
            activeTargets: buildActiveNutrientTargets({
              cofactorStrings: pathwayModulation.pathways.flatMap((p) => p.cofactors),
            }),
            multiscaleBridge,
            healthLabBridge,
            healthPanelModulators,
            pathwayModulation,
          })
        : null;

    const crossDomainInterpretationRoadmap = includeHeavy
      ? buildCrossDomainInterpretationRoadmapV1({
          athleteId,
          anchorDate: roadmapAnchorDate,
          pathwayModulation,
          plannedSessions: roadmapPlannedSessions,
          twin: twinState
            ? {
                glycogenStatus: twinState.glycogenStatus ?? null,
                readiness: twinState.readiness ?? null,
                redoxStressIndex: twinState.redoxStressIndex ?? null,
                inflammationRisk: twinState.inflammationRisk ?? null,
              }
            : null,
          physiology: physiologyState
            ? {
                performanceProfile: physiologyState.performanceProfile
                  ? { redoxStressIndex: physiologyState.performanceProfile.redoxStressIndex ?? null }
                  : null,
                lactateProfile: physiologyState.lactateProfile
                  ? {
                      gutStressScore: physiologyState.lactateProfile.gutStressScore ?? null,
                      bloodDeliveryPctOfIngested:
                        physiologyState.lactateProfile.bloodDeliveryPctOfIngested ?? null,
                    }
                  : null,
              }
            : null,
          recoverySummary: recoverySummary
            ? { status: recoverySummary.status, guidance: recoverySummary.guidance }
            : null,
          researchTraceSummaries: researchTracesResolved,
          hasNutritionPerformanceIntegration: nutritionPerformanceIntegration != null,
          multiscaleBridge,
          healthPanelModulators,
          nutrientInterrogation,
          multiscaleResearchSynced,
        })
      : null;

    timing.mark("total", t0, "nutrition module");
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
      approvedApplicationPatches,
      nutritionApprovedPatches,
      nutritionApplicationDirective,
      metabolicEfficiencyGenerativeModel,
      pathwayModulation,
      functionalFoodRecommendations,
      functionalMealSelector,
      dailyEnergyModel,
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
      researchTraceSummaries: researchTracesResolved,
      crossDomainInterpretationRoadmap,
      nutrientInterrogation,
      interrogationMap: empathyInterrogationBundle?.interrogationMap ?? null,
      applicationPlaybook: empathyInterrogationBundle?.applicationPlaybook ?? null,
      error,
    });
    res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    timing.applyTo(res.headers);
    return res;
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message, profile: null, physio: null, executed: [], planned: [] }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Nutrition module API error";
    return NextResponse.json({ error: message, profile: null, physio: null, executed: [], planned: [] }, { status: 500 });
  }
}

