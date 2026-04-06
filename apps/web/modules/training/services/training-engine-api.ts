import type {
  AdaptationTarget,
  GeneratedSession,
  GymGenerationProfile,
  SessionGoalRequest,
  TechnicalModuleFocus,
  TrainingDomain,
} from "@/lib/training/engine";

export type BuilderSessionGenerationInput = {
  athleteId: string;
  applyOperationalScaling?: boolean;
  request: {
    sport: string;
    domain?: TrainingDomain;
    goalLabel: string;
    adaptationTarget: AdaptationTarget;
    sessionMinutes: number;
    phase: SessionGoalRequest["phase"];
    tssTargetHint?: number;
    intensityHint?: string;
    objectiveDetail?: string;
    gymProfile?: GymGenerationProfile;
    technicalModuleFocus?: TechnicalModuleFocus;
  };
};

export type BuilderSessionGenerationResponse =
  | {
      ok: true;
      athleteId: string;
      athleteState: unknown;
      session: GeneratedSession;
      blockExercises: unknown;
      source: string;
      physiologyPresent: boolean;
      twinPresent: boolean;
      materializationPolicy: string;
    }
  | { error: string };

/**
 * Cookie SSR — niente Bearer. Stesso contratto logico del builder V1.
 */
export async function generateBuilderSession(
  input: BuilderSessionGenerationInput,
): Promise<BuilderSessionGenerationResponse> {
  const res = await fetch("/api/training/engine/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => ({}))) as BuilderSessionGenerationResponse & { error?: string };
  if (!res.ok) {
    return { error: payload.error ?? "Training engine generation failed" };
  }
  if ("ok" in payload && payload.ok) {
    return payload;
  }
  return { error: "Invalid response" };
}
