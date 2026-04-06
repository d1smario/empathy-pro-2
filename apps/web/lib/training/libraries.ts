export type GymMacroArea = "forza" | "massa" | "potenza" | "neuromuscolare";

export type GymExercise = {
  id: string;
  name: string;
  macroArea: GymMacroArea;
  muscleGroup: string;
  execution: string;
  equipment: string;
  animationUrl: string;
  youtubeUrl: string;
};

export type BoardPoint = { x: number; y: number; role: string };

export type TechnicalDrillCategory =
  | "technical"
  | "tactical"
  | "situational"
  | "offensive_phase"
  | "defensive_phase"
  | "simulation"
  | "motor_control"
  | "breath_posture";

export type TechnicalDrill = {
  id: string;
  sport: string;
  title: string;
  objective: string;
  youtubeUrl: string;
  mediaUrl?: string;
  boardPoints: BoardPoint[];
  category?: TechnicalDrillCategory;
  methodology?: string;
  sourceLabel?: string;
  evidenceQuery?: string;
  tags?: string[];
};

export type LifestyleProtocol = {
  id: string;
  sport: string;
  name: string;
  objective: string;
  durationMin: number;
  execution: string;
  youtubeUrl: string;
  mediaUrl?: string;
  methodology?: string;
  tags?: string[];
};

export const TECHNICAL_SPORT_DISCIPLINES = [
  "Calcio",
  "Pallavolo",
  "Basket",
  "Boxe",
  "Karate",
  "Judo",
  "Muay Thai",
] as const;

export const LIFESTYLE_DISCIPLINES = [
  "Yoga",
  "Pilates",
  "Meditazione",
  "Breathwork",
  "Mobility",
] as const;

export const GYM_MACRO_AREAS: Array<{ id: GymMacroArea; label: string }> = [
  { id: "forza", label: "Forza" },
  { id: "massa", label: "Massa" },
  { id: "potenza", label: "Potenza" },
  { id: "neuromuscolare", label: "Neuromuscolare" },
];

export const GYM_MUSCLE_GROUPS = [
  "Total body",
  "Quadricipiti",
  "Posterior chain",
  "Glutei",
  "Petto",
  "Dorso",
  "Spalle",
  "Core",
  "Braccia",
];

export const EXECUTION_STYLES = [
  "Veloce",
  "Lento controllato",
  "Spinta veloce / discesa lenta",
  "Sfinimento",
  "Superserie",
  "Isometrico",
  "Pliometrico",
];

export const SUPPORT_WORKS = ["Aerobico", "Mobilita", "Stretching", "Respirazione", "Core stability"];

const FIFA_SOURCE = "https://www.fifatrainingcentre.com/en/practice/talent-coach-programme/build-and-progress/5v5-plus-3-small-sided-game-breaking-the-press-and-play-in-behind.php";
const FIBA_SOURCE = "https://about.fiba.basketball/en/wabc-documents";
const FIVB_SOURCE = "https://www.fivb.com/wp-content/uploads/2024/03/Coaches_Manual_Level_II_EN.pdf";
const BOXING_SOURCE = "https://www.englandboxing.org/wp-content/uploads/2022/03/EB_Boxing-Coaching-Handbook-Part-1_v8-002.pdf";
const WKF_SOURCE = "https://www.wkf.net/news-center/article/!/1421/new-coach-examination-for-kumite-and-kata-on-wkf-e-learning-platform";
const IJF_SOURCE = "https://academy.ijf.org/courses/coach";
const IFMA_SOURCE = "https://muaythai.sport/one-standard-muaythai-world-course/";
const YOGA_SOURCE = "https://yogaalliance.org/scientific-research/physical-health-and-performance/";
const PILATES_SOURCE = "https://www.pilatesmethodalliance.org/pilates-research/research-pilates-references";
const MEDITATION_SOURCE = "https://pubmed.ncbi.nlm.nih.gov/?term=mindfulness+sport+performance+review";

function drill(input: TechnicalDrill): TechnicalDrill {
  return input;
}

function protocol(input: LifestyleProtocol): LifestyleProtocol {
  return input;
}

const SOCCER_BOARD: BoardPoint[] = [
  { x: 14, y: 20, role: "GK" },
  { x: 22, y: 38, role: "CB1" },
  { x: 22, y: 62, role: "CB2" },
  { x: 40, y: 24, role: "CM1" },
  { x: 40, y: 76, role: "CM2" },
  { x: 62, y: 32, role: "W1" },
  { x: 62, y: 68, role: "W2" },
  { x: 80, y: 50, role: "9" },
];

const BASKET_BOARD: BoardPoint[] = [
  { x: 50, y: 18, role: "1" },
  { x: 28, y: 34, role: "2" },
  { x: 72, y: 34, role: "3" },
  { x: 34, y: 64, role: "4" },
  { x: 66, y: 64, role: "5" },
];

const VOLLEY_BOARD: BoardPoint[] = [
  { x: 22, y: 22, role: "4" },
  { x: 50, y: 22, role: "3" },
  { x: 78, y: 22, role: "2" },
  { x: 22, y: 76, role: "5" },
  { x: 50, y: 76, role: "6" },
  { x: 78, y: 76, role: "1" },
];

const BOXING_BOARD: BoardPoint[] = [
  { x: 34, y: 52, role: "A" },
  { x: 66, y: 52, role: "B" },
  { x: 50, y: 24, role: "Coach" },
];

const KARATE_BOARD: BoardPoint[] = [
  { x: 36, y: 50, role: "AKA" },
  { x: 64, y: 50, role: "AO" },
  { x: 50, y: 18, role: "Ref" },
];

const JUDO_BOARD: BoardPoint[] = [
  { x: 38, y: 50, role: "Tori" },
  { x: 62, y: 50, role: "Uke" },
  { x: 50, y: 20, role: "Coach" },
];

const MUAY_THAI_BOARD: BoardPoint[] = [
  { x: 34, y: 50, role: "Red" },
  { x: 66, y: 50, role: "Blue" },
  { x: 50, y: 20, role: "Pad" },
];

const YOGA_BOARD: BoardPoint[] = [
  { x: 50, y: 50, role: "Mat" },
  { x: 28, y: 72, role: "Breath" },
  { x: 72, y: 72, role: "Align" },
];

const PILATES_BOARD: BoardPoint[] = [
  { x: 50, y: 50, role: "Core" },
  { x: 32, y: 70, role: "Scap" },
  { x: 68, y: 70, role: "Pelvis" },
];

