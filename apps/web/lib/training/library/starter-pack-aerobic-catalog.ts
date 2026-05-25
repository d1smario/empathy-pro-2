import {
  ALL_DISCIPLINES,
  DISCIPLINE_SCALES,
  i3,
  iv,
  preset,
  presetForDisciplines,
  py,
  rec,
  rm,
  st,
  type AerobicStarterPreset,
} from "@/lib/training/library/starter-pack-aerobic-helpers";
import { STRUCTURE_RICH_PRESETS } from "@/lib/training/library/starter-pack-aerobic-catalog-structures";
import { STRUCTURE_RICH_PRESETS_EXT } from "@/lib/training/library/starter-pack-aerobic-catalog-structures-ext";
import { XC_SKI_CATALOG_PRESETS } from "@/lib/training/library/starter-pack-aerobic-catalog-xcski";
import { TRAIL_RUNNING_CATALOG_PRESETS } from "@/lib/training/library/starter-pack-aerobic-catalog-trail";
import { WAVE3_MULTISPORT_PRESETS } from "@/lib/training/library/starter-pack-aerobic-catalog-wave3-multisport";
import { ENDURANCE_MATRIX_PRESETS } from "@/lib/training/library/starter-pack-aerobic-catalog-endurance-matrix";
import { WAVE4_CATALOG_PRESETS } from "@/lib/training/library/starter-pack-aerobic-catalog-wave4";

function z2Endurance75(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Endurance Z2 · 75′ · ${discipline}`,
    description: "Volume aerobico puro — densità ossidativa.",
    adaptationTarget: "aerobic_base",
    phase: "base",
    tags: ["endurance", "z2", "aerobic"],
    plannedMinutes: 75,
    tss: 48,
    viryaWeekObjective: "volume",
    blocks: [st("Steady Z2", 51, "Z2")],
  };
}

function z2Endurance105(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Long Z2 · 105′ · ${discipline}`,
    description: "Uscita lunga ossidativa — preparazione gara endurance.",
    adaptationTarget: "aerobic_base",
    phase: "base",
    tags: ["endurance", "z2", "long"],
    plannedMinutes: 105,
    tss: 68,
    viryaWeekObjective: "long",
    blocks: [st("Steady Z2", 78, "Z2")],
  };
}

function z3Tempo2x12(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Tempo Z3 · 2×12′ · ${discipline}`,
    description: "Soglia aerobica bassa / tempo sostenuto — recupero visibile tra blocchi.",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["tempo", "z3", "quality"],
    plannedMinutes: 70,
    tss: 62,
    blocks: [st("Tempo 1", 12, "Z3"), rec(4), st("Tempo 2", 12, "Z3")],
  };
}

function z3Progressive(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Z2→Z3 progressivo · 90′ · ${discipline}`,
    description: "Progressione aerobica: Z2 lungo, rampa, chiusura Z3.",
    adaptationTarget: "aerobic_base",
    phase: "build",
    tags: ["z2", "z3", "progressive", "ramp"],
    plannedMinutes: 90,
    tss: 58,
    blocks: [st("Z2 base", 30, "Z2"), rm("Rampa Z2→Z3", 15, "Z2", "Z3"), st("Z3 mod", 15, "Z3")],
  };
}

function norwegianThreshold5x3(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Norvegese · 5×3′ Z4 · ${discipline}`,
    description: "Metodo norvegese — blocchi soglia aerobica Z4, recupero breve.",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["norwegian", "threshold", "z4", "quality"],
    plannedMinutes: 75,
    tss: 88,
    viryaWeekObjective: "quality",
    blocks: [iv("Serie soglia Z4", 5, 180, 120, "Z4", "Z1", "Norwegian threshold blocks")],
  };
}

function norwegianDouble4x4(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Norvegese · 2×(4×4′) · ${discipline}`,
    description: "Doppia serie 4×4′ con 10′ Z1 tra blocchi — formato nordico completo.",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["norwegian", "vo2", "4x4", "quality"],
    plannedMinutes: 105,
    tss: 108,
    blocks: [iv("Serie A 4×4′", 4, 240, 240, "Z5", "Z1"), rec(10), iv("Serie B 4×4′", 4, 240, 240, "Z5", "Z1")],
  };
}

