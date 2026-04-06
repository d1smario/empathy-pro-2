/**
 * Baseline letterario / evidence per le regole adattive del Training Engine.
 *
 * Policy: le decisioni algoritmiche restano in codice deterministico; questo modulo
 * documenta il **fondamento biologico** e le query PubMed per arricchimento via
 * `knowledge_evidence_hits` + curatore umano (Nature, Cell, Sports Med, JSAMS, ecc.).
 */
import type { AdaptationTarget } from "@/lib/training/engine/types";

export type EvidenceTier = "A" | "B" | "C";

export type EvidenceAnchor = {
  /** Tier: A = review/sintesi multi-studio; B = RCT/meccanistico; C = ipotesi/consenso pratico */
  tier: EvidenceTier;
  pmid?: string;
  pmcid?: string;
  doi?: string;
  title: string;
  journal?: string;
  year?: string;
  /** Collegamento concettuale alla regola EMPATHY (non claim diagnostico) */
  supports: string;
};

export type AdaptationEvidenceBasis = {
  summary: string;
  /** Usare con GET /api/knowledge/pubmed?q=... (E-utilities, nessuna chiave obbligatoria) */
  pubmedSearchQuery: string;
  /** Seed curato — espandere con hits archiviati in Supabase */
  anchors: EvidenceAnchor[];
};

/**
 * Anchor PMID verificati via NCBI esummary al momento dell’introduzione nel repo.
 * Altri target usano query strutturate fino a curazione completa.
 */
