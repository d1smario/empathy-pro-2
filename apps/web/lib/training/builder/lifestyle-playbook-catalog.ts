/**
 * Catalogo esercizi / protocolli macro D (Yoga, Pilates, Mind-body…), strutturato come base “scheda” coach.
 * Chiave `sport` = palette Pro 2 (`sport-macro-palette` · lifestyle).
 */

export type LifestylePracticeCategory =
  | "yoga"
  | "pilates"
  | "breath"
  | "meditation"
  | "mobility"
  | "stretch";

export type LifestylePlaybookEntry = {
  id: string;
  sport: string;
  practiceCategory: LifestylePracticeCategory;
  name: string;
  brief: string;
  defaultRounds: number;
  defaultHoldOrReps: string;
  defaultRestSec: number;
  defaultExecution: string;
  defaultBreath: string;
  defaultCue: string;
};

const P = (partial: Omit<LifestylePlaybookEntry, "sport"> & { sport?: string }): LifestylePlaybookEntry => ({
  sport: partial.sport ?? "",
  id: partial.id,
  practiceCategory: partial.practiceCategory,
  name: partial.name,
  brief: partial.brief,
  defaultRounds: partial.defaultRounds,
  defaultHoldOrReps: partial.defaultHoldOrReps,
  defaultRestSec: partial.defaultRestSec,
  defaultExecution: partial.defaultExecution,
  defaultBreath: partial.defaultBreath,
  defaultCue: partial.defaultCue,
});

export const LIFESTYLE_PLAYBOOK: LifestylePlaybookEntry[] = [
  P({
    sport: "yoga",
    practiceCategory: "yoga",
    id: "yoga-align-foundation",
    name: "Allineamento · posizioni cardine",
    brief: "Tadasana, forward fold guidato, cue costole-bacino.",
    defaultRounds: 2,
    defaultHoldOrReps: "5 respiri/postura",
    defaultRestSec: 30,
    defaultExecution: "Lento controllato",
    defaultBreath: "Naso 4:6",
    defaultCue: "Chiavi addominali leggere, capo lungo",
  }),
  P({
    sport: "yoga",
    practiceCategory: "yoga",
    id: "yoga-vinyasa-short",
    name: "Vinyasa corto · transizioni",
    brief: "Cat-cow, sun A ridotta, enfasi scapolo-pelvi.",
    defaultRounds: 3,
    defaultHoldOrReps: "Flusso 6′",
    defaultRestSec: 60,
    defaultExecution: "Flusso continuo",
    defaultBreath: "Naso 5:5",
    defaultCue: "Meno velocità, più traiettoria",
  }),
  P({
    sport: "yoga",
    practiceCategory: "yoga",
    id: "yoga-yin-recovery",
    name: "Yin recovery",
    brief: "Tenute lunghe, range confortevole, downregulation.",
    defaultRounds: 4,
    defaultHoldOrReps: "90s tenuta",
    defaultRestSec: 45,
    defaultExecution: "Tenute respirate",
    defaultBreath: "Diaframmatica lenta",
    defaultCue: "Non forzare end range",
  }),

  P({
    sport: "pilates",
    practiceCategory: "pilates",
    id: "pilates-core-breath",
    name: "Core + breath sequence",
    brief: "Hundred leggero, dead bug, side kick prep.",
    defaultRounds: 3,
    defaultHoldOrReps: "8 rip / esercizio",
    defaultRestSec: 45,
    defaultExecution: "Tecnica controllata",
    defaultBreath: "Espira nello sforzo",
    defaultCue: "Costole che non “aprono” in crunch",
  }),
  P({
    sport: "pilates",
    practiceCategory: "pilates",
    id: "pilates-segmental",
    name: "Controllo segmentario",
    brief: "Dissociazione bacino-torace, bridge controllato.",
    defaultRounds: 2,
    defaultHoldOrReps: "10 rip lente",
    defaultRestSec: 60,
    defaultExecution: "Lento controllato",
    defaultBreath: "Naso 4:6",
    defaultCue: "Priorità precisione, non ampiezza",
  }),
  P({
    sport: "pilates",
    practiceCategory: "pilates",
    id: "pilates-posture-reset",
    name: "Posture reset",
    brief: "Scapola, ponte, roll-down a muro.",
    defaultRounds: 2,
    defaultHoldOrReps: "45s isometriche",
    defaultRestSec: 40,
    defaultExecution: "Isometrico respirato",
    defaultBreath: "Box 4-4-4-4",
    defaultCue: "Mento neutro, visione orizzonte",
  }),

  P({
    sport: "meditation",
    practiceCategory: "meditation",
    id: "med-focus-breath",
    name: "Focus respirazione 6′",
    brief: "Ancoraggio nasale + body scan sintetico.",
    defaultRounds: 1,
    defaultHoldOrReps: "6′ continui",
    defaultRestSec: 0,
    defaultExecution: "Statico",
    defaultBreath: "Coerenza 6:6",
    defaultCue: "Etichetta pensiero e ritorno al naso",
  }),
  P({
    sport: "meditation",
    practiceCategory: "meditation",
    id: "med-body-scan",
    name: "Body scan breve",
    brief: "Progressione piedi → cranio, arousal basso.",
    defaultRounds: 1,
    defaultHoldOrReps: "10′",
    defaultRestSec: 0,
    defaultExecution: "Statico",
    defaultBreath: "Naso 5:5",
    defaultCue: "Curiosità, non giudizio",
  }),

  P({
    sport: "breathwork",
    practiceCategory: "breath",
    id: "breath-box",
    name: "Box breathing 4-4-4-4",
    brief: "Regolazione pre/post allenamento.",
    defaultRounds: 4,
    defaultHoldOrReps: "8 cicli",
    defaultRestSec: 0,
    defaultExecution: "Cadenzato",
    defaultBreath: "Box 4-4-4-4",
    defaultCue: "Espira leggermente più lungo se ansioso",
  }),
  P({
    sport: "breathwork",
    practiceCategory: "breath",
    id: "breath-coherence",
    name: "Coerenza 6:6",
    brief: "HRV-friendly, simpatico parasimpatico.",
    defaultRounds: 1,
    defaultHoldOrReps: "12′",
    defaultRestSec: 0,
    defaultExecution: "Lento controllato",
    defaultBreath: "Coerenza 6:6",
    defaultCue: "Seduta alta, spalle cadute",
  }),

  P({
    sport: "mobility",
    practiceCategory: "mobility",
    id: "mob-hips-tspine",
    name: "Anche + T-spine",
    brief: "90/90, thoracic open book, quadruped reach.",
    defaultRounds: 2,
    defaultHoldOrReps: "6 rip / lato",
    defaultRestSec: 45,
    defaultExecution: "Flusso continuo",
    defaultBreath: "Naso 4:6",
    defaultCue: "Range senza dolore netto",
  }),
  P({
    sport: "mobility",
    practiceCategory: "mobility",
    id: "mob-global-flow",
    name: "Flow globale 15′",
    brief: "Preparazione tessuti, transizioni morbide.",
    defaultRounds: 1,
    defaultHoldOrReps: "15′ continuo",
    defaultRestSec: 0,
    defaultExecution: "Flusso continuo",
    defaultBreath: "Naso 5:5",
    defaultCue: "Respira nel cambio direzione",
  }),

  P({
    sport: "stretching",
    practiceCategory: "stretch",
    id: "stretch-lower-chain",
    name: "Catena posteriore",
    brief: "Psoas friendly, hamstring PNFs leggeri.",
    defaultRounds: 2,
    defaultHoldOrReps: "45s / lato",
    defaultRestSec: 30,
    defaultExecution: "Lento controllato",
    defaultBreath: "Espira in allungamento",
    defaultCue: "Evita lock ginocchio iperesteso",
  }),
  P({
    sport: "stretching",
    practiceCategory: "stretch",
    id: "stretch-shoulder-neck",
    name: "Spalla · collo",
    brief: "Porte, cross-body, upper trap release.",
    defaultRounds: 2,
    defaultHoldOrReps: "30s × 3",
    defaultRestSec: 20,
    defaultExecution: "Lento controllato",
    defaultBreath: "Diaframmatica lenta",
    defaultCue: "Spalle lontano dalle orecchie",
  }),
];