function interval30x30x20(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `30″/30″ · 20 rep · ${discipline}`,
    description: "Micro-intervalli 30-30 — polarizzato / VO₂ touch.",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["30-30", "intervals", "polarized", "vo2"],
    plannedMinutes: 55,
    tss: 72,
    blocks: [iv("30″/30″", 20, 30, 30, "Z5", "Z1", "30-30 format")],
  };
}

function interval20x40x12(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `20″/40″ · 12 rep · ${discipline}`,
    description: "Stimolo anaerobico breve con recupero attivo 40″.",
    adaptationTarget: "neuromuscular",
    phase: "build",
    tags: ["20-40", "anaerobic", "intervals"],
    plannedMinutes: 50,
    tss: 58,
    blocks: [iv("20″/40″", 12, 20, 40, "Z6", "Z1")],
  };
}

function polarized9015(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Polarizzato · 90′ · ${discipline}`,
    description: "Volume Z2 isolato, poi tier VO₂ separato da recupero profondo.",
    adaptationTarget: "aerobic_base",
    phase: "build",
    tags: ["polarized", "z2", "vo2", "quality"],
    plannedMinutes: 90,
    tss: 78,
    viryaWeekObjective: "quality",
    blocks: [st("Volume Z2", 50, "Z2"), rec(5), iv("Quality Z5", 4, 240, 240, "Z5", "Z1"), st("Flush Z2", 8, "Z2")],
  };
}

function polarized120(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Polarizzato long · 120′ · ${discipline}`,
    description: "Long Z2 + tier VO₂ 3×5′ con 8′ rec tra volume e qualità.",
    adaptationTarget: "aerobic_base",
    phase: "build",
    tags: ["polarized", "long", "z2", "vo2"],
    plannedMinutes: 120,
    tss: 92,
    viryaWeekObjective: "long",
    blocks: [st("Volume Z2", 70, "Z2"), rec(8), iv("Z5 blocks", 3, 300, 300, "Z5", "Z1"), st("Cool flush", 10, "Z2")],
  };
}

function lactateTolerance2x15(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Lattacido · 2×15′ Z4 · ${discipline}`,
    description: "Due blocchi soglia lunghi — 12′ recupero profondo tra i lavori.",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["lactate", "threshold", "z4"],
    plannedMinutes: 85,
    tss: 90,
    blocks: [st("Blocco 1", 15, "Z4"), rec(12), st("Blocco 2", 15, "Z4")],
  };
}

function lactate6x5(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Lattacido · 6×5′ Z4 · ${discipline}`,
    description: "Serie da 5′ a soglia — accumulo lattato controllato.",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["lactate", "intervals", "z4"],
    plannedMinutes: 75,
    tss: 84,
    blocks: [iv("6×5′ Z4", 6, 300, 150, "Z4", "Z1")],
  };
}

function vo2_5x5(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `VO₂ tier · 3×5′ + 8′ + 2×5′ · ${discipline}`,
    description: "VO₂max in due tier separati da recupero profondo 8′.",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["vo2", "intervals", "quality", "tier"],
    plannedMinutes: 95,
    tss: 98,
    viryaWeekObjective: "quality",
    blocks: [
      iv("Tier A · 3×5′", 3, 300, 180, "Z5", "Z1"),
      rec(8),
      iv("Tier B · 2×5′", 2, 300, 240, "Z5", "Z1"),
      st("Z2 flush", 10, "Z2"),
    ],
  };
}

function vo2_30x30x16(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `VO₂ · 30″/30″ ×16 · ${discipline}`,
    description: "Serie estesa 30-30 per capacità aerobica alta.",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["vo2", "30-30", "intervals"],
    plannedMinutes: 60,
    tss: 76,
    blocks: [iv("30″/30″ ×16", 16, 30, 30, "Z5", "Z1")],
  };
}