export const GYM_EXERCISE_LIBRARY: GymExercise[] = [
  {
    id: "squat_back",
    name: "Back Squat",
    macroArea: "forza",
    muscleGroup: "Quadricipiti",
    execution: "Spinta veloce / discesa lenta",
    equipment: "Bilanciere",
    animationUrl: "https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif",
    youtubeUrl: "https://www.youtube.com/watch?v=Dy28eq2PjcM",
  },
  {
    id: "deadlift",
    name: "Deadlift",
    macroArea: "forza",
    muscleGroup: "Posterior chain",
    execution: "Lento controllato",
    equipment: "Bilanciere",
    animationUrl: "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif",
    youtubeUrl: "https://www.youtube.com/watch?v=op9kVnSso6Q",
  },
  {
    id: "bench_press",
    name: "Bench Press",
    macroArea: "massa",
    muscleGroup: "Petto",
    execution: "Lento controllato",
    equipment: "Bilanciere",
    animationUrl: "https://media.giphy.com/media/3o7TKR2hYQXQ0Ff6yQ/giphy.gif",
    youtubeUrl: "https://www.youtube.com/watch?v=rT7DgCr-3pg",
  },
  {
    id: "hyrox_sled_push",
    name: "Sled Push",
    macroArea: "potenza",
    muscleGroup: "Total body",
    execution: "Veloce",
    equipment: "Sled",
    animationUrl: "https://media.giphy.com/media/l4FGI8GoTL7N4DsyI/giphy.gif",
    youtubeUrl: "https://www.youtube.com/watch?v=gf7x6MKE0uI",
  },
  {
    id: "box_jump",
    name: "Box Jump",
    macroArea: "neuromuscolare",
    muscleGroup: "Glutei",
    execution: "Pliometrico",
    equipment: "Box",
    animationUrl: "https://media.giphy.com/media/l0ExncehJzexFpRHq/giphy.gif",
    youtubeUrl: "https://www.youtube.com/watch?v=52r_Ul5k03g",
  },
  {
    id: "row_erg_sprint",
    name: "Row Erg Sprint",
    macroArea: "potenza",
    muscleGroup: "Dorso",
    execution: "Sfinimento",
    equipment: "Rower",
    animationUrl: "https://media.giphy.com/media/l4FGv7M9V9V0e9f7a/giphy.gif",
    youtubeUrl: "https://www.youtube.com/watch?v=ZN0J6qKCIrI",
  },
];

