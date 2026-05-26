import type { PlannedWorkout } from "@empathy/domain-training";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import {
  effectiveDurationMinutesFromPro2Contract,
  effectiveTssDisplayFromPro2Contract,
  parsePro2BuilderSessionFromNotes,
} from "@/lib/training/builder/pro2-session-notes";
import { effectiveMetabolicKcalForPlannedContract } from "@/lib/training/physiology/session-metabolic-kcal";
import { resolvePlannedSessionMetrics } from "@/lib/training/physiology/planned-session-metrics";
import type { SportGlyphId } from "@/lib/training/builder/sport-glyph-id";
import { resolveSportGlyphFromSportString } from "@/lib/training/session-detail-summary";

export type PlannedWorkoutFamily = "aerobic" | "strength" | "technical" | "lifestyle" | "unknown";

export type PlannedCalendarChipViewModel = {
  glyph: SportGlyphId | null;
  sportLabel: string;
  family: PlannedWorkoutFamily;
  minutes: number;
  load: number;
  kcal: number | null;
  title: string;
  detailLine: string;
  chipClass: string;
};

export function parsePlannedWorkoutContract(workout: PlannedWorkout): Pro2BuilderSessionContract | null {
  return parsePro2BuilderSessionFromNotes(workout.notes ?? null);
}

export function contractHasGymScheda(contract: Pro2BuilderSessionContract): boolean {
  return (contract.blocks ?? []).some((b) => Boolean(b.gymRx?.catalogExerciseId));
}

export function resolvePlannedWorkoutSportGlyph(workout: PlannedWorkout): SportGlyphId | null {
  const contract = parsePlannedWorkoutContract(workout);
  if (contract?.family === "strength") return "gym";
  if (contract?.family === "lifestyle") {
    const d = (contract.discipline ?? workout.type ?? "").toLowerCase();
    if (d.includes("yoga")) return "yoga";
    if (d.includes("pilates")) return "pilates";
    if (d.includes("breath")) return "breath";
    if (d.includes("meditation")) return "meditation";
    if (d.includes("stretch")) return "stretch";
    return "mobility";
  }
  const sport = contract?.discipline ?? contract?.sessionName ?? workout.type ?? "";
  const fromDiscipline = resolveSportGlyphFromSportString(sport);
  if (fromDiscipline) return fromDiscipline;
  return resolveSportGlyphFromSportString(workout.type ?? "");
}

function inferFamily(contract: Pro2BuilderSessionContract | null, workout: PlannedWorkout): PlannedWorkoutFamily {
  if (contract?.family === "aerobic" || contract?.family === "strength" || contract?.family === "technical" || contract?.family === "lifestyle") {
    return contract.family;
  }
  const t = (workout.type ?? "").toLowerCase();
  if (t.includes("gym") || t.includes("strength") || t.includes("forza")) return "strength";
  if (t.includes("yoga") || t.includes("pilates") || t.includes("mobility")) return "lifestyle";
  if (t.includes("tech") || t.includes("drill")) return "technical";
  if (t.includes("run") || t.includes("bike") || t.includes("cycl") || t.includes("swim")) return "aerobic";
  return "unknown";
}

const GLYPH_SPORT_LABEL: Partial<Record<SportGlyphId, string>> = {
  gym: "GYM",
  barbell: "GYM",
  crossfit: "GYM",
  hyrox: "HYROX",
  roadBike: "BIKE",
  mtb: "MTB",
  gravel: "GRAVEL",
  runner: "RUN",
  swim: "SWIM",
  triathlon: "TRI",
  xcSki: "SKI",
  alpine: "SKI",
  canoe: "CANOA",
  mobility: "LIFE",
  yoga: "YOGA",
  pilates: "PILATES",
  meditation: "MED",
  breath: "BREATH",
  stretch: "STRETCH",
};

function sportLabel(glyph: SportGlyphId | null, family: PlannedWorkoutFamily, workout: PlannedWorkout): string {
  if (glyph && GLYPH_SPORT_LABEL[glyph]) return GLYPH_SPORT_LABEL[glyph]!;
  if (family === "strength") return "GYM";
  if (family === "technical") return "TEC";
  if (family === "lifestyle") return "LIFE";
  const t = (workout.type ?? "PLAN").trim();
  return t.length > 10 ? t.slice(0, 9).toUpperCase() : t.toUpperCase() || "PLAN";
}

function chipClassForFamily(family: PlannedWorkoutFamily): string {
  switch (family) {
    case "strength":
      return "tc2-calendar-chip-plan tc2-calendar-chip-plan--gym";
    case "aerobic":
      return "tc2-calendar-chip-plan tc2-calendar-chip-plan--bike";
    case "technical":
      return "tc2-calendar-chip-plan tc2-calendar-chip-plan--tech";
    case "lifestyle":
      return "tc2-calendar-chip-plan tc2-calendar-chip-plan--life";
    default:
      return "tc2-calendar-chip-plan";
  }
}

