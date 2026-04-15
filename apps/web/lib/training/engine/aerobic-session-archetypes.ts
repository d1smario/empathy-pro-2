import type { AdaptationTarget } from "@/lib/training/engine/types";

/**
 * Archetipi di sessione aerobica Pro 2: 3–4 modelli base per fase macrociclo, riutilizzabili
 * e scalati (durata / TSS) in Virya invece di rigenerare “la stessa seduta” con solo slot rotanti.
 * Nessun LLM: tabelle deterministiche + token `PRESET_*` consumati dal motore / materializzazione.
 */
export type AerobicSessionArchetype = {
  id: string;
  /** Etichetta breve in calendario / titolo seduta */
  labelIt: string;
  adaptationTarget: AdaptationTarget;
  intensityHint: string;
  objectiveDetail: string;
  /** Moltiplicatore sulla durata (min) calcolata da Virya per quella seduta. */
  durationScale: number;
  /** Moltiplicatore sul TSS target hint passato al motore. */
  tssScale: number;
};

const BASE_ARCHETYPES: AerobicSessionArchetype[] = [
  {
    id: "base_z2_volume",
    labelIt: "Volume Z2 aerobico",
    adaptationTarget: "mitochondrial_density",
    intensityHint:
      "PRESET_POLARIZED_LONG Z2 continui 55–90 min effettivi; ingresso/uscita Z1; polarized base.",
    objectiveDetail: "archetype=base_z2_volume",
    durationScale: 1.28,
    tssScale: 0.88,
  },
  {
    id: "base_z3_sweet",
    labelIt: "Z2–Z3 dolce / fondo",
    adaptationTarget: "mitochondrial_density",
    intensityHint:
      "PRESET_Z3_GLICOLITICO Z3 moderata continua 30–50 min sotto MLSS con testa Z2 iniziale e finale.",
    objectiveDetail: "archetype=base_z3_sweet",
    durationScale: 1.05,
    tssScale: 0.98,
  },
  {
    id: "base_torque_z3_neuro",
    labelIt: "Torque / SFR aerobio (Z3 corti + Z2)",
    adaptationTarget: "lactate_tolerance",
    intensityHint:
      "PRESET_ON_OFF Z3 6 min on / Z2 attivo 9 min off; sequenza tipo SFR su bici senza saltare a Z6.",
    objectiveDetail: "archetype=base_torque_sfr_style",
    durationScale: 1.0,
    tssScale: 1.02,
  },
  {
    id: "base_threshold_intro",
    labelIt: "Intro soglia corta",
    adaptationTarget: "lactate_tolerance",
    intensityHint:
      "PRESET_LADDER Z4 4–6 min con recupero attivo Z2 2–3 min; volume a soglia contenuto in base.",
    objectiveDetail: "archetype=base_threshold_intro",
    durationScale: 0.82,
    tssScale: 1.05,
  },
];

const BUILD_ARCHETYPES: AerobicSessionArchetype[] = [
  {
    id: "build_z3_glycolytic_long",
    labelIt: "Z3 glicolitica prolungata",
    adaptationTarget: "mitochondrial_density",
    intensityHint:
      "PRESET_Z3_GLICOLITICO Z3 / sotto-soglia medio-alta continuativa; stress GLUT/PFK senza picchi Z6.",
    objectiveDetail: "archetype=build_z3_glycolytic_long",
    durationScale: 1.18,
    tssScale: 1.06,
  },
  {
    id: "build_norwegian_z4",
    labelIt: "Norvegese Z4",
    adaptationTarget: "lactate_tolerance",
    intensityHint:
      "PRESET_NORWEGIAN Z4 8–12 min intervallati con recuperi brevi Z1–Z2 (rapporto lavoro:recupero ~1:0.25–0.33).",
    objectiveDetail: "archetype=build_norwegian_z4",
    durationScale: 1.05,
    tssScale: 1.12,
  },
  {
    id: "build_vo2_interval",
    labelIt: "VO2 intervallato",
    adaptationTarget: "vo2_max_support",
    intensityHint:
      "PRESET_VO2_Z5 Z5 intervallato recuperi brevi 1:1; volume centrale VO2max senza prolungare troppo la seduta.",
    objectiveDetail: "archetype=build_vo2_interval",
    durationScale: 0.72,
    tssScale: 1.18,
  },
  {
    id: "build_lactate_z6_dense",
    labelIt: "Lattato Z6 denso",
    adaptationTarget: "lactate_tolerance",
    intensityHint:
      "PRESET_LACTATE_MAX Z6 breve ripetuto; recuperi corti; densità glicolitica e buffer H+.",
    objectiveDetail: "archetype=build_lactate_z6_dense",
    durationScale: 0.62,
    tssScale: 1.22,
  },
];

