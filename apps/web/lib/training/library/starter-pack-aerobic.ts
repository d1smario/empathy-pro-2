import type {
  Pro2BlockChart,
  Pro2BuilderBlockContract,
  Pro2BuilderSessionContract,
  Pro2RenderProfile,
} from "@/lib/training/builder/pro2-session-contract";

export const EMPATHY_AEROBIC_STARTER_PACK_ID = "empathy_aerobic_starter_v1";
export const EMPATHY_AEROBIC_STARTER_FOLDER_NAME = "Empathy · Aerobic Starter";

const DEFAULT_RENDER: Pro2RenderProfile = {
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

function blockFromSpec(spec: AerobicStarterBlockSpec, index: number): Pro2BuilderBlockContract {
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
    chart,
  };
}

function shell(
  warmMin: number,
  coolMin: number,
  main: AerobicStarterBlockSpec[],
): AerobicStarterBlockSpec[] {
  return [
    { label: "Riscaldamento", kind: "ramp", durationMinutes: warmMin, intensityCue: "Z1->Z2", startIntensity: "Z1", endIntensity: "Z2" },
    ...main,
    { label: "Defaticamento", kind: "ramp", durationMinutes: coolMin, intensityCue: "Z2->Z1", startIntensity: "Z2", endIntensity: "Z1" },
  ];
}