/** Kcal display: Σ(P_i×t_i) con FTP atleta attivo → kJ → kcal = kJ/η/4.184. */
export function effectivePlannedKcalForCalendar(
  contract: Pro2BuilderSessionContract | null,
  _load: number,
  kcalTargetDb: number | null | undefined,
  athleteFtpWatts?: number | null,
): number | null {
  const fromMechanical = effectiveMetabolicKcalForPlannedContract({ contract, kcalTargetDb, athleteFtpWatts });
  if (fromMechanical != null && fromMechanical > 0) return fromMechanical;

  if (contract?.family === "strength") {
    const db = typeof kcalTargetDb === "number" && Number.isFinite(kcalTargetDb) ? Math.max(0, Math.round(kcalTargetDb)) : 0;
    const summary =
      contract?.summary?.kcal != null && Number.isFinite(contract.summary.kcal) ? Math.max(0, Math.round(contract.summary.kcal)) : 0;
    if (db > 0 && (summary <= 0 || db >= summary)) return db;
    if (summary > 0) return summary;
    if (db > 0) return db;
  }

  return null;
}

function shortTitle(contract: Pro2BuilderSessionContract | null, workout: PlannedWorkout): string {
  const raw = contract?.sessionName?.trim() || workout.type?.trim() || "Sessione";
  return raw.length > 32 ? `${raw.slice(0, 30)}…` : raw;
}

function buildDetailLine(
  family: PlannedWorkoutFamily,
  contract: Pro2BuilderSessionContract | null,
  title: string,
  kcal: number | null,
): string {
  const kcalTxt = kcal != null && kcal > 0 ? String(kcal) : "—";
  if (family === "strength") {
    return `${title} · kcal ${kcalTxt}`;
  }
  if (family === "aerobic") {
    const pavg =
      contract?.summary?.avgPowerW != null && contract.summary.avgPowerW > 0
        ? `${Math.round(contract.summary.avgPowerW)} W`
        : null;
    return pavg ? `${title} · Pavg ${pavg} · kcal ${kcalTxt}` : `${title} · kcal ${kcalTxt}`;
  }
  if (family === "technical") {
    return `${title} · kcal ${kcalTxt}`;
  }
  if (family === "lifestyle") {
    return `${title} · kcal ${kcalTxt}`;
  }
  return `${title} · kcal ${kcalTxt}`;
}

export function plannedCalendarChipViewModel(
  workout: PlannedWorkout,
  opts?: { athleteFtpWatts?: number | null },
): PlannedCalendarChipViewModel {
  const contract = parsePlannedWorkoutContract(workout);
  const family = inferFamily(contract, workout);
  const glyph = resolvePlannedWorkoutSportGlyph(workout);
  const minutes = effectiveDurationMinutesFromPro2Contract(contract, workout.durationMinutes);
  const load = effectiveTssDisplayFromPro2Contract(contract, workout.tssTarget);
  const kcal = effectivePlannedKcalForCalendar(contract, load, workout.kcalTarget, opts?.athleteFtpWatts);
  const metrics = resolvePlannedSessionMetrics({
    contract,
    durationMinutesDb: workout.durationMinutes,
    tssTargetDb: workout.tssTarget,
    kcalTargetDb: workout.kcalTarget,
    kjTargetDb: workout.kjTarget,
    athleteFtpWatts: opts?.athleteFtpWatts,
  });
  const title = shortTitle(contract, workout);
  const detailWithKj =
    metrics.kj > 0
      ? buildDetailLine(family, contract, title, kcal).replace(
          `kcal ${kcal != null && kcal > 0 ? String(kcal) : "—"}`,
          `kJ ${metrics.kj} · kcal ${kcal != null && kcal > 0 ? String(kcal) : metrics.kcal > 0 ? String(metrics.kcal) : "—"}`,
        )
      : buildDetailLine(family, contract, title, kcal);
  return {
    glyph,
    sportLabel: sportLabel(glyph, family, workout),
    family,
    minutes,
    load,
    kcal,
    title,
    detailLine: detailWithKj,
    chipClass: chipClassForFamily(family),
  };
}

export function uniquePlannedSportGlyphs(workouts: PlannedWorkout[], max = 4): SportGlyphId[] {
  const out: SportGlyphId[] = [];
  for (const w of workouts) {
    const g = resolvePlannedWorkoutSportGlyph(w);
    if (!g || out.includes(g)) continue;
    out.push(g);
    if (out.length >= max) break;
  }
  return out;
}
