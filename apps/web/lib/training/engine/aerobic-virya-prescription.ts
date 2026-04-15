import type { AdaptationTarget } from "@/lib/training/engine/types";

/**
 * Prescrizioni deterministiche Virya (solo endurance): accoppiano fase macrociclo
 * a stimoli metabolici operativi (Z3 prolungata, schema norvegese Z4, polarized Z2 20–40',
 * VO2max / Z6 / lattato) senza LLM. I token `PRESET_*` in `intensityHint` guidano
 * `mapEngineSessionToTrainingBlocks` per work:rest e ripetute.
 */
export type ViryaMacroPhaseForAerobicPrescription =
  | "base"
  | "build"
  | "refine"
  | "peak"
  | "deload"
  | "second_peak";

export type AerobicViryaPrescription = {
  adaptationTarget: AdaptationTarget;
  intensityHint: string;
  objectiveDetail: string;
};

function goalOverrides(goalSummary: string): AerobicViryaPrescription | null {
  const g = goalSummary.toLowerCase();
  if (g.includes("recovery") || g.includes("recuper")) {
    return {
      adaptationTarget: "recovery",
      intensityHint: "Z1–Z2 attivo; volume basso; priorità autonomico e tessuto.",
      objectiveDetail: "override_goal=recovery",
    };
  }
  if (/\bvo2\b|vo2max|z5|z6/i.test(g)) {
    return {
      adaptationTarget: "vo2_max_support",
      intensityHint:
        "PRESET_VO2_Z5 Z5–Z6 intervallato recuperi brevi 1:1–1:1.5; stimolo VO2max e glicolisi rapida (da obiettivo piano).",
      objectiveDetail: "override_goal=vo2",
    };
  }
  if (/\blactat|lattat|\bsoglia\b|threshold/i.test(g)) {
    return {
      adaptationTarget: "lactate_tolerance",
      intensityHint:
        "PRESET_NORWEGIAN Z4 8–12 min con recuperi brevi Z1–Z2 (da obiettivo piano soglia / lattato).",
      objectiveDetail: "override_goal=threshold",
    };
  }
  return null;
}

function hasWeekFocus(objectives: readonly string[], id: string): boolean {
  return objectives.some((o) => o === id);
}

/**
 * Ruota sedute nella settimana (`sessionIndexInWeek`) e integra obiettivi focali (chip passo 5).
 */