/** 20 template aerobic curati (cycling) — contratto Builder v1. */
export const AEROBIC_STARTER_PRESETS: AerobicStarterPreset[] = [
  {
    presetId: "recovery_45_z1",
    title: "Recovery · 45′ Z1",
    description: "Spin leggero post-gara o giorno molto stanco.",
    discipline: "Cycling",
    adaptationTarget: "recovery",
    phase: "base",
    tags: ["recovery", "base"],
    plannedMinutes: 45,
    tss: 28,
    blocks: shell(10, 8, [{ label: "Volume Z1", kind: "steady", durationMinutes: 27, intensityCue: "Z1" }]),
  },
  {
    presetId: "recovery_60_z1",
    title: "Recovery · 60′ Z1",
    description: "Recupero attivo lungo, densità neuromuscolare bassa.",
    discipline: "Cycling",
    adaptationTarget: "recovery",
    phase: "base",
    tags: ["recovery"],
    plannedMinutes: 60,
    tss: 36,
    blocks: shell(12, 10, [{ label: "Volume Z1", kind: "steady", durationMinutes: 38, intensityCue: "Z1" }]),
  },
  {
    presetId: "endurance_90_z2",
    title: "Endurance · 90′ Z2",
    description: "Base aerobica classica.",
    discipline: "Cycling",
    adaptationTarget: "aerobic_base",
    phase: "base",
    viryaWeekObjective: "volume",
    tags: ["endurance", "base"],
    plannedMinutes: 90,
    tss: 55,
    blocks: shell(15, 12, [{ label: "Steady Z2", kind: "steady", durationMinutes: 63, intensityCue: "Z2" }]),
  },
  {
    presetId: "endurance_120_z2",
    title: "Long steady · 120′ Z2",
    description: "Long ride endurance — oxidativo.",
    discipline: "Cycling",
    adaptationTarget: "aerobic_base",
    phase: "base",
    viryaWeekObjective: "long",
    tags: ["endurance", "long"],
    plannedMinutes: 120,
    tss: 72,
    blocks: shell(18, 15, [{ label: "Steady Z2", kind: "steady", durationMinutes: 87, intensityCue: "Z2" }]),
  },
  {
    presetId: "tempo_2x15_z3",
    title: "Tempo · 2×15′ Z3",
    description: "Soglia bassa / tempo continuo.",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["tempo", "quality"],
    plannedMinutes: 75,
    tss: 68,
    blocks: shell(15, 10, [
      { label: "Tempo 1", kind: "steady", durationMinutes: 15, intensityCue: "Z3" },
      { label: "Recupero attivo", kind: "steady", durationMinutes: 5, intensityCue: "Z1" },
      { label: "Tempo 2", kind: "steady", durationMinutes: 15, intensityCue: "Z3" },
    ]),
  },
  {
    presetId: "sweet_spot_2x20",
    title: "Sweet spot · 2×20′",
    description: "88–93% FTP equivalente (Z3 alto).",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    viryaWeekObjective: "quality",
    tags: ["sweet_spot", "threshold"],
    plannedMinutes: 80,
    tss: 82,
    blocks: shell(15, 10, [
      { label: "Sweet spot 1", kind: "steady", durationMinutes: 20, intensityCue: "Z3" },
      { label: "Recupero", kind: "steady", durationMinutes: 5, intensityCue: "Z1" },
      { label: "Sweet spot 2", kind: "steady", durationMinutes: 20, intensityCue: "Z3" },
    ]),
  },
  {
    presetId: "sweet_spot_3x12",
    title: "Sweet spot · 3×12′",
    description: "Blocchi SS più corti, aderenza alta.",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["sweet_spot"],
    plannedMinutes: 70,
    tss: 74,
    blocks: shell(12, 10, [
      { label: "Sweet spot 1", kind: "steady", durationMinutes: 12, intensityCue: "Z3" },
      { label: "Recupero", kind: "steady", durationMinutes: 4, intensityCue: "Z1" },
      { label: "Sweet spot 2", kind: "steady", durationMinutes: 12, intensityCue: "Z3" },
      { label: "Recupero", kind: "steady", durationMinutes: 4, intensityCue: "Z1" },
      { label: "Sweet spot 3", kind: "steady", durationMinutes: 12, intensityCue: "Z3" },
    ]),
  },
  {
    presetId: "threshold_2x20_ftp",
    title: "Threshold · 2×20′ FTP",
    description: "Soglia funzionale — qualità centrale.",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    viryaWeekObjective: "quality",
    tags: ["threshold", "ftp"],
    plannedMinutes: 85,
    tss: 95,
    blocks: shell(15, 10, [
      { label: "Soglia 1", kind: "steady", durationMinutes: 20, intensityCue: "Z4" },
      { label: "Recupero", kind: "steady", durationMinutes: 8, intensityCue: "Z1" },
      { label: "Soglia 2", kind: "steady", durationMinutes: 20, intensityCue: "Z4" },
    ]),
  },
  {
    presetId: "threshold_3x12",
    title: "Threshold · 3×12′",
    description: "Soglia frazionata.",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["threshold"],
    plannedMinutes: 75,
    tss: 88,
    blocks: shell(12, 10, [
      { label: "Soglia 1", kind: "interval2", durationMinutes: 12, intensityCue: "Z4/Z1", intensity2: "Z1", repeats: 1, workSeconds: 720, recoverSeconds: 240 },
      { label: "Recupero", kind: "steady", durationMinutes: 4, intensityCue: "Z1" },
      { label: "Soglia 2", kind: "steady", durationMinutes: 12, intensityCue: "Z4" },
      { label: "Recupero", kind: "steady", durationMinutes: 4, intensityCue: "Z1" },
      { label: "Soglia 3", kind: "steady", durationMinutes: 12, intensityCue: "Z4" },
    ]),
  },
  {
    presetId: "vo2_5x3",
    title: "VO₂ · 5×3′",
    description: "Intervalli brevi sopra soglia.",
    discipline: "Cycling",
    adaptationTarget: "vo2max",
    phase: "build",
    viryaWeekObjective: "quality",
    tags: ["vo2", "intervals"],
    plannedMinutes: 65,
    tss: 78,
    blocks: shell(15, 10, [
      {
        label: "Serie VO₂",
        kind: "interval2",
        durationMinutes: 30,
        intensityCue: "Z5/Z1",
        intensity2: "Z1",
        repeats: 5,
        workSeconds: 180,
        recoverSeconds: 180,
      },
    ]),
  },
  {
    presetId: "vo2_4x4",
    title: "VO₂ · 4×4′",
    description: "Classico 4×4 nordico.",
    discipline: "Cycling",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["vo2"],
    plannedMinutes: 70,
    tss: 82,
    blocks: shell(15, 10, [
      {
        label: "Serie VO₂",
        kind: "interval2",
        durationMinutes: 32,
        intensityCue: "Z5/Z1",
        intensity2: "Z1",
        repeats: 4,
        workSeconds: 240,
        recoverSeconds: 240,
      },
    ]),
  },
  {
    presetId: "over_under_3x8",
    title: "Over-unders · 3×8′",
    description: "Oscillazioni sopra/sotto FTP.",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["over_under", "threshold"],
    plannedMinutes: 70,
    tss: 76,
    blocks: shell(15, 10, [
      { label: "OU block 1", kind: "steady", durationMinutes: 8, intensityCue: "Z4/Z3" },
      { label: "Recupero", kind: "steady", durationMinutes: 4, intensityCue: "Z1" },
      { label: "OU block 2", kind: "steady", durationMinutes: 8, intensityCue: "Z4/Z3" },
      { label: "Recupero", kind: "steady", durationMinutes: 4, intensityCue: "Z1" },
      { label: "OU block 3", kind: "steady", durationMinutes: 8, intensityCue: "Z4/Z3" },
    ]),
  },
  {
    presetId: "pyramid_z4",
    title: "Pyramid · Z4 progressivo",
    description: "Gradini crescenti di intensità.",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["pyramid", "quality"],
    plannedMinutes: 75,
    tss: 80,
    blocks: shell(15, 10, [
      { label: "Step 1", kind: "steady", durationMinutes: 8, intensityCue: "Z3" },
      { label: "Step 2", kind: "steady", durationMinutes: 8, intensityCue: "Z4" },
      { label: "Step 3", kind: "steady", durationMinutes: 8, intensityCue: "Z4" },
      { label: "Recupero", kind: "steady", durationMinutes: 6, intensityCue: "Z1" },
    ]),
  },
  {
    presetId: "long_z2_150",
    title: "Long · 150′ Z2",
    description: "Uscita lunga preparazione gara.",
    discipline: "Cycling",
    adaptationTarget: "aerobic_base",
    phase: "peak",
    viryaWeekObjective: "long",
    tags: ["long", "endurance"],
    plannedMinutes: 150,
    tss: 95,
    blocks: shell(20, 15, [{ label: "Steady Z2", kind: "steady", durationMinutes: 115, intensityCue: "Z2" }]),
  },
  {
    presetId: "race_openers_60",
    title: "Race openers · 60′",
    description: "Attivazione pre-gara (non fatigue).",
    discipline: "Cycling",
    adaptationTarget: "neuromuscular",
    phase: "peak",
    tags: ["openers", "race"],
    plannedMinutes: 60,
    tss: 52,
    blocks: shell(15, 10, [
      { label: "Z2 volume", kind: "steady", durationMinutes: 20, intensityCue: "Z2" },
      { label: "Opener 1", kind: "steady", durationMinutes: 2, intensityCue: "Z5" },
      { label: "Recupero", kind: "steady", durationMinutes: 3, intensityCue: "Z1" },
      { label: "Opener 2", kind: "steady", durationMinutes: 2, intensityCue: "Z5" },
    ]),
  },
  {
    presetId: "active_recovery_30",
    title: "Active recovery · 30′",
    description: "Micro-sessione tra quality days.",
    discipline: "Cycling",
    adaptationTarget: "recovery",
    phase: "build",
    tags: ["recovery", "micro"],
    plannedMinutes: 30,
    tss: 18,
    blocks: shell(8, 6, [{ label: "Spin Z1", kind: "steady", durationMinutes: 16, intensityCue: "Z1" }]),
  },
  {
    presetId: "endurance_pickups",
    title: "Endurance + pickups",
    description: "Z2 con 4 accelerazioni brevi.",
    discipline: "Cycling",
    adaptationTarget: "aerobic_base",
    phase: "base",
    tags: ["endurance", "pickups"],
    plannedMinutes: 90,
    tss: 62,
    blocks: shell(15, 12, [
      { label: "Steady Z2", kind: "steady", durationMinutes: 45, intensityCue: "Z2" },
      { label: "Pickups", kind: "interval2", durationMinutes: 12, intensityCue: "Z4/Z2", intensity2: "Z2", repeats: 4, workSeconds: 60, recoverSeconds: 120 },
      { label: "Z2 flush", kind: "steady", durationMinutes: 6, intensityCue: "Z2" },
    ]),
  },
  {
    presetId: "climbing_blocks",
    title: "Climbing sim · 3×10′",
    description: "Simulazione salita Z3–Z4.",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["climbing", "force"],
    plannedMinutes: 80,
    tss: 85,
    blocks: shell(15, 10, [
      { label: "Climb 1", kind: "steady", durationMinutes: 10, intensityCue: "Z4" },
      { label: "Recupero", kind: "steady", durationMinutes: 5, intensityCue: "Z1" },
      { label: "Climb 2", kind: "steady", durationMinutes: 10, intensityCue: "Z4" },
      { label: "Recupero", kind: "steady", durationMinutes: 5, intensityCue: "Z1" },
      { label: "Climb 3", kind: "steady", durationMinutes: 10, intensityCue: "Z4" },
    ]),
  },
  {
    presetId: "neuromuscular_sprints",
    title: "Neuromuscular · 8×30″",
    description: "Sprint brevi, full recovery.",
    discipline: "Cycling",
    adaptationTarget: "neuromuscular",
    phase: "build",
    tags: ["sprint", "neuromuscular"],
    plannedMinutes: 55,
    tss: 48,
    blocks: shell(15, 10, [
      {
        label: "Sprint series",
        kind: "interval2",
        durationMinutes: 18,
        intensityCue: "Z6/Z1",
        intensity2: "Z1",
        repeats: 8,
        workSeconds: 30,
        recoverSeconds: 150,
      },
    ]),
  },
  {
    presetId: "base_cadence_drills",
    title: "Base + cadence drills",
    description: "Z2 con blocchi cadenza alta.",
    discipline: "Cycling",
    adaptationTarget: "aerobic_base",
    phase: "base",
    tags: ["cadence", "base"],
    plannedMinutes: 75,
    tss: 58,
    blocks: shell(12, 10, [
      { label: "Steady Z2", kind: "steady", durationMinutes: 25, intensityCue: "Z2" },
      { label: "Cadence drill", kind: "steady", durationMinutes: 8, intensityCue: "Z2" },
      { label: "Steady Z2", kind: "steady", durationMinutes: 20, intensityCue: "Z2" },
    ]),
  },
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
    renderProfile: DEFAULT_RENDER,
    blocks,
  };
}

export function empathyAerobicStarterContracts(): Array<{
  preset: AerobicStarterPreset;
  contract: Pro2BuilderSessionContract;
}> {
  return AEROBIC_STARTER_PRESETS.map((preset) => ({
    preset,
    contract: buildStarterContractFromPreset(preset),
  }));
}
