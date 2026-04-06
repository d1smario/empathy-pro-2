import type {
  SessionAnalysisFacetCategory,
  SessionAnalysisFacetSource,
  SessionAnalysisFacetViewModel,
  SessionMultilevelAnalysisStripViewModel,
  SessionMultilevelStripSlotViewModel,
} from "@/api/training/contracts";
import type { SessionKnowledgePacket } from "@/lib/empathy/schemas/knowledge";
import type { AdaptationTarget } from "@/lib/training/engine/types";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

/** Contratto builder Pro 2 con campi opzionali V1-compat (knowledge / struttura) se presenti nel JSON. */
export type Pro2SessionMultilevelSource = Pro2BuilderSessionContract & {
  sessionKnowledge?: SessionKnowledgePacket | null;
  structure?: {
    descriptor?: string;
    objective?: string;
    methodology?: string;
  };
};

const CATEGORY_LABELS: Record<SessionAnalysisFacetCategory, string> = {
  bioenergetics: "Bioenergetica · ossidazione",
  oxygen_hypoxia: "Ossigeno · HIF / ipossia funzionale",
  glycolysis: "Glicolisi · glucosio · lattato",
  muscle_cellular: "Muscolo · ambiente · tensione",
  neuro_adrenergic: "Neuro · catecolamine · drive",
  endocrine_stress: "Endocrino · stress · HPA",
  endocrine_growth: "Endocrino · crescita · IGF / GH",
  repair_anabolic: "Riparazione · anabolismo · mTOR (timing)",
  genetic_regulation: "Genetica · regolazione (contesto)",
  microbiota_gut: "Microbiota · intestino · fibre / SCFA",
};

const CATEGORY_ORDER: SessionAnalysisFacetCategory[] = [
  "bioenergetics",
  "oxygen_hypoxia",
  "glycolysis",
  "muscle_cellular",
  "neuro_adrenergic",
  "endocrine_stress",
  "endocrine_growth",
  "repair_anabolic",
  "genetic_regulation",
  "microbiota_gut",
];

const STRIP_SHORT_LABEL: Record<SessionAnalysisFacetCategory, string> = {
  bioenergetics: "Bioenergetica",
  oxygen_hypoxia: "O₂ · HIF",
  glycolysis: "Glicolisi",
  muscle_cellular: "Muscolo",
  neuro_adrenergic: "Neuro · CA",
  endocrine_stress: "Stress · HPA",
  endocrine_growth: "Crescita · IGF",
  repair_anabolic: "Riparo · mTOR",
  genetic_regulation: "Genetica",
  microbiota_gut: "Microbiota",
};

const SOURCE_RANK: Record<SessionAnalysisFacetSource, number> = {
  session_knowledge: 0,
  session_structure: 1,
  session_family: 2,
  adaptation_target: 3,
  load_proxy: 4,
};

const ALL_ADAPTATION_TARGETS: readonly AdaptationTarget[] = [
  "mitochondrial_density",
  "vo2_max_support",
  "lactate_tolerance",
  "lactate_clearance",
  "max_strength",
  "hypertrophy_mixed",
  "hypertrophy_myofibrillar",
  "hypertrophy_sarcoplasmic",
  "neuromuscular_adaptation",
  "power_output",
  "movement_quality",
  "mobility_capacity",
  "skill_transfer",
  "recovery",
] as const;

function buildStripSlotsFromFacets(sortedFacets: SessionAnalysisFacetViewModel[]): SessionMultilevelStripSlotViewModel[] {
  const byCat = new Map<SessionAnalysisFacetCategory, SessionAnalysisFacetViewModel[]>();
  for (const f of sortedFacets) {
    const prev = byCat.get(f.category) ?? [];
    prev.push(f);
    byCat.set(f.category, prev);
  }

  return CATEGORY_ORDER.map((cat) => {
    const list = byCat.get(cat);
    if (!list?.length) {
      return {
        category: cat,
        shortLabelIt: STRIP_SHORT_LABEL[cat],
        valueLineIt: "—",
        detailHintIt: "Nessun segnale strutturato per questo settore su questa sessione.",
        facetId: `empty_${cat}`,
      };
    }
    const best = [...list].sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source])[0]!;
    return {
      category: cat,
      shortLabelIt: STRIP_SHORT_LABEL[cat],
      valueLineIt: best.pillLabelIt,
      detailHintIt: best.hintIt,
      facetId: best.id,
    };
  });
}

