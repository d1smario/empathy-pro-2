import type { PhysiologyState } from "@/lib/empathy/schemas/physiology";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import {
  analyzePlannedSessionsForFueling,
  type PlannedFuelingSessionAnalysis,
} from "@/lib/nutrition/fueling-planned-session-analysis";

export type EmpathyFuelingExportV1 = {
  version: 1;
  schema: "empathy_fueling_export_v1";
  sessionDate: string;
  plannedWorkoutId?: string;
  sessionTitle: string;
  durationMin: number;
  tss: number;
  kcal: number;
  gutPathwayRisk: "low" | "moderate" | "high";
  estimatedIntensityPctFtp: number;
  /** Finestre indicative per reminder su device (Connect IQ / companion). */
  reminders: Array<{ offsetMinFromStart: number; label: string }>;
};

function mapAnalysisToExport(
  sessionDate: string,
  plannedWorkoutId: string | undefined,
  a: PlannedFuelingSessionAnalysis,
): EmpathyFuelingExportV1 {
  const d = Math.max(1, a.durationMin);
  const r1 = Math.max(10, Math.floor(d * 0.25));
  const r2 = Math.max(r1 + 10, Math.floor(d * 0.5));
  const reminders = [
    { offsetMinFromStart: 0, label: "Check idratazione / CHO pre-sessione" },
    { offsetMinFromStart: r1, label: "Finestra intra CHO (metà sessione)" },
    { offsetMinFromStart: r2, label: "Finestra intra CHO (ultimo terzo)" },
  ].filter((r) => r.offsetMinFromStart < d);

  return {
    version: 1,
    schema: "empathy_fueling_export_v1",
    sessionDate: sessionDate.slice(0, 10),
    plannedWorkoutId,
    sessionTitle: a.title,
    durationMin: a.durationMin,
    tss: a.tss,
    kcal: a.kcal,
    gutPathwayRisk: a.lactateModel.gutPathwayRisk,
    estimatedIntensityPctFtp: a.substrate.estimatedIntensityPctFtp,
    reminders,
  };
}

export function buildEmpathyFuelingExportV1(input: {
  sessionDate: string;
  plannedWorkoutId?: string;
  contract: Pro2BuilderSessionContract;
  durationMinutesDb?: number | null;
  tssTargetDb?: number | null;
  kcalTargetDb?: number | null;
  weightKg?: number | null;
  ftpWatts?: number | null;
  physiology?: PhysiologyState | null;
}): EmpathyFuelingExportV1 {
  const ftp = input.ftpWatts ?? input.contract.renderProfile?.ftpW ?? 250;
  const rows = analyzePlannedSessionsForFueling({
    sessions: [
      {
        id: input.plannedWorkoutId ?? "fueling_export",
        title: input.contract.sessionName || "Session",
        durationMinutesDb: input.durationMinutesDb,
        tssTargetDb: input.tssTargetDb,
        kcalTargetDb: input.kcalTargetDb,
        builderSession: input.contract,
      },
    ],
    weightKg: input.weightKg ?? 72,
    ftpWatts: ftp,
    physiology: input.physiology ?? null,
    choIngestedGH: 0,
  });
  const a = rows[0];
  if (!a) {
    throw new Error("fueling_export: analyzePlannedSessionsForFueling ha restituito zero righe");
  }
  return mapAnalysisToExport(input.sessionDate, input.plannedWorkoutId, a);
}

export function serializeEmpathyFuelingExportV1(obj: EmpathyFuelingExportV1): string {
  return `${JSON.stringify(obj, null, 2)}\n`;
}
