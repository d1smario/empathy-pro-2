import type { Pro2BuilderBlockContract } from "@/lib/training/builder/pro2-session-contract";

/**
 * Da risposta motore (`session` + `blockExercises`) → blocchi “slim” compatibili con
 * `mapEngineSessionToTrainingBlocks` (stessa logica V1, tipi Pro2).
 */
export function materializeEngineSessionToSlimBlocks(input: {
  session?: Record<string, unknown> | null;
  blockExercises?: Array<Record<string, unknown>>;
  fallbackBlocks?: Pro2BuilderBlockContract[];
  fallbackDurationMinutes: number;
  fallbackTarget?: string;
  fallbackIntensityCue?: string;
  fallbackNotes?: string;
  mediaResolver?: (index: number) => string | undefined;
}): Pro2BuilderBlockContract[] {
  const engineSession =
    input.session && typeof input.session === "object"
      ? (input.session as { blocks?: Array<Record<string, unknown>> })
      : null;
  const blocks = engineSession?.blocks ?? [];
  if (!blocks.length) {
    return input.fallbackBlocks ?? [];
  }

  return blocks.map((block, index) => {
    const exerciseBundle =
      input.blockExercises?.[index] && typeof input.blockExercises[index] === "object"
        ? (input.blockExercises[index] as { exercises?: Array<{ name?: string }> })
        : null;
    const exerciseNames = (exerciseBundle?.exercises ?? [])
      .map((exercise) => String(exercise.name ?? "").trim())
      .filter(Boolean);
    const mediaUrl = input.mediaResolver?.(index);
    const base: Pro2BuilderBlockContract = {
      id: String(block.order ?? index + 1),
      label: String(block.label ?? `Block ${index + 1}`),
      kind: String(block.method ?? block.kind ?? "steady"),
      durationMinutes: Math.max(1, Math.round(Number(block.durationMinutes ?? 0) || input.fallbackDurationMinutes)),
      target: String(block.expectedAdaptation ?? input.fallbackTarget ?? "").trim() || undefined,
      intensityCue: String(block.intensityCue ?? input.fallbackIntensityCue ?? "").trim() || undefined,
      notes: exerciseNames.length
        ? `engine_exercises=${exerciseNames.join(", ")}`
        : String(block.targetSystem ?? input.fallbackNotes ?? "").trim() || undefined,
    };
    if (!mediaUrl) return base;
    if (base.kind === "flow_recovery") {
      return { ...base, lifestyleRx: { ...base.lifestyleRx, mediaUrl } };
    }
    return { ...base, mediaUrl };
  });
}