export function resolveAerobicViryaPrescription(input: {
  viryaPhase: ViryaMacroPhaseForAerobicPrescription;
  goalSummary: string;
  weekObjectives: readonly string[];
  sessionIndexInWeek: number;
  sessionsInWeek: number;
}): AerobicViryaPrescription {
  const override = goalOverrides(input.goalSummary);
  if (override) return override;

  const { viryaPhase, weekObjectives } = input;
  const sessions = Math.max(1, input.sessionsInWeek);
  const slot = ((input.sessionIndexInWeek % sessions) + sessions) % sessions;
  const mod3 = slot % 3;

  if (hasWeekFocus(weekObjectives, "recupero") || viryaPhase === "deload") {
    return {
      adaptationTarget: "recovery",
      intensityHint: "Deload / recupero: Z1–Z2 dominante, neuromuscolare leggero, niente stress glicolitico.",
      objectiveDetail: "macro=recovery_week",
    };
  }

  const pushLactate =
    hasWeekFocus(weekObjectives, "lattato") ||
    hasWeekFocus(weekObjectives, "anaerobico") ||
    hasWeekFocus(weekObjectives, "sprint_agilita");
  const pushAerobic = hasWeekFocus(weekObjectives, "aerobico");

  /** Costruzione: volumi intensi — Z3 continuativa (stress GLUT/PFK), norvegese Z4, densità on-off. */
  if (viryaPhase === "build") {
    if (pushAerobic && mod3 === 0) {
      return {
        adaptationTarget: "mitochondrial_density",
        intensityHint:
          "PRESET_POLARIZED_LONG Z2 distesi 50–80% seduta; ingresso/uscita Z1; supporto volume aerobico in blocco costruzione.",
        objectiveDetail: "costruzione_chip=aerobico_volume",
      };
    }
    if (mod3 === 0) {
      return {
        adaptationTarget: "mitochondrial_density",
        intensityHint:
          "PRESET_Z3_GLICOLITICO Z3 / sotto-soglia medio-alta continuativa progressiva (stress enzimatico via glicolitica aerobia; PFK/GLUT); evitare picchi Z5 in questo slot.",
        objectiveDetail: "costruzione_slot=z3_sostenuta",
      };
    }
    if (mod3 === 1 || pushLactate) {
      return {
        adaptationTarget: "lactate_tolerance",
        intensityHint:
          "PRESET_NORWEGIAN Z4 8–12 min intervallati con recuperi brevi Z1–Z2 (rapporto lavoro:recupero ~1:0.25–0.33); schema norvegese / double threshold per grande volume a soglia.",
        objectiveDetail: "costruzione_slot=norvegese_z4",
      };
    }
    return {
      adaptationTarget: "lactate_tolerance",
      intensityHint:
        "PRESET_LADDER Z4 5 min + recupero attivo Z2 2–3 min, ripetuto; densità glicolitica alta (scala soglia / volume intenso).",
      objectiveDetail: "costruzione_slot=ladder_z4",
    };
  }

  if (viryaPhase === "base") {
    if (pushLactate && slot === sessions - 1) {
      return {
        adaptationTarget: "lactate_tolerance",
        intensityHint:
          "PRESET_NORWEGIAN Z4 moderata 6–10 min; recuperi brevi; un solo tocco glicolitico in settimana base.",
        objectiveDetail: "base_tocco_soglia",
      };
    }
    if (mod3 === 0) {
      return {
        adaptationTarget: "mitochondrial_density",
        intensityHint:
          "PRESET_POLARIZED_LONG Z2 continui predominanti 45–75 min (polarized base); Z1 micro-segmenti ingresso/uscita.",
        objectiveDetail: "base_slot=z2_volume",
      };
    }
    if (mod3 === 1) {
      return {
        adaptationTarget: "mitochondrial_density",
        intensityHint:
          "PRESET_Z3_GLICOLITICO Z3 moderata continua 25–40 min sotto MLSS; progressione dolce verso costruzione.",
        objectiveDetail: "base_slot=z3_moderata",
      };
    }
    return {
      adaptationTarget: "lactate_tolerance",
      intensityHint:
        "PRESET_LADDER Z4 4–5 min con recupero attivo Z2 2 min; introduzione a volume a soglia senza Z6.",
      objectiveDetail: "base_slot=ladder_lieve",
    };
  }

  /** Rifinitura / picco: polarized Z2 20–40' + VO2max (Z5–Z6) + lattato massimo. */
  if (viryaPhase === "refine" || viryaPhase === "peak" || viryaPhase === "second_peak") {
    const peakish = viryaPhase === "peak" || viryaPhase === "second_peak";
    if (pushAerobic && mod3 === 2 && !peakish) {
      return {
        adaptationTarget: "mitochondrial_density",
        intensityHint:
          "PRESET_POLARIZED_LONG Z2 20–40 min distesi (rifinitura polarizzata); mantenere bassa glicolisi in questo slot.",
        objectiveDetail: "rifinitura_chip=aerobico",
      };
    }
    if (mod3 === 0) {
      return {
        adaptationTarget: "mitochondrial_density",
        intensityHint: peakish
          ? "PRESET_POLARIZED_LONG Z2 20–35 min; polarizzazione pre-gara; Z1 tra micro-blocchi."
          : "PRESET_POLARIZED_LONG Z2 distesi 20–40 min (polarized); recuperi Z1 attivi tra blocchi.",
        objectiveDetail: peakish ? "picco_slot=polarized_z2" : "rifinitura_slot=polarized_z2",
      };
    }
    if (mod3 === 1) {
      return {
        adaptationTarget: "vo2_max_support",
        intensityHint: peakish
          ? "PRESET_VO2_Z6 Z6 breve / Z5–Z6 intervallato con recuperi brevi 1:1–1:1.2; VO2max + glicolisi e picco ventilatorio."
          : "PRESET_VO2_Z5 Z5–Z6 intervallato recuperi brevi 1:1–1:1.5; stimolo VO2max con componente glicolitica.",
        objectiveDetail: peakish ? "picco_slot=vo2_z6" : "rifinitura_slot=vo2_z5_z6",
      };
    }
    return {
      adaptationTarget: "lactate_tolerance",
      intensityHint: peakish
        ? "PRESET_LACTATE_MAX Z6 molto breve con recuperi corti; tolleranza H+ e glicolisi massimale (volume ridotto, qualità alta)."
        : "PRESET_LACTATE_MAX Z6 breve / lattato alto; recuperi brevi; accoppiare a seduta polarized nella stessa settimana.",
      objectiveDetail: peakish ? "picco_slot=lattato_max" : "rifinitura_slot=lattato_max",
    };
  }

  return {
    adaptationTarget: "mitochondrial_density",
    intensityHint: "Z2–Z3 periodizzazione aerobia di supporto.",
    objectiveDetail: "fallback=aerobic_default",
  };
}
