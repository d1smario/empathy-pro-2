/**
 * Bundle unico: twin atteso vs osservato → guidance → contesto operativo → loop rigenerazione
 * → modulazione bioenergetica → dial nutrizione/fueling (diario reale).
 * Usato da GET /api/nutrition/module e GET /api/dashboard/athlete-hub — stessa verità di V1 GET /api/dashboard.
 */
import { buildAdaptationGuidance } from "@/lib/adaptation/adaptation-guidance";
import type { AdaptationGuidance } from "@/lib/empathy/schemas/adaptation";
import type { AthleteMemory } from "@/lib/empathy/schemas/memory";
import { extractDiaryAdaptiveSignals } from "@/lib/nutrition/diary-adaptive-signals";
import {
  buildNutritionPerformanceIntegration,
  type NutritionPerformanceIntegrationDials,
} from "@/lib/nutrition/performance-integration-scaler";
import { resolveLatestRecoverySummary, type RecoverySummary } from "@/lib/reality/recovery-summary";
import { buildBioenergeticModulation, type BioenergeticModulation } from "@/lib/training/bioenergetic-modulation";
import { buildTrainingDayOperationalContext, type TrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import {
  resolveAdaptationRegenerationLoop,
  type AdaptationRegenerationLoop,
} from "@/lib/training/adaptation-regeneration-loop";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export type ApprovedApplicationPatch = {
  id: string;
  target: string;
  action: string;
  reason: unknown;
  confidence: number | null;
  sourceRefs: unknown[];
  stagingRunId: string | null;
  status: "pending" | "applied" | "rejected" | "superseded";
  createdAt: string | null;
};

export type OperationalSignalsBundle = {
  adaptationGuidance: AdaptationGuidance;
  operationalContext: TrainingDayOperationalContext | null;
  adaptationLoop: AdaptationRegenerationLoop;
  bioenergeticModulation: BioenergeticModulation | null;
  nutritionPerformanceIntegration: NutritionPerformanceIntegrationDials;
  approvedApplicationPatches: ApprovedApplicationPatch[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function resolveApprovedApplicationPatches(athleteId: string): Promise<ApprovedApplicationPatch[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("manual_actions")
    .select("id, action_type, payload, status, created_at")
    .eq("athlete_id", athleteId)
    .eq("status", "pending")
    .in("action_type", ["training_staging_patch", "nutrition_staging_patch", "physiology_staging_patch"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    const msg = error.message ?? "";
    if (error.code === "42P01" || msg.includes("does not exist")) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const payload = asRecord(row.payload);
    const values = asRecord(payload.values);
    return {
      id: String(row.id ?? ""),
      target: asString(values.target) ?? "training",
      action: asString(values.action) ?? "review_staging_patch",
      reason: values.reason ?? payload.reason ?? null,
      confidence: asNumber(values.confidence),
      sourceRefs: asArray(values.sourceRefs),
      stagingRunId: asString(values.stagingRunId),
      status: row.status === "applied" || row.status === "rejected" || row.status === "superseded" ? row.status : "pending",
      createdAt: asString(row.created_at),
    };
  });
}

export async function resolveOperationalSignalsBundle(input: {
  athleteId: string;
  athleteMemory: AthleteMemory;
  /** Se già caricato (es. Promise.all del route), evita una seconda lettura recovery. */
  recoverySummary?: RecoverySummary | null;
}): Promise<OperationalSignalsBundle> {
  const { athleteId, athleteMemory } = input;
  const twinState = athleteMemory.twin ?? null;
  const physiologyState = athleteMemory.physiology ?? null;

  const recoverySummary =
    input.recoverySummary !== undefined
      ? input.recoverySummary
      : await resolveLatestRecoverySummary(athleteId).catch(() => null);

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

  const diarySignals = extractDiaryAdaptiveSignals({
    profile: athleteMemory.profile,
    diaryEntries: athleteMemory.nutrition.diary ?? [],
  });

  const nutritionPerformanceIntegration = buildNutritionPerformanceIntegration({
    bioenergeticModulation,
    adaptationGuidance,
    adaptationLoop: adaptationLoop
      ? { status: adaptationLoop.status, nextAction: adaptationLoop.nextAction }
      : null,
    operationalContext,
    diarySignals,
  });

  const approvedApplicationPatches = await resolveApprovedApplicationPatches(athleteId).catch(() => []);

  return {
    adaptationGuidance,
    operationalContext,
    adaptationLoop,
    bioenergeticModulation,
    nutritionPerformanceIntegration,
    approvedApplicationPatches,
  };
}
