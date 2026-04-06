import type {
  NutritionPathwayModulationViewModel,
  NutritionPathwaySupportItem,
  NutritionPathwaySystemLevel,
  NutritionPathwayTimingPhase,
} from "@/api/nutrition/contracts";
import type { SessionKnowledgePacket } from "@/lib/empathy/schemas/knowledge";
import type { PhysiologyState } from "@/lib/empathy/schemas/physiology";
import type { TwinState } from "@/lib/empathy/schemas/twin";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

type TwinLike = Pick<TwinState, "glycogenStatus" | "readiness" | "redoxStressIndex" | "inflammationRisk"> | null;
type PhysioLike = Pick<PhysiologyState, "metabolicProfile" | "lactateProfile" | "performanceProfile" | "recoveryProfile"> | null;

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
}

function phase(
  p: NutritionPathwayTimingPhase["phase"],
  windowLabel: string,
  halfLifeClass: NutritionPathwayTimingPhase["halfLifeClass"],
  actions: string[],
): NutritionPathwayTimingPhase {
  return { phase: p, windowLabel, halfLifeClass, actions };
}

function baseGlycogenResynthesis(stimuli: string[]): NutritionPathwaySupportItem {
  return {
    id: "glycogen_resynthesis",
    pathwayLabel: "Risintesi glicogeno / flusso glucosio peri-stimolo",
    stimulatedBy: stimuli,
    substrates: [
      "CHO ad alta disponibilità nella finestra 0–2 h post",
      "Elettroliti Na/K compatibili con assorbimento intestinale",
    ],
    cofactors: ["Magnesio (chinasi)", "Vitamine B1/B3 (utilizzo CHO)"],
    inhibitorsToAvoid: [
      "Alcol nelle prime ore post-seduta intensa",
      "Carico fibroso acuto immediatamente pre soglia alta",
    ],
    phases: [
      phase(
        "pre_acute",
        "−90 a −30 min (segnale simpatico acuto, modello qualitativo)",
        "minutes_acute",
        ["CHO moderati, fluidi con osmolalità controllata se storia GI sensibile."],
      ),
      phase("peri_workout", "Durata stimolo contrattile / AMPK", "minutes_acute", [
        "CHO intra secondo tolleranza; allineare a fueling solver.",
      ]),
      phase("early_recovery", "0–2 h post (finestra sintesi rapida)", "hours_signal", [
        "CHO + leucina; ripetizione se doppia seduta <12 h.",
      ]),
      phase("late_recovery", "2–8 h", "hours_extended", ["Pasti misti qualità; substrato prolungato."]),
    ],
    systemLevels: ["biochemical", "hormonal", "neurologic"],
    confidence: "engine_derived",
  };
}

function mitochondrialRedoxSupport(stimuli: string[]): NutritionPathwaySupportItem {
  return {
    id: "mitochondrial_redox_support",
    pathwayLabel: "Supporto ossidativo mitocondriale / equilibrio redox",
    stimulatedBy: stimuli,
    substrates: ["CHO distribuito su giornata lunga", "Grassi insaturi lontano da pre-intensa"],
    cofactors: ["Polifenoli alimentari", "Micronutrienti selenio/zinco", "Vitamina C da alimenti"],
    inhibitorsToAvoid: ["Pasto iperlipidico pre soglia", "Digiuno prolungato prima di volumi alti"],
    phases: [
      phase("daily_support", "Asse circadiano nutrizione–sonno", "circadian", [
        "Regolarità pasti; coerenza con cortisolo/melatonina e adattamento.",
      ]),
      phase("peri_workout", "Sedute >75 min", "hours_signal", [
        "CHO peri per sostenere flusso acetil-CoA senza esaurimento eccessivo.",
      ]),
    ],
    systemLevels: ["biochemical", "genetic", "hormonal"],
    confidence: "engine_derived",
  };
}

function gutAbsorptionPathway(stimuli: string[]): NutritionPathwaySupportItem {
  return {
    id: "gut_absorption_barrier",
    pathwayLabel: "Assorbimento CHO / barriera intestinale",
    stimulatedBy: stimuli,
    substrates: ["Soluzioni graduali", "Mix glucosio-fruttosio solo se tolleranza nota"],
    cofactors: ["Glutamina alimentare", "Fibre lontano dalla finestra intensa"],
    inhibitorsToAvoid: ["NSAID peri se rischio GI", "Nuovi alimenti 24 h pre evento chiave"],
    phases: [
      phase("pre_acute", "−24 a −3 h", "hours_extended", ["Dieta stabile; pattern noti."]),
      phase("peri_workout", "Seduta", "minutes_acute", ["Ridurre osmolalità per step se sintomi."]),
    ],
    systemLevels: ["biochemical", "microbiota", "neurologic"],
    confidence: "engine_derived",
  };
}