function anaerobic8x45(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Anaerobico · 8×45″ · ${discipline}`,
    description: "Potenza anaerobica — recupero lungo tra rep.",
    adaptationTarget: "neuromuscular",
    phase: "build",
    tags: ["anaerobic", "z6", "intervals"],
    plannedMinutes: 55,
    tss: 65,
    blocks: [iv("8×45″ Z6", 8, 45, 180, "Z6", "Z1")],
  };
}

function hitTabata(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `HIT · Tabata + flush · ${discipline}`,
    description: "Tabata 8×(20″/10″) poi Z2 flush — densità HIT isolata.",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["hit", "tabata", "intervals"],
    plannedMinutes: 50,
    tss: 58,
    blocks: [st("Priming Z2", 12, "Z2"), iv("Tabata", 8, 20, 10, "Z6", "Z1", "HIT Tabata"), rec(5), st("Z2 flush", 8, "Z2")],
  };
}

function hit12x1(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `HIT · 12×1′ · ${discipline}`,
    description: "HIT — 1′ massimale / 1′ recupero.",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["hit", "intervals", "z5"],
    plannedMinutes: 55,
    tss: 78,
    blocks: [iv("12×1′", 12, 60, 60, "Z5", "Z1")],
  };
}

function hit40x20x8(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `HIT · 40″/20″ ×8 · ${discipline}`,
    description: "Formato 40-20 — stimolo ipossico-like ad alta densità.",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["hit", "40-20", "hypoxic"],
    plannedMinutes: 48,
    tss: 62,
    blocks: [iv("40″/20″", 8, 40, 20, "Z5", "Z1", "Alta densità — simula stress ipossico")],
  };
}

function hypoxicSim4x6(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Ipossico sim · 4×6′ Z3 · ${discipline}`,
    description: "Simulazione ipossia — blocchi Z3 sostenuti (nota coach).",
    adaptationTarget: "aerobic_base",
    phase: "build",
    tags: ["hypoxic", "z3", "simulation"],
    plannedMinutes: 70,
    tss: 64,
    blocks: [iv("4×6′ Z3", 4, 360, 180, "Z3", "Z1", "Stimolo ipossico simulato")],
  };
}

function heatEndurance90(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Caldo · endurance Z2 · 90′ · ${discipline}`,
    description: "Acclimatamento termico — Z2 in condizioni calde.",
    adaptationTarget: "aerobic_base",
    phase: "peak",
    tags: ["heat", "temperature", "z2", "endurance"],
    plannedMinutes: 90,
    tss: 52,
    blocks: [st("Z2 caldo", 63, "Z2", "Ambiente caldo controllato / idratazione")],
  };
}

function heatTempo60(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Caldo · tempo Z3 · 60′ · ${discipline}`,
    description: "Tempo Z3 in caldo — adattamento gare estive.",
    adaptationTarget: "lactate_clearance",
    phase: "peak",
    tags: ["heat", "temperature", "z3", "tempo"],
    plannedMinutes: 60,
    tss: 58,
    blocks: [st("Tempo Z3 caldo", 30, "Z3", "Monitoraggio temperatura")],
  };
}

function tt2x20(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Time trial · 2×20′ · ${discipline}`,
    description: "Simulazione ritmo gara TT — due blocchi a Z4.",
    adaptationTarget: "lactate_clearance",
    phase: "peak",
    tags: ["time_trial", "tt", "z4", "race"],
    plannedMinutes: 85,
    tss: 96,
    viryaWeekObjective: "quality",
    blocks: [st("TT block 1", 20, "Z4"), st("Recupero", 8, "Z1"), st("TT block 2", 20, "Z4")],
  };
}

function tt40kSim(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Time trial · sim 40k · ${discipline}`,
    description: "Warm Z2 + blocco TT 35′ — simulazione 40 km.",
    adaptationTarget: "lactate_clearance",
    phase: "peak",
    tags: ["time_trial", "tt", "race"],
    plannedMinutes: 75,
    tss: 88,
    blocks: [st("Z2 priming", 15, "Z2"), st("TT effort", 35, "Z4")],
  };
}

