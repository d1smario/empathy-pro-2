import { inferDomainFromSport } from "@/lib/training/engine/sport-translation";
import type {
  AdaptationTarget,
  GeneratedSession,
  PrimaryPhysiologySystem,
  SessionBlock,
  SessionMethod,
} from "@/lib/training/engine/types";
import type { SportMacroId } from "@/lib/training/builder/sport-macro-palette";
import {
  type Pro2IntensityUnit,
  intensityScore,
  intensityToRelativeLoad,
  type Pro2IntensityLabel,
  zoneForTargetValue,
  zoneRangeLabel,
} from "@/lib/training/builder/pro2-intensity";
import { estimateTssFromSegments } from "@/lib/training/builder/tss-estimate";
import type {
  Pro2BlockChart,
  Pro2BuilderBlockContract,
  Pro2BuilderSessionContract,
  Pro2RenderProfile,
} from "@/lib/training/builder/pro2-session-contract";
import { PRO2_GYM_EXECUTION_STYLES } from "@/lib/training/builder/gym-execution-styles";

export type PlanBlockKind = "steady" | "interval2" | "interval3" | "ramp" | "pyramid";

export type ManualPlanBlock = {
  id: string;
  label: string;
  kind: PlanBlockKind;
  minutes: number;
  seconds: number;
  intensity: Pro2IntensityLabel;
  startIntensity: Pro2IntensityLabel;
  endIntensity: Pro2IntensityLabel;
  intensity2: Pro2IntensityLabel;
  intensity3: Pro2IntensityLabel;
  repeats: number;
  workSeconds: number;
  recoverSeconds: number;
  step1Seconds: number;
  step2Seconds: number;
  step3Seconds: number;
  pyramidSteps: number;
  pyramidStepSeconds: number;
  pyramidStartTarget: number;
  pyramidEndTarget: number;
  distanceKm: number;
  gradePercent: number;
  elevationMeters: number;
  /** Cadenza: come toggle W/FC — oppure nessuna. */
  cadenceMetric: "none" | "rpm" | "spm";
  cadenceMin: number;
  cadenceMax: number;
  frequencyHint: string;
  target: string;
  notes: string;
  loadFactor: number;
  /** Catalogo unificato V1 (`/api/training/builder/unified-exercises`). */
  exerciseCatalogId: string;
  exerciseNameSnapshot: string;
  gymSets: number;
  gymReps: string;
  gymWeightKg: number | null;
  gymExecutionStyle: string;
};

export type PlanExpandOpts = {
  unit: Pro2IntensityUnit;
  ftpW: number;
  hrMax: number;
  lengthMode: "time" | "distance";
  speedRefKmh: number;
};

export type PlanChartSegment = {
  id: string;
  order: number;
  label: string;
  durationSeconds: number;
  intensityLabel: string;
  intensityScore: number;
  /**
   * Altezza barra nel grafico (scala ~0.35–7). Piramide: da target W/bpm lineare tra inizio e fine,
   * così scalini nella stessa zona non risultano tutti uguali.
   */
  barIntensityScore?: number;
  /** 0–1 posizione lineare nel blocco piramide (solo piramide); per luminosità barra. */
  pyramidLinearT?: number;
};