export const TEAM_SPORT_DRILL_LIBRARY: TechnicalDrill[] = [
  drill({
    id: "soccer_rondo_4v2",
    sport: "Calcio",
    title: "Rondo 4v2 a tocchi limitati",
    objective: "Primo controllo, supporto e scansione in spazi ridotti.",
    youtubeUrl: FIFA_SOURCE,
    boardPoints: SOCCER_BOARD,
    category: "technical",
    methodology: "Representative learning con densita tecnica elevata.",
    sourceLabel: "FIFA Training Centre",
    evidenceQuery: "(soccer OR football) AND small-sided games AND decision making",
    tags: ["first_touch", "support", "scanning", "rondo"],
  }),
  drill({
    id: "soccer_build_high_press",
    sport: "Calcio",
    title: "Costruzione 5v5+3 contro high press",
    objective: "Uscita palla, terzo uomo e attacco dello spazio dietro linea.",
    youtubeUrl: FIFA_SOURCE,
    boardPoints: SOCCER_BOARD,
    category: "offensive_phase",
    methodology: "Small-sided con regola del fuorigioco e vincoli di pressione.",
    sourceLabel: "FIFA Training Centre",
    evidenceQuery: "(soccer OR football) AND tactical behavior AND build up",
    tags: ["build_up", "third_man", "press_resistance", "depth"],
  }),
  drill({
    id: "soccer_transition_counterpress",
    sport: "Calcio",
    title: "Counterpress 6 secondi",
    objective: "Transizione negativa immediata e recupero palla in zona palla.",
    youtubeUrl: FIFA_SOURCE,
    boardPoints: SOCCER_BOARD,
    category: "defensive_phase",
    methodology: "Vincolo temporale breve dopo perdita per allenare aggressione coordinata.",
    sourceLabel: "FIFA Training Centre",
    evidenceQuery: "(soccer OR football) AND transition AND tactical behavior",
    tags: ["transition", "counterpress", "compactness", "recovery_run"],
  }),
  drill({
    id: "soccer_finishing_wave",
    sport: "Calcio",
    title: "Wave finishing su rifinitura laterale",
    objective: "Attacco area, timing su cross e finalizzazione rapida.",
    youtubeUrl: FIFA_SOURCE,
    boardPoints: SOCCER_BOARD,
    category: "offensive_phase",
    methodology: "Sequenze ad alta frequenza con variabilita di rifinitura.",
    sourceLabel: "FIFA Training Centre",
    evidenceQuery: "(soccer OR football) AND attacking patterns AND finishing",
    tags: ["cross", "finish", "timing", "box_attack"],
  }),
  drill({
    id: "soccer_compact_block",
    sport: "Calcio",
    title: "Blocco medio 6v6 con uscite guidate",
    objective: "Compattezza, coperture e letture lato forte/lato debole.",
    youtubeUrl: FIFA_SOURCE,
    boardPoints: SOCCER_BOARD,
    category: "tactical",
    methodology: "Spazio modulato e trigger di pressione predefiniti.",
    sourceLabel: "FIFA Training Centre",
    evidenceQuery: "(soccer OR football) AND tactical periodization AND defensive organization",
    tags: ["block", "pressure_trigger", "cover", "shift"],
  }),
  drill({
    id: "soccer_match_sim_8v8",
    sport: "Calcio",
    title: "Simulazione partita 8v8 con obiettivi di fase",
    objective: "Integrare tecnica, tattica e condizione in contesto quasi-gara.",
    youtubeUrl: FIFA_SOURCE,
    boardPoints: SOCCER_BOARD,
    category: "simulation",
    methodology: "Match-constraints con KPI su transizioni e attacchi posizionali.",
    sourceLabel: "FIFA Training Centre",
    evidenceQuery: "(soccer OR football) AND representative learning design AND simulation",
    tags: ["simulation", "match_play", "phase_goals", "decision_speed"],
  }),

  drill({
    id: "basket_ballhandling_pressure",
    sport: "Basket",
    title: "Ball handling sotto pressione",
    objective: "Protezione palla, cambio ritmo e uscita dal primo difensore.",
    youtubeUrl: FIBA_SOURCE,
    boardPoints: BASKET_BOARD,
    category: "technical",
    methodology: "Constraints su spazio, mano debole e tempo di esecuzione.",
    sourceLabel: "FIBA WABC",
    evidenceQuery: "(basketball) AND dribbling AND skill performance",
    tags: ["ball_handling", "change_of_pace", "pressure", "weak_hand"],
  }),
  drill({
    id: "basket_shooting_relocation",
    sport: "Basket",
    title: "Shooting off relocation",
    objective: "Piede-perno, riallineamento e tiro dopo spostamento.",
    youtubeUrl: FIBA_SOURCE,
    boardPoints: BASKET_BOARD,
    category: "technical",
    methodology: "Ripetizioni brevi ad alta qualita con feedback tecnico.",
    sourceLabel: "FIBA WABC",
    evidenceQuery: "(basketball) AND shooting accuracy AND fatigue",
    tags: ["shooting", "footwork", "balance", "relocation"],
  }),
  drill({
    id: "basket_shell_4v4",
    sport: "Basket",
    title: "Shell drill 4v4",
    objective: "Difesa lato forte/lato debole, aiuti e closeout corretti.",
    youtubeUrl: FIBA_SOURCE,
    boardPoints: BASKET_BOARD,
    category: "defensive_phase",
    methodology: "Letture collettive con stop-and-correct su allineamenti difensivi.",
    sourceLabel: "FIBA WABC",
    evidenceQuery: "(basketball) AND defensive tactics AND coaching",
    tags: ["shell", "help_side", "closeout", "rotation"],
  }),
  drill({
    id: "basket_transition_3v2_2v1",
    sport: "Basket",
    title: "Transition 3v2 + 2v1",
    objective: "Decision making in vantaggio e rientro difensivo immediato.",
    youtubeUrl: FIBA_SOURCE,
    boardPoints: BASKET_BOARD,
    category: "situational",
    methodology: "Continuous drill per letture rapide e conversione attacco-difesa.",
    sourceLabel: "FIBA WABC",
    evidenceQuery: "(basketball) AND transition drill AND decision making",
    tags: ["transition", "advantage", "read_react", "conversion"],
  }),
  drill({
    id: "basket_pick_roll_reads",
    sport: "Basket",
    title: "Pick and roll reads",
    objective: "Gestione blocco centrale, short roll e letture sul low man.",
    youtubeUrl: FIBA_SOURCE,
    boardPoints: BASKET_BOARD,
    category: "offensive_phase",
    methodology: "Progressione 2c2 > 3c3 > 5c5 con opzioni vincolate.",
    sourceLabel: "FIBA WABC",
    evidenceQuery: "(basketball) AND offensive schemes AND pick and roll",
    tags: ["pick_and_roll", "spacing", "short_roll", "decision"],
  }),
  drill({
    id: "basket_halfcourt_sim",
    sport: "Basket",
    title: "Half-court simulation con vantaggio iniziale",
    objective: "Applicare concetti offensivi e difensivi in contesto semi-reale.",
    youtubeUrl: FIBA_SOURCE,
    boardPoints: BASKET_BOARD,
    category: "simulation",
    methodology: "5c5 a punteggio con scenari preimpostati e obiettivi di possesso.",
    sourceLabel: "FIBA WABC",
    evidenceQuery: "(basketball) AND tactical training AND simulation",
    tags: ["simulation", "half_court", "advantage_start", "execution"],
  }),

  drill({
    id: "volley_serve_receive_lanes",
    sport: "Pallavolo",
    title: "Serve-receive lanes",
    objective: "Qualita ricezione, piattaforma e traiettoria verso alzatore.",
    youtubeUrl: FIVB_SOURCE,
    boardPoints: VOLLEY_BOARD,
    category: "technical",
    methodology: "Volume tecnico con target di zona e scoring su precisione.",
    sourceLabel: "FIVB",
    evidenceQuery: "(volleyball) AND serve receive AND skill acquisition",
    tags: ["serve_receive", "platform", "trajectory", "precision"],
  }),
  drill({
    id: "volley_set_attack_timing",
    sport: "Pallavolo",
    title: "Set-attack timing",
    objective: "Sincronizzare rincorsa, tempo palla e scelta del colpo.",
    youtubeUrl: FIVB_SOURCE,
    boardPoints: VOLLEY_BOARD,
    category: "offensive_phase",
    methodology: "Progressione alzata controllata > alzata variabile > opposizione.",
    sourceLabel: "FIVB",
    evidenceQuery: "(volleyball) AND attack timing AND training",
    tags: ["set", "approach", "spike", "timing"],
  }),
  drill({
    id: "volley_block_defense_read",
    sport: "Pallavolo",
    title: "Read block-defense",
    objective: "Lettura mani del muro e coperture della difesa di seconda linea.",
    youtubeUrl: FIVB_SOURCE,
    boardPoints: VOLLEY_BOARD,
    category: "defensive_phase",
    methodology: "Cue-based drill con scelte di posizione sul colpo avversario.",
    sourceLabel: "FIVB",
    evidenceQuery: "(volleyball) AND block defense system AND coaching",
    tags: ["block", "defense", "coverage", "read"],
  }),
  drill({
    id: "volley_sideout_pressure",
    sport: "Pallavolo",
    title: "Side-out sotto pressione",
    objective: "Uscita side-out con target di efficienza su ricezione perfetta/imperfetta.",
    youtubeUrl: FIVB_SOURCE,
    boardPoints: VOLLEY_BOARD,
    category: "situational",
    methodology: "Scoring differenziato per side-out immediato o ricostruzione lunga.",
    sourceLabel: "FIVB",
    evidenceQuery: "(volleyball) AND side-out AND tactical performance",
    tags: ["side_out", "pressure", "efficiency", "reconstruction"],
  }),
  drill({
    id: "volley_freeball_transition",
    sport: "Pallavolo",
    title: "Transizione free-ball",
    objective: "Organizzazione offensiva dopo free-ball con scelta rapida della soluzione.",
    youtubeUrl: FIVB_SOURCE,
    boardPoints: VOLLEY_BOARD,
    category: "tactical",
    methodology: "Trigger visivi e chiamate di sistema per velocizzare la transizione.",
    sourceLabel: "FIVB",
    evidenceQuery: "(volleyball) AND transition offense AND tactics",
    tags: ["free_ball", "transition", "system", "choice"],
  }),
  drill({
    id: "volley_endgame_sim",
    sport: "Pallavolo",
    title: "Endgame rotation simulation",
    objective: "Gestire punti finali, rotazioni critiche e scelta del servizio tattico.",
    youtubeUrl: FIVB_SOURCE,
    boardPoints: VOLLEY_BOARD,
    category: "simulation",
    methodology: "Mini-set a punteggio con scenario di fine parziale.",
    sourceLabel: "FIVB",
    evidenceQuery: "(volleyball) AND match analysis AND end game",
    tags: ["simulation", "rotation", "endgame", "serve_strategy"],
  }),

  drill({
    id: "boxing_jab_footwork",
    sport: "Boxe",
    title: "Jab + footwork ladder",
    objective: "Mantenere distanza, ritmo e riallineamento con jab di controllo.",
    youtubeUrl: BOXING_SOURCE,
    boardPoints: BOXING_BOARD,
    category: "technical",
    methodology: "Round brevi con focus su stance, guardia e uscita laterale.",
    sourceLabel: "England Boxing",
    evidenceQuery: "(boxing) AND footwork AND technique",
    tags: ["jab", "distance", "footwork", "guard"],
  }),
  drill({
    id: "boxing_combo_exit",
    sport: "Boxe",
    title: "1-2-3 con uscita angolata",
    objective: "Combinazione offensiva con chiusura su angolo sicuro.",
    youtubeUrl: BOXING_SOURCE,
    boardPoints: BOXING_BOARD,
    category: "offensive_phase",
    methodology: "Pad work vincolato con tempo-lavoro controllato.",
    sourceLabel: "England Boxing",
    evidenceQuery: "(boxing) AND combination AND tactical training",
    tags: ["combination", "angle_exit", "offense", "pad_work"],
  }),
  drill({
    id: "boxing_slip_counter",
    sport: "Boxe",
    title: "Slip and counter lane",
    objective: "Reazione difensiva e contrattacco su linea interna/esterna.",
    youtubeUrl: BOXING_SOURCE,
    boardPoints: BOXING_BOARD,
    category: "situational",
    methodology: "Partner drill con trigger casuali e risposta immediata.",
    sourceLabel: "England Boxing",
    evidenceQuery: "(boxing) AND defensive reaction AND counter attack",
    tags: ["slip", "counter", "timing", "reaction"],
  }),
  drill({
    id: "boxing_ring_cut",
    sport: "Boxe",
    title: "Cut the ring pressure",
    objective: "Chiudere gli spazi, guidare alle corde e limitare le vie di uscita.",
    youtubeUrl: BOXING_SOURCE,
    boardPoints: BOXING_BOARD,
    category: "tactical",
    methodology: "Scenario di ring control con scoring sulla qualita di pressione.",
    sourceLabel: "England Boxing",
    evidenceQuery: "(boxing) AND tactical analysis AND ring control",
    tags: ["pressure", "ring_control", "cut_off", "ropes"],
  }),
  drill({
    id: "boxing_body_head_tempo",
    sport: "Boxe",
    title: "Tempo rounds body-head",
    objective: "Alternare livelli di attacco mantenendo economia e precisione.",
    youtubeUrl: BOXING_SOURCE,
    boardPoints: BOXING_BOARD,
    category: "technical",
    methodology: "Round tecnici con densita crescente e pausa breve.",
    sourceLabel: "England Boxing",
    evidenceQuery: "(boxing) AND punch biomechanics AND athlete",
    tags: ["body_head", "tempo", "precision", "economy"],
  }),
  drill({
    id: "boxing_sparring_scenario",
    sport: "Boxe",
    title: "Sparring situazionale 30-30",
    objective: "Applicare un compito tattico specifico in scambi brevi e controllati.",
    youtubeUrl: BOXING_SOURCE,
    boardPoints: BOXING_BOARD,
    category: "simulation",
    methodology: "Scenario-based sparring con obiettivo unico per round.",
    sourceLabel: "England Boxing",
    evidenceQuery: "(boxing) AND sparring AND performance analysis",
    tags: ["sparring", "scenario", "task", "simulation"],
  }),

  drill({
    id: "karate_kihon_speed",
    sport: "Karate",
    title: "Kihon line speed",
    objective: "Pulizia del gesto, allineamento e velocita dei fondamentali.",
    youtubeUrl: WKF_SOURCE,
    boardPoints: KARATE_BOARD,
    category: "technical",
    methodology: "Blocchi brevi con focus su precisione prima della velocita massima.",
    sourceLabel: "WKF",
    evidenceQuery: "(karate) AND biomechanics AND technical performance",
    tags: ["kihon", "precision", "alignment", "speed"],
  }),
  drill({
    id: "karate_kata_segments",
    sport: "Karate",
    title: "Kata segment precision",
    objective: "Scomporre la kata per ritmo, stabilita e transizioni pulite.",
    youtubeUrl: WKF_SOURCE,
    boardPoints: KARATE_BOARD,
    category: "motor_control",
    methodology: "Part-whole practice con feedback su equilibrio e ritmo.",
    sourceLabel: "WKF",
    evidenceQuery: "(karate) AND kata AND performance determinants",
    tags: ["kata", "rhythm", "balance", "sequence"],
  }),
  drill({
    id: "karate_kumite_maai",
    sport: "Karate",
    title: "Kumite maai entries",
    objective: "Gestire distanza e timing di ingresso senza perdere assetto.",
    youtubeUrl: WKF_SOURCE,
    boardPoints: KARATE_BOARD,
    category: "situational",
    methodology: "Entry drills con trigger visivi e risposta a tempo.",
    sourceLabel: "WKF",
    evidenceQuery: "(karate) AND kumite AND timing distance",
    tags: ["kumite", "maai", "entry", "timing"],
  }),
  drill({
    id: "karate_sen_no_sen",
    sport: "Karate",
    title: "Sen-no-sen counter timing",
    objective: "Anticipare l'azione avversaria con scelta del counter appropriato.",
    youtubeUrl: WKF_SOURCE,
    boardPoints: KARATE_BOARD,
    category: "tactical",
    methodology: "Partner task con anticipazione percettiva e zanshin finale.",
    sourceLabel: "WKF",
    evidenceQuery: "(karate) AND tactical analysis AND kumite",
    tags: ["counter", "anticipation", "zanshin", "tactics"],
  }),
  drill({
    id: "karate_corner_escape",
    sport: "Karate",
    title: "Corner pressure escape",
    objective: "Uscire dalla pressione laterale mantenendo scoring distance.",
    youtubeUrl: WKF_SOURCE,
    boardPoints: KARATE_BOARD,
    category: "defensive_phase",
    methodology: "Scenario micro-bout con reset rapido e coaching puntuale.",
    sourceLabel: "WKF",
    evidenceQuery: "(karate) AND kumite tactics AND match analysis",
    tags: ["escape", "corner", "distance", "defense"],
  }),
  drill({
    id: "karate_bout_simulation",
    sport: "Karate",
    title: "Kumite bout simulation",
    objective: "Trasferire pattern tecnico-tattici in combattimento regolato.",
    youtubeUrl: WKF_SOURCE,
    boardPoints: KARATE_BOARD,
    category: "simulation",
    methodology: "Mini-bout con compiti di punteggio e gestione tempo.",
    sourceLabel: "WKF",
    evidenceQuery: "(karate) AND simulation AND competitive performance",
    tags: ["simulation", "bout", "scoring", "competition"],
  }),

  drill({
    id: "judo_grip_fighting",
    sport: "Judo",
    title: "Grip fighting chain",
    objective: "Conquistare presa dominante e rompere quella avversaria.",
    youtubeUrl: IJF_SOURCE,
    boardPoints: JUDO_BOARD,
    category: "technical",
    methodology: "Entry chain ripetute con vincolo di tempo sulla presa.",
    sourceLabel: "IJF Academy",
    evidenceQuery: "(judo) AND gripping strength AND match analysis",
    tags: ["grip", "kumi_kata", "dominance", "entry"],
  }),
  drill({
    id: "judo_kuzushi_throw",
    sport: "Judo",
    title: "Kuzushi to throw",
    objective: "Collegare sbilanciamento, tsukuri e finalizzazione della tecnica.",
    youtubeUrl: IJF_SOURCE,
    boardPoints: JUDO_BOARD,
    category: "technical",
    methodology: "Progressione tecnica lenta > dinamica > opposizione controllata.",
    sourceLabel: "IJF Academy",
    evidenceQuery: "(judo) AND technical tactical analysis",
    tags: ["kuzushi", "tsukuri", "throw", "timing"],
  }),
  drill({
    id: "judo_nage_komi_density",
    sport: "Judo",
    title: "Nage-komi density set",
    objective: "Automatizzare entrate e precisione tecnica a densita crescente.",
    youtubeUrl: IJF_SOURCE,
    boardPoints: JUDO_BOARD,
    category: "situational",
    methodology: "Set a densita crescente con enfasi sulla qualita di entrata.",
    sourceLabel: "IJF Academy",
    evidenceQuery: "(judo) AND intermittent effort AND athlete",
    tags: ["nage_komi", "density", "entry", "repeatability"],
  }),
  drill({
    id: "judo_tachi_newaza",
    sport: "Judo",
    title: "Tachi-waza to newaza",
    objective: "Transizione immediata dalla proiezione al controllo a terra.",
    youtubeUrl: IJF_SOURCE,
    boardPoints: JUDO_BOARD,
    category: "situational",
    methodology: "Scenario con tempo limitato per capitalizzare la transizione.",
    sourceLabel: "IJF Academy",
    evidenceQuery: "(judo) AND transition AND match analysis",
    tags: ["transition", "newaza", "control", "follow_up"],
  }),
  drill({
    id: "judo_edge_fighting",
    sport: "Judo",
    title: "Edge fighting shiai",
    objective: "Gestire bordo tatami, direzione e tempi di attacco/difesa.",
    youtubeUrl: IJF_SOURCE,
    boardPoints: JUDO_BOARD,
    category: "tactical",
    methodology: "Randori vincolato all'area periferica del tatami.",
    sourceLabel: "IJF Academy",
    evidenceQuery: "(judo) AND tactical behavior AND competition",
    tags: ["edge", "tatami", "direction", "awareness"],
  }),
  drill({
    id: "judo_randori_theme",
    sport: "Judo",
    title: "Randori a tema",
    objective: "Applicare un principio tecnico-tattico in opposizione semi-libera.",
    youtubeUrl: IJF_SOURCE,
    boardPoints: JUDO_BOARD,
    category: "simulation",
    methodology: "Randori strutturato con un focus tattico dominante per round.",
    sourceLabel: "IJF Academy",
    evidenceQuery: "(judo) AND randori AND coaching",
    tags: ["randori", "theme", "simulation", "competition_transfer"],
  }),

  drill({
    id: "muay_thai_teep_distance",
    sport: "Muay Thai",
    title: "Teep distance control",
    objective: "Gestire distanza e rompere il ritmo dell'avversario con il teep.",
    youtubeUrl: IFMA_SOURCE,
    boardPoints: MUAY_THAI_BOARD,
    category: "technical",
    methodology: "Pad + partner drill con variazione distanza e timing.",
    sourceLabel: "IFMA OSM",
    evidenceQuery: "(muay thai OR kickboxing) AND technical performance",
    tags: ["teep", "distance", "timing", "control"],
  }),
  drill({
    id: "muay_thai_kick_check_return",
    sport: "Muay Thai",
    title: "Kick-check-return",
    objective: "Difesa calcio, assorbimento e risposta immediata.",
    youtubeUrl: IFMA_SOURCE,
    boardPoints: MUAY_THAI_BOARD,
    category: "situational",
    methodology: "Partner drill a pattern variabile per timing difensivo-offensivo.",
    sourceLabel: "IFMA OSM",
    evidenceQuery: "(muay thai OR kickboxing) AND tactical analysis",
    tags: ["kick", "check", "return", "reaction"],
  }),
  drill({
    id: "muay_thai_clinch_knees",
    sport: "Muay Thai",
    title: "Clinch knees and off-balance",
    objective: "Postura nel clinch, controllo capo-braccia e sbilanciamento.",
    youtubeUrl: IFMA_SOURCE,
    boardPoints: MUAY_THAI_BOARD,
    category: "technical",
    methodology: "Blocchi tecnici con enfasi su controllo e economia del gesto.",
    sourceLabel: "IFMA OSM",
    evidenceQuery: "(muay thai) AND clinch AND athlete",
    tags: ["clinch", "knees", "posture", "off_balance"],
  }),
  drill({
    id: "muay_thai_elbow_entry",
    sport: "Muay Thai",
    title: "Elbow entry on pads",
    objective: "Entrare in corta distanza con gomitate in sicurezza.",
    youtubeUrl: IFMA_SOURCE,
    boardPoints: MUAY_THAI_BOARD,
    category: "offensive_phase",
    methodology: "Pad drill con angle step e chiusura rapida.",
    sourceLabel: "IFMA OSM",
    evidenceQuery: "(muay thai) AND skill acquisition AND striking",
    tags: ["elbow", "entry", "short_range", "pads"],
  }),
  drill({
    id: "muay_thai_ring_pressure",
    sport: "Muay Thai",
    title: "Ring pressure and cut-off",
    objective: "Chiudere gli spazi e forzare scelte prevedibili all'avversario.",
    youtubeUrl: IFMA_SOURCE,
    boardPoints: MUAY_THAI_BOARD,
    category: "tactical",
    methodology: "Scenario drill con obiettivo di controllo spazio e tempo.",
    sourceLabel: "IFMA OSM",
    evidenceQuery: "(muay thai OR kickboxing) AND tactical training",
    tags: ["pressure", "cut_off", "ring_control", "timing"],
  }),
  drill({
    id: "muay_thai_round_sim",
    sport: "Muay Thai",
    title: "Round simulation with tactical task",
    objective: "Trasferire combinazioni e gestione distanza in round specifici.",
    youtubeUrl: IFMA_SOURCE,
    boardPoints: MUAY_THAI_BOARD,
    category: "simulation",
    methodology: "Round a compito con feedback tra round e reset tattico.",
    sourceLabel: "IFMA OSM",
    evidenceQuery: "(muay thai OR kickboxing) AND physiological demands AND athlete",
    tags: ["simulation", "round", "task", "competition_transfer"],
  }),
];

