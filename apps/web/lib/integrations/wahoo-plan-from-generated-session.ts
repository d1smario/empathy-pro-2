import type { GeneratedSession, SessionBlock } from "@/lib/training/engine/types";
import { zoneFromIntensityCue, zoneRelativeRange } from "@/lib/training/builder/pro2-intensity";

/** Famiglia Wahoo plan.json: 0 = Biking, 1 = Running (@see cloud-api plan format). */
export type WahooPlanWorkoutFamily = 0 | 1;

export type WahooPlanIntensityChannel = "watt" | "hr";

export type BuildWahooPlanFromSessionInput = {
  session: GeneratedSession;
  /** Nome piano lato Wahoo (header.name). */
  planName: string;
  description?: string;
  intensityChannel: WahooPlanIntensityChannel;
  /** 0 indoor, 1 outdoor (header.workout_type_location). */
  workoutTypeLocation: 0 | 1;
  ftpW?: number | null;
  hrMax?: number | null;
  /** Per target relativi `threshold_hr` in corsa; default ~0,87×max_hr se omesso. */
  thresholdHrBpm?: number | null;
};

function sportHeuristicFamily(sport: string): WahooPlanWorkoutFamily {
  const s = sport.toLowerCase();
  if (/run|foot|trail|walk|jog|marat|strada|podismo|xc\s*ski/.test(s)) return 1;
  return 0;
}

function wahooIntensityLabel(block: SessionBlock): string {
  const fallback = block.method === "flow_recovery" ? "Z1" : "Z2";
  return zoneFromIntensityCue(block.intensityCue, fallback);
}

function wahooIntensityType(block: SessionBlock, zoneLabel: string, index: number, total: number): string {
  const lab = block.label.toLowerCase();
  if (block.method === "flow_recovery" || block.expectedAdaptation === "recovery") return "recover";
  if (index === 0 && (zoneLabel === "Z1" || /warm|risv|scald/.test(lab))) return "wu";
  if (index === total - 1 && (zoneLabel === "Z1" || /cool|defatic|discesa/.test(lab))) return "cd";
  if (/tempo|soglia|threshold/.test(block.intensityCue.toLowerCase())) return "tempo";
  return "active";
}

function intervalFromBlock(
  block: SessionBlock,
  index: number,
  total: number,
  input: BuildWahooPlanFromSessionInput,
  family: WahooPlanWorkoutFamily,
): Record<string, unknown> {
  const zoneLabel = wahooIntensityLabel(block);
  const { min, max } = zoneRelativeRange(zoneLabel);
  const sec = Math.max(30, Math.round((Number(block.durationMinutes) || 1) * 60));
  const intensity_type = wahooIntensityType(block, zoneLabel, index, total);

  const base: Record<string, unknown> = {
    name: block.label.slice(0, 120) || `Blocco ${index + 1}`,
    exit_trigger_type: "time",
    exit_trigger_value: sec,
    intensity_type,
  };

  if (family === 0 && input.intensityChannel === "watt") {
    base.targets = [{ type: "ftp", low: round4(min), high: round4(Math.max(min, max)) }];
    return base;
  }

  if (family === 1) {
    base.targets = [{ type: "threshold_hr", low: round4(min), high: round4(Math.max(min, max)) }];
    return base;
  }

  const hrM = Math.max(60, Math.round(Number(input.hrMax) || 0));
  const loBpm = Math.max(50, Math.round(hrM * Math.min(min, 0.95)));
  const hiBpm = Math.max(loBpm, Math.round(hrM * Math.min(max, 1.0)));
  base.targets = [{ type: "hr", low: loBpm, high: hiBpm }];
  return base;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function sessionSupportsWahooStructuredPlan(session: GeneratedSession): boolean {
  if (session.domain === "gym") return false;
  if (!Array.isArray(session.blocks) || session.blocks.length === 0) return false;
  return true;
}

/**
 * Costruisce un oggetto plan.json Wahoo (header + intervals) da una sessione Pro2 generata.
 * @see https://cloud-api.wahooligan.com/docs/plan-json-format.pdf
 */
export function buildWahooPlanJsonFromGeneratedSession(input: BuildWahooPlanFromSessionInput): Record<string, unknown> {
  const { session } = input;
  if (!sessionSupportsWahooStructuredPlan(session)) {
    throw new Error("wahoo_plan_session_unsupported");
  }

  const family = sportHeuristicFamily(session.sport);
  if (family === 0 && input.intensityChannel === "watt" && (!input.ftpW || input.ftpW <= 0)) {
    throw new Error("wahoo_plan_ftp_required");
  }
  if (family === 1 && (!input.hrMax || input.hrMax <= 0)) {
    throw new Error("wahoo_plan_hr_max_required");
  }
  if (family === 0 && input.intensityChannel === "hr" && (!input.hrMax || input.hrMax <= 0)) {
    throw new Error("wahoo_plan_hr_max_required");
  }

  const sorted = [...session.blocks].sort((a, b) => a.order - b.order);
  const intervals = sorted.map((b, i) => intervalFromBlock(b, i, sorted.length, input, family));

  const duration_s = sorted.reduce((acc, b) => acc + Math.max(30, Math.round((Number(b.durationMinutes) || 1) * 60)), 0);

  const header: Record<string, unknown> = {
    name: input.planName.slice(0, 200),
    version: "1.0.0",
    workout_type_family: family,
    workout_type_location: input.workoutTypeLocation,
    duration_s,
  };
  if (input.description?.trim()) {
    header.description = input.description.trim().slice(0, 5000);
  }

  if (family === 0 && input.intensityChannel === "watt") {
    header.ftp = Math.max(1, Math.round(Number(input.ftpW) || 0));
  }
  if (family === 1) {
    const hrM = Math.max(60, Math.round(Number(input.hrMax) || 0));
    header.max_hr = hrM;
    header.threshold_hr = Math.max(1, Math.round(Number(input.thresholdHrBpm) || hrM * 0.87));
  }

  return { header, intervals };
}

export function totalSessionMinutes(session: GeneratedSession): number {
  const sorted = [...session.blocks].sort((a, b) => a.order - b.order);
  const sum = sorted.reduce((acc, b) => acc + Math.max(1, Number(b.durationMinutes) || 1), 0);
  return Math.max(1, Math.round(sum));
}