const GENERIC_LIFESTYLE_FALLBACK: Omit<LifestylePlaybookEntry, "sport">[] = [
  {
    id: "gen-mind-body-base",
    practiceCategory: "mobility",
    name: "Circuito mind-body base",
    brief: "Mobilità articolare + respiro consapevole.",
    defaultRounds: 2,
    defaultHoldOrReps: "12′ blocco",
    defaultRestSec: 60,
    defaultExecution: "Tecnica controllata",
    defaultBreath: "Naso 5:5",
    defaultCue: "Qualità prima dell’ampiezza",
  },
  {
    id: "gen-recovery-breath",
    practiceCategory: "breath",
    name: "Recovery respiratorio",
    brief: "Downregulation autonomica.",
    defaultRounds: 1,
    defaultHoldOrReps: "8′",
    defaultRestSec: 0,
    defaultExecution: "Lento controllato",
    defaultBreath: "Coerenza 6:6",
    defaultCue: "Sedia o supino, stesso schema",
  },
];

export function getLifestylePlaybookForSport(sport: string): LifestylePlaybookEntry[] {
  const key = sport.trim().toLowerCase();
  const rows = LIFESTYLE_PLAYBOOK.filter((e) => e.sport === key);
  if (rows.length > 0) return rows;
  return GENERIC_LIFESTYLE_FALLBACK.map((f) => ({ ...f, sport: key }));
}

export function lifestyleCategoryLabel(c: LifestylePracticeCategory): string {
  const map: Record<LifestylePracticeCategory, string> = {
    yoga: "Yoga",
    pilates: "Pilates",
    breath: "Respiro",
    meditation: "Meditazione",
    mobility: "Mobilità",
    stretch: "Stretching",
  };
  return map[c];
}