export const LIFESTYLE_PROTOCOL_LIBRARY: LifestyleProtocol[] = [
  protocol({
    id: "yoga_alignment_foundation",
    sport: "Yoga",
    name: "Yoga Alignment Foundation",
    objective: "Allineamento di base, controllo del respiro e stabilita nelle posizioni cardine.",
    durationMin: 35,
    execution: "Lento controllato",
    youtubeUrl: YOGA_SOURCE,
    methodology: "Tecnica posturale + breath cueing.",
    tags: ["asana", "alignment", "breath", "foundation"],
  }),
  protocol({
    id: "yoga_vinyasa_transition",
    sport: "Yoga",
    name: "Yoga Vinyasa Transition Flow",
    objective: "Fluidita nelle transizioni, controllo scapolo-pelvico e continuita del gesto.",
    durationMin: 30,
    execution: "Flusso continuo",
    youtubeUrl: YOGA_SOURCE,
    methodology: "Flow progressivo con intensita medio-bassa.",
    tags: ["vinyasa", "transition", "flow", "motor_control"],
  }),
  protocol({
    id: "yoga_yin_recovery",
    sport: "Yoga",
    name: "Yoga Yin Recovery",
    objective: "Recupero parasimpatico, mobilita lenta e downregulation.",
    durationMin: 40,
    execution: "Tenute respirate",
    youtubeUrl: YOGA_SOURCE,
    methodology: "Tenute lunghe con enfasi sul respiro nasale.",
    tags: ["yin", "recovery", "mobility", "parasympathetic"],
  }),
  protocol({
    id: "pilates_core_breath",
    sport: "Pilates",
    name: "Pilates Core-Breath Sequence",
    objective: "Integrare respiro, pressione e controllo del centro.",
    durationMin: 28,
    execution: "Tecnica controllata",
    youtubeUrl: PILATES_SOURCE,
    methodology: "Sequenza mat con cue su costole e bacino.",
    tags: ["core", "breath", "control", "precision"],
  }),
  protocol({
    id: "pilates_segmental_control",
    sport: "Pilates",
    name: "Pilates Segmental Control",
    objective: "Migliorare dissociazione segmentaria e precisione del movimento.",
    durationMin: 32,
    execution: "Lento controllato",
    youtubeUrl: PILATES_SOURCE,
    methodology: "Progressione segmentale con isometrie brevi.",
    tags: ["segmental_control", "dissociation", "posture", "quality"],
  }),
  protocol({
    id: "pilates_posture_reset",
    sport: "Pilates",
    name: "Pilates Posture Reset",
    objective: "Riallineamento scapolare-pelvico e stabilita del tronco.",
    durationMin: 25,
    execution: "Isometrico respirato",
    youtubeUrl: PILATES_SOURCE,
    methodology: "Hold tecnici e transizioni a bassa velocita.",
    tags: ["posture", "scapular_control", "pelvic_control", "stability"],
  }),
  protocol({
    id: "meditation_focus_reset",
    sport: "Meditazione",
    name: "Meditation Focus Reset",
    objective: "Ridurre rumore cognitivo e migliorare attenzione sostenuta.",
    durationMin: 12,
    execution: "Statico",
    youtubeUrl: MEDITATION_SOURCE,
    methodology: "Focus breath + body scan breve.",
    tags: ["focus", "downregulation", "attention", "awareness"],
  }),
  protocol({
    id: "breathwork_coherence_6_6",
    sport: "Breathwork",
    name: "Breath Coherence 6-6",
    objective: "Coerenza respiratoria e regolazione autonomica.",
    durationMin: 12,
    execution: "Lento controllato",
    youtubeUrl: YOGA_SOURCE,
    methodology: "Respirazione nasale 6:6 con progressione morbida.",
    tags: ["coherence", "breath", "recovery", "autonomic"],
  }),
  protocol({
    id: "breathwork_box_breathing",
    sport: "Breathwork",
    name: "Box Breathing 4-4-4-4",
    objective: "Stabilizzare arousal e concentrazione pre/post sessione.",
    durationMin: 8,
    execution: "Cadenzato",
    youtubeUrl: YOGA_SOURCE,
    methodology: "Protocollo breve per focus e controllo.",
    tags: ["box_breathing", "focus", "control", "arousal"],
  }),
  protocol({
    id: "mobility_flow_global",
    sport: "Mobility",
    name: "Mobility Flow Full Body",
    objective: "Range of motion, tissue prep e fluidita generale.",
    durationMin: 25,
    execution: "Flusso continuo",
    youtubeUrl: YOGA_SOURCE,
    methodology: "Flow multi-articolare con transizioni progressive.",
    tags: ["mobility", "flow", "range_of_motion", "prep"],
  }),
  protocol({
    id: "mobility_hips_tspine",
    sport: "Mobility",
    name: "Hips + T-Spine Reset",
    objective: "Ripristinare mobilita di anche e colonna toracica.",
    durationMin: 18,
    execution: "Lento controllato",
    youtubeUrl: YOGA_SOURCE,
    methodology: "Mobilita segmentaria con respirazione coordinata.",
    tags: ["hips", "t_spine", "mobility", "reset"],
  }),
];

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function escapeSvgText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function accentForDiscipline(discipline: string): string {
  const accents: Record<string, string> = {
    calcio: "#78f0a4",
    pallavolo: "#7dd3fc",
    basket: "#f59e0b",
    boxe: "#fb7185",
    karate: "#f97316",
    judo: "#a78bfa",
    "muay thai": "#f43f5e",
    yoga: "#8b5cf6",
    pilates: "#22c55e",
    meditazione: "#38bdf8",
    breathwork: "#06b6d4",
    mobility: "#f59e0b",
  };
  return accents[normalizeLabel(discipline)] ?? "#ff6a00";
}