function newBlockId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `b-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultManualPlanBlock(kind: PlanBlockKind = "steady", label = "Blocco"): ManualPlanBlock {
  return {
    id: newBlockId(),
    label,
    kind,
    minutes: 20,
    seconds: 0,
    intensity: "Z2",
    startIntensity: "Z2",
    endIntensity: "Z4",
    intensity2: "Z1",
    intensity3: "Z5",
    repeats: 6,
    workSeconds: 180,
    recoverSeconds: 90,
    step1Seconds: 120,
    step2Seconds: 90,
    step3Seconds: 60,
    pyramidSteps: 5,
    pyramidStepSeconds: 180,
    pyramidStartTarget: 100,
    pyramidEndTarget: 200,
    distanceKm: 5,
    gradePercent: 0,
    elevationMeters: 0,
    cadenceMetric: "none",
    cadenceMin: 85,
    cadenceMax: 95,
    frequencyHint: "",
    target: "Performance",
    notes: "",
    loadFactor: 1,
    exerciseCatalogId: "",
    exerciseNameSnapshot: "",
    gymSets: 3,
    gymReps: "10",
    gymWeightKg: null,
    gymExecutionStyle: PRO2_GYM_EXECUTION_STYLES[0] ?? "Lento controllato",
  };
}

/**
 * Prescrizione gym in cue / contratto.
 * Compare solo se c’è esercizio da catalogo, nome libero o carico: evita duplicare il solo label blocco.
 */
export function formatGymPrescriptionLine(b: ManualPlanBlock): string {
  const id = b.exerciseCatalogId.trim();
  const name = (b.exerciseNameSnapshot || "").trim();
  const reps = (b.gymReps || "").trim();
  const sr = b.gymSets > 0 && reps ? `${b.gymSets}×${reps}` : b.gymSets > 0 ? `${b.gymSets} serie` : "";
  const w =
    b.gymWeightKg != null && Number.isFinite(b.gymWeightKg) && b.gymWeightKg > 0 ? `${b.gymWeightKg} kg` : "";
  const ex = (b.gymExecutionStyle || "").trim();
  const hasLoad = w.length > 0;
  const defaultEx = (PRO2_GYM_EXECUTION_STYLES[0] ?? "Lento controllato").trim();
  const exDiff = ex.length > 0 && ex !== defaultEx;
  const picked = Boolean(id || name || hasLoad || exDiff);
  if (!picked) return "";
  const display = name || b.label.trim();
  const head = id ? `${display} [${id}]` : display;
  const parts = [head, sr, w, ex].filter((p) => p.length > 0);
  return parts.join(" · ");
}

export function resolveBlockDurationSeconds(block: ManualPlanBlock, opts: PlanExpandOpts): number {
  if (opts.lengthMode === "distance" && (block.kind === "steady" || block.kind === "ramp" || block.kind === "pyramid")) {
    const km = Math.max(0.1, block.distanceKm || 0);
    return Math.max(30, Math.round((km / Math.max(1, opts.speedRefKmh)) * 3600));
  }
  return Math.max(30, block.minutes * 60 + block.seconds);
}

/** Stessa logica V1: ogni ripetuta = lavoro + recupero (incluso dopo l’ultima). */
export function expandPlanBlockSegments(block: ManualPlanBlock, opts: PlanExpandOpts): PlanChartSegment[] {
  const base = (label: string, intensity: string, seconds: number, suffix: string): PlanChartSegment => ({
    id: `${block.id}-${suffix}`,
    order: 0,
    label,
    durationSeconds: Math.max(1, seconds),
    intensityLabel: intensity,
    intensityScore: intensityScore(intensity),
  });

  if (block.kind === "steady") {
    const s = resolveBlockDurationSeconds(block, opts);
    return [{ ...base(block.label, block.intensity, s, "steady"), order: 1 }];
  }
  if (block.kind === "ramp") {
    const s = resolveBlockDurationSeconds(block, opts);
    return [
      {
        ...base(`${block.label} (${block.startIntensity}→${block.endIntensity})`, block.endIntensity, s, "ramp"),
        order: 1,
      },
    ];
  }
  if (block.kind === "pyramid") {
    const steps = Math.max(1, block.pyramidSteps || 1);
    const stepSeconds = Math.max(20, block.pyramidStepSeconds || 20);
    const start = block.pyramidStartTarget;
    const end = block.pyramidEndTarget;
    /** Esattamente `steps` segmenti: target allo scalino i = start + i×(end−start)/steps (i = 1…steps). Ultimo scalino = end. */
    const span = end - start;
    const unitLabel = opts.unit === "watt" ? "W" : "bpm";
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    const spanAbs = hi - lo || 1;
    const out: PlanChartSegment[] = [];
    for (let i = 1; i <= steps; i += 1) {
      const targetValue = Math.round((start + (span * i) / steps) * 10) / 10;
      const z = zoneForTargetValue(targetValue, opts.unit, opts.ftpW, opts.hrMax);
      /** Posizione lineare sul target fisico (non sulla zona): altezza piramide reale nel grafico. */
      const pyramidLinearT = Math.min(1, Math.max(0, (targetValue - lo) / spanAbs));
      const barIntensityScore = Math.min(7, Math.max(0.35, 0.35 + pyramidLinearT * 6.65));
      out.push({
        id: `${block.id}-py-${i}`,
        order: i,
        label: `${block.label} ${i}/${steps} (~${Math.round(targetValue)} ${unitLabel})`,
        durationSeconds: stepSeconds,
        intensityLabel: z,
        intensityScore: intensityScore(z),
        barIntensityScore,
        pyramidLinearT,
      });
    }
    return out;
  }
  if (block.kind === "interval2") {
    const reps = Math.max(1, block.repeats);
    const work = Math.max(10, block.workSeconds);
    const rec = Math.max(10, block.recoverSeconds);
    const out: PlanChartSegment[] = [];
    let o = 1;
    for (let i = 0; i < reps; i += 1) {
      out.push({ ...base(`${block.label} · lavoro`, block.intensity, work, `i2w-${i}`), order: o++ });
      out.push({ ...base(`${block.label} · recupero`, block.intensity2, rec, `i2r-${i}`), order: o++ });
    }
    return out;
  }
  const reps = Math.max(1, block.repeats);
  const a = Math.max(10, block.step1Seconds);
  const b = Math.max(10, block.step2Seconds);
  const c = Math.max(10, block.step3Seconds);
  const out: PlanChartSegment[] = [];
  let o = 1;
  for (let i = 0; i < reps; i += 1) {
    out.push({ ...base(`${block.label} · A`, block.intensity, a, `i3a-${i}`), order: o++ });
    out.push({ ...base(`${block.label} · B`, block.intensity2, b, `i3b-${i}`), order: o++ });
    out.push({ ...base(`${block.label} · C`, block.intensity3, c, `i3c-${i}`), order: o++ });
  }
  return out;
}

export function manualPlanBlocksToChartSegments(blocks: ManualPlanBlock[], opts: PlanExpandOpts): PlanChartSegment[] {
  const flat: PlanChartSegment[] = [];
  let order = 1;
  for (const b of blocks) {
    for (const seg of expandPlanBlockSegments(b, opts)) {
      flat.push({ ...seg, order: order++ });
    }
  }
  return flat;
}

function loadFactorForKind(kind: PlanBlockKind): number {
  if (kind === "ramp") return 1.05;
  if (kind === "interval2") return 1.18;
  if (kind === "interval3") return 1.22;
  if (kind === "pyramid") return 1.12;
  return 0.95;
}

export function summarizePlanBlocks(blocks: ManualPlanBlock[], opts: PlanExpandOpts): Pro2BuilderSessionContract["summary"] {
  const flatSegs: PlanChartSegment[] = blocks.flatMap((b) => expandPlanBlockSegments(b, opts));
  let order = 1;
  const forTss = flatSegs.map((s) => ({ ...s, order: order++ }));

  const durationSec = forTss.reduce((sum, s) => sum + s.durationSeconds, 0);
  const tss = estimateTssFromSegments(forTss);

  const totalWorkJ = blocks.reduce((sum, b) => {
    const segs = expandPlanBlockSegments(b, opts);
    const secs = segs.reduce((acc, seg) => acc + seg.durationSeconds, 0);
    const rel =
      b.kind === "steady"
        ? intensityToRelativeLoad(b.intensity)
        : b.kind === "ramp"
          ? (intensityToRelativeLoad(b.startIntensity) + intensityToRelativeLoad(b.endIntensity)) / 2
          : b.kind === "interval2"
            ? (intensityToRelativeLoad(b.intensity) + intensityToRelativeLoad(b.intensity2)) / 2
            : b.kind === "pyramid"
              ? (b.pyramidStartTarget + b.pyramidEndTarget) / 2 / Math.max(1, opts.ftpW)
              : (intensityToRelativeLoad(b.intensity) +
                  intensityToRelativeLoad(b.intensity2) +
                  intensityToRelativeLoad(b.intensity3)) /
                3;
    const estPower = Math.max(60, Math.round(opts.ftpW * rel));
    return sum + estPower * secs;
  }, 0);

  const kj = Math.round(totalWorkJ / 1000);
  const avgPowerW = durationSec > 0 ? Math.round(totalWorkJ / durationSec) : 0;
  const kcal = Math.round(Math.max(0, tss) * 9.3);

  return { durationSec, tss, kcal, kj, avgPowerW };
}

function planBlockKindToSessionMethod(kind: PlanBlockKind): SessionMethod {
  if (kind === "interval2" || kind === "interval3" || kind === "pyramid") return "interval";
  if (kind === "ramp") return "steady";
  return "steady";
}

function primarySystemForManualBlock(
  family: SportMacroId,
  adaptation: AdaptationTarget,
  block: ManualPlanBlock,
): PrimaryPhysiologySystem {
  if (family === "strength") {
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
  if (family === "technical") {
    if (adaptation === "skill_transfer") return "skill";
    if (adaptation === "movement_quality") return "coordination";
    return "coordination";
  }
  if (family === "lifestyle") {
    if (adaptation === "mobility_capacity") return "mobility";
    if (adaptation === "recovery") return "proprioception";
    return "proprioception";
  }
  /* aerobic */
  if (block.kind === "steady" && intensityScore(block.intensity) <= 2) return "mobility";
  return "aerobic";
}

function cadenceCue(block: ManualPlanBlock): string | undefined {
  if (block.cadenceMetric === "none") return undefined;
  const u = block.cadenceMetric === "rpm" ? "rpm" : "spm";
  const lo = Math.round(block.cadenceMin);
  const hi = Math.round(block.cadenceMax);
  return `${u} ${lo}–${hi}`;
}

function blockIntensityCue(
  block: ManualPlanBlock,
  unit: Pro2IntensityUnit,
  ftpW: number,
  hrMax: number,
  family: SportMacroId = "aerobic",
): string {
  const primary =
    block.kind === "ramp"
      ? `${zoneRangeLabel(block.startIntensity, unit, ftpW, hrMax)} → ${zoneRangeLabel(block.endIntensity, unit, ftpW, hrMax)}`
      : block.kind === "pyramid"
        ? (() => {
            const n = Math.max(1, block.pyramidSteps);
            const a = block.pyramidStartTarget;
            const b = block.pyramidEndTarget;
            const du = (b - a) / n;
            const u = unit === "watt" ? "W" : "bpm";
            return `Piramide ${n} scalini · Δ ${Math.round(du * 10) / 10}${u}/scalino · ${Math.round(a)}→${Math.round(b)}${u}`;
          })()
        : zoneRangeLabel(block.intensity, unit, ftpW, hrMax);
  const cad = [cadenceCue(block), block.frequencyHint.trim() && block.frequencyHint.trim()].filter(Boolean).join(" · ");
  const extra = cad ? ` · ${cad}` : "";
  const gym =
    family === "strength" && formatGymPrescriptionLine(block).length > 0
      ? ` · ${formatGymPrescriptionLine(block)}`
      : "";
  return `${primary}${extra}${gym}`;
}

export function manualPlanBlocksToGeneratedSession(params: {
  sport: string;
  blocks: ManualPlanBlock[];
  opts: PlanExpandOpts;
  /** Macro A–D: determina targetSystem dei blocchi e physio target. */
  family?: SportMacroId;
  adaptationTarget?: AdaptationTarget;
}): GeneratedSession | null {
  const { sport, blocks, opts, family = "aerobic", adaptationTarget = "mitochondrial_density" } = params;
  if (blocks.length === 0) return null;
  const domain = inferDomainFromSport(sport);
  const summary = summarizePlanBlocks(blocks, opts);
  const sessionBlocks: SessionBlock[] = blocks.map((b, i) => {
    const secs = expandPlanBlockSegments(b, opts).reduce((s, seg) => s + seg.durationSeconds, 0);
    const durationMinutes = Math.max(1, Math.ceil(secs / 60));
    const cue = blockIntensityCue(b, opts.unit, opts.ftpW, opts.hrMax, family);
    const notesPart = b.notes.trim() ? ` | ${b.notes.trim()}` : "";
    const targetSystem = primarySystemForManualBlock(family, adaptationTarget, b);
    return {
      order: i + 1,
      label: b.label,
      method: planBlockKindToSessionMethod(b.kind),
      targetSystem,
      durationMinutes,
      intensityCue: `${cue}${notesPart}`.slice(0, 500),
      expectedAdaptation: adaptationTarget,
      exerciseIds: [],
    };
  });

  const familyNote =
    family === "strength"
      ? "Famiglia B gym / forza: zone come intensità relativa o cardio accessorio."
      : family === "technical"
        ? "Famiglia C tecnici: blocchi durata + intensità per drill / lavoro intermittente."
        : family === "lifestyle"
          ? "Famiglia D lifestyle: mobilità / respiro / bassa sollecitazione."
          : "Famiglia A aerobica: zone watt/FC, distanza opzionale, cadenza.";

  return {
    sport,
    domain,
    goalLabel: "manual_coach_builder",
    physiologicalTarget: adaptationTarget,
    expectedLoad: {
      loadBand: "moderate",
      tssHint: Math.max(20, summary.tss),
    },
    blocks: sessionBlocks,
    rationale: [`Builder manuale Pro 2 — ${familyNote}`],
  };
}

function manualPlanBlockToChart(b: ManualPlanBlock): Pro2BlockChart {
  return {
    minutes: Math.max(0, b.minutes),
    seconds: Math.max(0, Math.min(59, b.seconds)),
    intensity: b.intensity,
    startIntensity: b.startIntensity,
    endIntensity: b.endIntensity,
    intensity2: b.intensity2,
    intensity3: b.intensity3,
    repeats: Math.max(1, b.repeats),
    workSeconds: Math.max(0, b.workSeconds),
    recoverSeconds: Math.max(0, b.recoverSeconds),
    step1Seconds: Math.max(0, b.step1Seconds),
    step2Seconds: Math.max(0, b.step2Seconds),
    step3Seconds: Math.max(0, b.step3Seconds),
    pyramidSteps: Math.max(1, b.pyramidSteps),
    pyramidStepSeconds: Math.max(0, b.pyramidStepSeconds),
    pyramidStartTarget: b.pyramidStartTarget,
    pyramidEndTarget: b.pyramidEndTarget,
    distanceKm: b.distanceKm,
    gradePercent: b.gradePercent,
    elevationMeters: b.elevationMeters,
    cadence: cadenceCue(b) ?? "",
    frequencyHint: b.frequencyHint,
    loadFactor: b.loadFactor > 0 ? b.loadFactor : loadFactorForKind(b.kind),
  };
}

export function buildPro2BuilderSessionContract(input: {
  blocks: ManualPlanBlock[];
  renderProfile: Pro2RenderProfile;
  discipline: string;
  sessionName: string;
  adaptationTarget?: string;
  phase?: string;
  family?: SportMacroId;
  plannedSessionDurationMinutes?: number;
}): Pro2BuilderSessionContract {
  const fam = input.family ?? "aerobic";
  const opts: PlanExpandOpts = {
    unit: input.renderProfile.intensityUnit,
    ftpW: input.renderProfile.ftpW,
    hrMax: input.renderProfile.hrMax,
    lengthMode: input.renderProfile.lengthMode,
    speedRefKmh: input.renderProfile.speedRefKmh,
  };
  const summary = summarizePlanBlocks(input.blocks, opts);
  const contractBlocks: Pro2BuilderBlockContract[] = input.blocks.map((b) => {
    const secs = expandPlanBlockSegments(b, opts).reduce((s, seg) => s + seg.durationSeconds, 0);
    const durationMinutes = Math.max(0, Math.round(secs / 60));
    const rx = formatGymPrescriptionLine(b);
    const gymRx =
      fam === "strength" && rx
        ? {
            catalogExerciseId: b.exerciseCatalogId.trim() || undefined,
            exerciseName: b.exerciseNameSnapshot.trim() || undefined,
            sets: b.gymSets,
            reps: b.gymReps.trim() || undefined,
            weightKg: b.gymWeightKg,
            executionStyle: b.gymExecutionStyle.trim() || undefined,
          }
        : undefined;
    return {
      id: b.id,
      label: b.label,
      kind: b.kind,
      durationMinutes,
      intensityCue: blockIntensityCue(b, opts.unit, opts.ftpW, opts.hrMax, fam),
      target: b.target.trim() || undefined,
      notes: b.notes.trim() || undefined,
      chart: manualPlanBlockToChart(b),
      gymRx,
    };
  });

  return {
    version: 1,
    source: "builder",
    family: input.family ?? "aerobic",
    discipline: input.discipline.trim() || "Endurance",
    sessionName: input.sessionName.trim() || "Sessione Pro 2",
    adaptationTarget: input.adaptationTarget,
    phase: input.phase,
    plannedSessionDurationMinutes:
      input.plannedSessionDurationMinutes != null && input.plannedSessionDurationMinutes > 0
        ? Math.round(input.plannedSessionDurationMinutes)
        : undefined,
    summary,
    renderProfile: input.renderProfile,
    blocks: contractBlocks,
  };
}
