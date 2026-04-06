/**
 * Catalogo deterministico drill + schemi di gioco per macro C (espandibile come “database” inline).
 * Chiave `sport` = palette Pro 2 (`sport-macro-palette` · technical).
 */

export type TechnicalPlaybookEntry = {
  id: string;
  sport: string;
  entryType: "drill" | "scheme";
  name: string;
  brief: string;
  defaultMinutes: number;
  defaultPeriods: string;
  defaultSpace: string;
  defaultCue: string;
  /** Tag schema V1 (footer card SVG) + futura indicizzazione asset. */
  schemaTags?: string[];
};

const G = (partial: Omit<TechnicalPlaybookEntry, "sport"> & { sport?: string }): TechnicalPlaybookEntry => ({
  sport: partial.sport ?? "",
  id: partial.id,
  entryType: partial.entryType,
  name: partial.name,
  brief: partial.brief,
  defaultMinutes: partial.defaultMinutes,
  defaultPeriods: partial.defaultPeriods,
  defaultSpace: partial.defaultSpace,
  defaultCue: partial.defaultCue,
  schemaTags: partial.schemaTags,
});

export const TECHNICAL_PLAYBOOK: TechnicalPlaybookEntry[] = [
  /* —— Calcio —— */
  G({
    sport: "soccer",
    id: "soc-drill-rondo",
    entryType: "drill",
    name: "Rondò quadrato 4+1",
    brief: "Possesso sotto pressione, primi tempi, ampiezza.",
    defaultMinutes: 12,
    defaultPeriods: "3×4′",
    defaultSpace: "12×12 m · 5 giocatori",
    defaultCue: "Solo due tocchi in uscita dalla pressione",
    schemaTags: ["rondo", "first_touch", "possession"],
  }),
  G({
    sport: "soccer",
    id: "soc-drill-finishing",
    entryType: "drill",
    name: "Finalizzazione trasversale",
    brief: "Cross dal fondo e inserimenti centrali coordinati.",
    defaultMinutes: 15,
    defaultPeriods: "6×90″ + 30″",
    defaultSpace: "Terzo offensivo · porte ridotte",
    defaultCue: "Tempi di attacco palla e scansione",
  }),
  G({
    sport: "soccer",
    id: "soc-scheme-low-block",
    entryType: "scheme",
    name: "Blocchio basso · uscite",
    brief: "Linea compatta, press sul lato, verticalizzazione su vincolo.",
    defaultMinutes: 18,
    defaultPeriods: "2×8′ + 2′ pausa",
    defaultSpace: "2/3 difensivo vs 6 attaccanti",
    defaultCue: "Trigger press sulla ricezione verso linea di fondo",
  }),
  G({
    sport: "soccer",
    id: "soc-scheme-ssg-transition",
    entryType: "scheme",
    name: "SSG 6v6 transizioni",
    brief: "Recupero → 8 passi per meta; fallimento → contropiede.",
    defaultMinutes: 20,
    defaultPeriods: "4×5′",
    defaultSpace: "Metà campo · 2 porte",
    defaultCue: "Priorità verticalizzazione nei primi 4″",
  }),

  /* —— Pallavolo —— */
  G({
    sport: "volleyball",
    id: "vol-drill-pass-set",
    entryType: "drill",
    name: "Bagher + alzata target",
    brief: "Precisione traiettoria e tempi palleggiatore-schiacciatore.",
    defaultMinutes: 14,
    defaultPeriods: "4 rotazioni × 3′",
    defaultSpace: "Campo 3 m linea d’attacco",
    defaultCue: "Allineamento spalle-anca verso target",
  }),
  G({
    sport: "volleyball",
    id: "vol-drill-block-read",
    entryType: "drill",
    name: "Lettura muro vs pipe",
    brief: "Timing salto muro e copertura schiacciata posteriore.",
    defaultMinutes: 12,
    defaultPeriods: "8×45″",
    defaultSpace: "Zona 3 · velo in pipes",
    defaultCue: "Mano sul ‘seam’ prima del plant",
  }),
  G({
    sport: "volleyball",
    id: "vol-scheme-s-serve",
    entryType: "scheme",
    name: "Schema battuta S + difesa base",
    brief: "Battuta appoggio zona 1 → accettazione → prima pipe.",
    defaultMinutes: 16,
    defaultPeriods: "set da 25",
    defaultSpace: "Campo intero",
    defaultCue: "Comunicare ‘mio/stretto’ prima del servizio",
  }),

  /* —— Basket —— */
  G({
    sport: "basketball",
    id: "bb-drill-pick-roll-read",
    entryType: "drill",
    name: "Lettura pick & roll 2v2",
    brief: "Angolo schermo, split, roll corto vs drop big.",
    defaultMinutes: 14,
    defaultPeriods: "12×90″",
    defaultSpace: "Semicerchio sommità",
    defaultCue: "Punteruolo al piede dello schermo",
  }),
  G({
    sport: "basketball",
    id: "bb-drill-transition",
    entryType: "drill",
    name: "3v2 + rincalzo",
    brief: "Decisione rapida fill lane vs kick ahead.",
    defaultMinutes: 12,
    defaultPeriods: "8 serie",
    defaultSpace: "Campo intero",
    defaultCue: "Primo passaggio entro mezzo campo",
  }),
  G({
    sport: "basketball",
    id: "bb-scheme-horns",
    entryType: "scheme",
    name: "Horns · opzione flare/slip",
    brief: "Ingresso dual high, lettura tag e back-door.",
    defaultMinutes: 18,
    defaultPeriods: "5×3′ possesso",
    defaultSpace: "5v5 dimezzato",
    defaultCue: "Big che slippa se difensore ‘ice’",
  }),

  /* —— Tennis —— */
  G({
    sport: "tennis",
    id: "ten-drill-cc-bh",
    entryType: "drill",
    name: "Cross-court backhand ritmato",
    brief: "Stabilità spinta e profondità zona 2–3 m oltre rete.",
    defaultMinutes: 15,
    defaultPeriods: "4 vagoni × 3′",
    defaultSpace: "Mezzo campo diagonal backhand",
    defaultCue: "Contatto avanti · rovescio chiuso sopra spalla",
  }),
  G({
    sport: "tennis",
    id: "ten-drill-serve-plus-one",
    entryType: "drill",
    name: "Servizio + primo colpo",
    brief: "Schema servizio T wide + avvicinamento e chiuder short.",
    defaultMinutes: 12,
    defaultPeriods: "20+20 servizi",
    defaultSpace: "Scatola servizio + metà campo",
    defaultCue: "Piede anteriore verso obiettivo dopo la rincorsa",
  }),
  G({
    sport: "tennis",
    id: "ten-scheme-ih-attack",
    entryType: "scheme",
    name: "Aggressione diritto inside-out",
    brief: "Palla centrale → diritto IO → chiusura a rete.",
    defaultMinutes: 16,
    defaultPeriods: "4 gruppi × 4′",
    defaultSpace: "Quarto campo avversario",
    defaultCue: "Scalare dopo IO per volè corto",
  }),

  /* —— Boxe —— */
  G({
    sport: "boxing",
    id: "box-drill-foot-ladder",
    entryType: "drill",
    name: "Lavoro piedi + jab in uscita",
    brief: "Entrata angolata e uscita su jab; controllo seduta.",
    defaultMinutes: 12,
    defaultPeriods: "6×2′",
    defaultSpace: "Sacco / partner pad",
    defaultCue: "Menti sopra guantone in uscita",
  }),
  G({
    sport: "boxing",
    id: "box-scheme-inside",
    entryType: "scheme",
    name: "Gioco infighting clinch-legale",
    brief: "Colpi corti, gestione SPACE, uscite su angolo.",
    defaultMinutes: 14,
    defaultPeriods: "5×2′ tecnico",
    defaultSpace: "Ring ridotto 3×3",
    defaultCue: "Respirazione naso su attacco corto",
  }),

  /* —— Karate —— */
  G({
    sport: "karate",
    id: "kar-drill-kata-segment",
    entryType: "drill",
    name: "Segmenti kata · transizioni",
    brief: "4–6 movimenti isolati precisi, reset piedi tra uno e l’altro.",
    defaultMinutes: 15,
    defaultPeriods: "8×90″",
    defaultSpace: "Linea tatami",
    defaultCue: "Kime controllato senza blocco respiratorio",
  }),
  G({
    sport: "karate",
    id: "kar-scheme-kumite-clock",
    entryType: "scheme",
    name: "Kumite 2′ · gestione distanza",
    brief: "Lettura maai; attacco su reset avversario.",
    defaultMinutes: 16,
    defaultPeriods: "6×2′",
    defaultSpace: "8×8 area",
    defaultCue: "Mano guida sempre visibile",
  }),

  /* —— Judo —— */
  G({
    sport: "judo",
    id: "judo-drill-uchi-entry",
    entryType: "drill",
    name: "Entrate ripetute uchi-komi",
    brief: "Kuzushi + ingresso senza completare; simmetria sin/des.",
    defaultMinutes: 14,
    defaultPeriods: "10+10 per tecnica",
    defaultSpace: "Coppie tatami",
    defaultCue: "Tallone perno attivo prima della mano",
  }),
  G({
    sport: "judo",
    id: "judo-scheme-randori-theme",
    entryType: "scheme",
    name: "Randori a tema · ne-waza uscita",
    brief: "Obbligo vincolo 20″ poi lotta in piedi.",
    defaultMinutes: 18,
    defaultPeriods: "5×3′",
    defaultSpace: "Area competizione",
    defaultCue: "Penalizzare stallo senza kumi-kata",
  }),

  /* —— Muay Thai —— */
  G({
    sport: "muay thai",
    id: "mt-drill-clinch-knee",
    entryType: "drill",
    name: "Clinch · ginocchiate alternate",
    brief: "Controlli cranio, punteggio viso interno-esterno.",
    defaultMinutes: 12,
    defaultPeriods: "5×2′",
    defaultSpace: "Coppie · corde libere",
    defaultCue: "Schiena dritta — peso sul compagno",
  }),
  G({
    sport: "muay thai",
    id: "mt-scheme-long-range-teep",
    entryType: "scheme",
    name: "Gestione lungo + teep reset",
    brief: "Distanza jab/teep; entrate su caduta guardia.",
    defaultMinutes: 14,
    defaultPeriods: "6×3′ leggero",
    defaultSpace: "Ring / area 5×5",
    defaultCue: "Tallone a terra sul teep destro",
  }),
];