function sprint10x15(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Sprint · 10×15″ · ${discipline}`,
    description: "Neuromuscolare sprinter — max power breve.",
    adaptationTarget: "neuromuscular",
    phase: "build",
    tags: ["sprint", "neuromuscular", "sprinter"],
    plannedMinutes: 50,
    tss: 52,
    blocks: [iv("10×15″ sprint", 10, 15, 120, "Z6", "Z1")],
  };
}

function sprint6x30(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Sprint · 6×30″ · ${discipline}`,
    description: "Accelerazioni sprinter — full recovery.",
    adaptationTarget: "neuromuscular",
    phase: "build",
    tags: ["sprint", "neuromuscular", "sprinter"],
    plannedMinutes: 52,
    tss: 54,
    blocks: [iv("6×30″", 6, 30, 150, "Z6", "Z1")],
  };
}

function forceLowCadence4x8(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Forza · 4×8′ low cadence · ${discipline}`,
    description: "Lavoro di forza aerobica — cadenza bassa / resistenza.",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["force", "strength", "low_cadence"],
    plannedMinutes: 70,
    tss: 72,
    blocks: [
      st("Force 1", 8, "Z3", "Cadenza bassa / resistenza"),
      st("Recupero", 4, "Z1"),
      st("Force 2", 8, "Z3"),
      st("Recupero", 4, "Z1"),
      st("Force 3", 8, "Z3"),
      st("Recupero", 4, "Z1"),
      st("Force 4", 8, "Z3"),
    ],
  };
}

function sweetSpot3x15(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Sweet spot · 3×15′ · ${discipline}`,
    description: "Z3 alto — miglioramento soglia aerobica senza Z4 pieno.",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["sweet_spot", "z3", "threshold"],
    plannedMinutes: 85,
    tss: 86,
    blocks: [
      st("SS 1", 15, "Z3"),
      st("Rec", 5, "Z1"),
      st("SS 2", 15, "Z3"),
      st("Rec", 5, "Z1"),
      st("SS 3", 15, "Z3"),
    ],
  };
}

function overUnderNorwegian(discipline: string): Omit<AerobicStarterPreset, "presetId" | "discipline"> {
  return {
    title: `Over-under · 3×(2′Z4/1′Z3/2′Z4) · ${discipline}`,
    description: "Oscillazioni sopra/sotto soglia — interval3 con recupero tra blocchi.",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["over_under", "norwegian", "z4", "z3"],
    plannedMinutes: 78,
    tss: 82,
    blocks: [
      i3("OU block 1", 3, 120, 60, 120, "Z4", "Z3", "Z4"),
      rec(5),
      i3("OU block 2", 3, 120, 60, 120, "Z4", "Z3", "Z4"),
    ],
  };
}

const SIMPLE_MULTI_TEMPLATES: Array<{
  baseId: string;
  build: (discipline: string) => Omit<AerobicStarterPreset, "presetId" | "discipline">;
}> = [
  { baseId: "endurance_z2_75", build: z2Endurance75 },
  { baseId: "long_z2_105", build: z2Endurance105 },
  { baseId: "heat_z2_90", build: heatEndurance90 },
];

const CYCLING_QUALITY_TEMPLATES: Array<{
  baseId: string;
  build: (discipline: string) => Omit<AerobicStarterPreset, "presetId" | "discipline">;
}> = [
  { baseId: "tempo_z3_2x12", build: z3Tempo2x12 },
  { baseId: "z2_z3_progressive_90", build: z3Progressive },
  { baseId: "norwegian_5x3_z4", build: norwegianThreshold5x3 },
  { baseId: "norwegian_2x4x4", build: norwegianDouble4x4 },
  { baseId: "interval_30_30_x20", build: interval30x30x20 },
  { baseId: "interval_20_40_x12", build: interval20x40x12 },
  { baseId: "polarized_90", build: polarized9015 },
  { baseId: "polarized_120", build: polarized120 },
  { baseId: "lactate_2x15_z4", build: lactateTolerance2x15 },
  { baseId: "lactate_6x5_z4", build: lactate6x5 },
  { baseId: "vo2_5x5", build: vo2_5x5 },
  { baseId: "vo2_30_30_x16", build: vo2_30x30x16 },
  { baseId: "anaerobic_8x45", build: anaerobic8x45 },
  { baseId: "hit_tabata", build: hitTabata },
  { baseId: "hit_12x1", build: hit12x1 },
  { baseId: "hit_40_20_x8", build: hit40x20x8 },
  { baseId: "hypoxic_sim_4x6", build: hypoxicSim4x6 },
  { baseId: "heat_z3_60", build: heatTempo60 },
  { baseId: "tt_2x20", build: tt2x20 },
  { baseId: "tt_40k_sim", build: tt40kSim },
  { baseId: "sprint_10x15", build: sprint10x15 },
  { baseId: "sprint_6x30", build: sprint6x30 },
  { baseId: "force_4x8", build: forceLowCadence4x8 },
  { baseId: "sweet_spot_3x15", build: sweetSpot3x15 },
  { baseId: "over_under_norwegian", build: overUnderNorwegian },
];