const REFINE_ARCHETYPES: AerobicSessionArchetype[] = [
  {
    id: "refine_polarized_z2",
    labelIt: "Polarized Z2",
    adaptationTarget: "mitochondrial_density",
    intensityHint:
      "PRESET_POLARIZED_LONG Z2 distesi 25–45 min; Z1 tra micro-blocchi; mantenere bassa glicolisi.",
    objectiveDetail: "archetype=refine_polarized_z2",
    durationScale: 1.12,
    tssScale: 0.9,
  },
  {
    id: "refine_vo2_z5",
    labelIt: "VO2 Z5",
    adaptationTarget: "vo2_max_support",
    intensityHint:
      "PRESET_VO2_Z5 Z5 intervallato recuperi brevi 1:1–1:1.5; stimolo VO2max classico.",
    objectiveDetail: "archetype=refine_vo2_z5",
    durationScale: 0.78,
    tssScale: 1.14,
  },
  {
    id: "refine_sprint_z6_z7",
    labelIt: "Sprint neuromuscolare Z6–Z7",
    adaptationTarget: "vo2_max_support",
    intensityHint:
      "PRESET_SPRINT Z6–Z7 micro-intervalli 15–25 s con recuperi lunghi Z1–Z2; intento velocità / RFD aerobio.",
    objectiveDetail: "archetype=refine_sprint_z6_z7",
    durationScale: 0.58,
    tssScale: 1.08,
  },
  {
    id: "refine_lactate_max",
    labelIt: "Lattato massimale",
    adaptationTarget: "lactate_tolerance",
    intensityHint:
      "PRESET_LACTATE_MAX Z6 molto breve con recuperi corti; tolleranza H+ e glicolisi massimale.",
    objectiveDetail: "archetype=refine_lactate_max",
    durationScale: 0.65,
    tssScale: 1.2,
  },
];

const PEAK_ARCHETYPES: AerobicSessionArchetype[] = [
  {
    id: "peak_openers_z2",
    labelIt: "Aperture Z2 pre-gara",
    adaptationTarget: "mitochondrial_density",
    intensityHint:
      "PRESET_POLARIZED_LONG Z2 18–32 min; polarizzazione; tenere freschezza neuromuscolare.",
    objectiveDetail: "archetype=peak_openers_z2",
    durationScale: 0.95,
    tssScale: 0.82,
  },
  {
    id: "peak_vo2_z6",
    labelIt: "VO2 / Z6 qualità",
    adaptationTarget: "vo2_max_support",
    intensityHint:
      "PRESET_VO2_Z6 Z6 breve / Z5–Z6 intervallato recuperi brevi 1:1–1:1.2; qualità alta volume ridotto.",
    objectiveDetail: "archetype=peak_vo2_z6",
    durationScale: 0.68,
    tssScale: 1.16,
  },
  {
    id: "peak_sprint_touch",
    labelIt: "Touch neuromuscolare sprint",
    adaptationTarget: "vo2_max_support",
    intensityHint:
      "PRESET_SPRINT Z6–Z7 micro-serie; recuperi completi; non cumulare volume glicolitico.",
    objectiveDetail: "archetype=peak_sprint_touch",
    durationScale: 0.52,
    tssScale: 0.95,
  },
  {
    id: "peak_lactate_race_pace",
    labelIt: "Lattato gara / race pace",
    adaptationTarget: "lactate_tolerance",
    intensityHint:
      "PRESET_LADDER Z4 3–5 min con recuperi attivi brevi; simulazione ritmo gara corta.",
    objectiveDetail: "archetype=peak_lactate_race_pace",
    durationScale: 0.7,
    tssScale: 1.1,
  },
];

