import { NextRequest, NextResponse } from "next/server";
import { buildAdaptationGuidance } from "@/lib/adaptation/adaptation-guidance";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { isMissingKnowledgeFoundationError } from "@/lib/knowledge/knowledge-foundation";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { summarizeReadSpineCoverage } from "@/lib/platform/read-spine-coverage";
import { resolveCanonicalPhysiologyState } from "@/lib/physiology/profile-resolver";
import { buildViryaResearchPlans } from "@/lib/knowledge/training-research-context";
import { persistCanonicalResearchTracePlan } from "@/lib/knowledge/knowledge-research-flow";
import { resolveLatestRecoverySummary } from "@/lib/reality/recovery-summary";
import { buildTrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import { resolveAdaptationRegenerationLoop } from "@/lib/training/adaptation-regeneration-loop";
import { buildBioenergeticModulation } from "@/lib/training/bioenergetic-modulation";
import { extractDiaryAdaptiveSignals } from "@/lib/nutrition/diary-adaptive-signals";
import { buildNutritionPerformanceIntegration } from "@/lib/nutrition/performance-integration-scaler";
import { buildOperationalDynamicsLines } from "@/lib/platform/operational-dynamics-lines";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/** Planner-context VIRYA — stesso loop V1; sessioni concrete solo via builder. */
function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }
    await requireAthleteReadContext(req, athleteId);

    const athleteMemory = await resolveAthleteMemory(athleteId);
    const canonicalState = athleteMemory.physiology ?? (await resolveCanonicalPhysiologyState(athleteId));
    const twinState = athleteMemory.twin;
    const readSpineCoverage = summarizeReadSpineCoverage(athleteMemory);

    let recoverySummary: Awaited<ReturnType<typeof resolveLatestRecoverySummary>> = null;
    try {
      recoverySummary = await resolveLatestRecoverySummary(athleteId);
    } catch {
      recoverySummary = null;
    }

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
      twinState != null
        ? buildBioenergeticModulation({
            physiologyState: canonicalState,
            twinState,
            recoverySummary,
          })
        : null;

    const diarySignals = extractDiaryAdaptiveSignals({
      profile: athleteMemory.profile,
      diaryEntries: athleteMemory.nutrition.diary ?? [],
    });
    const nutritionPerformanceIntegration = buildNutritionPerformanceIntegration({
      bioenergeticModulation,
      adaptationGuidance,
      adaptationLoop: adaptationLoop ? { status: adaptationLoop.status, nextAction: adaptationLoop.nextAction } : null,
      operationalContext,
      diarySignals,
    });
    const crossModuleDynamicsLines = buildOperationalDynamicsLines({
      adaptationGuidance,
      operationalContext,
      nutritionPerformanceIntegration,
      adaptationLoop: adaptationLoop ? { status: adaptationLoop.status, nextAction: adaptationLoop.nextAction } : null,
    });

    const profile = athleteMemory.profile;
    const panels = athleteMemory.health.panels ?? [];

    const latestLactate = canonicalState.lactateProfile.latestValues;
    const latestMaxOx = canonicalState.performanceProfile.latestValues;
    const latestMicrobiota =
      athleteMemory.health.microbiota ??
      (panels.find((p) => String(p.type) === "microbiota")?.values as Record<string, unknown> | null);
    const latestGenomics =
      athleteMemory.health.epigenetics ??
      (panels.find((p) => String(p.type) === "genomics")?.values as Record<string, unknown> | null);
    const latestBlood =
      athleteMemory.health.blood ??
      (panels.find((p) => String(p.type) === "blood")?.values as Record<string, unknown> | null);

    const flags = {
      peripheralLimit: (asNumber(latestMaxOx?.peripheralUtilizationIndex) ?? 1) < 0.8,
      redoxLimit:
        (asNumber(latestMaxOx?.redoxStressIndex) ?? 0) >= 55 ||
        (canonicalState.bioenergeticProfile.inflammationProxy ?? 0) >= 55,
      glycolyticPressure: (asNumber(latestLactate?.glycolyticSharePct) ?? 0) >= 88,
      gutConstraint:
        (asNumber(latestLactate?.effectiveSequestrationPct) ?? 0) >= 12 ||
        (canonicalState.bioenergeticProfile.hydrationStatus ?? 100) < 45,
      dysbiosisRisk: (asNumber(latestLactate?.microbiotaDysbiosisScore) ?? 0) >= 0.35,
      epigeneticConstraint:
        (asNumber(latestGenomics?.mthfr_risk_score_0_10) ?? 0) >= 7 ||
        (asNumber(latestGenomics?.nrf2_pathway_score_0_10) ?? 10) <= 4,
      ironConstraint: (asNumber(latestBlood?.ferritin_ng_ml) ?? 80) < 35,
    };

    const strategyHints: string[] = [];
    if (flags.peripheralLimit) strategyHints.push("focus_z2_mitochondrial_density");
    if (flags.glycolyticPressure) strategyHints.push("lactate_clearance_mct_block");
    if (flags.gutConstraint || flags.dysbiosisRisk) strategyHints.push("gut_absorption_progression_protocol");
    if (flags.redoxLimit) strategyHints.push("redox_stability_block");
    if (flags.epigeneticConstraint) strategyHints.push("epigenetic_recovery_block");
    if (flags.ironConstraint) strategyHints.push("iron_recovery_monitoring");
    if ((canonicalState.lactateProfile.glucoseFromCoriG ?? 0) >= 35) strategyHints.push("cori_reconversion_capacity_session");
    if ((canonicalState.performanceProfile.oxidativeBottleneckIndex ?? 0) >= 60) {
      strategyHints.push("oxidative_bottleneck_resolution");
    }
    if ((canonicalState.lactateProfile.bloodDeliveryPctOfIngested ?? 100) <= 75) {
      strategyHints.push("cho_delivery_ceiling_management");
    }
    if ((twinState?.glycogenStatus ?? 100) < 40) strategyHints.push("glycogen_restoration_priority");
    if ((twinState?.readiness ?? 100) < 45) strategyHints.push("readiness_protection_microcycle");
    if (!strategyHints.length) strategyHints.push("balanced_periodization");

    const knowledgeModulation =
      athleteMemory.knowledge?.activeModulations.find((snapshot) => snapshot.domain === "training") ??
      athleteMemory.knowledge?.activeModulations.find((snapshot) => snapshot.domain === "bioenergetics") ??
      athleteMemory.knowledge?.activeModulations.find((snapshot) => snapshot.domain === "health") ??
      athleteMemory.knowledge?.activeModulations.find((snapshot) => snapshot.domain === "nutrition") ??
      athleteMemory.knowledge?.activeModulations[0] ??
      null;
    const researchPlans = buildViryaResearchPlans({
      athleteId,
      strategyHints,
      flags,
    });
    const researchTraces = new Array<Awaited<ReturnType<typeof persistCanonicalResearchTracePlan>>>();
    const persistenceResults = await Promise.allSettled(
      researchPlans.map((plan) => persistCanonicalResearchTracePlan(plan)),
    );
    for (const result of persistenceResults) {
      if (result.status === "fulfilled") {
        researchTraces.push(result.value);
        continue;
      }
      if (!isMissingKnowledgeFoundationError(result.reason)) {
        console.error("virya research trace persistence failed", result.reason);
      }
    }

    return NextResponse.json(
      {
        athleteId,
        profile: {
          weight_kg: profile?.weightKg ?? null,
          body_fat_pct: profile?.bodyFatPct ?? null,
          max_hr_bpm: canonicalState.performanceProfile.maxHrBpm ?? profile?.maxHrBpm ?? null,
          resting_hr_bpm: canonicalState.performanceProfile.restingHrBpm ?? profile?.restingHrBpm ?? null,
        },
        physiology: {
          ftp_watts: canonicalState.physiologicalProfile.ftpWatts ?? null,
          lt1_watts: canonicalState.physiologicalProfile.lt1Watts ?? null,
          lt2_watts: canonicalState.physiologicalProfile.lt2Watts ?? null,
          v_lamax: canonicalState.physiologicalProfile.vLamax ?? null,
          vo2max_ml_min_kg: canonicalState.physiologicalProfile.vo2maxMlMinKg ?? null,
          baseline_hrv_ms: canonicalState.physiologicalProfile.baselineHrvMs ?? null,
        },
        physiologyState: canonicalState,
        health: {
          microbiota: latestMicrobiota,
          genomics: latestGenomics,
          blood: latestBlood,
          bioenergetics: canonicalState.bioenergeticProfile.raw,
        },
        latestLab: {
          lactate: latestLactate,
          maxOx: latestMaxOx,
        },
        twinState: athleteMemory.twin,
        athleteMemory,
        readSpineCoverage,
        recoverySummary,
        operationalContext,
        adaptationLoop,
        bioenergeticModulation,
        adaptationGuidance,
        nutritionPerformanceIntegration,
        crossModuleDynamicsLines,
        knowledgeModulation,
        researchPlans,
        researchTraces,
        flags,
        strategyHints,
        connectedModules: {
          profile: !!profile,
          physiology:
            canonicalState.sources.physiologicalProfile ||
            canonicalState.sources.lactateRun ||
            canonicalState.sources.performanceRun,
          health: panels.length > 0 || canonicalState.sources.biomarkerPanel,
        },
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Virya context fetch failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
