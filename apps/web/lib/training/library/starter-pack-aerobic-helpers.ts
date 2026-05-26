import type {
  Pro2BlockChart,
  Pro2BuilderBlockContract,
  Pro2BuilderSessionContract,
  Pro2RenderProfile,
} from "@/lib/training/builder/pro2-session-contract";
import { preparePro2BuilderSessionContractForPersist } from "@/lib/training/builder/pro2-session-interpretation";
import { resolvePlannedSessionMetrics } from "@/lib/training/physiology/planned-session-metrics";

export const DEFAULT_STARTER_RENDER: Pro2RenderProfile = {
  intensityUnit: "watt",
  ftpW: 250,
  hrMax: 190,
  lengthMode: "time",
  speedRefKmh: 35,
};

export type AerobicStarterBlockSpec = {
  label: string;
  kind: "steady" | "ramp" | "interval2" | "interval3" | "pyramid";
  durationMinutes: number;
  intensityCue: string;
  startIntensity?: string;
  endIntensity?: string;
  intensity2?: string;
  intensity3?: string;
  repeats?: number;
  workSeconds?: number;
  recoverSeconds?: number;
  step1Seconds?: number;
  step2Seconds?: number;
  step3Seconds?: number;
  pyramidSteps?: number;
  pyramidStepSeconds?: number;
  pyramidStartTarget?: number;
  pyramidEndTarget?: number;
  notes?: string;
};

export type AerobicStarterPreset = {
  presetId: string;
  title: string;
  description: string;
  discipline: string;
  adaptationTarget: string;
  phase: string;
  viryaWeekObjective?: string;
  tags: string[];
  plannedMinutes: number;
  tss: number;
  blocks: AerobicStarterBlockSpec[];
};

function defaultChart(
  minutes: number,
  intensity: string,
  extra?: Partial<Pro2BlockChart>,
): Pro2BlockChart {
  return {
    minutes: Math.floor(minutes),
    seconds: Math.round((minutes % 1) * 60),
    intensity,
    startIntensity: extra?.startIntensity ?? intensity,
    endIntensity: extra?.endIntensity ?? intensity,
    intensity2: extra?.intensity2 ?? "Z1",
    intensity3: "Z5",
    repeats: extra?.repeats ?? 1,
    workSeconds: extra?.workSeconds ?? 180,
    recoverSeconds: extra?.recoverSeconds ?? 90,
    step1Seconds: 120,
    step2Seconds: 90,
    step3Seconds: 60,
    pyramidSteps: 5,
    pyramidStepSeconds: 180,
    pyramidStartTarget: 100,
    pyramidEndTarget: 200,
    distanceKm: 0,
    gradePercent: 0,
    elevationMeters: 0,
    cadence: "",
    frequencyHint: "",
    loadFactor: 1,
  };
}

export function blockFromSpec(spec: AerobicStarterBlockSpec, index: number): Pro2BuilderBlockContract {
  const isWarm = /riscaldamento|warm/i.test(spec.label);
  const isCool = /defaticamento|cool/i.test(spec.label);
  const primary = spec.intensityCue.split("/")[0]?.trim() || "Z2";
  const ftp = DEFAULT_STARTER_RENDER.ftpW;
  const chart = defaultChart(spec.durationMinutes, primary, {
    startIntensity: spec.startIntensity ?? (isWarm ? "Z1" : isCool ? "Z2" : primary),
    endIntensity: spec.endIntensity ?? (isWarm ? "Z2" : isCool ? "Z1" : primary),
    intensity2: spec.intensity2 ?? "Z1",
    repeats: spec.repeats ?? 1,
    workSeconds: spec.workSeconds ?? 180,
    recoverSeconds: spec.recoverSeconds ?? 90,
  });
  if (spec.kind === "interval3") {
    chart.intensity2 = spec.intensity2 ?? "Z3";
    chart.intensity3 = spec.intensity3 ?? primary;
    chart.step1Seconds = spec.step1Seconds ?? 120;
    chart.step2Seconds = spec.step2Seconds ?? 60;
    chart.step3Seconds = spec.step3Seconds ?? 120;
    chart.repeats = spec.repeats ?? 1;
  }
  if (spec.kind === "pyramid") {
    chart.pyramidSteps = spec.pyramidSteps ?? 5;
    chart.pyramidStepSeconds = spec.pyramidStepSeconds ?? 180;
    chart.pyramidStartTarget = spec.pyramidStartTarget ?? Math.round(ftp * 0.72);
    chart.pyramidEndTarget = spec.pyramidEndTarget ?? Math.round(ftp * 1.06);
  }
  return {
    id: `sp-${index + 1}`,
    label: spec.label,
    kind: spec.kind,
    durationMinutes: spec.durationMinutes,
    intensityCue: spec.intensityCue,
    notes: spec.notes,
    chart,
  };
}