function boardPaletteForSport(sport: string): { surface: string; lines: string } {
  const normalized = normalizeLabel(sport);
  if (normalized === "basket") return { surface: "#4a2d16", lines: "#f8d7a5" };
  if (normalized === "pallavolo") return { surface: "#1c4f72", lines: "#c2e6ff" };
  if (normalized === "boxe" || normalized === "muay thai") return { surface: "#34263d", lines: "#f8c7ff" };
  if (normalized === "karate" || normalized === "judo") return { surface: "#45505f", lines: "#e5edf7" };
  return { surface: "#29513a", lines: "#bde7c6" };
}

function shortTagLine(tags?: string[], max = 4): string {
  return (tags ?? [])
    .slice(0, max)
    .map((tag) => tag.replace(/_/g, " ").toUpperCase())
    .join(" · ");
}

function renderTechnicalSurface(drill: TechnicalDrill, accent: string, surface: string, lines: string): string {
  const normalized = normalizeLabel(drill.sport);
  const points = drill.boardPoints
    .map((point) => {
      const x = 24 + point.x * 5.5;
      const y = 104 + point.y * 2.1;
      return `
        <g>
          <circle cx="${x}" cy="${y}" r="13" fill="${accent}" fill-opacity="0.96" stroke="#091018" stroke-width="3" />
          <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#081017">${escapeSvgText(
            point.role,
          )}</text>
        </g>`;
    })
    .join("");

  if (normalized === "basket") {
    return `
      <rect x="20" y="90" width="380" height="246" rx="18" fill="${surface}" stroke="${lines}" stroke-width="2"/>
      <rect x="60" y="110" width="300" height="206" rx="12" fill="none" stroke="${lines}" stroke-width="2"/>
      <circle cx="210" cy="213" r="34" fill="none" stroke="${lines}" stroke-width="2"/>
      <path d="M84 160 C134 160 154 180 154 213 C154 246 134 266 84 266" fill="none" stroke="${lines}" stroke-width="2"/>
      <path d="M336 160 C286 160 266 180 266 213 C266 246 286 266 336 266" fill="none" stroke="${lines}" stroke-width="2"/>
      <line x1="210" y1="110" x2="210" y2="316" stroke="${lines}" stroke-width="2"/>
      ${points}`;
  }
  if (normalized === "pallavolo") {
    return `
      <rect x="20" y="90" width="380" height="246" rx="18" fill="${surface}" stroke="${lines}" stroke-width="2"/>
      <rect x="46" y="116" width="328" height="194" rx="8" fill="none" stroke="${lines}" stroke-width="2"/>
      <line x1="210" y1="116" x2="210" y2="310" stroke="${lines}" stroke-width="4" stroke-dasharray="6 6"/>
      <line x1="46" y1="180" x2="374" y2="180" stroke="${lines}" stroke-width="1.5" opacity="0.6"/>
      <line x1="46" y1="246" x2="374" y2="246" stroke="${lines}" stroke-width="1.5" opacity="0.6"/>
      ${points}`;
  }
  if (normalized === "boxe" || normalized === "muay thai") {
    return `
      <rect x="20" y="90" width="380" height="246" rx="18" fill="#1b1426" stroke="${lines}" stroke-width="2"/>
      <rect x="68" y="122" width="284" height="182" rx="8" fill="${surface}" stroke="${lines}" stroke-width="3"/>
      <rect x="54" y="108" width="312" height="210" rx="14" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="6"/>
      <line x1="68" y1="152" x2="352" y2="152" stroke="${lines}" stroke-width="1.5" opacity="0.5"/>
      <line x1="68" y1="274" x2="352" y2="274" stroke="${lines}" stroke-width="1.5" opacity="0.5"/>
      ${points}`;
  }
  if (normalized === "karate" || normalized === "judo") {
    return `
      <rect x="20" y="90" width="380" height="246" rx="18" fill="${surface}" stroke="${lines}" stroke-width="2"/>
      <rect x="68" y="122" width="284" height="182" rx="12" fill="none" stroke="${lines}" stroke-width="2"/>
      <rect x="90" y="144" width="240" height="138" rx="6" fill="none" stroke="${accent}" stroke-opacity="0.3" stroke-width="2"/>
      <line x1="210" y1="122" x2="210" y2="304" stroke="${lines}" stroke-width="1.5" opacity="0.7"/>
      <line x1="68" y1="213" x2="352" y2="213" stroke="${lines}" stroke-width="1.5" opacity="0.7"/>
      ${points}`;
  }
  return `
    <rect x="20" y="90" width="380" height="246" rx="18" fill="${surface}" stroke="${lines}" stroke-width="2"/>
    <line x1="210" y1="90" x2="210" y2="336" stroke="${lines}" stroke-width="2"/>
    <circle cx="210" cy="213" r="34" fill="none" stroke="${lines}" stroke-width="2"/>
    <rect x="36" y="106" width="348" height="214" rx="14" fill="none" stroke="${lines}" stroke-width="1.5" opacity="0.55"/>
    ${points}`;
}