export const ADAPTATION_EVIDENCE_BASIS: Record<AdaptationTarget, AdaptationEvidenceBasis> = {
  mitochondrial_density: {
    summary:
      "Volume a bassa intensità relativa e polarizzazione della distribuzione delle intensità favoriscono segnali molecolari legati a efficienza mitocondriale e capacità aerobica di lungo periodo (mPET, PGC-1α pathway, ecc.).",
    pubmedSearchQuery: "(mitochondrial biogenesis OR PGC-1alpha) AND (endurance training OR aerobic training OR polarized training) AND (review[Publication Type])",
    anchors: [
      {
        tier: "A",
        pmid: "35136001",
        doi: "10.1249/MSS.0000000000002871",
        title: "Polarized Training Is Optimal for Endurance Athletes.",
        journal: "Med Sci Sports Exerc",
        year: "2022",
        supports: "Distribuzione degli stimoli intensità ↔ adattamenti aerobici; contesto distribuzione sessioni endurance.",
      },
    ],
  },
  vo2_max_support: {
    summary:
      "Sessioni ripetute vicino a VO₂max o sopra soglia aumentano stimolo centrale e periferico per max oxygen uptake; le linee guida combinano intervalli lunghi e micro-intervalli a seconda del contesto.",
    pubmedSearchQuery:
      "(VO2 max OR maximal oxygen uptake OR interval training[MeSH]) AND (adaptation OR physiological) AND (review[Publication Type])",
    anchors: [
      {
        tier: "A",
        pmid: "30141022",
        doi: "10.1007/s40279-018-0969-2",
        title:
          "Biomarkers of Physiological Responses to Periods of Intensified, Non-Resistance-Based Exercise Training in Well-Trained Male Athletes: A Systematic Review and Meta-Analysis.",
        journal: "Sports Med",
        year: "2018",
        supports: "Evidenza su blocchi intensificati e marker fisiologici — contesto periodi sopra soglia aerobica.",
      },
    ],
  },
  lactate_tolerance: {
    summary:
      "Tolleranza al lattato / stress glicolitico: ripetizioni sopra soglia con recuperi controllati modulano buffer, turnover e integrazione shuttle muscolo-cuore-fegato (framework lactate shuttle).",
    pubmedSearchQuery: "(lactate shuttle OR glycolytic) AND (exercise training OR interval training) AND (review[Publication Type])",
    anchors: [
      {
        tier: "A",
        pmid: "40879933",
        doi: "10.1007/978-3-031-88361-3_1",
        title: "Muscle Fuel Utilization with Glycolysis Viewed Right Side Up.",
        journal: "Adv Exp Med Biol",
        year: "2025",
        supports: "Quadro aggiornato su utilizzo substrati e glicolisi — riferimento concettuale per stimolo glicolitico.",
      },
      {
        tier: "B",
        pmcid: "PMC2805372",
        title: "Science and Translation of Lactate Shuttle Theory (open access archive)",
        journal: "PMC literature",
        supports: "Shuttle intra/extra-cellulare — contesto fisiologico per integrare righe guida lattato (vedi governance doc).",
      },
    ],
  },
  lactate_clearance: {
    summary:
      "Clearance / riciclo del lattato richiede anche finestre aerobiche e transizioni alta-bassa intensità che favoriscono ossidazione e ruolo monocarbossilato / flussi inter-organo.",
    pubmedSearchQuery: "(lactate clearance OR lactate oxidation) AND (exercise OR training) AND (endurance OR recovery)",
    anchors: [
      {
        tier: "B",
        pmid: "40879933",
        title: "Muscle Fuel Utilization with Glycolysis Viewed Right Side Up.",
        journal: "Adv Exp Med Biol",
        year: "2025",
        supports: "Stesso corpus Brooks: metabolismo lattato in integrazione con blocchi misti.",
      },
    ],
  },
  max_strength: {
    summary:
      "Forza massima (1RM / alta tensione): reclutamento motorio, stiffening tendineo, progressione carico con tecnica — disassociazione da FTP/ciclismo (carico esterno + RPE, non watt).",
    pubmedSearchQuery: "(resistance training[MeSH]) AND (maximal strength OR one-repetition maximum) AND (review[Publication Type])",
    anchors: [],
  },
  hypertrophy_mixed: {
    summary:
      "Ipertrofia ‘massa’ integrata (V1): combina tensione meccanica e stress metabolico; allineabile a raccomandazioni ACSM/position stands su volume e prossimità al cedimento gestita.",
    pubmedSearchQuery:
      "(hypertrophy OR muscle hypertrophy OR resistance training) AND (volume OR proximity to failure) AND (review[Publication Type])",
    anchors: [],
  },
  hypertrophy_myofibrillar: {
    summary:
      "Definizione EMPATHY (operativa, non istologica): ‘fibrillare’ = crescita / adattamento tirato da **alta intensità e volume complessivo limitato** — utile quando si vuole potenza e supporto di forza senza gonfiare il volume tipico bodybuilding (es. sport di potenza, discipline **miste aerobicamente con componenti anaerobiche**). Non è una biopsia muscolare.",
    pubmedSearchQuery:
      "(resistance training[MeSH]) AND (strength OR power athlete OR concurrent training) AND (low volume OR heavy load) AND (review[Publication Type])",
    anchors: [],
  },
  hypertrophy_sarcoplasmic: {
    summary:
      "Definizione EMPATHY (operativa): ‘sarcoplasmica’ = **alto volume e sfinimento / stress metabolico elevato**; pesa meno il rapporto peso·potenza “da performance mista”. Contesti tipo **culturismo, pesistica, sport di forza** in atletica dove massa e capacità di sopportare volume contano. Arricchimento letteratura via query e knowledge store.",
    pubmedSearchQuery:
      "(resistance training) AND (hypertrophy OR muscle damage OR metabolic stress OR volume load OR training to failure) AND (review[Publication Type])",
    anchors: [],
  },
  neuromuscular_adaptation: {
    summary:
      "Qualità neuromuscolare (V1 neuromuscolare): velocità d’intento, RFD submassimale, clustered sets — letteratura su explosive/vbt e adattamenti neurali senza massimizzare solo la 1RM.",
    pubmedSearchQuery:
      "(neuromuscular adaptations OR rate of force development OR velocity based training) AND resistance training AND (review[Publication Type])",
    anchors: [],
  },
  power_output: {
    summary:
      "Potenza: contrazioni esplosive, basso volume per ripetizione, qualità del movimento; sistemi fosfageno e reclutamento motorio.",
    pubmedSearchQuery: "(plyometric OR power training OR explosive) AND (athlete OR sport) AND (review[Publication Type])",
    anchors: [],
  },
  movement_quality: {
    summary:
      "Coordinazione e controllo motorio sotto carico moderato; approcci skill-acquisition e constrained movement in contesto sportivo.",
    pubmedSearchQuery: "(motor learning OR movement quality OR coordination) AND (sport OR athlete) AND (review[Publication Type])",
    anchors: [],
  },
  mobility_capacity: {
    summary:
      "Mobilità e tessuto connettivo: range di movimento, carico progressivo, integrazione respiro; overlap con letteratura su stretching dinamico e salute muscolo-scheletrica.",
    pubmedSearchQuery: "(mobility OR flexibility OR range of motion) AND (exercise OR training) AND (injury prevention OR athletic)",
    anchors: [],
  },
  skill_transfer: {
    summary:
      "Trasferimento abilità: pratica contestuale, variazione strutturata, vincoli rappresentativi dello sport (team sports, combattimento, ecc.).",
    pubmedSearchQuery: "(skill acquisition OR deliberate practice OR representative learning design) AND sport",
    anchors: [],
  },
  recovery: {
    summary:
      "Recupero: riduzione carico autonomico, sonno, nutrizione, carichi a bassa intensità; letteratura su monitoring readiness (HRV, RPE, biomarkers).",
    pubmedSearchQuery: "(recovery OR autonomic OR HRV) AND (athlete OR sport) AND (review[Publication Type])",
    anchors: [],
  },
};

export function getAdaptationEvidence(target: AdaptationTarget): AdaptationEvidenceBasis {
  return ADAPTATION_EVIDENCE_BASIS[target];
}