export function shell(
  warmMin: number,
  coolMin: number,
  main: AerobicStarterBlockSpec[],
): AerobicStarterBlockSpec[] {
  return [
    {
      label: "Riscaldamento",
      kind: "ramp",
      durationMinutes: warmMin,
      intensityCue: "Z1->Z2",
      startIntensity: "Z1",
      endIntensity: "Z2",
    },
    ...main,
    {
      label: "Defaticamento",
      kind: "ramp",
      durationMinutes: coolMin,
      intensityCue: "Z2->Z1",
      startIntensity: "Z2",
      endIntensity: "Z1",
    },
  ];
}

/** Steady-state block. */
export function st(label: string, durationMinutes: number, intensityCue: string, notes?: string): AerobicStarterBlockSpec {
  return { label, kind: "steady", durationMinutes, intensityCue, notes };
}

/** Interval block (interval2 kind). */
export function iv(
  label: string,
  repeats: number,
  workSeconds: number,
  recoverSeconds: number,
  workZone: string,
  recoverZone: string,
  notes?: string,
): AerobicStarterBlockSpec {
  const durationMinutes = Math.max(1, Math.ceil((repeats * (workSeconds + recoverSeconds)) / 60));
  return {
    label,
    kind: "interval2",
    durationMinutes,
    intensityCue: `${workZone}/${recoverZone}`,
    intensity2: recoverZone,
    repeats,
    workSeconds,
    recoverSeconds,
    notes,
  };
}

/** Three-phase interval block (over-under, cruise sets, etc.). */
export function i3(
  label: string,
  repeats: number,
  step1Seconds: number,
  step2Seconds: number,
  step3Seconds: number,
  zoneA: string,
  zoneB: string,
  zoneC: string,
  notes?: string,
): AerobicStarterBlockSpec {
  const durationMinutes = Math.max(1, Math.ceil((repeats * (step1Seconds + step2Seconds + step3Seconds)) / 60));
  return {
    label,
    kind: "interval3",
    durationMinutes,
    intensityCue: `${zoneA}/${zoneB}/${zoneC}`,
    intensity2: zoneB,
    intensity3: zoneC,
    repeats,
    step1Seconds,
    step2Seconds,
    step3Seconds,
    notes,
  };
}

/** Pyramid block — progressive watt targets on chart. */
export function py(
  label: string,
  steps: number,
  stepSeconds: number,
  startTargetW: number,
  endTargetW: number,
  notes?: string,
): AerobicStarterBlockSpec {
  const durationMinutes = Math.max(1, Math.ceil((steps * stepSeconds) / 60));
  return {
    label,
    kind: "pyramid",
    durationMinutes,
    intensityCue: "Z2→Z5→Z2",
    pyramidSteps: steps,
    pyramidStepSeconds: stepSeconds,
    pyramidStartTarget: startTargetW,
    pyramidEndTarget: endTargetW,
    notes,
  };
}

/** Main-work ramp (Z2→LT2, openers, etc.). */
export function rm(
  label: string,
  durationMinutes: number,
  startZone: string,
  endZone: string,
  notes?: string,
): AerobicStarterBlockSpec {
  return {
    label,
    kind: "ramp",
    durationMinutes,
    intensityCue: `${startZone}→${endZone}`,
    startIntensity: startZone,
    endIntensity: endZone,
    notes,
  };
}

/** Long recovery between work blocks — visible as its own segment. */
export function rec(durationMinutes: number, zone = "Z1", notes?: string): AerobicStarterBlockSpec {
  return {
    label: `Recupero profondo · ${durationMinutes}′`,
    kind: "steady",
    durationMinutes,
    intensityCue: zone,
    notes: notes ?? "Recupero generoso tra blocchi di lavoro",
  };
}

export type PresetShell = {
  warm?: number;
  cool?: number;
  viryaWeekObjective?: string;
};

