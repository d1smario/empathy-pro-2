/**
 * Scheletro v1 — rete metabolico-endocrina giornaliera (Empathy Pro 2).
 *
 * North star: un solo sistema ricco di interazioni (nutrizione, training, stress, sonno, lab),
 * non curve isolate. Questo file **non** sostituisce motori esistenti: dichiara archi canonic,
 * prerequisiti di osservabilità e «buchi» quando manca memoria (es. pasti → ghrelina → GH).
 * Le formule orarie concrete si ampliano qui e nei caller (`buildSimulatedGluLacDiurnal`, tile, ecc.)
 * convogliando su questa mappa invece di aprire pipeline parallele.
 */

import type { SimTimelineEventV1 } from "./sim-timeline-v1";

export const METABOLIC_ENDOCRINE_INTERACTION_CONTRACT_VERSION = 1 as const;

/** Arco direzionale educativo (non grafo DB assi fluidi). */
export type MetabolicEndocrineEdgeV1 = {
  from: string;
  to: string;
  mechanismIt: string;
  /** Cosa serve perché l’arco sia «osservabile» oltre al tile statico. */
  requires: readonly ("meal_timing" | "fasting_interval" | "training_load" | "sleep_context" | "lab_anchor")[];
};

/** Bordo minimo v1: estendibile senza rompere i consumer. */
export const METABOLIC_ENDOCRINE_INTERACTION_EDGES_V1: readonly MetabolicEndocrineEdgeV1[] = [
  {
    from: "fasting_interval",
    to: "ghrelin",
    mechanismIt: "Digiuno / intervallo inter-prandiale → drive orexigeno (proxy ghrelina).",
    requires: ["meal_timing"],
  },
  {
    from: "ghrelin",
    to: "gh_pulse",
    mechanismIt: "Ghrelina (contesto) modula pulsatile GH / asse somatotropo (non sostituisce IGF-1 da lab).",
    requires: ["meal_timing", "sleep_context"],
  },
  {
    from: "meal_timing",
    to: "insulin_demand",
    mechanismIt: "Timing + CHO/kcal → domanda insulinica operativa (già in proxy orario).",
    requires: ["meal_timing"],
  },
  {
    from: "training_load",
    to: "lactate_glucose_shift",
    mechanismIt: "Carico seduta → spostamento glucosio/lattato (sim diurna + timeline).",
    requires: ["training_load"],
  },
  {
    from: "stress_autonomic",
    to: "cortisol_acth",
    mechanismIt: "Stress kernel / pathway → modulazione diurna cortisolo–ACTH (modello nominale v1).",
    requires: [],
  },
  {
    from: "leptin_energy_balance",
    to: "ghrelin",
    mechanismIt: "Bilancio energetico (CHO giornaliero, load) incrocia appetito / ghrelina (macro-fase successiva).",
    requires: ["meal_timing", "training_load"],
  },
  {
    from: "sleep",
    to: "gh_pulse",
    mechanismIt:
      "Sonno strutturato (durata / score / HRV da export wellness) modula il contesto notturno per il proxy pulsatile GH (educativo, non polisonnografia).",
    requires: ["sleep_context"],
  },
  {
    from: "igf1_lab",
    to: "gh_pulse",
    mechanismIt:
      "IGF-1 da referto integra l’asse GH–IGF (livello medio-seriato vs GH pulsatile); non sostituisce il contesto nutrizionale.",
    requires: ["lab_anchor"],
  },
] as const;

/** Sintesi sonno passata dallo stesso conditioning giorno (wellness export); null/assente = nessun segnale. */
export type MetabolicSleepContextSnapshotV1 = {
  present: boolean;
  maxSleepHours: number | null;
};

/** Presenza GH / IGF-1 in panel biomarker (solo booleani; niente numeri inventati). */
export type MetabolicLabSomatoaxisSnapshotV1 = {
  hasGhLab: boolean;
  hasIgf1Lab: boolean;
};