function isAdaptationTarget(s: string): s is AdaptationTarget {
  return (ALL_ADAPTATION_TARGETS as readonly string[]).includes(s);
}

function pushFacet(
  out: SessionAnalysisFacetViewModel[],
  input: {
    id: string;
    category: SessionAnalysisFacetCategory;
    pillLabelIt: string;
    hintIt: string;
    source: SessionAnalysisFacetSource;
  },
): void {
  if (out.some((f) => f.id === input.id)) return;
  out.push({
    ...input,
    categoryLabelIt: CATEGORY_LABELS[input.category],
  });
}

function knowledgeBlob(contract: Pro2SessionMultilevelSource): string {
  const sk = contract.sessionKnowledge;
  const parts: string[] = [];
  if (sk) {
    parts.push(
      ...sk.physiologicalIntent,
      ...sk.primaryMechanisms,
      ...sk.nutritionSupports,
      ...sk.inhibitorsAndRisks,
      ...(sk.relevantPathways?.map((p) => p.label) ?? []),
      ...(sk.relevantGenes?.map((g) => g.label) ?? []),
      ...(sk.relevantMetabolites?.map((m) => m.label) ?? []),
      ...(sk.relevantMicrobiota?.map((m) => m.label) ?? []),
    );
  }
  if (contract.structure?.objective) parts.push(contract.structure.objective);
  if (contract.structure?.methodology) parts.push(contract.structure.methodology);
  if (contract.structure?.descriptor) parts.push(contract.structure.descriptor);
  return parts.join(" ").toLowerCase();
}

