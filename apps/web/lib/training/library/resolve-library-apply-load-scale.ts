import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOperationalSignalsBundle } from "@/lib/dashboard/resolve-operational-signals-bundle";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";
import { resolveLatestRecoverySummary } from "@/lib/reality/recovery-summary";
import {
  resolveDailyBuilderLoadAdaptation,
  type DailyBuilderLoadAdaptation,
} from "@/lib/training/builder/daily-builder-load-adaptation";
import { loadArchetypeTracesForKey } from "@/lib/training/library/athlete-workout-archetype-traces";

export type LibraryApplyLoadScaleResult = {
  loadScale: number;
  loadScalePct: number;
  hints: string[];
  loadAdaptation: DailyBuilderLoadAdaptation;
  traceAdjusted: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Load scale per apply library: operational day bundle + hint da tracce archetype (opt-in).
 */
export async function resolveLibraryApplyLoadScale(input: {
  db: SupabaseClient;
  athleteId: string;
  date: string;
  archetypeKey: string;
}): Promise<LibraryApplyLoadScaleResult> {
  const [athleteMemory, recoverySummary] = await Promise.all([
    resolveAthleteMemorySlice(input.athleteId, { slice: "dashboard" }),
    resolveLatestRecoverySummary(input.athleteId).catch(() => null),
  ]);

  const bundle = await resolveOperationalSignalsBundle({
    athleteId: input.athleteId,
    athleteMemory,
    recoverySummary,
  });

  const loadAdaptation = resolveDailyBuilderLoadAdaptation({
    adaptationGuidance: bundle.adaptationGuidance,
    operationalContext: bundle.operationalContext!,
    bioenergeticModulation: bundle.bioenergeticModulation,
    adaptationLoop: bundle.adaptationLoop,
    recoveryStatus: recoverySummary?.status ?? null,
  });

  let loadScale = loadAdaptation.loadScale;
  const hints: string[] = [loadAdaptation.guidance];
  let traceAdjusted = false;

  const traces = await loadArchetypeTracesForKey(input.db, input.athleteId, input.archetypeKey, 6);
  if (traces.length >= 2) {
    const negative = traces.filter((t) => t.responseSignal === "negative").length;
    const avgAdherence = traces.reduce((s, t) => s + t.adherencePct, 0) / traces.length;
    if (negative >= 2 && avgAdherence < 75) {
      const before = loadScale;
      loadScale = clamp(loadScale * 0.9, 0.35, 1);
      if (loadScale < before - 0.01) {
        traceAdjusted = true;
        hints.push(
          `Archetype con aderenza media ${Math.round(avgAdherence)}%: riduzione extra −10% sul carico operativo.`,
        );
      }
    }
  }

  return {
    loadScale,
    loadScalePct: Math.round(loadScale * 100),
    hints,
    loadAdaptation,
    traceAdjusted,
  };
}