function renderLifestyleIllustration(protocol: LifestyleProtocol, accent: string): string {
  const normalized = normalizeLabel(protocol.sport);
  if (normalized === "meditazione") {
    return `
      <circle cx="150" cy="150" r="68" fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="3"/>
      <circle cx="150" cy="150" r="34" fill="${accent}" fill-opacity="0.14" stroke="${accent}" stroke-width="2"/>
      <path d="M150 120 C138 120 132 131 132 141 C132 152 140 160 150 160 C160 160 168 152 168 141 C168 131 162 120 150 120 Z" fill="${accent}" fill-opacity="0.88"/>
      <path d="M112 206 C124 190 136 184 150 184 C164 184 176 190 188 206" fill="none" stroke="${accent}" stroke-width="11" stroke-linecap="round"/>
      <path d="M100 236 C118 222 134 216 150 216 C166 216 182 222 200 236" fill="none" stroke="${accent}" stroke-width="11" stroke-linecap="round"/>
      <circle cx="94" cy="118" r="6" fill="${accent}" fill-opacity="0.7"/>
      <circle cx="206" cy="118" r="6" fill="${accent}" fill-opacity="0.7"/>
      <circle cx="84" cy="156" r="4" fill="${accent}" fill-opacity="0.55"/>
      <circle cx="216" cy="156" r="4" fill="${accent}" fill-opacity="0.55"/>`;
  }
  if (normalized === "breathwork") {
    return `
      <path d="M118 118 C92 118 76 140 76 166 C76 194 94 214 120 214 C142 214 158 198 160 174 C162 198 178 214 200 214 C226 214 244 194 244 166 C244 140 228 118 202 118 C182 118 168 132 160 148 C152 132 138 118 118 118 Z" fill="${accent}" fill-opacity="0.22" stroke="${accent}" stroke-width="3"/>
      <path d="M50 174 C80 156 106 156 136 174 C166 192 192 192 222 174 C250 158 272 158 296 174" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
      <path d="M56 210 C86 192 112 192 142 210 C172 228 198 228 228 210 C252 196 274 196 292 204" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
      <circle cx="160" cy="166" r="18" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-width="2"/>`;
  }
  if (normalized === "pilates") {
    return `
      <rect x="82" y="216" width="136" height="14" rx="7" fill="${accent}" fill-opacity="0.75"/>
      <line x1="94" y1="216" x2="84" y2="248" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
      <line x1="206" y1="216" x2="216" y2="248" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="150" cy="142" r="18" fill="${accent}" fill-opacity="0.9"/>
      <path d="M132 162 C118 176 112 192 110 210" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
      <path d="M168 162 C184 174 194 190 202 210" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
      <path d="M110 210 C136 202 164 202 202 210" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
      <circle cx="100" cy="120" r="28" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="3"/>
      <circle cx="208" cy="120" r="28" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="3"/>`;
  }
  if (normalized === "mobility") {
    return `
      <circle cx="150" cy="126" r="18" fill="${accent}" fill-opacity="0.9"/>
      <path d="M150 146 L150 206" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
      <path d="M150 166 L104 186" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
      <path d="M150 166 L196 146" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
      <path d="M150 206 L112 242" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
      <path d="M150 206 L196 234" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
      <path d="M70 132 C78 116 92 104 112 96" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>
      <path d="M230 98 C210 106 198 118 190 132" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>
      <path d="M76 258 C98 250 114 238 126 220" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>
      <path d="M224 248 C204 240 188 228 176 210" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>`;
  }
  return `
    <circle cx="150" cy="168" r="54" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="3"/>
    <circle cx="150" cy="168" r="28" fill="${accent}" fill-opacity="0.2" stroke="${accent}" stroke-width="2"/>
    <path d="M150 128 C137 128 130 140 130 151 C130 162 139 170 150 170 C161 170 170 162 170 151 C170 140 163 128 150 128 Z" fill="${accent}" fill-opacity="0.9"/>
    <path d="M109 248 C116 210 134 188 150 188 C166 188 184 210 191 248" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round"/>
    <path d="M128 206 C108 214 98 224 91 242" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
    <path d="M172 206 C192 214 202 224 209 242" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>`;
}

