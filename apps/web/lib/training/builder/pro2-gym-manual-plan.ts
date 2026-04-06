import { inferDomainFromSport } from "@/lib/training/engine/sport-translation";
import type { AdaptationTarget, GeneratedSession, PrimaryPhysiologySystem, SessionBlock } from "@/lib/training/engine/types";
import { estimateTssFromSegments } from "@/lib/training/builder/tss-estimate";
import { intensityScore } from "@/lib/training/builder/pro2-intensity";
import type { PlanChartSegment } from "@/lib/training/builder/manual-plan-block";
import type { Pro2BuilderSessionContract, Pro2RenderProfile } from "@/lib/training/builder/pro2-session-contract";
import {
  PRO2_GYM_CONTRACTION_LABELS,
  type Pro2GymContractionPreset,
} from "@/lib/training/builder/pro2-gym-library-filters";

export type Pro2GymManualRow = {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  loadKg: number | null;
  restSec: number;
  /** Stile esecuzione coach (stessi valori di `PRO2_GYM_EXECUTION_STYLES` o testo libero). */
  executionStyle: string;
  /** % 1RM indicativa (prescrizione). */
  pct1Rm: number | null;
  /** Accento contrazione (standard / eccentrica / isometrica / pliometrica). */
  contractionEmphasis: Pro2GymContractionPreset;
  /** Superserie o gruppo accorpato (testo libero breve). */
  chainLabel: string;
  /** Scheda rapida: da rifinire in palestra. */
  quickIncomplete: boolean;
  technique: string;
  notes: string;
  mediaUrl?: string;
};