const GENERIC_FALLBACK: Omit<TechnicalPlaybookEntry, "sport">[] = [
  {
    id: "gen-drill-warm-tech",
    entryType: "drill",
    name: "Riscaldamento tecnico progressivo",
    brief: "Volume basso, enfasi pattern motorio disciplina.",
    defaultMinutes: 12,
    defaultPeriods: "Continuo",
    defaultSpace: "A metà struttura",
    defaultCue: "Qualità prima dell’intensità",
  },
  {
    id: "gen-drill-situational",
    entryType: "drill",
    name: "Lavoro situazionale guidato",
    brief: "Vincoli numerici o spaziali decisi dal coach.",
    defaultMinutes: 15,
    defaultPeriods: "4×3′",
    defaultSpace: "Area adattata",
    defaultCue: "Obiettivo chiaro per fascia",
  },
  {
    id: "gen-scheme-themed",
    entryType: "scheme",
    name: "Schema / partita a tema",
    brief: "Regola ritmo, spazio o obiettivo tattico da imprimere.",
    defaultMinutes: 20,
    defaultPeriods: "2 tempi × 10′",
    defaultSpace: "Campo regolamentare o ridotto",
    defaultCue: "Reset su fallimento tecnico",
  },
];

export function getTechnicalPlaybookForSport(sport: string): TechnicalPlaybookEntry[] {
  const key = sport.trim().toLowerCase();
  const rows = TECHNICAL_PLAYBOOK.filter((e) => e.sport === key);
  if (rows.length > 0) return rows;
  return GENERIC_FALLBACK.map((f) => ({ ...f, sport: key }));
}