function facetsFromAdaptationTarget(target: AdaptationTarget): Array<Omit<SessionAnalysisFacetViewModel, "categoryLabelIt">> {
  const out: Array<Omit<SessionAnalysisFacetViewModel, "categoryLabelIt">> = [];
  switch (target) {
    case "vo2_max_support":
      out.push({
        id: "at_vo2_bio",
        category: "bioenergetics",
        pillLabelIt: "VO2 · capacità aerobica",
        hintIt: "Stimolo orientato a massa/tempo sopra soglie aerobiche: economia O2 e integrazione cardiaca–muscolare.",
        source: "adaptation_target",
      });
      out.push({
        id: "at_vo2_hypox",
        category: "oxygen_hypoxia",
        pillLabelIt: "Ipossia funzionale muscolare",
        hintIt: "Durante blocchi intensi: gradiente O2 muscolo ↔ mitocondri; asse HIF come contesto adattivo (non misura invasiva).",
        source: "adaptation_target",
      });
      out.push({
        id: "at_vo2_gly",
        category: "glycolysis",
        pillLabelIt: "Glicolisi di supporto",
        hintIt: "A intervalli o progressioni: glucosio rapido e lattato come shuttle energetico accanto all’ossidazione.",
        source: "adaptation_target",
      });
      break;
    case "mitochondrial_density":
      out.push({
        id: "at_mito_bio",
        category: "bioenergetics",
        pillLabelIt: "Mitocondri · densità / efficienza",
        hintIt: "Segnali PGC-1α / biogenesi (contesto allenamento); integrazione con recupero e disponibilità substrato.",
        source: "adaptation_target",
      });
      out.push({
        id: "at_mito_hyp",
        category: "oxygen_hypoxia",
        pillLabelIt: "Stress redox · O2",
        hintIt: "Ripetute ondate ipossiche transitorie come trigger comuni in protocolli aerobici strutturati.",
        source: "adaptation_target",
      });
      break;
    case "lactate_tolerance":
      out.push({
        id: "at_lt_gly",
        category: "glycolysis",
        pillLabelIt: "Glicolisi · acido lattato",
        hintIt: "Produzione H+ e lactate intramuscolo; tolleranza a carico metabolico acuto.",
        source: "adaptation_target",
      });
      out.push({
        id: "at_lt_muscle",
        category: "muscle_cellular",
        pillLabelIt: "Buffer · microambiente",
        hintIt: "Capacità tampone e trasportatori (es. MCT) come asse cellulare (contesto, non lab).",
        source: "adaptation_target",
      });
      break;
    case "lactate_clearance":
      out.push({
        id: "at_lc_gly",
        category: "glycolysis",
        pillLabelIt: "Clearance lattato",
        hintIt: "Riossidazione / gluconeogenesi periferica; accoppiamento con lavoro sotto soglia e recupero attivo.",
        source: "adaptation_target",
      });
      out.push({
        id: "at_lc_bio",
        category: "bioenergetics",
        pillLabelIt: "Mitocondri · ossidazione",
        hintIt: "Utilizzo lattato come substrato in fibre ossidative e cuore (contesto fisiologico).",
        source: "adaptation_target",
      });
      break;
    case "max_strength":
    case "hypertrophy_mixed":
    case "hypertrophy_myofibrillar":
    case "hypertrophy_sarcoplasmic":
      out.push({
        id: "at_ms_mech",
        category: "muscle_cellular",
        pillLabelIt: "Stress meccanico / ipertrofia",
        hintIt: "Tensione muscolo–tendinea; segnali meccanotrasduzione e stress metabolico (contesto forza-massa).",
        source: "adaptation_target",
      });
      out.push({
        id: "at_ms_neuro",
        category: "neuro_adrenergic",
        pillLabelIt: "Drive neuromuscolare",
        hintIt: "Reclutamento unità motorie; simpatico acuto su serie intense.",
        source: "adaptation_target",
      });
      out.push({
        id: "at_ms_mtor",
        category: "repair_anabolic",
        pillLabelIt: "Segnale anabolico (timing)",
        hintIt: "mTOR / sintesi proteica sensibile al post-carico con aminoacidi ed energia adeguata.",
        source: "adaptation_target",
      });
      break;
    case "neuromuscular_adaptation":
      out.push({
        id: "at_neuro_nm",
        category: "neuro_adrenergic",
        pillLabelIt: "RFD · innervazione",
        hintIt: "Intento velocità e reclutamento; non priorità volume ipertrofico massimo.",
        source: "adaptation_target",
      });
      out.push({
        id: "at_neuro_muscle",
        category: "muscle_cellular",
        pillLabelIt: "Accoppiamento eccitazione–contrazione",
        hintIt: "Qualità contrattile e coordinazione sotto carico moderato-alto.",
        source: "adaptation_target",
      });
      break;
    case "power_output":
      out.push({
        id: "at_po_neuro",
        category: "neuro_adrenergic",
        pillLabelIt: "Catecolamine · output",
        hintIt: "Sprint e salti: picco simpatico e coordinazione.",
        source: "adaptation_target",
      });
      out.push({
        id: "at_po_muscle",
        category: "muscle_cellular",
        pillLabelIt: "PCr · velocità di accoppiamento",
        hintIt: "Sistemi anaerobici alattacidici e glicolitici rapidi.",
        source: "adaptation_target",
      });
      break;
    case "recovery":
      out.push({
        id: "at_rec_rep",
        category: "repair_anabolic",
        pillLabelIt: "Riparazione prioritaria",
        hintIt: "Bassa densità di segnale catabolico; focus sonno, energia, micronutrienti.",
        source: "adaptation_target",
      });
      out.push({
        id: "at_rec_hpa",
        category: "endocrine_stress",
        pillLabelIt: "Ridurre allostasi",
        hintIt: "Attenuare cortisolo cronico da sovrallenamento (contesto gestionale).",
        source: "adaptation_target",
      });
      break;
    case "movement_quality":
    case "mobility_capacity":
    case "skill_transfer":
      out.push({
        id: "at_motor_neuro",
        category: "neuro_adrenergic",
        pillLabelIt: "Plasticità motoria",
        hintIt: "Apprendimento e rifinitura pattern; carico simpatico tipicamente moderato.",
        source: "adaptation_target",
      });
      break;
    default:
      break;
  }
  return out;
}

