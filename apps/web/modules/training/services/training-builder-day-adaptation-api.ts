import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import type { AdaptationGuidance } from "@/lib/empathy/schemas/adaptation";
import type { DailyBuilderLoadAdaptation } from "@/lib/training/builder/daily-builder-load-adaptation";

export type BuilderDayAdaptationResponse =
  | {
      ok: true;
      athleteId: string;
      date: string;
      loadAdaptation: DailyBuilderLoadAdaptation;
      adaptationGuidance: AdaptationGuidance;
      adaptationLoop: {
        status: string;
        nextAction: string;
        divergenceScore: number;
        guidance: string;
      };
      targetPlanned: {
        id: string;
        type: string;
        baselineDurationMinutes: number;
        baselineTssTarget: number;
        adaptedDurationMinutes: number;
        adaptedTssTarget: number;
      } | null;
      plannedCount: number;
    }
  | { ok: false; error: string };

export async function fetchBuilderDayAdaptation(input: {
  athleteId: string;
  date: string;
  replacePlannedId?: string | null;
}): Promise<BuilderDayAdaptationResponse> {
  const q = new URLSearchParams({
    athleteId: input.athleteId,
    date: input.date.slice(0, 10),
  });
  if (input.replacePlannedId?.trim()) {
    q.set("replacePlannedId", input.replacePlannedId.trim());
  }
  const res = await fetch(`/api/training/builder/day-adaptation?${q}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: await buildSupabaseAuthHeaders(),
  });
  const json = (await res.json().catch(() => ({}))) as BuilderDayAdaptationResponse & { error?: string };
  if (!res.ok || !("ok" in json) || !json.ok) {
    return { ok: false, error: json.error ?? "Lettura adattamento giorno non riuscita" };
  }
  return json;
}