function newRowId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `g-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultPro2GymManualRow(partial?: Partial<Pro2GymManualRow>): Pro2GymManualRow {
  return {
    id: partial?.id ?? newRowId(),
    exerciseId: partial?.exerciseId ?? "",
    name: partial?.name ?? "Nuovo esercizio",
    sets: partial?.sets ?? 3,
    reps: partial?.reps ?? "8",
    loadKg: partial?.loadKg ?? null,
    restSec: partial?.restSec ?? 90,
    executionStyle: partial?.executionStyle ?? "",
    pct1Rm: partial?.pct1Rm ?? null,
    contractionEmphasis: partial?.contractionEmphasis ?? "",
    chainLabel: partial?.chainLabel ?? "",
    quickIncomplete: partial?.quickIncomplete ?? false,
    technique: partial?.technique ?? "",
    notes: partial?.notes ?? "",
    mediaUrl: partial?.mediaUrl,
  };
}

function targetSystemForStrengthAdaptation(adaptation: AdaptationTarget): PrimaryPhysiologySystem {
  if (adaptation === "max_strength") return "neuromuscular_strength";
  if (adaptation === "power_output") return "neuromuscular_power";
  if (adaptation === "neuromuscular_adaptation") return "neuromuscular_power";
  if (
    adaptation === "hypertrophy_mixed" ||
    adaptation === "hypertrophy_myofibrillar" ||
    adaptation === "hypertrophy_sarcoplasmic"
  )
    return "neuromuscular_strength";
  if (adaptation === "movement_quality") return "coordination";
  return "anaerobic_lactic";
}

export function formatPro2GymRowCue(row: Pro2GymManualRow): string {
  const rx = `${Math.max(1, row.sets)}×${row.reps.trim() || "—"}`;
  const load = row.loadKg != null && row.loadKg > 0 ? ` @ ${row.loadKg} kg` : "";
  const pct1 = row.pct1Rm ?? null;
  const pct = pct1 != null && pct1 > 0 ? ` · ~${pct1}% 1RM` : "";
  const ceKey = row.contractionEmphasis ?? "";
  const ce =
    ceKey && ceKey !== "standard"
      ? ` · ${PRO2_GYM_CONTRACTION_LABELS[ceKey as keyof typeof PRO2_GYM_CONTRACTION_LABELS] ?? ceKey}`
      : "";
  const chainRaw = (row.chainLabel ?? "").trim();
  const chain = chainRaw ? ` · gruppo ${chainRaw}` : "";
  const q = row.quickIncomplete ? " · [scheda rapida]" : "";
  const exe = row.executionStyle.trim() ? ` · ${row.executionStyle.trim()}` : "";
  const rest = row.restSec > 0 ? ` · recupero ${row.restSec}s` : "";
  const tech = row.technique.trim() ? ` · ${row.technique.trim()}` : "";
  return `${rx}${load}${pct}${ce}${chain}${q}${exe}${rest}${tech}`.trim();
}

/** Stima tempo blocco per grafico / TSS proxy (non sostituisce durata calendario scelta dal coach). */
export function estimateGymRowDurationMinutes(row: Pro2GymManualRow): number {
  const sets = Math.max(1, row.sets);
  const restMin = Math.max(0, row.restSec) / 60;
  const workMinPerSet = 0.75;
  return Math.max(3, Math.min(28, Math.round(sets * (workMinPerSet + restMin))));
}

export function gymManualRowsToChartSegments(rows: Pro2GymManualRow[]): PlanChartSegment[] {
  let order = 1;
  const out: PlanChartSegment[] = [];
  for (const row of rows) {
    const dm = estimateGymRowDurationMinutes(row);
    const sec = Math.max(120, dm * 60);
    out.push({
      id: row.id,
      order: order++,
      label: row.name,
      durationSeconds: sec,
      intensityLabel: "Z3",
      intensityScore: intensityScore("Z3"),
    });
  }
  return out;
}

function summarizeGymRowsForContract(rows: Pro2GymManualRow[]): Pro2BuilderSessionContract["summary"] {
  const segs = gymManualRowsToChartSegments(rows);
  const durationSec = segs.reduce((s, x) => s + x.durationSeconds, 0);
  const tss = estimateTssFromSegments(segs);
  const kcal = Math.round(Math.max(0, tss) * 9.3);
  const avgPowerW = durationSec > 0 ? Math.round((150 * durationSec) / durationSec) : 0;
  return { durationSec, tss, kcal, kj: Math.round((avgPowerW * durationSec) / 1000), avgPowerW };
}

export function gymManualRowsToGeneratedSession(params: {
  sport: string;
  rows: Pro2GymManualRow[];
  adaptationTarget: AdaptationTarget;
}): GeneratedSession | null {
  if (params.rows.length === 0) return null;
  const domain = inferDomainFromSport(params.sport);
  const targetSystem = targetSystemForStrengthAdaptation(params.adaptationTarget);
  const summary = summarizeGymRowsForContract(params.rows);
  const blocks: SessionBlock[] = params.rows.map((row, i) => {
    const dm = estimateGymRowDurationMinutes(row);
    const cue = formatPro2GymRowCue(row);
    const notes = row.notes.trim() ? ` | ${row.notes.trim()}` : "";
    return {
      order: i + 1,
      label: row.name,
      method: "strength_sets",
      targetSystem,
      durationMinutes: Math.max(1, dm),
      intensityCue: `${cue}${notes}`.slice(0, 500),
      expectedAdaptation: params.adaptationTarget,
      exerciseIds: row.exerciseId.trim() ? [row.exerciseId.trim()] : [],
    };
  });

  return {
    sport: params.sport,
    domain,
    goalLabel: "manual_coach_gym_scheda",
    physiologicalTarget: params.adaptationTarget,
    expectedLoad: {
      loadBand: "moderate",
      tssHint: Math.max(15, summary.tss),
    },
    blocks,
    rationale: [
      "Builder manuale Pro 2 · scheda palestra (Gym / Hyrox / CrossFit / Powerlifting), allineata a V1 — nessun modello a blocchi aerobici.",
    ],
  };
}

export function buildPro2GymSchedaSessionContract(input: {
  rows: Pro2GymManualRow[];
  renderProfile: Pro2RenderProfile;
  discipline: string;
  sessionName: string;
  adaptationTarget?: string;
  phase?: string;
  plannedSessionDurationMinutes?: number;
}): Pro2BuilderSessionContract {
  const summary = summarizeGymRowsForContract(input.rows);
  const blocks = input.rows.map((row) => {
    const dm = estimateGymRowDurationMinutes(row);
    const cue = formatPro2GymRowCue(row);
    const pct1 = row.pct1Rm ?? null;
    const ceKey = row.contractionEmphasis ?? "";
    const chainRaw = (row.chainLabel ?? "").trim();
    return {
      id: row.id,
      label: row.name,
      kind: "gym_exercise",
      durationMinutes: dm,
      intensityCue: cue,
      notes: row.notes.trim() || undefined,
      gymRx: {
        catalogExerciseId: row.exerciseId.trim() || undefined,
        exerciseName: row.name.trim() || undefined,
        sets: row.sets,
        reps: row.reps.trim() || undefined,
        weightKg: row.loadKg,
        executionStyle: row.executionStyle.trim() || undefined,
        pct1Rm: pct1 != null && pct1 > 0 ? pct1 : undefined,
        contractionEmphasis: ceKey || undefined,
        chainLabel: chainRaw || undefined,
        quickIncomplete: row.quickIncomplete || undefined,
      },
    };
  });

  return {
    version: 1,
    source: "builder",
    family: "strength",
    discipline: input.discipline.trim() || "Gym",
    sessionName: input.sessionName.trim() || "Scheda Pro 2",
    adaptationTarget: input.adaptationTarget,
    phase: input.phase,
    plannedSessionDurationMinutes:
      input.plannedSessionDurationMinutes != null && input.plannedSessionDurationMinutes > 0
        ? Math.round(input.plannedSessionDurationMinutes)
        : undefined,
    summary,
    renderProfile: input.renderProfile,
    blocks,
  };
}