function facetsFromKnowledgeBlob(blob: string): Array<Omit<SessionAnalysisFacetViewModel, "categoryLabelIt">> {
  const out: Array<Omit<SessionAnalysisFacetViewModel, "categoryLabelIt">> = [];
  if (/hif|ipossi|hypox|hiposs/i.test(blob)) {
    out.push({
      id: "sk_hif",
      category: "oxygen_hypoxia",
      pillLabelIt: "HIF / risposta ipossica",
      hintIt: "Dal knowledge packet: contesto ossigeno–trascrizione (allenamento o altri segnali dichiarati).",
      source: "session_knowledge",
    });
  }
  if (/igf|igf-1|growth hormone|ormone della crescita|somatro/i.test(blob)) {
    out.push({
      id: "sk_igf",
      category: "endocrine_growth",
      pillLabelIt: "IGF-1 / GH (contesto)",
      hintIt: "Asse somatotropo legato a carico, sonno, nutrizione; interpretazione qualitativa.",
      source: "session_knowledge",
    });
  }
  if (/cortisol|cortisolo|hpa|glucorticoid/i.test(blob)) {
    out.push({
      id: "sk_hpa",
      category: "endocrine_stress",
      pillLabelIt: "HPA · glucocorticoidi",
      hintIt: "Stress neuroendocrino; bilanciare con recupero e energia disponibile.",
      source: "session_knowledge",
    });
  }
  if (/catecolamin|adrenalin|noradrenalin|noradrenal|epinefrin|simpatic/i.test(blob)) {
    out.push({
      id: "sk_cat",
      category: "neuro_adrenergic",
      pillLabelIt: "Catecolamine",
      hintIt: "Asse simpatico–adrenergico su intensità e durata.",
      source: "session_knowledge",
    });
  }
  if (/mtor|m-tor|sintesi proteic|ipertrof/i.test(blob)) {
    out.push({
      id: "sk_mtor",
      category: "repair_anabolic",
      pillLabelIt: "mTOR · sintesi proteica",
      hintIt: "Timing nutrizione–allenamento per massimizzare segnale (non override clinico).",
      source: "session_knowledge",
    });
  }
  if (/gene|geni|transcript|hif1|ppargc1|pgc-1/i.test(blob)) {
    out.push({
      id: "sk_genes",
      category: "genetic_regulation",
      pillLabelIt: "Regolazione genica",
      hintIt: "Contesto da packet (pathway / geni citati); non è test genetico.",
      source: "session_knowledge",
    });
  }
  if (/microbiota|probiotic|probiot|veillonella|butirrato|butyrate|acetato|acetic|propion|scfa|fibra|fiber|lattato.*microb/i.test(blob)) {
    out.push({
      id: "sk_micro",
      category: "microbiota_gut",
      pillLabelIt: "Microbiota · assorbimento",
      hintIt: "Carichi glucidici intensi + fibre / fermentazione → modulatori (butirrato, acetato, propionato); contesto letteratura.",
      source: "session_knowledge",
    });
  }
  return out;
}

function facetsFromFamily(contract: Pro2SessionMultilevelSource): Array<Omit<SessionAnalysisFacetViewModel, "categoryLabelIt">> {
  const out: Array<Omit<SessionAnalysisFacetViewModel, "categoryLabelIt">> = [];
  if (contract.family === "strength") {
    out.push({
      id: "fam_strength_mech",
      category: "muscle_cellular",
      pillLabelIt: "Carico strutturale",
      hintIt: "Forza: tensione meccanica dominante rispetto al costo aerobico globale.",
      source: "session_family",
    });
  }
  if (contract.family === "aerobic") {
    out.push({
      id: "fam_aer_bio",
      category: "bioenergetics",
      pillLabelIt: "Dominante aerobio",
      hintIt: "Ossidazione e gestione substrato come asse centrale della sessione.",
      source: "session_family",
    });
  }
  return out;
}

