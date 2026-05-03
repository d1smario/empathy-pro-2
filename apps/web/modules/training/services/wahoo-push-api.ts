import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import type { GeneratedSession } from "@/lib/training/engine/types";

export type PushBuilderSessionToWahooInput = {
  athleteId: string;
  session: GeneratedSession;
  plannedDate: string;
  planName?: string;
  description?: string;
  intensityChannel: "watt" | "hr";
  workoutTypeLocation: 0 | 1;
  ftpW: number;
  hrMax: number;
  thresholdHrBpm?: number | null;
  scheduleWorkout?: boolean;
  workoutTypeId?: number;
  startsIso?: string;
};

export type PushBuilderSessionToWahooOk = {
  ok: true;
  plan_id: number | null;
  wahoo_plan: unknown;
  wahoo_workout: unknown | null;
};

export type PushBuilderSessionToWahooErr = {
  ok: false;
  error: string;
  code?: string;
  phase?: string;
  status?: number;
};

export async function pushBuilderSessionToWahoo(
  input: PushBuilderSessionToWahooInput,
): Promise<PushBuilderSessionToWahooOk | PushBuilderSessionToWahooErr> {
  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch("/api/integrations/wahoo/push-builder-session", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({
      athleteId: input.athleteId,
      session: input.session,
      planned_date: input.plannedDate.slice(0, 10),
      plan_name: input.planName,
      description: input.description,
      intensity_channel: input.intensityChannel,
      workout_type_location: input.workoutTypeLocation,
      ftp_w: input.ftpW,
      hr_max: input.hrMax,
      threshold_hr_bpm: input.thresholdHrBpm ?? undefined,
      schedule_workout: input.scheduleWorkout !== false,
      workout_type_id: input.workoutTypeId,
      starts_iso: input.startsIso,
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.ok !== true) {
    return {
      ok: false,
      error: typeof json.error === "string" ? json.error : "Wahoo push fallito",
      code: typeof json.code === "string" ? json.code : undefined,
      phase: typeof json.phase === "string" ? json.phase : undefined,
      status: typeof json.status === "number" ? json.status : res.status,
    };
  }
  return {
    ok: true,
    plan_id: typeof json.plan_id === "number" && Number.isFinite(json.plan_id) ? json.plan_id : null,
    wahoo_plan: json.wahoo_plan ?? json.wahoo ?? null,
    wahoo_workout: json.wahoo_workout ?? null,
  };
}