function buildMultiDisciplinePresets(): AerobicStarterPreset[] {
  const out: AerobicStarterPreset[] = [];
  for (const tpl of SIMPLE_MULTI_TEMPLATES) {
    out.push(
      ...presetForDisciplines(tpl.baseId, ALL_DISCIPLINES, (discipline, durationScale) => {
        const base = tpl.build(discipline);
        const scaledMain = base.blocks.map((b) => ({
          ...b,
          durationMinutes: Math.max(1, Math.round(b.durationMinutes * durationScale)),
        }));
        return { ...base, blocks: scaledMain };
      }),
    );
  }
  for (const tpl of CYCLING_QUALITY_TEMPLATES) {
    out.push(
      ...presetForDisciplines(tpl.baseId, [DISCIPLINE_SCALES.cycling], (discipline) => tpl.build(discipline)),
    );
  }
  return out;
}

const CYCLING_ONLY: AerobicStarterPreset[] = [
  preset(
    "cyc_climb_force_5x6",
    "Cycling",
    "Climb force · 5×6′ Z4",
    "Simulazione salita forzata — cadenza bassa.",
    "lactate_clearance",
    "build",
    ["climbing", "force", "cycling"],
    80,
    88,
    [
      st("Climb 1", 6, "Z4"),
      st("Rec", 3, "Z1"),
      st("Climb 2", 6, "Z4"),
      st("Rec", 3, "Z1"),
      st("Climb 3", 6, "Z4"),
      st("Rec", 3, "Z1"),
      st("Climb 4", 6, "Z4"),
      st("Rec", 3, "Z1"),
      st("Climb 5", 6, "Z4"),
    ],
  ),
  preset(
    "cyc_cadence_z2_drills",
    "Cycling",
    "Z2 + cadenza · drills",
    "Endurance con blocchi cadenza 100+ rpm.",
    "aerobic_base",
    "base",
    ["cadence", "cycling", "z2"],
    80,
    58,
    [st("Z2", 30, "Z2"), st("Cadence drill", 6, "Z2", "100+ rpm"), st("Z2", 22, "Z2")],
  ),
  preset(
    "cyc_sprint_leadout",
    "Cycling",
    "Sprint lead-out · 4×(30″+2′)",
    "Simulazione volata — 2′ Z4 + 30″ sprint.",
    "neuromuscular",
    "peak",
    ["sprint", "sprinter", "cycling", "race"],
    65,
    70,
    [iv("Lead-out + sprint", 4, 150, 180, "Z6", "Z1", "2′ Z4 + 30″ max"), st("Z2 flush", 10, "Z2")],
  ),
];