function pathwayFromSessionPacket(packet: SessionKnowledgePacket, sessionLabel: string): NutritionPathwaySupportItem | null {
  const hasContent =
    packet.physiologicalIntent.length ||
    packet.nutritionSupports.length ||
    packet.inhibitorsAndRisks.length ||
    (packet.relevantMetabolites?.length ?? 0) > 0;
  if (!hasContent) return null;

  const substrates = uniq([
    ...packet.nutritionSupports.filter((s) => /cho|carb|gluc|glyc|fuel|energy/i.test(s)),
    ...packet.relevantMetabolites.map((m) => m.label).filter(Boolean),
  ]);
  const cofactors = uniq(packet.nutritionSupports.filter((s) => /mg|b12|b1|iron|fe|coq|polifen|zinc|selen/i.test(s)));

  const levels: NutritionPathwaySystemLevel[] = ["biochemical"];
  if (packet.relevantGenes?.length) levels.push("genetic");
  if (packet.relevantMicrobiota?.length) levels.push("microbiota");

  return {
    id: `sk_${packet.packetId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 14)}`,
    pathwayLabel: `Session knowledge · ${sessionLabel}`,
    stimulatedBy: uniq([
      ...packet.physiologicalIntent,
      ...(packet.adaptationTarget ? [packet.adaptationTarget] : []),
      ...packet.primaryMechanisms,
    ]),
    substrates: substrates.length ? substrates : ["Vedi supporti nutrizionali nel packet builder."],
    cofactors: cofactors.length ? cofactors : ["Vedi cofattori elencati in knowledge / dieta."],
    inhibitorsToAvoid: uniq(packet.inhibitorsAndRisks),
    phases: [
      phase("pre_acute", "Pre-seduta (allineare al contract)", "minutes_acute", [
        "Applicare supporti e vitare inibitori elencati nel packet.",
      ]),
      phase("early_recovery", "0–4 h post", "hours_signal", [
        "Mantenere coerenza con meccanismi e rischi dichiarati nel packet.",
      ]),
    ],
    systemLevels: Array.from(new Set(levels)),
    confidence: "session_knowledge",
  };
}

export type BuildNutritionPathwayModulationInput = {
  date: string;
  plannedSessions: Array<{
    id: string;
    label: string;
    builderSession: Pro2BuilderSessionContract | null;
  }>;
  physiology: PhysioLike;
  twin: TwinLike;
};

/**
 * Nutrition as pathway amplifier: substrates, cofactors, inhibitors, timing bands
 * keyed to qualitative half-life classes. Multilevel tags structure analysis (not full PK).
 */
export function buildNutritionPathwayModulationViewModel(
  input: BuildNutritionPathwayModulationInput,
): NutritionPathwayModulationViewModel {
  const notes: string[] = [
    "Template deterministico multilivello: emivite come classi (acuta/oraria/circadiana), non concentrazioni plasmatiche individuali.",
    "Non sostituisce motori fisiologici né decisioni cliniche; integra stimolo seduta + twin + physiology + session knowledge.",
  ];

  const stimuli = uniq(
    input.plannedSessions.flatMap((s) => {
      const t = s.builderSession?.adaptationTarget;
      return t ? [String(t)] : [];
    }),
  );

  const pathways: NutritionPathwaySupportItem[] = [];

  if (input.plannedSessions.length > 0) {
    pathways.push(baseGlycogenResynthesis(stimuli.length ? stimuli : ["sessione_pianificata"]));
  }

  const redox = Math.max(
    input.physiology?.performanceProfile?.redoxStressIndex ?? 0,
    input.twin?.redoxStressIndex ?? 0,
  );
  const gutStress = (input.physiology?.lactateProfile?.gutStressScore ?? 0) * 100;
  const choDelivery = input.physiology?.lactateProfile?.bloodDeliveryPctOfIngested ?? 100;

  if (redox >= 52 || (input.twin?.inflammationRisk ?? 0) >= 55) {
    const p = mitochondrialRedoxSupport(stimuli);
    p.inhibitorsToAvoid = uniq([
      ...p.inhibitorsToAvoid,
      "Carico ossidativo cumulativo senza micronutrienti adeguati in dieta basale",
    ]);
    pathways.push(p);
  }

  if (gutStress >= 35 || choDelivery < 82) {
    pathways.push(gutAbsorptionPathway(stimuli));
  }

  const g = input.twin?.glycogenStatus;
  if (g != null && g < 42) {
    notes.push("Twin: glicogeno basso — enfatizzare timing CHO early recovery e peri.");
    const gly = pathways.find((x) => x.id === "glycogen_resynthesis");
    if (gly) {
      gly.substrates.unshift("Priorità assoluta CHO nelle finestre 0–120 min post o tra micro-sessioni.");
    }
  }

  for (const s of input.plannedSessions) {
    const ext = s.builderSession as (Pro2BuilderSessionContract & { sessionKnowledge?: SessionKnowledgePacket }) | null;
    const pkt = ext?.sessionKnowledge;
    if (!pkt) continue;
    const row = pathwayFromSessionPacket(pkt, s.label);
    if (row) pathways.push(row);
  }

  const aggregateInhibitors = uniq(pathways.flatMap((p) => p.inhibitorsToAvoid));

  const levelKeys: NutritionPathwaySystemLevel[] = ["biochemical", "genetic", "hormonal", "neurologic", "microbiota"];
  const multiLevelSummary = {} as NutritionPathwayModulationViewModel["multiLevelSummary"];
  for (const k of levelKeys) {
    multiLevelSummary[k] = uniq(pathways.filter((p) => p.systemLevels.includes(k)).map((p) => p.pathwayLabel));
  }

  return {
    modelVersion: 1,
    layer: "deterministic_pathway_template",
    sessionDate: input.date,
    pathways,
    aggregateInhibitors,
    multiLevelSummary,
    notes,
  };
}
