import type { GeneratedSession } from "@/lib/training/engine";
import type { Pro2BuilderSessionContract, Pro2RenderProfile } from "@/lib/training/builder/pro2-session-contract";
import type { AdaptationTarget } from "@/lib/training/engine";
import {
  buildPro2BlockSessionContract,
  mapEngineSessionToTrainingBlocks,
  scaleTrainingBlock,
  summarizeBlocks,
} from "@/lib/training/builder/engine-blocks-to-session-contract";
import { finalizeViryaPro2ContractAsBuilderFile } from "@/lib/training/builder/finalize-virya-pro2-contract-as-builder-file";

/**
 * Materializza contratto Builder completo da output motore (append-only su notes calendario).
 * Stessa pipeline di VIRYA aerobic/technical/lifestyle — nessun secondo motore.
 */
export function buildPro2ContractFromEngineGeneration(input: {
  session: GeneratedSession;
  blockExercises?: unknown;
  renderProfile: Pro2RenderProfile;
  family: "aerobic" | "technical" | "lifestyle";
  discipline: string;
  sessionName: string;
  adaptationTarget?: AdaptationTarget;
  phase?: string;
  plannedSessionDurationMinutes?: number;
  loadScale?: number;
}): Pro2BuilderSessionContract | null {
  const { intensityUnit: unit, ftpW, hrMax, lengthMode, speedRefKmh } = input.renderProfile;
  const trainingBlocks = mapEngineSessionToTrainingBlocks({
    session: input.session as unknown as Record<string, unknown>,
    blockExercises: Array.isArray(input.blockExercises)
      ? (input.blockExercises as Array<Record<string, unknown>>)
      : undefined,
    fallbackDurationMinutes: input.plannedSessionDurationMinutes ?? 60,
    fallbackTarget: input.adaptationTarget,
  });
  if (!trainingBlocks.length) return null;

  const scale = input.loadScale != null && input.loadScale > 0 ? input.loadScale : 1;
  const scaledBlocks = scale === 1 ? trainingBlocks : trainingBlocks.map((b) => scaleTrainingBlock(b, scale));
  const summary = summarizeBlocks(scaledBlocks, { unit, ftpW, hrMax, lengthMode, speedRefKmh });
  const effectiveDuration =
    input.plannedSessionDurationMinutes ??
    Math.max(1, Math.round(summary.durationSec / 60));

  const contract = buildPro2BlockSessionContract({
    discipline: input.discipline,
    family: input.family,
    sessionName: input.sessionName,
    adaptationTarget: input.adaptationTarget,
    phase: input.phase,
    summary,
    plannedSessionDurationMinutes: effectiveDuration,
    blocks: scaledBlocks,
    unit,
    ftpW,
    hrMax,
    lengthMode,
    speedRefKmh,
  });

  return finalizeViryaPro2ContractAsBuilderFile({
    contract,
    ftpW,
    hrMax,
    intensityUnit: unit,
    lengthMode,
    speedRefKmh,
  });
}
