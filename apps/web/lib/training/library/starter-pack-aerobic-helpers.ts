import type {
  Pro2BlockChart,
  Pro2BuilderBlockContract,
  Pro2BuilderSessionContract,
  Pro2RenderProfile,
} from "@/lib/training/builder/pro2-session-contract";

export const DEFAULT_STARTER_RENDER: Pro2RenderProfile = {
  intensityUnit: "watt",
  ftpW: 250,
  hrMax: 190,
  lengthMode: "time",
  speedRefKmh: 35,
};

export type AerobicStarterBlockSpec = {
  label: string;
  kind: "steady" | "ramp" | "interval2";
  durationMinutes: number;
  intensityCue: string;
  startIntensity?: string;
  endIntensity?: string;
  intensity2?: string;
  repeats?: number;
  workSeconds?: number;
  recoverSeconds?: number;
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
  const chart = defaultChart(spec.durationMinutes, primary, {
    startIntensity: spec.startIntensity ?? (isWarm ? "Z1" : isCool ? "Z2" : primary),
    endIntensity: spec.endIntensity ?? (isWarm ? "Z2" : isCool ? "Z1" : primary),
    intensity2: spec.intensity2 ?? "Z1",
    repeats: spec.repeats ?? 1,
    workSeconds: spec.workSeconds ?? 180,
    recoverSeconds: spec.recoverSeconds ?? 90,
  });
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
} as const;

export const ALL_DISCIPLINES = [
  DISCIPLINE_SCALES.cycling,
  DISCIPLINE_SCALES.running,
  DISCIPLINE_SCALES.swimming,
  DISCIPLINE_SCALES.canoe,
];

export function buildStarterContractFromPreset(preset: AerobicStarterPreset): Pro2BuilderSessionContract {
  const durationSec = Math.max(60, preset.plannedMinutes * 60);
  const avgPowerW = Math.max(80, Math.round((preset.tss * 1000) / Math.max(durationSec / 3600, 0.25) / 36));
  const blocks = preset.blocks.map((b, i) => blockFromSpec(b, i));
  return {
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
      kcal: Math.round(preset.tss * 9.3),
      kj: Math.round(preset.tss * 39),
      avgPowerW,
    },
    renderProfile: DEFAULT_STARTER_RENDER,
    blocks,
  };
}