export function preset(
  presetId: string,
  discipline: string,
  title: string,
  description: string,
  adaptationTarget: string,
  phase: string,
  tags: string[],
  plannedMinutes: number,
  tss: number,
  main: AerobicStarterBlockSpec[],
  shellOpts?: PresetShell,
): AerobicStarterPreset {
  const warm = shellOpts?.warm ?? (plannedMinutes >= 100 ? 15 : 12);
  const cool = shellOpts?.cool ?? (plannedMinutes >= 100 ? 12 : 10);
  return {
    presetId,
    title,
    description,
    discipline,
    adaptationTarget,
    phase,
    tags,
    plannedMinutes,
    tss,
    viryaWeekObjective: shellOpts?.viryaWeekObjective,
    blocks: shell(warm, cool, main),
  };
}

/** Replica un template su più discipline con scaling durata/TSS. */
export function presetForDisciplines(
  baseId: string,
  disciplines: Array<{ discipline: string; slug: string; durationScale: number; tssScale: number }>,
  build: (discipline: string, durationScale: number, tssScale: number) => Omit<AerobicStarterPreset, "presetId" | "discipline">,
): AerobicStarterPreset[] {
  return disciplines.map(({ discipline, slug, durationScale, tssScale }) => {
    const base = build(discipline, durationScale, tssScale);
    const plannedMinutes = Math.max(25, Math.round(base.plannedMinutes * durationScale));
    const tss = Math.max(15, Math.round(base.tss * tssScale));
    const warm = plannedMinutes >= 100 ? 15 : 12;
    const cool = plannedMinutes >= 100 ? 12 : 10;
    return {
      ...base,
      presetId: `${slug}_${baseId}`,
      discipline,
      plannedMinutes,
      tss,
      blocks: shell(warm, cool, base.blocks),
    };
  });
}

export const DISCIPLINE_SCALES = {
  cycling: { discipline: "Cycling", slug: "cyc", durationScale: 1, tssScale: 1 },
  running: { discipline: "Running", slug: "run", durationScale: 0.82, tssScale: 0.88 },
  swimming: { discipline: "Swimming", slug: "swm", durationScale: 0.62, tssScale: 0.72 },
  canoe: { discipline: "Canoe", slug: "can", durationScale: 0.88, tssScale: 0.9 },
  xcSki: { discipline: "XC Ski", slug: "xcs", durationScale: 0.9, tssScale: 0.92 },
  trailRunning: { discipline: "Trail Running", slug: "trl", durationScale: 0.85, tssScale: 0.86 },
} as const;

export const ALL_DISCIPLINES = [
  DISCIPLINE_SCALES.cycling,
  DISCIPLINE_SCALES.running,
  DISCIPLINE_SCALES.swimming,
  DISCIPLINE_SCALES.canoe,
  DISCIPLINE_SCALES.xcSki,
  DISCIPLINE_SCALES.trailRunning,
];

/** Obiettivo crescita catalogo (import incrementale per presetId). */
export const AEROBIC_CATALOG_GROWTH_TARGET = 500;

export function buildStarterContractFromPreset(preset: AerobicStarterPreset): Pro2BuilderSessionContract {
  const durationSec = Math.max(60, preset.plannedMinutes * 60);
  const avgPowerW = Math.max(80, Math.round((preset.tss * 1000) / Math.max(durationSec / 3600, 0.25) / 36));
  const blocks = preset.blocks.map((b, i) => blockFromSpec(b, i));
  const draft: Pro2BuilderSessionContract = {
    version: 1,
    source: "builder",
    family: "aerobic",
    discipline: preset.discipline,
    sessionName: preset.title,
    adaptationTarget: preset.adaptationTarget,
    phase: preset.phase,
    plannedSessionDurationMinutes: preset.plannedMinutes,
    summary: {
      durationSec,
      tss: preset.tss,
      kcal: 0,
      kj: 0,
      avgPowerW,
    },
    renderProfile: DEFAULT_STARTER_RENDER,
    blocks,
  };
  const metrics = resolvePlannedSessionMetrics({
    contract: draft,
    durationMinutesDb: preset.plannedMinutes,
    tssTargetDb: preset.tss,
    athleteFtpWatts: DEFAULT_STARTER_RENDER.ftpW,
  });
  return preparePro2BuilderSessionContractForPersist({
    ...draft,
    summary: {
      durationSec,
      tss: metrics.tss > 0 ? metrics.tss : preset.tss,
      kcal: metrics.kcal,
      kj: metrics.kj,
      avgPowerW: metrics.avgPowerW ?? avgPowerW,
    },
  });
}
