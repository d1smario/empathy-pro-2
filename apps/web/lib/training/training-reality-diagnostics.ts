import type { DataSourcePreferenceMap, DataSourceProvider } from "@/lib/integrations/data-source-preference";
import {
  executedWorkoutSourceMatchesPreference,
  pickPreferredProvider,
} from "@/lib/integrations/data-source-preference";
import { empathyExternalDailyImpulseFromSession } from "@empathy/domain-training";

export type ExecutedRowForRealityDiagnostics = {
  date: string | null;
  source?: string | null;
  tss?: number | null;
  duration_minutes?: number | null;
  trace_summary?: Record<string, unknown> | null;
};

export type TrainingRealityDiagnosticsHint =
  | "none"
  | "no_executed_in_window"
  | "preference_mismatch"
  | "executed_no_load_signal";

export type TrainingRealityDiagnostics = {
  windowDays: number;
  preferredTrainingProvider: DataSourceProvider | null;
  executedCountRaw: number;
  executedCountVisible: number;
  hiddenByTrainingPreference: number;
  sourceCounts: Array<{ source: string; count: number }>;
  sessionsWithStructuredTss: number;
  sessionsWithExternalImpulse: number;
  sessionsWithNoLoadSignal: number;
  hint: TrainingRealityDiagnosticsHint;
};

const HR_TRACE_KEYS = ["hr_avg_bpm", "avg_hr", "heart_rate_avg", "avg_heart_rate", "averageHeartRateInBeatsPerMinute"];

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickHr(trace: Record<string, unknown> | null | undefined): number | null {
  if (!trace) return null;
  for (const key of HR_TRACE_KEYS) {
    const n = asNum(trace[key]);
    if (n != null && n > 0) return n;
  }
  return null;
}

function sessionExternalImpulse(row: ExecutedRowForRealityDiagnostics): number {
  return empathyExternalDailyImpulseFromSession({
    tss: row.tss != null ? Number(row.tss) : null,
    durationMinutes: Math.max(0, Number(row.duration_minutes ?? 0)),
    hrAvgBpm: pickHr(row.trace_summary ?? null),
  });
}

function inRollingWindow(date: string | null, endDate: string, windowDays: number): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const end = new Date(`${endDate}T12:00:00.000Z`);
  const start = new Date(end.getTime() - (windowDays - 1) * 24 * 60 * 60 * 1000);
  const startStr = start.toISOString().slice(0, 10);
  return date >= startStr && date <= endDate;
}

function sourceLabel(source: string | null | undefined): string {
  if (typeof source !== "string" || !source.trim()) return "(senza source)";
  return source;
}

/**
 * Conteggi eseguiti grezzi vs visibili dopo preferenza `training_activity` (Settings → Devices).
 * Usato da analytics/Core per spiegare piano alto + CTL/TSS a zero.
 */
export function summarizeTrainingRealityDiagnostics(
  rows: ExecutedRowForRealityDiagnostics[],
  prefs: DataSourcePreferenceMap,
  input: { endDate: string; windowDays?: number },
): TrainingRealityDiagnostics {
  const windowDays = input.windowDays ?? 7;
  const preferredTrainingProvider = pickPreferredProvider(prefs, "training_activity");
  const inWindow = rows.filter((r) => inRollingWindow(r.date, input.endDate, windowDays));

  const sourceMap = new Map<string, number>();
  let executedCountVisible = 0;
  let sessionsWithStructuredTss = 0;
  let sessionsWithExternalImpulse = 0;

  for (const row of inWindow) {
    const src = sourceLabel(row.source);
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
    if (!executedWorkoutSourceMatchesPreference(prefs, row.source)) continue;
    executedCountVisible += 1;
    const tss = Math.max(0, Number(row.tss ?? 0));
    if (tss > 0) sessionsWithStructuredTss += 1;
    const impulse = sessionExternalImpulse(row);
    if (impulse > 0) sessionsWithExternalImpulse += 1;
  }

  const executedCountRaw = inWindow.length;
  const hiddenByTrainingPreference = Math.max(0, executedCountRaw - executedCountVisible);
  const sessionsWithNoLoadSignal = Math.max(0, executedCountVisible - sessionsWithExternalImpulse);

  let hint: TrainingRealityDiagnosticsHint = "none";
  if (executedCountRaw === 0) {
    hint = "no_executed_in_window";
  } else if (hiddenByTrainingPreference > 0 && executedCountVisible === 0 && preferredTrainingProvider) {
    hint = "preference_mismatch";
  } else if (executedCountVisible > 0 && sessionsWithExternalImpulse === 0) {
    hint = "executed_no_load_signal";
  }

  const sourceCounts = [...sourceMap.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  return {
    windowDays,
    preferredTrainingProvider,
    executedCountRaw,
    executedCountVisible,
    hiddenByTrainingPreference,
    sourceCounts,
    sessionsWithStructuredTss,
    sessionsWithExternalImpulse,
    sessionsWithNoLoadSignal,
    hint,
  };
}

const PROVIDER_LABEL_IT: Partial<Record<DataSourceProvider, string>> = {
  garmin: "Garmin",
  whoop: "WHOOP",
  wahoo: "Wahoo",
  strava: "Strava",
  manual: "Manuale / file",
};

export function trainingRealityDiagnosticsBannerIt(diag: {
  hint: TrainingRealityDiagnosticsHint;
  windowDays: number;
  executedCountRaw: number;
  executedCountVisible: number;
  preferredTrainingProvider: string | null;
  sourceCounts: Array<{ source: string; count: number }>;
}): string | null {
  if (diag.hint === "preference_mismatch" && diag.preferredTrainingProvider) {
    const pref =
      PROVIDER_LABEL_IT[diag.preferredTrainingProvider as DataSourceProvider] ??
      diag.preferredTrainingProvider;
    const sources = diag.sourceCounts
      .slice(0, 3)
      .map((s) => `${s.source} (${s.count})`)
      .join(", ");
    return `Hai ${diag.executedCountRaw} sessioni eseguite negli ultimi ${diag.windowDays} giorni, ma la preferenza training è «${pref}» e nessuna corrisponde (${sources || "nessuna source"}). Imposta il provider corretto in Impostazioni → Devices oppure «nessuna preferenza» per usare tutte le fonti.`;
  }
  if (diag.hint === "no_executed_in_window") {
    return `Nessuna sessione in \`executed_workouts\` negli ultimi ${diag.windowDays} giorni: sincronizza Garmin/Wahoo/Strava, importa file o segna completato da Calendario.`;
  }
  if (diag.hint === "executed_no_load_signal") {
    return `${diag.executedCountVisible} sessioni visibili senza carico strutturato né FC in trace: Fitness/Strain restano piatti finché il provider non invia load o FC (o power per stima).`;
  }
  return null;
}