export type MetabolicDayCoherenceSnapshotV1 = {
  mealEntryCount: number;
  mealWithMacroCount: number;
  executedSessionCount: number;
  plannedSessionCount: number;
  stress01: number;
  /** Stima ore tra pasti consecutivi (stesso giorno ISO); null se <2 pasti timestampati. */
  longestInterMealGapHours: number | null;
  /** Opzionale: contesto sonno da export device (stesso flusso `sleepAutonomic` del conditioning). */
  sleepContext?: MetabolicSleepContextSnapshotV1 | null;
  /** CHO giornaliero (g) da diario; per nodo leptina/energia (roadmap 2.1). */
  choIntakeGramsDay?: number | null;
  /** 0–100 da kernel domanda insulinica; accoppiamento leptina–energia (roadmap 2.1). */
  insulinDemandScore01?: number | null;
  /** Opzionale: referti GH/IGF-1 nel panel (roadmap 2.3). */
  somatoaxisLab?: MetabolicLabSomatoaxisSnapshotV1 | null;
};

function parseMealTsMs(ts: string): number | null {
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Stima massima distanza temporale tra pasti consecutivi (timeline), ore.
 * Serve come proxy debole di «finestra digiuno» senza CGM; con un solo pasto → null.
 */
export function estimateLongestInterMealGapHours(timeline: readonly SimTimelineEventV1[]): number | null {
  const tsList: number[] = [];
  for (const ev of timeline) {
    if (ev.type !== "meal") continue;
    const ms = parseMealTsMs(ev.ts);
    if (ms == null) continue;
    tsList.push(ms);
  }
  if (tsList.length < 2) return null;
  tsList.sort((a, b) => a - b);
  let maxH = 0;
  for (let i = 1; i < tsList.length; i += 1) {
    const h = (tsList[i]! - tsList[i - 1]!) / 3600000;
    if (h > maxH) maxH = h;
  }
  return Math.round(maxH * 10) / 10;
}

export type MetabolicNodeCoherenceV1 = {
  nodeId: string;
  labelIt: string;
  observability: "high" | "partial" | "blocked";
  rationaleIt: string;
};

export type MetabolicEndocrineInteractionReportV1 = {
  contractVersion: typeof METABOLIC_ENDOCRINE_INTERACTION_CONTRACT_VERSION;
  northStarIt: string;
  edges: readonly MetabolicEndocrineEdgeV1[];
  longestInterMealGapHoursEstimate: number | null;
  nodes: readonly MetabolicNodeCoherenceV1[];
};

function assessGhrelin(s: MetabolicDayCoherenceSnapshotV1): MetabolicNodeCoherenceV1 {
  if (s.mealEntryCount === 0) {
    return {
      nodeId: "ghrelin",
      labelIt: "Ghrelina (proxy)",
      observability: "blocked",
      rationaleIt:
        "Senza voci diario pasti non esiste una finestra prandiale/digiuno osservabile: non stimabile il drive ghrelina→asse GH.",
    };
  }
  if (s.mealWithMacroCount === 0 && s.mealEntryCount < 2) {
    return {
      nodeId: "ghrelin",
      labelIt: "Ghrelina (proxy)",
      observability: "partial",
      rationaleIt:
        "Timing pasti presente ma macro scarsi o un solo evento: ghrelina operativa solo in lettura debole; catena verso GH limitata.",
    };
  }
  if (s.longestInterMealGapHours != null && s.longestInterMealGapHours >= 5) {
    return {
      nodeId: "ghrelin",
      labelIt: "Ghrelina (proxy)",
      observability: "high",
      rationaleIt: `Intervallo inter-prandiale stimato fino a ~${s.longestInterMealGapHours} h: leva digiuno/prandio utilizzabile come contesto per modulazioni successive.`,
    };
  }
  return {
    nodeId: "ghrelin",
    labelIt: "Ghrelina (proxy)",
    observability: "partial",
    rationaleIt:
      "Diario sufficiente per timing; intervalli digiuno medi: rafforzare con più pasti timestampati o macro.",
  };
}

/** Raffina osservabilità/rationale GH quando in panel ci sono GH e/o IGF-1 (roadmap 2.3). */
function applySomatoaxisLabToGhNode(
  gh: MetabolicNodeCoherenceV1,
  s: MetabolicDayCoherenceSnapshotV1,
): MetabolicNodeCoherenceV1 {
  const lab = s.somatoaxisLab;
  if (!lab?.hasGhLab && !lab?.hasIgf1Lab) return gh;
  if (gh.observability === "blocked") {
    return {
      ...gh,
      observability: "partial",
      rationaleIt:
        lab.hasGhLab && lab.hasIgf1Lab
          ? "GH e IGF-1 in panel: asse somatotropo ancorato al referto; ghrelina da diario arricchisce ancora la dinamica prandiale."
          : lab.hasIgf1Lab
            ? "IGF-1 in panel: ancoraggio lab dell’asse somatotropo (GH pulsatile + contesto da diario/sonno)."
            : "GH in panel: lettura lab disponibile; proxy nutrizionale–sonno restano utili per il contesto operativo.",
    };
  }
  if (lab.hasIgf1Lab && gh.observability === "partial") {
    return {
      ...gh,
      rationaleIt: `${gh.rationaleIt} IGF-1 da referto affianca GH (asse integrato, non numeri simulati).`,
    };
  }
  if (lab.hasIgf1Lab && gh.observability === "high") {
    return {
      ...gh,
      rationaleIt: `${gh.rationaleIt} IGF-1 da referto consolida l’asse GH–IGF.`,
    };
  }
  if (lab.hasGhLab && !lab.hasIgf1Lab && gh.observability === "high") {
    return {
      ...gh,
      rationaleIt: `${gh.rationaleIt} GH da lab coerente con il contesto dinamico giornaliero.`,
    };
  }
  return gh;
}

function assessGh(ghrelin: MetabolicNodeCoherenceV1, s: MetabolicDayCoherenceSnapshotV1): MetabolicNodeCoherenceV1 {
  if (ghrelin.observability === "blocked") {
    return {
      nodeId: "gh_pulse",
      labelIt: "GH (pulsatile / contesto)",
      observability: "blocked",
      rationaleIt:
        "Asse GH richiede proxy ghrelina/sleep o lab; ghrelina bloccata per memoria nutrizionale → punto di indagine escluso finché non si arricchisce il diario.",
    };
  }
  if (ghrelin.observability === "partial") {
    if (s.sleepContext?.present) {
      return {
        nodeId: "gh_pulse",
        labelIt: "GH (pulsatile / contesto)",
        observability: "partial",
        rationaleIt:
          "Ghrelina solo parzialmente osservabile; sonno/HRV da export aggiunge contesto notturno al proxy GH (lab GH/IGF-1 utili per chiudere).",
      };
    }
    return {
      nodeId: "gh_pulse",
      labelIt: "GH (pulsatile / contesto)",
      observability: "partial",
      rationaleIt:
        "Ghrelina solo parzialmente osservabile: GH resta tile/lab o modello macro; collegamento dinamico da ampliare (sonno, seri notturni).",
    };
  }
  if (s.sleepContext?.present) {
    const hoursBit =
      s.sleepContext.maxSleepHours != null
        ? ` Sonno fino a ~${Math.round(s.sleepContext.maxSleepHours * 10) / 10} h da export.`
        : " Segnale sonno/HRV da export.";
    return {
      nodeId: "gh_pulse",
      labelIt: "GH (pulsatile / contesto)",
      observability: "high",
      rationaleIt: `Contesto prandiale/digiuno più ricco;${hoursBit} Asse GH in lettura rafforzata (proxy operativo; GH/IGF-1 da lab chiudono il cerchio).`,
    };
  }
  return {
    nodeId: "gh_pulse",
    labelIt: "GH (pulsatile / contesto)",
    observability: "partial",
    rationaleIt:
      "Contesto pasti/digiuno migliore: prossimo ampliamento = sonno strutturato + eventuali marker lab GH/IGF-1 per chiudere il cerchio.",
  };
}

/**
 * Leptina / bilancio energetico (proxy v1): CHO giornaliero + carico insulinico kernel + training (roadmap 2.1).
 * Soglie deterministiche — rivedere con golden se si cambiano coefficienti.
 */
function assessLeptinEnergy(s: MetabolicDayCoherenceSnapshotV1): MetabolicNodeCoherenceV1 {
  const cho = s.choIntakeGramsDay;
  const hasCho = cho != null && cho > 0;
  const ins = s.insulinDemandScore01;
  const training = s.executedSessionCount + s.plannedSessionCount > 0;
  const CHO_HIGH = 280;
  const CHO_MED = 130;
  const INS_HIGH = 58;

  if (!hasCho && s.mealEntryCount === 0) {
    return {
      nodeId: "leptin_energy_balance",
      labelIt: "Leptina / energia (proxy)",
      observability: "blocked",
      rationaleIt:
        "Senza diario pasti né CHO giornaliero stimabile: nessun segnale energetico strutturato per incrociare leptina/adiposità proxy.",
    };
  }
  if (!hasCho && s.mealEntryCount > 0) {
    return {
      nodeId: "leptin_energy_balance",
      labelIt: "Leptina / energia (proxy)",
      observability: "partial",
      rationaleIt:
        "Pasti loggati ma CHO aggregato debole: leptina operativa solo in lettura debole rispetto a carico glucidico.",
    };
  }
  const choN = cho ?? 0;
  const insN = ins != null && Number.isFinite(ins) ? ins : 50;
  if (choN >= CHO_HIGH || (choN >= CHO_MED && training) || (choN >= 95 && insN >= INS_HIGH)) {
    return {
      nodeId: "leptin_energy_balance",
      labelIt: "Leptina / energia (proxy)",
      observability: "high",
      rationaleIt:
        "CHO giornaliero e/o domanda insulinica kernel elevati con contesto training: segnale energetico utilizzabile per incrocio con ghrelina (macro-fase).",
    };
  }
  if (choN >= 85 || training || insN >= 52) {
    return {
      nodeId: "leptin_energy_balance",
      labelIt: "Leptina / energia (proxy)",
      observability: "partial",
      rationaleIt:
        "Energia giornaliera moderata (CHO + load): utile come contesto; rafforzare con macro coerenti o adiposità proxy da BIA quando disponibile.",
    };
  }
  return {
    nodeId: "leptin_energy_balance",
    labelIt: "Leptina / energia (proxy)",
    observability: "partial",
    rationaleIt:
      "CHO giornaliero basso e poca leva training/insulinica: incrocio leptina–ghrelina limitato finché non si arricchisce il diario.",
  };
}

function assessSleep(s: MetabolicDayCoherenceSnapshotV1): MetabolicNodeCoherenceV1 {
  const sc = s.sleepContext;
  if (!sc?.present) {
    return {
      nodeId: "sleep",
      labelIt: "Sonno (wellness / device)",
      observability: "blocked",
      rationaleIt:
        "Nessun segnale sonno strutturato (ore, score, HRV) dagli export device per la data: arco sonno→GH resta non ancorato.",
    };
  }
  if (sc.maxSleepHours != null && sc.maxSleepHours >= 7.5) {
    const h = Math.round(sc.maxSleepHours * 10) / 10;
    return {
      nodeId: "sleep",
      labelIt: "Sonno (wellness / device)",
      observability: "high",
      rationaleIt: `Durata sonno fino a ~${h} h da export: contesto notturno utilizzabile come modulatore proxy GH.`,
    };
  }
  if (sc.maxSleepHours != null && sc.maxSleepHours >= 5) {
    const h = Math.round(sc.maxSleepHours * 10) / 10;
    return {
      nodeId: "sleep",
      labelIt: "Sonno (wellness / device)",
      observability: "partial",
      rationaleIt: `Sonno ~${h} h o segmentato: supporto contestuale moderato per asse GH (non «chiusura» fisiologica).`,
    };
  }
  return {
    nodeId: "sleep",
    labelIt: "Sonno (wellness / device)",
    observability: "partial",
    rationaleIt: "Score sonno o HRV da device senza durata affidabile: contesto notturno debole ma non nullo.",
  };
}

function assessInsulin(s: MetabolicDayCoherenceSnapshotV1): MetabolicNodeCoherenceV1 {
  if (s.mealWithMacroCount === 0) {
    return {
      nodeId: "insulin_demand",
      labelIt: "Domanda insulinica (proxy)",
      observability: s.mealEntryCount > 0 ? "partial" : "blocked",
      rationaleIt:
        s.mealEntryCount > 0
          ? "Pasti senza macro utili: proxy insulinico attenuato rispetto a CHO/kcal strutturati."
          : "Nessun pasto: proxy insulinico degenera su kernel solo — perdita incrocio nutrizione.",
    };
  }
  return {
    nodeId: "insulin_demand",
    labelIt: "Domanda insulinica (proxy)",
    observability: "high",
    rationaleIt: "Macro pasti presenti: incrocio nutrizione–metabolismo operativo (coerente con serie orarie).",
  };
}

function assessTrainingCoupling(s: MetabolicDayCoherenceSnapshotV1): MetabolicNodeCoherenceV1 {
  if (s.executedSessionCount === 0 && s.plannedSessionCount === 0) {
    return {
      nodeId: "lactate_glucose_shift",
      labelIt: "Spostamento glucosio / lattato (training)",
      observability: "partial",
      rationaleIt:
        "Nessuna seduta in timeline per la data: sim diurna senza leva allenamento; carico globale giorno preso solo da kernel aggregato.",
    };
  }
  return {
    nodeId: "lactate_glucose_shift",
    labelIt: "Spostamento glucosio / lattato (training)",
    observability: "high",
    rationaleIt: "Sedute pianificate/eseguite in timeline: finestre attività modulano glucosio/lattato (sim v1).",
  };
}

function assessStressCortisol(s: MetabolicDayCoherenceSnapshotV1): MetabolicNodeCoherenceV1 {
  const hi = s.stress01 >= 0.55;
  return {
    nodeId: "cortisol_acth",
    labelIt: "Cortisolo / ACTH (modello giorno)",
    observability: "high",
    rationaleIt: hi
      ? "Stress kernel elevato: diurna nominale modulata (pathway); resta modello, non campionamento seriato."
      : "Stress kernel moderato: diurna cortisolo–ACTH come contesto fisiologico operativo.",
  };
}

/**
 * Report unico da allegare alla VM giornaliera: grafo + stato osservabilità nodi chiave.
 * I motori numerici esistenti **consumano** lo stesso snapshot nel tempo; questo è il canone dichiarativo.
 */
export function buildMetabolicEndocrineInteractionReportV1(
  snapshot: MetabolicDayCoherenceSnapshotV1,
): MetabolicEndocrineInteractionReportV1 {
  const sleepNode = assessSleep(snapshot);
  const leptin = assessLeptinEnergy(snapshot);
  const ghrelin = assessGhrelin(snapshot);
  const gh = applySomatoaxisLabToGhNode(assessGh(ghrelin, snapshot), snapshot);
  const insulin = assessInsulin(snapshot);
  const lacG = assessTrainingCoupling(snapshot);
  const cort = assessStressCortisol(snapshot);

  return {
    contractVersion: METABOLIC_ENDOCRINE_INTERACTION_CONTRACT_VERSION,
    northStarIt:
      "Una sola rete: nutrizione (timing, macro, digiuno), energia/leptina (proxy), training, stress, sonno (wellness) e lab convergono sugli stessi nodi; assenza di memoria in un ramo esclude indagini a valle finché non si arricchisce il contesto.",
    edges: METABOLIC_ENDOCRINE_INTERACTION_EDGES_V1,
    longestInterMealGapHoursEstimate: snapshot.longestInterMealGapHours,
    nodes: [sleepNode, leptin, ghrelin, gh, insulin, lacG, cort],
  };
}
