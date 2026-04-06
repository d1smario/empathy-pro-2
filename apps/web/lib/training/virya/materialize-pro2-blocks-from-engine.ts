import type { Pro2BuilderBlockContract } from "@/lib/training/builder/pro2-session-contract";
import type { GeneratedSession, SessionBlock } from "@/lib/training/engine/types";

type BlockExerciseBundle = { exercises?: Array<{ name?: string }> };

/**
 * Da `generateTrainingSession` + `blockExercises` (API generate) → blocchi per contratto Pro2 in `notes`.
 */
export function materializePro2BlocksFromEngine(input: {
  session?: GeneratedSession | null;
  blockExercises?: BlockExerciseBundle[] | null;
  fallbackBlocks: Pro2BuilderBlockContract[];
  fallbackDurationMinutes: number;
  fallbackTarget?: string;
  fallbackIntensityCue?: string;
  fallbackNotes?: string;
  mediaResolver?: (index: number) => string | undefined;
}): Pro2BuilderBlockContract[] {
  const blocks: SessionBlock[] = input.session?.blocks ?? [];
  if (!blocks.length) {
    return input.fallbackBlocks;
  }

  return blocks.map((block, index) => {
    const bundle = input.blockExercises?.[index];
    const exerciseNames = (bundle?.exercises ?? [])
      .map((exercise) => String(exercise.name ?? "").trim())
      .filter(Boolean);
    const mediaUrl = input.mediaResolver?.(index);
    const base: Pro2BuilderBlockContract = {
      id: String(block.order ?? index + 1),
      label: block.label,
      kind: block.method,
      durationMinutes: Math.max(
        1,
        Math.round(Number(block.durationMinutes) || input.fallbackDurationMinutes),
      ),
      target: block.expectedAdaptation,
      intensityCue: block.intensityCue,
      notes: exerciseNames.length
        ? `engine_exercises=${exerciseNames.join(", ")}`
        : String(block.targetSystem ?? input.fallbackNotes ?? "").trim() || undefined,
    };
    if (mediaUrl && base.kind === "flow_recovery") {
      return { ...base, lifestyleRx: { ...base.lifestyleRx, mediaUrl } };
    }
    return base;
  });
}
