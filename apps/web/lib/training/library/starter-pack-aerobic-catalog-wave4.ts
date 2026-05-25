/**
 * Wave 4 — chiusura verso 500 preset: qualità strutturata multi-disciplina + sport-specific.
 */
import {
  ALL_DISCIPLINES,
  DEFAULT_STARTER_RENDER,
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

const FTP = DEFAULT_STARTER_RENDER.ftpW;

function buildWave4Multidiscipline(): AerobicStarterPreset[] {
  const templates: Array<{
    baseId: string;
    build: (discipline: string) => Omit<AerobicStarterPreset, "presetId" | "discipline">;
  }> = [
    {
      baseId: "w4_cruise_3x10",
      build: (discipline) => ({
        title: `Cruise · 3×10′ Z3 · ${discipline}`,
        description: "Tre blocchi tempo sostenuto — recupero visibile tra i lavori.",
        adaptationTarget: "lactate_clearance",
        phase: "build",
        tags: ["cruise", "tempo", "z3", "tier"],
        plannedMinutes: 72,
        tss: 68,
        blocks: [st("Cruise 1", 10, "Z3"), rec(3), st("Cruise 2", 10, "Z3"), rec(3), st("Cruise 3", 10, "Z3")],
      }),
    },
    {
      baseId: "w4_threshold_5x4",
      build: (discipline) => ({
        title: `Soglia · 5×4′ Z4 · ${discipline}`,
        description: "Serie soglia classica — 2′ recupero attivo.",
        adaptationTarget: "lactate_tolerance",
        phase: "build",
        tags: ["threshold", "z4", "intervals", "norwegian"],
        plannedMinutes: 68,
        tss: 82,
        viryaWeekObjective: "quality",
        blocks: [iv("5×4′ Z4", 5, 240, 120, "Z4", "Z1")],
      }),
    },
    {
      baseId: "w4_vo2_double_tier",
      build: (discipline) => ({
        title: `VO₂ doppio tier · ${discipline}`,
        description: "3×3′ Z5, recupero 8′, poi 2×5′ Z5 — separazione qualità.",
        adaptationTarget: "vo2max",
        phase: "build",
        tags: ["vo2", "tier", "intervals", "quality"],
        plannedMinutes: 78,
        tss: 88,
        blocks: [iv("Tier A · 3×3′", 3, 180, 120, "Z5", "Z1"), rec(8), iv("Tier B · 2×5′", 2, 300, 240, "Z5", "Z1")],
      }),
    },
    {
      baseId: "w4_ladder_z4",
      build: (discipline) => ({
        title: `Ladder Z4 · 3-6′ · ${discipline}`,
        description: "Scala crescente a soglia — ogni blocco diverso.",
        adaptationTarget: "lactate_tolerance",
        phase: "build",
        tags: ["ladder", "ascending", "z4", "threshold"],
        plannedMinutes: 75,
        tss: 86,
        blocks: [
          st("3′ Z4", 3, "Z4"),
          rec(2),
          st("4′ Z4", 4, "Z4"),
          rec(3),
          st("5′ Z4", 5, "Z4"),
          rec(3),
          st("6′ Z4", 6, "Z4"),
        ],
      }),
    },
    {
      baseId: "w4_pyramid_vo2_5",
      build: (discipline) => ({
        title: `Pyramid VO₂ · 5 step · ${discipline}`,
        description: "Piramide watt — salita e discesa controllata.",
        adaptationTarget: "vo2max",
        phase: "build",
        tags: ["pyramid", "vo2", "structured"],
        plannedMinutes: 65,
        tss: 78,
        blocks: [py("Pyramid Z4→Z5", 5, 180, Math.round(FTP * 0.88), Math.round(FTP * 1.08))],
      }),
    },
    {
      baseId: "w4_ou_double",
      build: (discipline) => ({
        title: `Over-under · 2×(3×OU) · ${discipline}`,
        description: "Due blocchi over-under interval3 — 6′ tra i blocchi.",
        adaptationTarget: "lactate_tolerance",
        phase: "build",
        tags: ["over_under", "interval3", "z4", "z3"],
        plannedMinutes: 80,
        tss: 84,
        blocks: [
          i3("OU A", 3, 120, 60, 120, "Z4", "Z3", "Z4"),
          rec(6),
          i3("OU B", 3, 120, 60, 120, "Z4", "Z3", "Z4"),
        ],
      }),
    },
    {
      baseId: "w4_polarized_insert",
      build: (discipline) => ({
        title: `Polarizzato insert · ${discipline}`,
        description: "Z2 lungo, tier 4×4′ Z5, chiusura Z2.",
        adaptationTarget: "aerobic_base",
        phase: "build",
        tags: ["polarized", "z2", "vo2"],
        plannedMinutes: 95,
        tss: 76,
        blocks: [st("Z2 volume", 40, "Z2"), rec(5), iv("4×4′ Z5", 4, 240, 240, "Z5", "Z1"), st("Z2 flush", 15, "Z2")],
      }),
    },
    {
      baseId: "w4_tempo_ramp_finish",
      build: (discipline) => ({
        title: `Z2→tempo ramp · ${discipline}`,
        description: "Base Z2, rampa progressiva, chiusura tempo Z3.",
        adaptationTarget: "aerobic_base",
        phase: "build",
        tags: ["progressive", "ramp", "z3", "z2"],
        plannedMinutes: 88,
        tss: 62,
        blocks: [st("Z2 base", 25, "Z2"), rm("Rampa Z2→Z3", 12, "Z2", "Z3"), st("Tempo finish", 12, "Z3")],
      }),
    },
    {
      baseId: "w4_micro_30_30_24",
      build: (discipline) => ({
        title: `30″/30″ ×24 · ${discipline}`,
        description: "Micro-intervalli estesi — polarizzato / Seiler-style touch.",
        adaptationTarget: "vo2max",
        phase: "build",
        tags: ["30-30", "micro", "vo2", "polarized"],
        plannedMinutes: 58,
        tss: 74,
        blocks: [iv("30″/30″ ×24", 24, 30, 30, "Z5", "Z1")],
      }),
    },
    {
      baseId: "w4_sweet_2x18",
      build: (discipline) => ({
        title: `Sweet spot · 2×18′ · ${discipline}`,
        description: "Due blocchi Z3 alto — recupero 5′ tra i lavori.",
        adaptationTarget: "lactate_clearance",
        phase: "build",
        tags: ["sweet_spot", "z3", "threshold"],
        plannedMinutes: 82,
        tss: 80,
        blocks: [st("Sweet 1", 18, "Z3"), rec(5), st("Sweet 2", 18, "Z3")],
      }),
    },
    {
      baseId: "w4_anaerobic_tier",
      build: (discipline) => ({
        title: `Anaerobic tier · ${discipline}`,
        description: "6×45″ Z6, recupero 5′, poi 4×30″ Z6.",
        adaptationTarget: "neuromuscular",
        phase: "build",
        tags: ["anaerobic", "tier", "z6", "hit"],
        plannedMinutes: 55,
        tss: 68,
        blocks: [iv("Tier A · 6×45″", 6, 45, 120, "Z6", "Z1"), rec(5), iv("Tier B · 4×30″", 4, 30, 90, "Z6", "Z1")],
      }),
    },
  ];

  const out: AerobicStarterPreset[] = [];
  for (const tpl of templates) {
    out.push(
      ...presetForDisciplines(tpl.baseId, ALL_DISCIPLINES, (discipline, durationScale, tssScale) => {
        const base = tpl.build(discipline);
        return {
          ...base,
          plannedMinutes: Math.max(28, Math.round(base.plannedMinutes * durationScale)),
          tss: Math.max(18, Math.round(base.tss * tssScale)),
        };
      }),
    );
  }
  return out;
}

const WAVE4_CYCLING: AerobicStarterPreset[] = [
  preset("cyc_w4_crit_3x8", "Cycling", "Crit · 3×8′ Z5", "Simulazione criterium — blocchi VO₂ lunghi.", "vo2max", "peak", ["cycling", "crit", "race", "vo2"], 72, 86, [iv("3×8′ Z5", 3, 480, 300, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_w4_ttt_progressive", "Cycling", "TTT progressive · 40′", "Rampa Z3→Z4 continua — time trial.", "lactate_tolerance", "peak", ["cycling", "tt", "time_trial", "ramp"], 68, 82, [rm("TT ramp", 40, "Z3", "Z4")], { warm: 15, cool: 12 }),
  preset("cyc_w4_vo3max_6x3", "Cycling", "vVO₂ · 6×3′", "Intervalli a vVO₂ — recupero 1:1.", "vo2max", "build", ["cycling", "vo2", "vvo2"], 62, 78, [iv("6×3′ Z5", 6, 180, 180, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_w4_climb_surge_5", "Cycling", "Climb surge · 5×(4′Z4+1′Z6)", "Salita con picco neuromuscolare.", "lactate_tolerance", "build", ["cycling", "climbing", "surges"], 78, 84, [i3("Climb surge", 5, 240, 60, 60, "Z4", "Z3", "Z6"), rec(4)], { warm: 12, cool: 10 }),
  preset("cyc_w4_endurance_neuromuscular_12", "Cycling", "Z2 + 12×20″ NM", "Endurance con tocchi neuromuscolari frequenti.", "aerobic_base", "build", ["cycling", "endurance", "neuromuscular", "z2"], 92, 68, [st("Z2", 48, "Z2"), iv("12×20″", 12, 20, 70, "Z6", "Z1"), st("Z2", 14, "Z2")], { warm: 12, cool: 10 }),
  preset("cyc_w4_billat_30_30_20", "Cycling", "Billat · 20×30″/30″", "Serie Billat estesa.", "vo2max", "build", ["cycling", "billat", "hit"], 58, 76, [iv("20×30″/30″", 20, 30, 30, "Z5", "Z1")], { warm: 12, cool: 8 }),
  preset("cyc_w4_taper_openers_5x2", "Cycling", "Taper openers · 5×2′", "Pre-gara — volume ridotto + openers.", "neuromuscular", "peak", ["cycling", "taper", "openers", "race"], 50, 46, [st("Z2", 22, "Z2"), iv("5×2′ Z5", 5, 120, 180, "Z5", "Z1")], { warm: 10, cool: 8 }),
  preset("cyc_w4_gravel_over_under_long", "Cycling", "Gravel OU long · 3×(5′Z4/3′Z3)", "Over-under gravel — blocchi lunghi.", "lactate_tolerance", "build", ["cycling", "gravel", "over-under"], 88, 86, [i3("Gravel OU", 3, 300, 180, 300, "Z4", "Z3", "Z4"), rec(8)], { warm: 12, cool: 10 }),
  preset("cyc_w4_ftp_blocks_2x20", "Cycling", "FTP · 2×20′ Z4", "Due blocchi FTP — recupero 8′.", "lactate_tolerance", "build", ["cycling", "ftp", "z4"], 85, 92, [st("FTP 1", 20, "Z4"), rec(8), st("FTP 2", 20, "Z4")], { warm: 15, cool: 12 }),
  preset("cyc_w4_z2_z5_brick", "Cycling", "Brick Z2→Z5 · 50+4×3′", "Volume poi qualità — simulazione brick.", "vo2max", "peak", ["cycling", "brick", "triathlon"], 78, 80, [st("Z2 brick", 50, "Z2"), rec(6), iv("4×3′ Z5", 4, 180, 180, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_w4_cadence_pyramid", "Cycling", "Cadence pyramid · 5 step", "Piramide cadenza/potenza su Z3.", "lactate_clearance", "build", ["cycling", "cadence", "pyramid"], 70, 72, [py("Cadence pyramid", 5, 150, Math.round(FTP * 0.75), Math.round(FTP * 0.95))], { warm: 12, cool: 10 }),
  preset("cyc_w4_recovery_spin_50", "Cycling", "Recovery spin · 50′ Z1", "Giorno recupero attivo leggero.", "recovery", "deload", ["cycling", "recovery", "deload"], 50, 26, [st("Z1 spin", 32, "Z1")], { warm: 10, cool: 8 }),
  preset("cyc_w4_race_sim_3x12", "Cycling", "Race sim · 3×12′ Z4", "Tre blocchi ritmo gara.", "lactate_tolerance", "peak", ["cycling", "race", "simulation"], 82, 88, [st("Race 1", 12, "Z4"), rec(5), st("Race 2", 12, "Z4"), rec(5), st("Race 3", 12, "Z4")], { warm: 15, cool: 12 }),
  preset("cyc_w4_hypoxic_touch_5x5", "Cycling", "Hypoxic touch · 5×5′ Z3", "Blocchi Z3 densi — simulazione ipossia.", "aerobic_base", "build", ["cycling", "hypoxic", "z3"], 72, 64, [iv("5×5′ Z3", 5, 300, 180, "Z3", "Z1", "Stimolo ipossico simulato")], { warm: 12, cool: 10 }),
  preset("cyc_w4_sprint_neuromuscular_8x12", "Cycling", "Sprint · 8×12″ max", "Accelerazioni max — recupero pieno.", "neuromuscular", "build", ["cycling", "sprint", "neuromuscular"], 48, 54, [iv("8×12″", 8, 12, 150, "Z6", "Z1")], { warm: 12, cool: 8 }),
  preset("cyc_w4_mixed_quality_day", "Cycling", "Mixed quality · threshold+VO₂", "Soglia breve poi VO₂ — giornata mista.", "vo2max", "build", ["cycling", "mixed", "threshold", "vo2"], 90, 94, [iv("4×5′ Z4", 4, 300, 120, "Z4", "Z1"), rec(10), iv("3×4′ Z5", 3, 240, 240, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_w4_endurance_pickups_6", "Cycling", "Endurance pickups · 6×90″", "Z2 con pickup Z4 incorporati.", "aerobic_base", "build", ["cycling", "endurance", "pickups", "z2"], 88, 70, [st("Z2", 42, "Z2"), iv("6×90″ pickup", 6, 90, 210, "Z4", "Z2"), st("Z2", 16, "Z2")], { warm: 12, cool: 10 }),
  preset("cyc_w4_norwegian_3x9", "Cycling", "Norwegian · 3×9′ Z4", "Blocchi soglia lunghi norvegesi.", "lactate_tolerance", "build", ["cycling", "norwegian", "z4"], 78, 86, [st("9′ Z4", 9, "Z4"), rec(4), st("9′ Z4", 9, "Z4"), rec(4), st("9′ Z4", 9, "Z4")], { warm: 12, cool: 10 }),
  preset("cyc_w4_vo2_3x7", "Cycling", "VO₂ · 3×7′ Z5", "Intervalli VO₂ medi — recupero 3′.", "vo2max", "build", ["cycling", "vo2", "intervals"], 68, 82, [iv("3×7′ Z5", 3, 420, 180, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_w4_gran_fondo_sim_140", "Cycling", "Gran fondo sim · 140′", "Uscita lunga con surge finali.", "aerobic_base", "build", ["cycling", "gran_fondo", "long", "z2"], 140, 88, [st("Z2 GF", 110, "Z2"), iv("6×2′ surge", 6, 120, 180, "Z4", "Z2"), st("Z2 home", 12, "Z2")], { warm: 15, cool: 12 }),
  preset("cyc_w4_coffee_ride_z2", "Cycling", "Coffee ride · 65′ Z2", "Uscita sociale aerobica — densità bassa.", "aerobic_base", "base", ["cycling", "z2", "social", "endurance"], 65, 42, [st("Z2 social", 45, "Z2")], { warm: 10, cool: 10 }),
  preset("cyc_w4_indoor_trainer_vo2", "Cycling", "Trainer · 4×5′ Z5", "File indoor — intervalli VO₂ puliti.", "vo2max", "build", ["cycling", "indoor", "trainer", "vo2"], 62, 76, [iv("4×5′ Z5", 4, 300, 180, "Z5", "Z1")], { warm: 12, cool: 8 }),
  preset("cyc_w4_over_gear_4x12", "Cycling", "Over gear · 4×12′ Z3", "Forza — rapporto pesante bassa cadenza.", "lactate_clearance", "build", ["cycling", "force", "low_cadence"], 82, 78, [st("OG 1", 12, "Z3"), rec(4), st("OG 2", 12, "Z3"), rec(4), st("OG 3", 12, "Z3"), rec(4), st("OG 4", 12, "Z3")], { warm: 12, cool: 10 }),
  preset("cyc_w4_race_openers_90", "Cycling", "Race openers · 90′", "Z2 + 4×3′ Z5 + Z2 — openers pre-evento.", "neuromuscular", "peak", ["cycling", "openers", "race"], 90, 72, [st("Z2", 50, "Z2"), rec(6), iv("4×3′ Z5", 4, 180, 240, "Z5", "Z1"), st("Z2 spin", 12, "Z2")], { warm: 12, cool: 10 }),
  preset("cyc_w4_tte_3x12", "Cycling", "TTE · 3×12′ Z4", "Time-to-exhaustion style — soglia sostenuta.", "lactate_tolerance", "build", ["cycling", "tte", "z4"], 80, 88, [st("TTE 1", 12, "Z4"), rec(5), st("TTE 2", 12, "Z4"), rec(5), st("TTE 3", 12, "Z4")], { warm: 12, cool: 10 }),
  preset("cyc_w4_zwift_race_prep", "Cycling", "Zwift race prep · mixed", "Warm Z2 + OU + sprint touch.", "lactate_tolerance", "peak", ["cycling", "zwift", "race", "simulation"], 75, 78, [st("Z2", 25, "Z2"), i3("OU touch", 2, 120, 60, 120, "Z4", "Z3", "Z4"), rec(5), iv("4×30″ sprint", 4, 30, 90, "Z6", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_w4_deload_quality_cut", "Cycling", "Deload quality · 2×5′ Z4", "Settimana scarico — qualità ridotta.", "recovery", "deload", ["cycling", "deload", "quality"], 55, 48, [st("Z2", 30, "Z2"), iv("2×5′ Z4", 2, 300, 180, "Z4", "Z1")], { warm: 10, cool: 8 }),
  preset("cyc_w4_emtb_burst_z2", "Cycling", "eMTB · Z2 + bursts", "Trail e-bike — Z2 con burst Z5.", "vo2max", "build", ["cycling", "emtb", "mtb", "bursts"], 85, 72, [st("Z2 trail", 50, "Z2"), iv("8×40″ burst", 8, 40, 100, "Z5", "Z2"), st("Z2", 15, "Z2")], { warm: 12, cool: 10 }),
];

const WAVE4_RUNNING: AerobicStarterPreset[] = [
  preset("run_w4_progression_6mi", "Running", "Progression · 6 mi equiv.", "Ultimi 20′ progressivi Z3→Z4.", "lactate_clearance", "build", ["running", "progression", "tempo"], 72, 68, [st("Easy", 35, "Z2"), rm("Progression", 20, "Z3", "Z4")], { warm: 12, cool: 10 }),
  preset("run_w4_800_repeats", "Running", "800 m repeats · 5×", "Ripetute 800 m — ritmo 5K/10K.", "vo2max", "build", ["running", "track", "vo2"], 58, 72, [iv("5×800 m", 5, 180, 120, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("run_w4_mile_repeats_3", "Running", "Mile repeats · 3×", "3×1600 m — soglia alta.", "lactate_tolerance", "build", ["running", "mile", "threshold"], 68, 78, [st("Mile 1", 8, "Z4"), rec(4), st("Mile 2", 8, "Z4"), rec(4), st("Mile 3", 8, "Z4")], { warm: 12, cool: 10 }),
  preset("run_w4_cutback_long", "Running", "Cutback long · 100′", "Long run con ultimi 15′ Z3.", "aerobic_base", "build", ["running", "long", "cutback"], 100, 72, [st("Z2 long", 75, "Z2"), st("Cutback Z3", 15, "Z3")], { warm: 12, cool: 12 }),
  preset("run_w4_float_recovery", "Running", "Float · 6×3′ Z4 / 2′ float", "Recupero float tra intervalli.", "lactate_tolerance", "build", ["running", "float", "threshold"], 65, 74, [iv("6×3′ float", 6, 180, 120, "Z4", "Z2")], { warm: 12, cool: 10 }),
  preset("run_w4_kenyan_fartlek", "Running", "Kenyan fartlek · 50′", "Fartlek libero strutturato in Z2.", "aerobic_base", "build", ["running", "fartlek", "kenyan"], 50, 52, [st("Z2", 20, "Z2"), iv("Fartlek surges", 8, 90, 90, "Z4", "Z2"), st("Z2", 12, "Z2")], { warm: 12, cool: 10 }),
  preset("run_w4_hill_tempo_3x6", "Running", "Hill tempo · 3×6′", "Tempo in salita — forza specifica.", "lactate_tolerance", "build", ["running", "hill", "tempo"], 62, 70, [iv("3×6′ hill", 3, 360, 180, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("run_w4_10k_pace_4x2", "Running", "10K pace · 4×2′", "Ritmo 10K — intervalli brevi densi.", "vo2max", "peak", ["running", "10k", "race"], 55, 66, [iv("4×2′ 10k", 4, 120, 120, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("run_w4_recovery_jog_40", "Running", "Recovery jog · 40′ Z1", "Recupero molto leggero.", "recovery", "deload", ["running", "recovery"], 40, 24, [st("Z1 jog", 26, "Z1")], { warm: 8, cool: 8 }),
  preset("run_w4_marathon_specific_2x8", "Running", "Marathon specific · 2×8 mi", "Due blocchi ritmo maratona (equiv).", "lactate_clearance", "peak", ["running", "marathon", "race"], 95, 82, [st("MP block 1", 32, "Z3"), rec(6), st("MP block 2", 32, "Z3")], { warm: 12, cool: 10 }),
];

const WAVE4_TRAIL: AerobicStarterPreset[] = [
  preset("trl_w4_vertical_4x5", "Trail Running", "Vertical · 4×5′ Z4", "Ripetute vertical gain — trail power.", "lactate_tolerance", "build", ["trail", "vertical", "hill", "z4"], 68, 74, [iv("4×5′ uphill", 4, 300, 180, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_w4_technical_z2_90", "Trail Running", "Technical Z2 · 90′", "Z2 su sentiero tecnico — coordinazione.", "aerobic_base", "base", ["trail", "technical", "z2"], 90, 52, [st("Technical Z2", 66, "Z2")], { warm: 12, cool: 12 }),
  preset("trl_w4_downhill_neuromuscular", "Trail Running", "Downhill NM · 8×30″", "Neuromuscolare discesa controllata.", "neuromuscular", "build", ["trail", "downhill", "neuromuscular"], 55, 58, [st("Z2 approach", 25, "Z2"), iv("8×30″ downhill", 8, 30, 90, "Z6", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_w4_sky_race_sim", "Trail Running", "Skyrace sim · tier Z3/Z4", "Simulazione skyrace — due tier.", "lactate_tolerance", "peak", ["trail", "skyrace", "race"], 85, 80, [st("Climb Z3", 25, "Z3"), rec(6), iv("4×4′ Z4", 4, 240, 120, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_w4_power_hiking", "Trail Running", "Power hiking · 5×8′ Z3", "Camminata potente in salita.", "lactate_clearance", "build", ["trail", "power_hiking", "vertical"], 75, 68, [st("Hike 1", 8, "Z3"), rec(3), st("Hike 2", 8, "Z3"), rec(3), st("Hike 3", 8, "Z3"), rec(3), st("Hike 4", 8, "Z3"), rec(3), st("Hike 5", 8, "Z3")], { warm: 12, cool: 10 }),
  preset("trl_w4_ultra_backoff", "Trail Running", "Ultra backoff · 120′ Z2", "Volume ultra trail — densità bassa.", "aerobic_base", "build", ["trail", "ultra", "long", "z2"], 120, 68, [st("Z2 trail", 92, "Z2")], { warm: 15, cool: 12 }),
  preset("trl_w4_fartlek_trail", "Trail Running", "Trail fartlek · 55′", "Fartlek su trail — variabilità terreno.", "aerobic_base", "build", ["trail", "fartlek"], 55, 54, [st("Z2", 18, "Z2"), iv("6×2′ surge", 6, 120, 120, "Z4", "Z2"), st("Z2", 12, "Z2")], { warm: 12, cool: 10 }),
  preset("trl_w4_vo2_hill_5x3", "Trail Running", "VO₂ hill · 5×3′", "VO₂ in salita — trail intervals.", "vo2max", "build", ["trail", "vo2", "hill"], 62, 72, [iv("5×3′ hill VO₂", 5, 180, 120, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_w4_race_pace_down", "Trail Running", "Race pace · 3×12′ Z3", "Ritmo gara trail — blocchi sostenuti.", "lactate_clearance", "peak", ["trail", "race", "z3"], 78, 76, [st("RP 1", 12, "Z3"), rec(5), st("RP 2", 12, "Z3"), rec(5), st("RP 3", 12, "Z3")], { warm: 12, cool: 10 }),
  preset("trl_w4_taper_trail_50", "Trail Running", "Taper trail · 50′ + openers", "Taper pre-gara trail.", "neuromuscular", "peak", ["trail", "taper", "openers"], 50, 44, [st("Z2", 32, "Z2"), iv("4×1′ Z5", 4, 60, 120, "Z5", "Z1")], { warm: 10, cool: 8 }),
];

const WAVE4_SWIMMING: AerobicStarterPreset[] = [
  preset("swm_w4_css_5x200", "Swimming", "CSS · 5×200 m", "200 m a CSS — soglia nuoto.", "lactate_tolerance", "build", ["swimming", "css", "threshold"], 52, 50, [iv("5×200 m", 5, 180, 30, "Z4", "Z1")], { warm: 10, cool: 8 }),
  preset("swm_w4_vo2_8x100", "Swimming", "VO₂ · 8×100 m", "100 m VO₂ — recupero 20″.", "vo2max", "build", ["swimming", "vo2"], 48, 52, [iv("8×100 m", 8, 90, 20, "Z5", "Z1")], { warm: 10, cool: 8 }),
  preset("swm_w4_endurance_3x500", "Swimming", "Endurance · 3×500 m", "Serie aerobiche lunghe.", "aerobic_base", "build", ["swimming", "endurance", "z2"], 65, 48, [st("500 1", 10, "Z2"), rec(2), st("500 2", 10, "Z2"), rec(2), st("500 3", 10, "Z2")], { warm: 10, cool: 8 }),
  preset("swm_w4_broken_800", "Swimming", "Broken 800 · 4×200", "800 m spezzato — ritmo gara.", "lactate_clearance", "peak", ["swimming", "broken", "race"], 50, 48, [st("200 1", 3, "Z4"), rec(1), st("200 2", 3, "Z4"), rec(1), st("200 3", 3, "Z4"), rec(1), st("200 4", 3, "Z4")], { warm: 10, cool: 8 }),
  preset("swm_w4_ladder_50_100", "Swimming", "Ladder · 50-100 m", "Scala distanze — varietà.", "vo2max", "build", ["swimming", "ladder"], 48, 46, [st("50 m", 1, "Z5"), rec(1), st("100 m", 2, "Z5"), rec(2), st("100 m", 2, "Z5"), rec(2), st("50 m", 1, "Z5")], { warm: 10, cool: 8 }),
  preset("swm_w4_kick_pull_combo", "Swimming", "Kick+pull · 6×150", "Combinato tecnica/forza.", "lactate_clearance", "build", ["swimming", "kick", "pull"], 52, 46, [iv("6×150 m", 6, 120, 30, "Z3", "Z1")], { warm: 10, cool: 8 }),
  preset("swm_w4_recovery_swim", "Swimming", "Recovery swim · 30′ Z1", "Recupero vasca leggero.", "recovery", "deload", ["swimming", "recovery"], 30, 22, [st("Easy swim", 18, "Z1")], { warm: 10, cool: 8 }),
  preset("swm_w4_open_water_buoy", "Swimming", "OW buoy turns · 40′", "Simulazione boe — surge.", "aerobic_base", "peak", ["swimming", "open_water", "race"], 48, 44, [st("OW steady", 28, "Z2"), iv("6×20″ surge", 6, 20, 60, "Z5", "Z2")], { warm: 10, cool: 8 }),
  preset("swm_w4_threshold_ladder", "Swimming", "Threshold ladder · 4-6′", "Scala soglia 4→6′.", "lactate_tolerance", "build", ["swimming", "threshold", "ladder"], 50, 52, [st("4′ Z4", 4, "Z4"), rec(2), st("5′ Z4", 5, "Z4"), rec(2), st("6′ Z4", 6, "Z4")], { warm: 10, cool: 8 }),
  preset("swm_w4_sprint_race_prep", "Swimming", "Sprint prep · 10×25 m", "Pre-gara sprint — neuromuscolare.", "neuromuscular", "peak", ["swimming", "sprint", "race"], 42, 42, [iv("10×25 m", 10, 18, 50, "Z6", "Z1")], { warm: 10, cool: 8 }),
];

const WAVE4_CANOE: AerobicStarterPreset[] = [
  preset("can_w4_sprint_intervals_10x1", "Canoe", "Sprint · 10×1′ Z5", "Intervalli sprint canoa.", "vo2max", "build", ["canoe", "sprint", "vo2"], 62, 70, [iv("10×1′ Z5", 10, 60, 90, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("can_w4_endurance_race_2h", "Canoe", "Race prep · 2×25′ Z3", "Due blocchi ritmo gara.", "lactate_clearance", "peak", ["canoe", "race", "marathon"], 88, 76, [st("Race 1", 25, "Z3"), rec(6), st("Race 2", 25, "Z3")], { warm: 12, cool: 10 }),
  preset("can_w4_technique_drills_z2", "Canoe", "Technique · Z2 drills 60′", "Tecnica in volume aerobico.", "aerobic_base", "base", ["canoe", "technique", "z2"], 60, 44, [st("Z2 paddle", 28, "Z2"), st("Drills", 12, "Z2"), st("Z2", 16, "Z2")], { warm: 12, cool: 10 }),
  preset("can_w4_power_paddle_6x3", "Canoe", "Power · 6×3′ Z4", "Potenza pagaia — recupero 2′.", "lactate_tolerance", "build", ["canoe", "power", "z4"], 68, 74, [iv("6×3′ Z4", 6, 180, 120, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("can_w4_recovery_paddle_40", "Canoe", "Recovery · 40′ Z1", "Recupero acqua piatta.", "recovery", "deload", ["canoe", "recovery"], 40, 24, [st("Z1 paddle", 24, "Z1")], { warm: 10, cool: 8 }),
  preset("can_w4_polarized_long", "Canoe", "Polarized · 80′ Z2 + tier", "Volume Z2 + tier VO₂.", "aerobic_base", "build", ["canoe", "polarized", "long"], 95, 70, [st("Z2", 70, "Z2"), rec(5), iv("4×3′ Z5", 4, 180, 120, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("can_w4_upwind_force_4x6", "Canoe", "Upwind force · 4×6′ Z3", "Controvento — forza specifica.", "lactate_clearance", "build", ["canoe", "upwind", "force"], 72, 68, [st("Upwind 1", 6, "Z3"), rec(3), st("Upwind 2", 6, "Z3"), rec(3), st("Upwind 3", 6, "Z3"), rec(3), st("Upwind 4", 6, "Z3")], { warm: 12, cool: 10 }),
  preset("can_w4_billat_extended", "Canoe", "Billat · 16×30″/30″", "Micro-interval esteso canoe.", "vo2max", "build", ["canoe", "billat", "hit"], 58, 68, [iv("16×30″/30″", 16, 30, 30, "Z5", "Z1")], { warm: 10, cool: 8 }),
];

export const WAVE4_CATALOG_PRESETS: AerobicStarterPreset[] = [
  ...buildWave4Multidiscipline(),
  ...WAVE4_CYCLING,
  ...WAVE4_RUNNING,
  ...WAVE4_TRAIL,
  ...WAVE4_SWIMMING,
  ...WAVE4_CANOE,
];
