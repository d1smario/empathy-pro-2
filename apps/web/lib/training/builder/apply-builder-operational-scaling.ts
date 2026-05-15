import type { BuilderSessionOperationalScalingViewModel } from "@/api/training/contracts";
import type { AdaptationGuidance } from "@/lib/empathy/schemas/adaptation";
import type { BioenergeticModulation } from "@/lib/training/bioenergetic-modulation";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import type { AdaptationRegenerationLoop } from "@/lib/training/adaptation-regeneration-loop";
import type { RecoveryStatus } from "@/lib/reality/recovery-summary";
import {
  resolveDailyBuilderLoadAdaptation,
  type DailyBuilderLoadAdaptation,
} from "@/lib/training/builder/daily-builder-load-adaptation";
import type { GeneratedSession } from "@/lib/training/engine";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export type ApplyBuilderOperationalScalingInput = {
  session: GeneratedSession;
  sessionMinutesRequested: number;
  tssTargetHintRequested: number | null;
  adaptationGuidance: AdaptationGuidance;
  operationalContext: TrainingDayOperationalContext;
  bioenergeticModulation: BioenergeticModulation | null;
  adaptationLoop?: Pick<
    AdaptationRegenerationLoop,
    "status" | "executionDeltaTss" | "divergenceScore" | "executionCompliancePct"
  > | null;
  recoveryStatus?: RecoveryStatus | null;
};

export type ApplyBuilderOperationalScalingResult = {
  session: GeneratedSession;
  operationalScaling: BuilderSessionOperationalScalingViewModel;
  loadAdaptation: DailyBuilderLoadAdaptation;
};

function scaleSessionBlocks(session: GeneratedSession, loadScale: number): GeneratedSession {
  const scaledBlocks = session.blocks.map((block) => ({
    ...block,
    durationMinutes: Math.max(4, Math.round(block.durationMinutes * loadScale)),
  }));
  return { ...session, blocks: scaledBlocks };
}

/**
 * Scala durata/TSS della sessione builder dal punteggio giornaliero (±%) + recovery + bioenergetica.
 * VIRYA annuale: non chiamare (applyOperationalScaling false su engine/generate).
 */
export function applyBuilderOperationalScaling(
  input: ApplyBuilderOperationalScalingInput,
): ApplyBuilderOperationalScalingResult {
  const loadAdaptation = resolveDailyBuilderLoadAdaptation({
    adaptationGuidance: input.adaptationGuidance,
    operationalContext: input.operationalContext,
    bioenergeticModulation: input.bioenergeticModulation,
    adaptationLoop: input.adaptationLoop ?? null,
    recoveryStatus: input.recoveryStatus ?? null,
  });

  const loadScale = loadAdaptation.loadScale;
  const loadScalePct = loadAdaptation.loadScalePct;
  const applied = Math.abs(loadScale - 1) >= 0.01;

  const sessionMinutesRequested = Math.max(20, Math.round(input.sessionMinutesRequested));
  const tssTargetHintRequested =
    input.tssTargetHintRequested != null && input.tssTargetHintRequested > 0
      ? Math.round(input.tssTargetHintRequested)
      : null;

  const operationalLoadScale = input.operationalContext.loadScale;
  const bioenergeticLoadScale = input.bioenergeticModulation?.loadScale ?? 1;

  if (!applied) {
    return {
      session: input.session,
      loadAdaptation,
      operationalScaling: {
        applied: false,
        operationalApplied: false,
        bioenergeticApplied: false,
        loadScale: 1,
        loadScalePct: 100,
        mode: input.operationalContext.mode,
        operationalLoadScale,
        operationalLoadScalePct: input.operationalContext.loadScalePct,
        bioenergeticLoadScale,
        bioenergeticLoadScalePct: Math.round(bioenergeticLoadScale * 100),
        sessionMinutesRequested,
        sessionMinutesEffective: sessionMinutesRequested,
        tssTargetHintRequested,
        tssTargetHintEffective: tssTargetHintRequested,
        headline: loadAdaptation.headline,
        guidance: loadAdaptation.guidance,
      },
    };
  }

  let session = scaleSessionBlocks(input.session, loadScale);
  const sessionMinutesEffective = Math.max(
    20,
    session.blocks.reduce((sum, block) => sum + block.durationMinutes, 0) ||
      Math.round(sessionMinutesRequested * loadScale),
  );
  const baseTss =
    tssTargetHintRequested ??
    (session.expectedLoad.tssHint != null && session.expectedLoad.tssHint > 0 ? session.expectedLoad.tssHint : null);
  const tssTargetHintEffective =
    baseTss != null ? Math.max(1, Math.round(baseTss * loadScale)) : session.expectedLoad.tssHint;

  const adjLabel =
    loadAdaptation.adjustmentPct > 0
      ? `+${loadAdaptation.adjustmentPct}%`
      : loadAdaptation.adjustmentPct < 0
        ? `${loadAdaptation.adjustmentPct}%`
        : "invariato";

  const rationale = [
    ...input.session.rationale,
    `Adattamento giornaliero (${adjLabel}): seduta al ${loadScalePct}% del target — score ${loadAdaptation.scorePct}%. Piano VIRYA invariato.`,
    loadAdaptation.guidance,
  ];
  if (input.bioenergeticModulation?.guidance) {
    rationale.push(input.bioenergeticModulation.guidance);
  }

  session = {
    ...session,
    expectedLoad: {
      ...session.expectedLoad,
      tssHint: tssTargetHintEffective,
    },
    rationale,
  };

  return {
    session,
    loadAdaptation,
    operationalScaling: {
      applied: true,
      operationalApplied: operationalLoadScale < 0.999 || operationalLoadScale > 1.001,
      bioenergeticApplied: bioenergeticLoadScale < 0.999 || bioenergeticLoadScale > 1.001,
      loadScale,
      loadScalePct,
      mode: input.operationalContext.mode,
      operationalLoadScale,
      operationalLoadScalePct: input.operationalContext.loadScalePct,
      bioenergeticLoadScale,
      bioenergeticLoadScalePct: Math.round(bioenergeticLoadScale * 100),
      sessionMinutesRequested,
      sessionMinutesEffective,
      tssTargetHintRequested,
      tssTargetHintEffective: tssTargetHintEffective ?? null,
      headline: loadAdaptation.headline,
      guidance: loadAdaptation.guidance,
    },
  };
}