function facetsFromLoadProxy(tss: number, durationMin: number): Array<Omit<SessionAnalysisFacetViewModel, "categoryLabelIt">> {
  const out: Array<Omit<SessionAnalysisFacetViewModel, "categoryLabelIt">> = [];
  if (tss >= 75 && durationMin >= 50) {
    out.push({
      id: "load_gly",
      category: "glycolysis",
      pillLabelIt: "Carico glucidico elevato",
      hintIt: "Proxy da TSS/durata: probabile dipendenza da glicogeno e glicolisi per porzioni della sessione.",
      source: "load_proxy",
    });
  }
  if (tss >= 90) {
    out.push({
      id: "load_neuro",
      category: "neuro_adrenergic",
      pillLabelIt: "Stress neuro–endocrino acuto",
      hintIt: "Alto TSS: picco simpatico e bisogno di recovery strutturato.",
      source: "load_proxy",
    });
  }
  return out;
}

function sortFacets(facets: SessionAnalysisFacetViewModel[]): SessionAnalysisFacetViewModel[] {
  const order = new Map(CATEGORY_ORDER.map((c, i) => [c, i]));
  return [...facets].sort((a, b) => {
    const da = order.get(a.category) ?? 99;
    const db = order.get(b.category) ?? 99;
    if (da !== db) return da - db;
    return a.pillLabelIt.localeCompare(b.pillLabelIt, "it");
  });
}

export type BuildSessionMultilevelStripInput = {
  contract: Pro2SessionMultilevelSource | null | undefined;
  fallbackTss?: number | null;
  fallbackDurationMin?: number | null;
};

/**
 * Vista multilivello **deterministica**: incrocia training ↔ fisiologia / endocrino / neuro / microbiota (template facet, non diagnosi).
 */
export function buildSessionMultilevelAnalysisStrip(
  input: BuildSessionMultilevelStripInput,
): SessionMultilevelAnalysisStripViewModel {
  const contract = input.contract;
  const raw: SessionAnalysisFacetViewModel[] = [];

  if (!contract) {
    return {
      modelVersion: 1,
      layer: "deterministic_session_facet_template",
      facets: [],
      stripSlots: buildStripSlotsFromFacets([]),
      notes: [
        "Nessun contract builder: collega una sessione generata dal builder per attivare le pillole di analisi multilivello.",
      ],
    };
  }

  const targetStr = String(contract.adaptationTarget ?? "").trim();
  if (targetStr && isAdaptationTarget(targetStr)) {
    for (const f of facetsFromAdaptationTarget(targetStr)) pushFacet(raw, f);
  } else if (targetStr) {
    const low = targetStr.toLowerCase();
    if (low.includes("vo2") || low.includes("aerobic") || low.includes("mitochond")) {
      for (const f of facetsFromAdaptationTarget("vo2_max_support")) pushFacet(raw, f);
    }
  }

  for (const f of facetsFromFamily(contract)) pushFacet(raw, f);

  const blob = knowledgeBlob(contract);
  for (const f of facetsFromKnowledgeBlob(blob)) pushFacet(raw, f);

  const tss = contract.summary?.tss ?? input.fallbackTss ?? 0;
  const durMin = contract.summary?.durationSec
    ? Math.max(1, Math.round(contract.summary.durationSec / 60))
    : input.fallbackDurationMin ?? 0;
  for (const f of facetsFromLoadProxy(tss, durMin)) pushFacet(raw, f);

  const facets = sortFacets(raw);
  return {
    modelVersion: 1,
    layer: "deterministic_session_facet_template",
    facets,
    stripSlots: buildStripSlotsFromFacets(facets),
    notes: [
      "Interpretazione strutturata da target adattativo, famiglia sessione, knowledge packet e proxy di carico — non diagnosi e non decisione clinica.",
      "Nutrizione, microbiota e genetica sono modulatori transversali: usa Nutrizione / Health per approfondire con evidenza e tracce ricerca.",
    ],
  };
}