export function getTechnicalDrillMediaUrl(drill: TechnicalDrill): string {
  if (drill.mediaUrl?.trim()) return drill.mediaUrl;
  const accent = accentForDiscipline(drill.sport);
  const palette = boardPaletteForSport(drill.sport);
  const category = escapeSvgText((drill.category ?? "technical").replace(/_/g, " ").toUpperCase());
  const title = escapeSvgText(drill.title);
  const objective = escapeSvgText(drill.objective);
  const methodology = escapeSvgText(drill.methodology ?? "Representative drill");
  const sourceLabel = escapeSvgText(drill.sourceLabel ?? drill.sport);
  const tags = escapeSvgText(shortTagLine(drill.tags));
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#121722"/>
          <stop offset="100%" stop-color="#090d14"/>
        </linearGradient>
      </defs>
      <rect width="640" height="360" rx="24" fill="url(#bg)"/>
      <rect x="20" y="20" width="600" height="52" rx="16" fill="#0d131d" stroke="rgba(255,255,255,0.08)"/>
      <text x="36" y="42" font-size="13" font-weight="700" fill="${accent}">${escapeSvgText(drill.sport.toUpperCase())}</text>
      <text x="36" y="61" font-size="21" font-weight="700" fill="#f8fafc">${title}</text>
      <text x="604" y="43" text-anchor="end" font-size="12" font-weight="700" fill="#cbd5e1">${category}</text>
      ${renderTechnicalSurface(drill, accent, palette.surface, palette.lines)}
      <rect x="420" y="90" width="200" height="246" rx="18" fill="#0d131d" stroke="rgba(255,255,255,0.08)"/>
      <text x="440" y="120" font-size="11" font-weight="700" fill="${accent}">OBJECTIVE</text>
      <text x="440" y="144" font-size="16" font-weight="700" fill="#f8fafc">${objective}</text>
      <text x="440" y="186" font-size="11" font-weight="700" fill="${accent}">METHOD</text>
      <text x="440" y="208" font-size="13" fill="#cbd5e1">${methodology}</text>
      <text x="440" y="252" font-size="11" font-weight="700" fill="${accent}">SOURCE</text>
      <text x="440" y="274" font-size="13" fill="#cbd5e1">${sourceLabel}</text>
      <text x="440" y="314" font-size="11" fill="#94a3b8">${tags}</text>
    </svg>`);
}

export function getLifestyleProtocolMediaUrl(protocol: LifestyleProtocol): string {
  if (protocol.mediaUrl?.trim()) return protocol.mediaUrl;
  const accent = accentForDiscipline(protocol.sport);
  const title = escapeSvgText(protocol.name);
  const objective = escapeSvgText(protocol.objective);
  const execution = escapeSvgText(protocol.execution);
  const methodology = escapeSvgText(protocol.methodology ?? "Mind-body protocol");
  const tags = escapeSvgText(shortTagLine(protocol.tags));
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#111722"/>
          <stop offset="100%" stop-color="#090d14"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="640" height="360" rx="24" fill="url(#bg)"/>
      <rect x="20" y="20" width="600" height="52" rx="16" fill="#0d131d" stroke="rgba(255,255,255,0.08)"/>
      <text x="36" y="42" font-size="13" font-weight="700" fill="${accent}">${escapeSvgText(protocol.sport.toUpperCase())}</text>
      <text x="36" y="61" font-size="21" font-weight="700" fill="#f8fafc">${title}</text>
      <text x="604" y="43" text-anchor="end" font-size="12" font-weight="700" fill="#cbd5e1">${protocol.durationMin} MIN</text>
      <rect x="20" y="90" width="260" height="246" rx="18" fill="#0d131d" stroke="rgba(255,255,255,0.08)"/>
      <rect x="24" y="94" width="252" height="238" rx="16" fill="url(#glow)"/>
      ${renderLifestyleIllustration(protocol, accent)}
      <rect x="300" y="90" width="320" height="246" rx="18" fill="#0d131d" stroke="rgba(255,255,255,0.08)"/>
      <text x="322" y="120" font-size="11" font-weight="700" fill="${accent}">OBJECTIVE</text>
      <text x="322" y="144" font-size="16" font-weight="700" fill="#f8fafc">${objective}</text>
      <text x="322" y="188" font-size="11" font-weight="700" fill="${accent}">EXECUTION</text>
      <text x="322" y="210" font-size="13" fill="#cbd5e1">${execution}</text>
      <text x="322" y="252" font-size="11" font-weight="700" fill="${accent}">METHOD</text>
      <text x="322" y="274" font-size="13" fill="#cbd5e1">${methodology}</text>
      <text x="322" y="314" font-size="11" fill="#94a3b8">${tags}</text>
    </svg>`);
}

export function getTechnicalDrillsForDiscipline(discipline: string): TechnicalDrill[] {
  const target = normalizeLabel(discipline);
  return TEAM_SPORT_DRILL_LIBRARY.filter((drill) => normalizeLabel(drill.sport) === target);
}

export function getLifestyleProtocolsForDiscipline(discipline: string): LifestyleProtocol[] {
  const target = normalizeLabel(discipline);
  return LIFESTYLE_PROTOCOL_LIBRARY.filter((item) => normalizeLabel(item.sport) === target);
}