const DELOAD_ARCHETYPES: AerobicSessionArchetype[] = [
  {
    id: "deload_spin_z1_z2",
    labelIt: "Spin attivo Z1–Z2",
    adaptationTarget: "recovery",
    intensityHint: "Z1–Z2 dominante; respirazione guidata; nessun blocco Z4.",
    objectiveDetail: "archetype=deload_spin",
    durationScale: 0.85,
    tssScale: 0.55,
  },
  {
    id: "deload_endurance_flush",
    labelIt: "Defaticamento endurance",
    adaptationTarget: "recovery",
    intensityHint: "Z2 molto leggero continuo; eventuali tocchi Z3 brevissimi sotto 6 min totali.",
    objectiveDetail: "archetype=deload_flush",
    durationScale: 0.92,
    tssScale: 0.62,
  },
  {
    id: "deload_connective",
    labelIt: "Mobilità connettivo / pedalare",
    adaptationTarget: "recovery",
    intensityHint: "Z1 prevalente con micro-accelerazioni Z2; priorità tessuto e autonomico.",
    objectiveDetail: "archetype=deload_connective",
    durationScale: 0.78,
    tssScale: 0.5,
  },
  {
    id: "deload_active_rest",
    labelIt: "Riposo attivo",
    adaptationTarget: "recovery",
    intensityHint: "Z1 continuo; durata contenuta; nessuna densità lattacida.",
    objectiveDetail: "archetype=deload_active_rest",
    durationScale: 0.65,
    tssScale: 0.45,
  },
];

function archetypesForPhase(phase: string): AerobicSessionArchetype[] {
  if (phase === "deload") return DELOAD_ARCHETYPES;
  if (phase === "base") return BASE_ARCHETYPES;
  if (phase === "build") return BUILD_ARCHETYPES;
  if (phase === "refine") return REFINE_ARCHETYPES;
  if (phase === "peak" || phase === "second_peak") return PEAK_ARCHETYPES;
  return BASE_ARCHETYPES;
}

/** Sceglie un archetipo deterministico: slot settimanale + fase + (opz.) obiettivi chip. */
export function pickAerobicSessionArchetype(input: {
  viryaPhase: string;
  sessionIndexInWeek: number;
  sessionsInWeek: number;
  weekObjectives: readonly string[];
}): AerobicSessionArchetype {
  const has = (id: string) => input.weekObjectives.some((o) => o === id);
  const sessions = Math.max(1, input.sessionsInWeek);
  const slot = ((input.sessionIndexInWeek % sessions) + sessions) % sessions;

  if (has("recupero") || input.viryaPhase === "deload") {
    return DELOAD_ARCHETYPES[slot % DELOAD_ARCHETYPES.length];
  }

  const list = archetypesForPhase(input.viryaPhase);
  let idx = slot % list.length;

  if (has("sprint_agilita") || has("neuromotorio")) {
    const j = list.findIndex((a) => /sprint/i.test(a.id));
    if (j >= 0) idx = j;
  } else if (has("lattato") || has("anaerobico")) {
    const j = list.findIndex((a) => /lactate|norwegian|ladder|vo2_z6|vo2_z5/i.test(a.id));
    if (j >= 0) idx = j;
  } else if (has("aerobico")) {
    const j = list.findIndex((a) => /z2_volume|polarized|sweet|torque|z3/i.test(a.id));
    if (j >= 0) idx = j;
  }

  return list[idx] ?? list[0]!;
}