const SWIMMING_ONLY: AerobicStarterPreset[] = [
  preset(
    "swm_aerobic_200s",
    "Swimming",
    "Aerobic · 8×200 m",
    "Serie aerobiche pool — Z2/Z3 per 200 m.",
    "aerobic_base",
    "base",
    ["swimming", "z2", "intervals"],
    55,
    42,
    [iv("8×200 m", 8, 180, 30, "Z2", "Z1", "Pace aerobica pool")],
    { warm: 10, cool: 8 },
  ),
  preset(
    "swm_threshold_100s",
    "Swimming",
    "Threshold · 10×100 m",
    "Soglia nuoto — 100 m on / 20 s off.",
    "lactate_clearance",
    "build",
    ["swimming", "threshold", "z4"],
    50,
    48,
    [iv("10×100 m", 10, 90, 20, "Z4", "Z1")],
    { warm: 10, cool: 8 },
  ),
  preset(
    "swm_vo2_50s",
    "Swimming",
    "VO₂ · 12×50 m",
    "Intervalli VO₂ pool — 50 m fast.",
    "vo2max",
    "build",
    ["swimming", "vo2", "intervals"],
    48,
    46,
    [iv("12×50 m", 12, 45, 25, "Z5", "Z1")],
    { warm: 10, cool: 8 },
  ),
  preset(
    "swm_sprint_25s",
    "Swimming",
    "Sprint · 8×25 m",
    "Neuromuscolare vasca — 25 m max.",
    "neuromuscular",
    "build",
    ["swimming", "sprint", "neuromuscular"],
    40,
    38,
    [iv("8×25 m", 8, 20, 60, "Z6", "Z1")],
    { warm: 10, cool: 8 },
  ),
];

const RUNNING_ONLY: AerobicStarterPreset[] = [
  preset(
    "run_fartlek_60",
    "Running",
    "Fartlek · 60′",
    "Fartlek libero — alternanza Z2/Z4 per percezione.",
    "aerobic_base",
    "build",
    ["running", "fartlek", "z2", "z4"],
    60,
    55,
    [st("Z2 base", 20, "Z2"), iv("Fartlek", 6, 120, 120, "Z4", "Z2"), st("Z2 home", 12, "Z2")],
  ),
  preset(
    "run_hill_repeats",
    "Running",
    "Hill repeats · 6×3′",
    "Forza specifica running — ripetute in salita.",
    "lactate_clearance",
    "build",
    ["running", "force", "hill"],
    55,
    58,
    [iv("6×3′ hill", 6, 180, 120, "Z4", "Z1")],
  ),
  preset(
    "run_marathon_pace",
    "Running",
    "Marathon pace · 2×20′",
    "Ritmo gara maratona — Z3 sostenuto.",
    "lactate_clearance",
    "peak",
    ["running", "marathon", "race", "z3"],
    75,
    72,
    [st("MP 1", 20, "Z3"), st("Rec", 5, "Z1"), st("MP 2", 20, "Z3")],
  ),
];

const CANOE_ONLY: AerobicStarterPreset[] = [
  preset(
    "can_endurance_paddle_90",
    "Canoe",
    "Endurance paddle · 90′ Z2",
    "Volume aerobico canoa — ritmo sostenuto acqua piatta.",
    "aerobic_base",
    "base",
    ["canoe", "z2", "endurance"],
    90,
    52,
    [st("Paddle Z2", 66, "Z2")],
  ),
  preset(
    "can_vo2_3min",
    "Canoe",
    "VO₂ · 5×3′ paddle",
    "Intervalli VO₂ canoa — 3′ on / 2′ off.",
    "vo2max",
    "build",
    ["canoe", "vo2", "intervals"],
    65,
    68,
    [iv("5×3′ paddle", 5, 180, 120, "Z5", "Z1")],
  ),
  preset(
    "can_sprint_starts",
    "Canoe",
    "Sprint starts · 8×20″",
    "Partenze e neuromuscolare canoa.",
    "neuromuscular",
    "build",
    ["canoe", "sprint", "neuromuscular"],
    50,
    48,
    [iv("8×20″ start", 8, 20, 120, "Z6", "Z1")],
  ),
];

export const AEROBIC_CATALOG_EXTENSION_PRESETS: AerobicStarterPreset[] = [
  ...buildMultiDisciplinePresets(),
  ...STRUCTURE_RICH_PRESETS,
  ...STRUCTURE_RICH_PRESETS_EXT,
  ...XC_SKI_CATALOG_PRESETS,
  ...TRAIL_RUNNING_CATALOG_PRESETS,
  ...WAVE3_MULTISPORT_PRESETS,
  ...ENDURANCE_MATRIX_PRESETS,
  ...WAVE4_CATALOG_PRESETS,
  ...CYCLING_ONLY,
  ...SWIMMING_ONLY,
  ...RUNNING_ONLY,
  ...CANOE_ONLY,
];
