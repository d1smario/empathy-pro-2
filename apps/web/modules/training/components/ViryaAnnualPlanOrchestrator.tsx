"use client";

import {
  Activity,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flag,
  Layers,
  LineChart,
  TableProperties,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { cn } from "@/lib/cn";
import type { TrainingPlannerContextViewModel } from "@/api/training/contracts";
import {
  serializePro2BuilderSessionContract,
  type Pro2BuilderBlockContract,
} from "@/lib/training/builder/pro2-session-contract";
import {
  getLifestyleProtocolMediaUrl,
  getLifestyleProtocolsForDiscipline,
  getTechnicalDrillMediaUrl,
  LIFESTYLE_DISCIPLINES,
  TECHNICAL_SPORT_DISCIPLINES,
  getTechnicalDrillsForDiscipline,
} from "@/lib/training/libraries";
import type { AdaptationTarget, SessionGoalRequest, TrainingDomain } from "@/lib/training/engine";
import type { BuilderSessionOperationalScalingViewModel } from "@/api/training/contracts";
import { materializePro2BlocksFromEngine } from "@/lib/training/virya/materialize-pro2-blocks-from-engine";
import { generateBuilderSession } from "@/modules/training/services/training-engine-api";
import { replaceTrainingPlannerCalendar } from "@/modules/training/services/training-write-api";

type PhaseType = "base" | "build" | "refine" | "peak" | "deload" | "second_peak";
type RaceType = "warmup" | "test" | "goal" | "milestone";

/** Obiettivi focali settimanali (tabella programma). */
export type WeekObjectiveKey =
  | "forza"
  | "aerobico"
  | "anaerobico"
  | "lattato"
  | "sprint_agilita"
  | "neuromotorio"
  | "tecnico_tattico"
  | "recupero";

const WEEK_FOCUS_OPTIONS: { id: WeekObjectiveKey; label: string }[] = [
  { id: "forza", label: "Forza" },
  { id: "aerobico", label: "Aerobico" },
  { id: "anaerobico", label: "Anaerobico" },
  { id: "lattato", label: "Lattato" },
  { id: "sprint_agilita", label: "Sprint / agilità" },
  { id: "neuromotorio", label: "Neuromotorio" },
  { id: "tecnico_tattico", label: "Tecnico-tattico" },
  { id: "recupero", label: "Recupero" },
];

/** Stili chip attivo/off per contrasto rosa / arancio su fondo scuro. */
const WEEK_FOCUS_CHIP_STYLES: Record<WeekObjectiveKey, { on: string; off: string }> = {
  forza: {
    on: "border-fuchsia-400 bg-fuchsia-500/35 text-fuchsia-50 shadow-[0_0_14px_rgba(232,121,249,0.35)]",
    off: "border-fuchsia-500/25 bg-black/50 text-fuchsia-200/35 hover:border-fuchsia-400/45 hover:text-fuchsia-200/70",
  },
  aerobico: {
    on: "border-orange-400 bg-orange-500/35 text-orange-50 shadow-[0_0_14px_rgba(251,146,60,0.35)]",
    off: "border-orange-500/25 bg-black/50 text-orange-200/35 hover:border-orange-400/45 hover:text-orange-200/70",
  },
  anaerobico: {
    on: "border-rose-400 bg-rose-500/35 text-rose-50 shadow-[0_0_14px_rgba(251,113,133,0.35)]",
    off: "border-rose-500/25 bg-black/50 text-rose-200/35 hover:border-rose-400/45 hover:text-rose-200/70",
  },
  lattato: {
    on: "border-pink-400 bg-pink-500/30 text-pink-50 shadow-[0_0_14px_rgba(244,114,182,0.35)]",
    off: "border-pink-500/25 bg-black/50 text-pink-200/35 hover:border-pink-400/45 hover:text-pink-200/70",
  },
  sprint_agilita: {
    on: "border-amber-400 bg-amber-500/30 text-amber-50 shadow-[0_0_14px_rgba(251,191,36,0.35)]",
    off: "border-amber-500/25 bg-black/50 text-amber-200/35 hover:border-amber-400/45 hover:text-amber-200/70",
  },
  neuromotorio: {
    on: "border-violet-400 bg-violet-500/35 text-violet-50 shadow-[0_0_14px_rgba(167,139,250,0.35)]",
    off: "border-violet-500/25 bg-black/50 text-violet-200/35 hover:border-violet-400/45 hover:text-violet-200/70",
  },
  tecnico_tattico: {
    on: "border-cyan-400 bg-cyan-500/25 text-cyan-50 shadow-[0_0_14px_rgba(34,211,238,0.28)]",
    off: "border-cyan-600/30 bg-black/50 text-cyan-200/35 hover:border-cyan-400/45 hover:text-cyan-200/70",
  },
  recupero: {
    on: "border-emerald-400 bg-emerald-500/25 text-emerald-50 shadow-[0_0_14px_rgba(52,211,153,0.28)]",
    off: "border-emerald-600/30 bg-black/50 text-emerald-200/35 hover:border-emerald-400/45 hover:text-emerald-200/70",
  },
};
type SportFamily = "aerobic" | "strength" | "technical" | "lifestyle";
type GymPrimaryGoal = "massa" | "forza" | "potenza" | "rapidita" | "definizione" | "resistenza";
type GymMacroObjective =
  | "forza"
  | "massa"
  | "definizione"
  | "potenza"
  | "ipertrofia_miofibrillare"
  | "ipertrofia_sarcoplasmatica"
  | "neuromuscolare"
  | "posturale"
  | "stretching"
  | "mobilita";

type PhasePlan = {
  id: string;
  start: string;
  end: string;
  phase: PhaseType;
  macroObjective?: string;
  mesocycle: string;
  weeklyTss: number;
  sessionsPerWeek: number;
  notes: string;
};

type RacePlan = {
  id: string;
  date: string;
  name: string;
  raceType: RaceType;
  priority: "A" | "B" | "C";
};

type GoalTargets = {
  distanceKm: number | null;
  durationMin: number | null;
  speedAvgKmh: number | null;
  powerAvgW: number | null;
  elevationM: number | null;
  workKj: number | null;
};

type MultiSportTarget = {
  sport: string;
  loadSharePct: number | null;
  distanceKm: number | null;
  durationMin: number | null;
  speedAvgKmh: number | null;
  powerAvgW: number | null;
  elevationM: number | null;
  workKj: number | null;
};

type GymDayModule = {
  dayIndex: number;
  district: string;
  districtObjective: string;
  exerciseType: string;
  methodology: string;
};

type TechnicalDayModule = {
  dayIndex: number;
  objectives: string[];
  exerciseType: string;
  intensity: string;
  methodology: string;
};

type LifestyleDayModule = {
  dayIndex: number;
  objective: string;
  practiceType: string;
  intensityRpe: number;
  breathingCadence: string;
  holdOrFlow: string;
  methodology: string;
};

const phaseLabels: Record<PhaseType, string> = {
  base: "Base",
  build: "Costruzione",
  refine: "Rifinitura",
  peak: "Forma",
  deload: "Scarico",
  second_peak: "Secondo picco",
};

const sportFamilies: { id: SportFamily; label: string; sports: string[] }[] = [
  {
    id: "aerobic",
    label: "A · Sport aerobico / anaerobico",
    sports: ["Ciclismo", "Running", "MTB", "Gravel", "Triathlon", "Nuoto", "XC Ski", "Alpinismo", "Canoa"],
  },
  {
    id: "strength",
    label: "B · Gym & Performance",
    sports: ["Gym", "Hyrox", "Crossfit", "Powerlifting"],
  },
  {
    id: "technical",
    label: "C · Sport tecnici / tattici",
    sports: [...TECHNICAL_SPORT_DISCIPLINES],
  },
  {
    id: "lifestyle",
    label: "D · Lifestyle",
    sports: [...LIFESTYLE_DISCIPLINES],
  },
];
const allSports = Array.from(new Set(sportFamilies.flatMap((f) => f.sports)));
const gymGoalLabels: Array<{ id: GymPrimaryGoal; label: string }> = [
  { id: "massa", label: "Massa" },
  { id: "forza", label: "Forza" },
  { id: "potenza", label: "Potenza" },
  { id: "rapidita", label: "Rapidita" },
  { id: "definizione", label: "Definizione" },
  { id: "resistenza", label: "Resistenza" },
];
const gymMacroObjectiveLabels: Array<{ id: GymMacroObjective; label: string }> = [
  { id: "forza", label: "Forza" },
  { id: "massa", label: "Massa" },
  { id: "definizione", label: "Definizione" },
  { id: "potenza", label: "Potenza" },
  { id: "ipertrofia_miofibrillare", label: "Ipertrofia miofibrillare" },
  { id: "ipertrofia_sarcoplasmatica", label: "Ipertrofia sarcoplasmatica" },
  { id: "neuromuscolare", label: "Neuromuscolare" },
  { id: "posturale", label: "Posturale" },
  { id: "stretching", label: "Stretching" },
  { id: "mobilita", label: "Mobilita" },
];
const gymDistrictOptions = [
  "Petto",
  "Spalle",
  "Dorsali",
  "Schiena",
  "Addominali",
  "Gambe",
  "Polpacci",
  "Glutei",
  "Femorali",
  "Quadricipiti",
  "Braccia",
  "Avambraccia",
  "Total body",
];
const gymDistrictObjectiveOptions = [
  "Forza",
  "Massa",
  "Definizione",
  "Potenza",
  "Neuromuscolare",
  "Posturale",
  "Stretching",
  "Mobilita",
];
const gymExerciseTypeOptions = ["Corpo libero", "Pesi", "Macchine", "Cavi", "Isometrico", "Pliometria", "Crossfit", "Hyrox"];
const gymMethodologyOptions = [
  "Lento controllato",
  "Max velocita",
  "Superserie",
  "Discesa lenta",
  "Spinta veloce",
  "Isometrico",
  "Pliometrico",
  "Circuito",
];
const technicalObjectiveOptions = [
  "Condizione fisica",
  "Aerobico",
  "Anaerobico",
  "Velocita",
  "Forza",
  "Recupero",
  "Tecnica con modulo",
  "Fase offensiva",
  "Fase difensiva",
  "Schemi",
  "Partita",
];
const technicalExerciseTypeOptions = [
  "Riscaldamento tecnico",
  "Rondo/possesso",
  "Lavoro tecnico individuale",
  "Situazionale",
  "Small sided game",
  "Lavoro tattico a reparti",
  "Transizioni",
  "Partita a tema",
  "Partita libera",
  "Defaticamento",
];
const technicalIntensityOptions = ["Bassa", "Media", "Alta", "Massimale"];
const technicalMethodologyOptions = [
  "Progressivo",
  "Intermittente",
  "Blocco tecnico",
  "Blocco tattico",
  "Circuito",
  "Partita condizionata",
];
const lifestyleObjectiveOptions = [
  "Recupero autonomico",
  "Mobilita articolare",
  "Flessibilita",
  "Core stability",
  "Controllo posturale",
  "Riduzione stress",
  "Controllo respiratorio",
  "Consapevolezza corporea",
];
const lifestylePracticeOptions = ["Yoga Hatha", "Yoga Vinyasa", "Yoga Yin", "Pilates Mat", "Pilates Reformer", "Breathwork", "Meditazione guidata", "Mobility flow"];
const lifestyleBreathingOptions = ["Naso 4:6", "Naso 5:5", "Box 4:4:4:4", "Diaframmatica lenta", "Coerenza 6:6"];
const lifestyleHoldFlowOptions = ["Tenute 20-40s", "Tenute 45-90s", "Flow continuo", "Flow + pause", "Isometrie respirate"];
const lifestyleMethodologyOptions = ["Progressivo", "Rigenerativo", "Tecnica controllata", "Mind-body", "Recovery focus"];

function sportIcon(name: string): string {
  const map: Record<string, string> = {
    Ciclismo: "🚴",
    Running: "🏃",
    MTB: "🚵",
    Gravel: "🚴",
    Triathlon: "🏊",
    Nuoto: "🏊",
    "XC Ski": "⛷️",
    Alpinismo: "🧗",
    Canoa: "🚣",
    Gym: "🏋️",
    Hyrox: "💥",
    Crossfit: "🔥",
    Powerlifting: "🏋️",
    Calcio: "⚽",
    Tennis: "🎾",
    Pallavolo: "🏐",
    Basket: "🏀",
    Boxe: "🥊",
    Karate: "🥋",
    Judo: "🥋",
    "Muay Thai": "🥊",
    Yoga: "🧘",
    Meditazione: "🧠",
    Pilates: "🤸",
    Breathwork: "🫁",
    Mobility: "🌀",
  };
  return map[name] ?? "•";
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function weeksBetween(a: string, b: string): number {
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.max(1, Math.ceil((end - start + 1) / (1000 * 60 * 60 * 24 * 7)));
}

function phaseColor(phase: PhaseType): string {
  const map: Record<PhaseType, string> = {
    base: "#00c2ff",
    build: "#00e08d",
    refine: "#ffd60a",
    peak: "#ff9e00",
    deload: "#9ca3af",
    second_peak: "#ff00a8",
  };
  return map[phase];
}

/** Sfondo riga / tint input da fase (hex + alpha 8 cifre). */
function phaseRowBackground(phase: PhaseType): string {
  return `${phaseColor(phase)}18`;
}

function phaseCellBorder(phase: PhaseType): string {
  return `${phaseColor(phase)}55`;
}

function tssColor(tss: number): string {
  if (tss >= 560) return "#ff00a8";
  if (tss >= 500) return "#ff9e00";
  if (tss >= 420) return "#ffd60a";
  if (tss >= 300) return "#00e08d";
  return "#9ca3af";
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function demandScore(target: GoalTargets) {
  const distanceScore = target.distanceKm != null ? clamp(target.distanceKm / 180, 0, 1.6) : 0;
  const durationScore = target.durationMin != null ? clamp(target.durationMin / 360, 0, 1.6) : 0;
  const speedScore = target.speedAvgKmh != null ? clamp(target.speedAvgKmh / 34, 0, 1.5) : 0;
  const powerScore = target.powerAvgW != null ? clamp(target.powerAvgW / 280, 0, 1.6) : 0;
  const elevationScore = target.elevationM != null ? clamp(target.elevationM / 2500, 0, 1.4) : 0;
  const workScore = target.workKj != null ? clamp(target.workKj / 2600, 0, 1.6) : 0;

  const weighted =
    0.2 * distanceScore +
    0.15 * durationScore +
    0.18 * speedScore +
    0.22 * powerScore +
    0.1 * elevationScore +
    0.15 * workScore;
  return clamp(weighted, 0.25, 1.7);
}

function targetSummary(target: GoalTargets) {
  const bits: string[] = [];
  if (target.distanceKm != null) bits.push(`${target.distanceKm}km`);
  if (target.durationMin != null) bits.push(`${target.durationMin}min`);
  if (target.speedAvgKmh != null) bits.push(`${target.speedAvgKmh}kmh`);
  if (target.powerAvgW != null) bits.push(`${target.powerAvgW}W`);
  if (target.elevationM != null) bits.push(`${target.elevationM}m D+`);
  if (target.workKj != null) bits.push(`${target.workKj}kJ`);
  return bits.length ? bits.join(" · ") : "target non specificato";
}

function emptyTargetSport(sport = ""): MultiSportTarget {
  return {
    sport,
    loadSharePct: null,
    distanceKm: null,
    durationMin: null,
    speedAvgKmh: null,
    powerAvgW: null,
    elevationM: null,
    workKj: null,
  };
}

function aggregateGoalTargets(targets: MultiSportTarget[]): GoalTargets {
  const sum = {
    distanceKm: 0,
    durationMin: 0,
    speedAvgKmhWeighted: 0,
    powerAvgWWeighted: 0,
    elevationM: 0,
    workKj: 0,
    speedWeight: 0,
    powerWeight: 0,
  };
  for (const t of targets) {
    const share = clamp((t.loadSharePct ?? 0) / 100, 0, 1);
    if ((t.distanceKm ?? 0) > 0) sum.distanceKm += t.distanceKm ?? 0;
    if ((t.durationMin ?? 0) > 0) sum.durationMin += t.durationMin ?? 0;
    if ((t.elevationM ?? 0) > 0) sum.elevationM += t.elevationM ?? 0;
    if ((t.workKj ?? 0) > 0) sum.workKj += t.workKj ?? 0;
    if ((t.speedAvgKmh ?? 0) > 0) {
      sum.speedAvgKmhWeighted += (t.speedAvgKmh ?? 0) * Math.max(share, 0.0001);
      sum.speedWeight += Math.max(share, 0.0001);
    }
    if ((t.powerAvgW ?? 0) > 0) {
      sum.powerAvgWWeighted += (t.powerAvgW ?? 0) * Math.max(share, 0.0001);
      sum.powerWeight += Math.max(share, 0.0001);
    }
  }
  return {
    distanceKm: sum.distanceKm > 0 ? Math.round(sum.distanceKm) : null,
    durationMin: sum.durationMin > 0 ? Math.round(sum.durationMin) : null,
    speedAvgKmh: sum.speedWeight > 0 ? Math.round((sum.speedAvgKmhWeighted / sum.speedWeight) * 10) / 10 : null,
    powerAvgW: sum.powerWeight > 0 ? Math.round(sum.powerAvgWWeighted / sum.powerWeight) : null,
    elevationM: sum.elevationM > 0 ? Math.round(sum.elevationM) : null,
    workKj: sum.workKj > 0 ? Math.round(sum.workKj) : null,
  };
}

function defaultPhases(start: string): PhasePlan[] {
  return [
    {
      id: crypto.randomUUID(),
      start,
      end: addDays(start, 55),
      phase: "base",
      mesocycle: "M1",
      weeklyTss: 460,
      sessionsPerWeek: 6,
      notes: "Volume progressivo + lavori estensivi",
    },
    {
      id: crypto.randomUUID(),
      start: addDays(start, 56),
      end: addDays(start, 111),
      phase: "build",
      mesocycle: "M2",
      weeklyTss: 560,
      sessionsPerWeek: 7,
      notes: "Incremento qualità + intensità controllata",
    },
    {
      id: crypto.randomUUID(),
      start: addDays(start, 112),
      end: addDays(start, 139),
      phase: "refine",
      mesocycle: "M3",
      weeklyTss: 510,
      sessionsPerWeek: 6,
      notes: "Rifinitura specifica evento",
    },
    {
      id: crypto.randomUUID(),
      start: addDays(start, 140),
      end: addDays(start, 154),
      phase: "peak",
      mesocycle: "M4",
      weeklyTss: 430,
      sessionsPerWeek: 5,
      notes: "Picco forma + taper graduale",
    },
  ];
}

function buildGymDayModules(daysPerWeek: number): GymDayModule[] {
  const safeDays = clamp(daysPerWeek, 1, 7);
  return Array.from({ length: safeDays }, (_, idx) => ({
    dayIndex: idx + 1,
    district: idx % 2 === 0 ? "Gambe" : "Petto",
    districtObjective: "Forza",
    exerciseType: "Pesi",
    methodology: "Lento controllato",
  }));
}

function buildTechnicalDayModules(daysPerWeek: number): TechnicalDayModule[] {
  const safeDays = clamp(daysPerWeek, 1, 7);
  return Array.from({ length: safeDays }, (_, idx) => ({
    dayIndex: idx + 1,
    objectives: idx % 3 === 0 ? ["Condizione fisica", "Tecnica con modulo"] : idx % 3 === 1 ? ["Fase offensiva", "Schemi"] : ["Fase difensiva", "Partita"],
    exerciseType: idx % 2 === 0 ? "Lavoro tattico a reparti" : "Small sided game",
    intensity: idx % 2 === 0 ? "Media" : "Alta",
    methodology: "Progressivo",
  }));
}

function buildLifestyleDayModules(daysPerWeek: number): LifestyleDayModule[] {
  const safeDays = clamp(daysPerWeek, 1, 7);
  return Array.from({ length: safeDays }, (_, idx) => ({
    dayIndex: idx + 1,
    objective: idx % 2 === 0 ? "Mobilita articolare" : "Recupero autonomico",
    practiceType: idx % 2 === 0 ? "Yoga Hatha" : "Pilates Mat",
    intensityRpe: idx % 3 === 0 ? 4 : 3,
    breathingCadence: "Naso 5:5",
    holdOrFlow: "Tenute 20-40s",
    methodology: "Rigenerativo",
  }));
}

function buildGymMacroPhases(start: string, end: string, phaseCount: number): PhasePlan[] {
  const count = Math.max(1, Math.min(8, Math.round(phaseCount)));
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    return defaultPhases(isoToday());
  }
  const totalDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const chunk = Math.max(7, Math.floor(totalDays / count));
  return Array.from({ length: count }, (_, i) => {
    const phaseStart = addDays(start, i * chunk);
    const rawEnd = i === count - 1 ? end : addDays(phaseStart, Math.max(6, chunk - 1));
    const phaseTypes: PhaseType[] = ["base", "build", "refine", "peak", "deload", "second_peak"];
    const pType = phaseTypes[Math.min(i, phaseTypes.length - 1)];
    const objective = gymMacroObjectiveLabels[Math.min(i, gymMacroObjectiveLabels.length - 1)]?.id ?? "forza";
    return {
      id: crypto.randomUUID(),
      start: phaseStart,
      end: rawEnd,
      phase: pType,
      macroObjective: objective,
      mesocycle: `M${i + 1}`,
      weeklyTss: pType === "peak" ? 420 : pType === "build" ? 560 : pType === "deload" ? 320 : 500,
      sessionsPerWeek: pType === "deload" ? 4 : 5,
      notes: `Gym phase objective ${objective}`,
    };
  });
}

export type ViryaAnnualPlanOrchestratorProps = {
  athleteId: string | null;
  viryaContext: TrainingPlannerContextViewModel | null;
  contextLoading: boolean;
};

export function ViryaAnnualPlanOrchestrator({
  athleteId: selectedAthleteId,
  viryaContext,
  contextLoading,
}: ViryaAnnualPlanOrchestratorProps) {
  const start = isoToday();
  const [planName, setPlanName] = useState("EMPATHY Annual Strategy");
  const [sportFamily, setSportFamily] = useState<SportFamily>("aerobic");
  const [discipline, setDiscipline] = useState("Ciclismo");
  const [objective, setObjective] = useState("Miglioramento performance metabolica con doppio picco");
  const [sportTargets, setSportTargets] = useState<MultiSportTarget[]>([
    { ...emptyTargetSport("Ciclismo"), loadSharePct: 100 },
    emptyTargetSport(""),
    emptyTargetSport(""),
  ]);
  const [gymPrimaryGoal, setGymPrimaryGoal] = useState<GymPrimaryGoal>("forza");
  const [gymPlanStart, setGymPlanStart] = useState(start);
  const [gymPlanEnd, setGymPlanEnd] = useState(addDays(start, 364));
  const [gymMacroPhaseCount, setGymMacroPhaseCount] = useState(4);
  const [gymTrainingDaysPerWeek, setGymTrainingDaysPerWeek] = useState(5);
  const [gymDayModules, setGymDayModules] = useState<GymDayModule[]>(buildGymDayModules(5));
  const [technicalPlanStart, setTechnicalPlanStart] = useState(start);
  const [technicalPlanEnd, setTechnicalPlanEnd] = useState(addDays(start, 364));
  const [technicalMacroPhaseCount, setTechnicalMacroPhaseCount] = useState(4);
  const [technicalTrainingDaysPerWeek, setTechnicalTrainingDaysPerWeek] = useState(5);
  const [technicalDayModules, setTechnicalDayModules] = useState<TechnicalDayModule[]>(buildTechnicalDayModules(5));
  const [lifestylePlanStart, setLifestylePlanStart] = useState(start);
  const [lifestylePlanEnd, setLifestylePlanEnd] = useState(addDays(start, 364));
  const [lifestyleMacroPhaseCount, setLifestyleMacroPhaseCount] = useState(4);
  const [lifestyleTrainingDaysPerWeek, setLifestyleTrainingDaysPerWeek] = useState(5);
  const [lifestyleDayModules, setLifestyleDayModules] = useState<LifestyleDayModule[]>(buildLifestyleDayModules(5));
  const [selectedGymWeekStart, setSelectedGymWeekStart] = useState<string>("");
  const [selectedTechnicalWeekStart, setSelectedTechnicalWeekStart] = useState<string>("");
  const [selectedLifestyleWeekStart, setSelectedLifestyleWeekStart] = useState<string>("");
  const [phases, setPhases] = useState<PhasePlan[]>(defaultPhases(start));
  const [races, setRaces] = useState<RacePlan[]>([
    { id: crypto.randomUUID(), date: addDays(start, 70), name: "Gara test #1", raceType: "test", priority: "B" },
    { id: crypto.randomUUID(), date: addDays(start, 150), name: "Gara obiettivo", raceType: "goal", priority: "A" },
  ]);
  const [gymWeekCustomizations, setGymWeekCustomizations] = useState<
    Record<string, { sessionsPerWeek: number; loadPct: number; modules: GymDayModule[] }>
  >({});
  const [technicalWeekCustomizations, setTechnicalWeekCustomizations] = useState<
    Record<string, { sessionsPerWeek: number; loadPct: number; modules: TechnicalDayModule[] }>
  >({});
  const [lifestyleWeekCustomizations, setLifestyleWeekCustomizations] = useState<
    Record<string, { sessionsPerWeek: number; loadPct: number; modules: LifestyleDayModule[] }>
  >({});
  const [replacePrevious, setReplacePrevious] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viryaStep, setViryaStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [planWindowStart, setPlanWindowStart] = useState(start);
  const [planWindowEnd, setPlanWindowEnd] = useState(() => {
    const d = defaultPhases(start);
    return d[d.length - 1]?.end ?? addDays(start, 160);
  });
  const [weeklyProgramOverrides, setWeeklyProgramOverrides] = useState<
    Record<
      string,
      {
        weeklyTss?: number;
        sessionsPerWeek?: number;
        hoursPerWeek?: number;
        objectives?: WeekObjectiveKey[];
      }
    >
  >({});

  const familySports = sportFamilies.find((f) => f.id === sportFamily)?.sports ?? [];
  const defaultTechnicalDrill = useMemo(() => getTechnicalDrillsForDiscipline(discipline)[0] ?? null, [discipline]);
  const defaultLifestyleProtocol = useMemo(() => getLifestyleProtocolsForDiscipline(discipline)[0] ?? null, [discipline]);

  const annualProjection = useMemo(() => {
    const weeks: {
      week: number;
      weekStart: string;
      tss: number;
      phase: string;
      phaseType: PhaseType;
      sessions: number;
    }[] = [];
    let idx = 1;
    for (const p of phases) {
      const wc = weeksBetween(p.start, p.end);
      for (let w = 0; w < wc; w += 1) {
        const weekStart = addDays(p.start, w * 7);
        const progressive = p.phase === "build" ? 1 + Math.min(0.14, w * 0.02) : 1;
        const taper = p.phase === "peak" || p.phase === "deload" ? Math.max(0.68, 1 - w * 0.08) : 1;
        const baseTss = Math.round(p.weeklyTss * progressive * taper);
        const custom =
          sportFamily === "strength"
            ? gymWeekCustomizations[weekStart]
            : sportFamily === "technical"
              ? technicalWeekCustomizations[weekStart]
              : sportFamily === "lifestyle"
                ? lifestyleWeekCustomizations[weekStart]
              : undefined;
        const loadPct = custom ? clamp(custom.loadPct, 50, 180) : 100;
        const finalTss = Math.round(baseTss * (loadPct / 100));
        weeks.push({
          week: idx,
          weekStart,
          tss: finalTss,
          phase: phaseLabels[p.phase],
          phaseType: p.phase,
          sessions: custom?.sessionsPerWeek ?? p.sessionsPerWeek,
        });
        idx += 1;
      }
    }
    return weeks;
  }, [phases, sportFamily, gymWeekCustomizations, technicalWeekCustomizations, lifestyleWeekCustomizations]);

  const programWeekRows = useMemo(
    () =>
      annualProjection.map((row) => {
        const o = weeklyProgramOverrides[row.weekStart];
        return {
          ...row,
          displayTss: o?.weeklyTss ?? row.tss,
          displaySessions: o?.sessionsPerWeek ?? row.sessions,
          hoursPerWeek: o?.hoursPerWeek,
          objectives: o?.objectives ?? [],
        };
      }),
    [annualProjection, weeklyProgramOverrides],
  );

  const annualLoad = programWeekRows.slice(0, 52).map((w) => w.displayTss);
  while (annualLoad.length < 52) annualLoad.push(0);
  const maxAnnual = Math.max(...annualLoad, 1);

  const totalSessions = programWeekRows.reduce((sum, w) => sum + w.displaySessions, 0);
  const totalTss = programWeekRows.reduce((sum, w) => sum + w.displayTss, 0);
  const goalTargets = useMemo(() => aggregateGoalTargets(sportTargets), [sportTargets]);
  const physiologyDrive = useMemo(() => {
    const physiology = viryaContext?.physiologyState;
    const twin = viryaContext?.twinState;
    return {
      ftp: physiology?.physiologicalProfile.ftpWatts ?? null,
      vLamax: physiology?.metabolicProfile.vLamax ?? physiology?.physiologicalProfile.vLamax ?? null,
      oxidativeBottleneck: physiology?.performanceProfile.oxidativeBottleneckIndex ?? null,
      gutDelivery: physiology?.lactateProfile.bloodDeliveryPctOfIngested ?? null,
      coriReturn: physiology?.lactateProfile.glucoseFromCoriG ?? null,
      glycogen: twin?.glycogenStatus ?? null,
      readiness: twin?.readiness ?? null,
    };
  }, [viryaContext]);
  const operationalContext = viryaContext?.operationalContext ?? null;
  const recoverySummary = viryaContext?.recoverySummary ?? null;
  const adaptationLoop = viryaContext?.adaptationLoop ?? null;
  const bioenergeticModulation = viryaContext?.bioenergeticModulation ?? null;
  const objectiveDemand = useMemo(() => {
    if (sportFamily === "strength") {
      const daysFactor = clamp(gymTrainingDaysPerWeek / 5, 0.7, 1.35);
      const uniqueTypes = new Set(gymDayModules.map((m) => m.exerciseType).filter(Boolean)).size;
      const modeFactor = clamp(1 + (Math.max(1, uniqueTypes) - 1) * 0.06, 1, 1.24);
      const goalFactor =
        gymPrimaryGoal === "potenza" || gymPrimaryGoal === "rapidita"
          ? 1.1
          : gymPrimaryGoal === "forza"
            ? 1.08
            : gymPrimaryGoal === "massa"
              ? 1.05
              : gymPrimaryGoal === "resistenza"
                ? 1.0
                : 0.95;
      return clamp(1.0 * daysFactor * modeFactor * goalFactor, 0.5, 2.1);
    }
    if (sportFamily === "technical") {
      const daysFactor = clamp(technicalTrainingDaysPerWeek / 5, 0.75, 1.35);
      const objectiveVariety = Math.max(1, new Set(technicalDayModules.flatMap((m) => m.objectives)).size);
      const objectiveFactor = clamp(1 + (objectiveVariety - 1) * 0.02, 1, 1.22);
      const intensityFactor = clamp(
        technicalDayModules.reduce((acc, m) => acc + (m.intensity === "Massimale" ? 1.2 : m.intensity === "Alta" ? 1.1 : m.intensity === "Media" ? 1.0 : 0.9), 0) /
          Math.max(1, technicalDayModules.length),
        0.85,
        1.2,
      );
      return clamp(1.0 * daysFactor * objectiveFactor * intensityFactor, 0.5, 2.1);
    }
    if (sportFamily === "lifestyle") {
      const daysFactor = clamp(lifestyleTrainingDaysPerWeek / 5, 0.75, 1.3);
      const avgRpe =
        lifestyleDayModules.reduce((acc, m) => acc + clamp(m.intensityRpe, 1, 10), 0) / Math.max(1, lifestyleDayModules.length);
      const rpeFactor = clamp(avgRpe / 4.5, 0.7, 1.25);
      const variety = Math.max(1, new Set(lifestyleDayModules.map((m) => m.practiceType)).size);
      const varietyFactor = clamp(1 + (variety - 1) * 0.03, 1, 1.2);
      return clamp(0.95 * daysFactor * rpeFactor * varietyFactor, 0.45, 1.9);
    }
    const active = sportTargets.filter((t) => (t.sport ?? "").trim() !== "");
    if (!active.length) return demandScore(goalTargets);
    const sumShares = active.reduce((s, t) => s + Math.max(0, t.loadSharePct ?? 0), 0);
    const weighted = active.reduce((acc, t) => {
      const localDemand = demandScore({
        distanceKm: t.distanceKm,
        durationMin: t.durationMin,
        speedAvgKmh: t.speedAvgKmh,
        powerAvgW: t.powerAvgW,
        elevationM: t.elevationM,
        workKj: t.workKj,
      });
      const w = sumShares > 0 ? Math.max(0, t.loadSharePct ?? 0) / sumShares : 1 / active.length;
      return acc + localDemand * w;
    }, 0);
    return clamp(weighted, 0.25, 1.9);
  }, [sportFamily, gymTrainingDaysPerWeek, gymDayModules, gymPrimaryGoal, technicalTrainingDaysPerWeek, technicalDayModules, lifestyleTrainingDaysPerWeek, lifestyleDayModules, sportTargets, goalTargets]);
  const goalSummary = useMemo(() => targetSummary(goalTargets), [goalTargets]);
  const goalRaceDate = useMemo(() => {
    const sorted = [...races]
      .filter((r) => r.raceType === "goal")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return sorted[0]?.date ?? null;
  }, [races]);
  const sportFamilyLabel = useMemo(
    () => sportFamilies.find((option) => option.id === sportFamily)?.label.split("·")[1]?.trim() ?? sportFamilies.find((option) => option.id === sportFamily)?.label ?? sportFamily,
    [sportFamily],
  );
  const viryaHeroStats = useMemo(
    () => [
      { label: "Family", value: sportFamilyLabel },
      { label: "Discipline", value: discipline },
      { label: "Phases", value: String(phases.length) },
      { label: "Annual TSS", value: String(totalTss) },
    ],
    [discipline, phases.length, sportFamilyLabel, totalTss],
  );
  const viryaSummaryCards = useMemo<
    Array<{ label: string; value: string; tone: "cyan" | "green" | "amber" | "rose" | "slate" }>
  >(
    () => [
      { label: "Goal date", value: goalRaceDate ? new Date(`${goalRaceDate}T00:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "Open", tone: "amber" },
      { label: "Sessions", value: String(totalSessions), tone: "cyan" },
      { label: "Demand", value: objectiveDemand.toFixed(2), tone: objectiveDemand >= 1.2 ? "rose" : objectiveDemand >= 0.9 ? "amber" : "green" },
      { label: "Readiness", value: physiologyDrive.readiness != null ? `${physiologyDrive.readiness.toFixed(0)}%` : "—", tone: "green" },
      { label: "Bioenergetic", value: bioenergeticModulation ? `${bioenergeticModulation.mitochondrialReadinessScore}/100` : "—", tone: bioenergeticModulation?.state === "protective" ? "rose" : bioenergeticModulation?.state === "watch" ? "amber" : "cyan" },
      { label: "Loop", value: adaptationLoop ? adaptationLoop.status : "stable", tone: adaptationLoop?.status === "regenerate" ? "rose" : adaptationLoop?.status === "watch" ? "amber" : "slate" },
    ],
    [adaptationLoop, bioenergeticModulation, goalRaceDate, objectiveDemand, physiologyDrive.readiness, totalSessions],
  );

  useEffect(() => {
    const sport1 = (sportTargets[0]?.sport ?? "").trim();
    if (sport1 && sport1 !== discipline) setDiscipline(sport1);
  }, [sportTargets, discipline]);

  useEffect(() => {
    setGymDayModules((prev) => {
      const target = Math.max(1, Math.min(7, gymTrainingDaysPerWeek));
      if (prev.length === target) return prev;
      const next = prev.slice(0, target);
      while (next.length < target) {
        const day = next.length + 1;
        next.push({
          dayIndex: day,
          district: day % 2 === 0 ? "Petto" : "Gambe",
          districtObjective: "Forza",
          exerciseType: "Pesi",
          methodology: "Lento controllato",
        });
      }
      return next;
    });
  }, [gymTrainingDaysPerWeek]);

  useEffect(() => {
    setTechnicalDayModules((prev) => {
      const target = Math.max(1, Math.min(7, technicalTrainingDaysPerWeek));
      if (prev.length === target) return prev;
      const next = prev.slice(0, target);
      while (next.length < target) {
        const day = next.length + 1;
        next.push({
          dayIndex: day,
          objectives: day % 2 === 0 ? ["Fase offensiva", "Schemi"] : ["Condizione fisica", "Tecnica con modulo"],
          exerciseType: day % 2 === 0 ? "Lavoro tattico a reparti" : "Small sided game",
          intensity: day % 2 === 0 ? "Media" : "Alta",
          methodology: "Progressivo",
        });
      }
      return next;
    });
  }, [technicalTrainingDaysPerWeek]);

  useEffect(() => {
    setLifestyleDayModules((prev) => {
      const target = Math.max(1, Math.min(7, lifestyleTrainingDaysPerWeek));
      if (prev.length === target) return prev;
      const next = prev.slice(0, target);
      while (next.length < target) {
        const day = next.length + 1;
        next.push({
          dayIndex: day,
          objective: day % 2 === 0 ? "Mobilita articolare" : "Recupero autonomico",
          practiceType: day % 2 === 0 ? "Yoga Hatha" : "Pilates Mat",
          intensityRpe: 3,
          breathingCadence: "Naso 5:5",
          holdOrFlow: "Tenute 20-40s",
          methodology: "Rigenerativo",
        });
      }
      return next;
    });
  }, [lifestyleTrainingDaysPerWeek]);

  useEffect(() => {
    if (sportFamily !== "strength") return;
    const firstWeekStart = annualProjection[0]?.weekStart ?? "";
    if (!selectedGymWeekStart && firstWeekStart) {
      setSelectedGymWeekStart(firstWeekStart);
    } else if (
      selectedGymWeekStart &&
      !annualProjection.some((w) => w.weekStart === selectedGymWeekStart)
    ) {
      setSelectedGymWeekStart(firstWeekStart);
    }
  }, [sportFamily, annualProjection, selectedGymWeekStart]);

  useEffect(() => {
    if (sportFamily !== "technical") return;
    const firstWeekStart = annualProjection[0]?.weekStart ?? "";
    if (!selectedTechnicalWeekStart && firstWeekStart) {
      setSelectedTechnicalWeekStart(firstWeekStart);
    } else if (
      selectedTechnicalWeekStart &&
      !annualProjection.some((w) => w.weekStart === selectedTechnicalWeekStart)
    ) {
      setSelectedTechnicalWeekStart(firstWeekStart);
    }
  }, [sportFamily, annualProjection, selectedTechnicalWeekStart]);

  useEffect(() => {
    if (sportFamily !== "lifestyle") return;
    const firstWeekStart = annualProjection[0]?.weekStart ?? "";
    if (!selectedLifestyleWeekStart && firstWeekStart) {
      setSelectedLifestyleWeekStart(firstWeekStart);
    } else if (
      selectedLifestyleWeekStart &&
      !annualProjection.some((w) => w.weekStart === selectedLifestyleWeekStart)
    ) {
      setSelectedLifestyleWeekStart(firstWeekStart);
    }
  }, [sportFamily, annualProjection, selectedLifestyleWeekStart]);

  function updatePhase(id: string, patch: Partial<PhasePlan>) {
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function addPhase() {
    const last = phases[phases.length - 1];
    const newStart = last ? addDays(last.end, 1) : start;
    setPhases((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        start: newStart,
        end: addDays(newStart, 27),
        phase: "base",
        macroObjective:
          sportFamily === "strength"
            ? gymPrimaryGoal
            : sportFamily === "technical"
              ? "tecnico_tattico"
              : sportFamily === "lifestyle"
                ? "lifestyle_balance"
                : undefined,
        mesocycle: `M${prev.length + 1}`,
        weeklyTss: 450,
        sessionsPerWeek: 6,
        notes: "",
      },
    ]);
  }

  function removePhase(id: string) {
    setPhases((prev) => prev.filter((p) => p.id !== id));
  }

  function addRace() {
    setRaces((prev) => [...prev, { id: crypto.randomUUID(), date: addDays(start, 21), name: "Nuova gara", raceType: "warmup", priority: "C" }]);
  }

  function updateRace(id: string, patch: Partial<RacePlan>) {
    setRaces((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRace(id: string) {
    setRaces((prev) => prev.filter((r) => r.id !== id));
  }

  function setSportTargetValue(index: number, key: keyof MultiSportTarget, value: string) {
    setSportTargets((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        if (key === "sport") return { ...t, sport: value };
        const n = Number(value);
        if (key === "loadSharePct") {
          return { ...t, loadSharePct: Number.isFinite(n) ? clamp(n, 0, 100) : null };
        }
        return { ...t, [key]: Number.isFinite(n) && n > 0 ? n : null };
      }),
    );
  }

  function regenerateGymMacroPlan() {
    const next = buildGymMacroPhases(gymPlanStart, gymPlanEnd, gymMacroPhaseCount);
    setPhases(next);
  }

  function regenerateTechnicalMacroPlan() {
    const next = buildGymMacroPhases(technicalPlanStart, technicalPlanEnd, technicalMacroPhaseCount);
    setPhases(next);
  }

  function regenerateLifestyleMacroPlan() {
    const next = buildGymMacroPhases(lifestylePlanStart, lifestylePlanEnd, lifestyleMacroPhaseCount);
    setPhases(next);
  }

  function loadStatusLabel(loadPct: number) {
    if (loadPct > 100) return "Carico";
    if (loadPct < 100) return "Scarico";
    return "Stabile";
  }

  function selectedWeekConfig() {
    const baseSessions = Math.max(1, Math.min(7, gymTrainingDaysPerWeek));
    const baseModules = gymDayModules.slice(0, baseSessions);
    const saved = gymWeekCustomizations[selectedGymWeekStart];
    if (saved) return saved;
    return { sessionsPerWeek: baseSessions, loadPct: 100, modules: baseModules };
  }

  function updateSelectedWeekConfig(patch: Partial<{ sessionsPerWeek: number; loadPct: number; modules: GymDayModule[] }>) {
    if (!selectedGymWeekStart) return;
    setGymWeekCustomizations((prev) => {
      const current = prev[selectedGymWeekStart] ?? selectedWeekConfig();
      return {
        ...prev,
        [selectedGymWeekStart]: {
          sessionsPerWeek: patch.sessionsPerWeek ?? current.sessionsPerWeek,
          loadPct: patch.loadPct ?? current.loadPct,
          modules: patch.modules ?? current.modules,
        },
      };
    });
  }

  function selectedTechnicalWeekConfig() {
    const baseSessions = Math.max(1, Math.min(7, technicalTrainingDaysPerWeek));
    const baseModules = technicalDayModules.slice(0, baseSessions);
    const saved = technicalWeekCustomizations[selectedTechnicalWeekStart];
    if (saved) return saved;
    return { sessionsPerWeek: baseSessions, loadPct: 100, modules: baseModules };
  }

  function updateSelectedTechnicalWeekConfig(
    patch: Partial<{ sessionsPerWeek: number; loadPct: number; modules: TechnicalDayModule[] }>,
  ) {
    if (!selectedTechnicalWeekStart) return;
    setTechnicalWeekCustomizations((prev) => {
      const current = prev[selectedTechnicalWeekStart] ?? selectedTechnicalWeekConfig();
      return {
        ...prev,
        [selectedTechnicalWeekStart]: {
          sessionsPerWeek: patch.sessionsPerWeek ?? current.sessionsPerWeek,
          loadPct: patch.loadPct ?? current.loadPct,
          modules: patch.modules ?? current.modules,
        },
      };
    });
  }

  function selectedLifestyleWeekConfig() {
    const baseSessions = Math.max(1, Math.min(7, lifestyleTrainingDaysPerWeek));
    const baseModules = lifestyleDayModules.slice(0, baseSessions);
    const saved = lifestyleWeekCustomizations[selectedLifestyleWeekStart];
    if (saved) return saved;
    return { sessionsPerWeek: baseSessions, loadPct: 100, modules: baseModules };
  }

  function updateSelectedLifestyleWeekConfig(
    patch: Partial<{ sessionsPerWeek: number; loadPct: number; modules: LifestyleDayModule[] }>,
  ) {
    if (!selectedLifestyleWeekStart) return;
    setLifestyleWeekCustomizations((prev) => {
      const current = prev[selectedLifestyleWeekStart] ?? selectedLifestyleWeekConfig();
      return {
        ...prev,
        [selectedLifestyleWeekStart]: {
          sessionsPerWeek: patch.sessionsPerWeek ?? current.sessionsPerWeek,
          loadPct: patch.loadPct ?? current.loadPct,
          modules: patch.modules ?? current.modules,
        },
      };
    });
  }

  function autoTuneFromGoal() {
    const weeksToGoal =
      goalRaceDate == null
        ? 24
        : Math.max(8, weeksBetween(isoToday(), goalRaceDate));
    const volumeBias = clamp(
      (goalTargets.distanceKm ?? 0) / 200 + (goalTargets.durationMin ?? 0) / 420,
      0,
      1.2,
    );
    const intensityBias = clamp(
      (goalTargets.speedAvgKmh ?? 0) / 40 + (goalTargets.powerAvgW ?? 0) / 360,
      0,
      1.2,
    );
    const climbingBias = clamp((goalTargets.elevationM ?? 0) / 3500, 0, 1);
    let demand = demandScore(goalTargets);
    const flags = viryaContext?.flags ?? {};
    if (flags.peripheralLimit) demand = clamp(demand * 1.06, 0.25, 1.9);
    if (flags.gutConstraint || flags.dysbiosisRisk) demand = clamp(demand * 0.97, 0.25, 1.9);
    if (flags.redoxLimit) demand = clamp(demand * 0.95, 0.25, 1.9);
    if (flags.epigeneticConstraint) demand = clamp(demand * 0.93, 0.25, 1.9);
    const oxidativeBottleneck = viryaContext?.physiologyState?.performanceProfile.oxidativeBottleneckIndex ?? 0;
    const gutDelivery = viryaContext?.physiologyState?.lactateProfile.bloodDeliveryPctOfIngested ?? 100;
    const glycogenStatus = viryaContext?.twinState?.glycogenStatus ?? 100;
    const readiness = viryaContext?.twinState?.readiness ?? 100;
    if (oxidativeBottleneck >= 60) demand = clamp(demand * 0.96, 0.25, 1.9);
    if (gutDelivery <= 75) demand = clamp(demand * 0.97, 0.25, 1.9);
    if (glycogenStatus < 40) demand = clamp(demand * 0.95, 0.25, 1.9);
    if (readiness < 45) demand = clamp(demand * 0.94, 0.25, 1.9);

    // Strength-specific generator: objective and exercise mode drive annual load shape.
    if (sportFamily === "strength") {
      const modeCount = Math.max(1, new Set(gymDayModules.map((m) => m.exerciseType).filter(Boolean)).size);
      const modeComplexityBoost = clamp(1 + (modeCount - 1) * 0.05, 1, 1.2);
      const goalDemandBoost =
        gymPrimaryGoal === "potenza" || gymPrimaryGoal === "rapidita"
          ? 1.08
          : gymPrimaryGoal === "forza"
            ? 1.06
            : gymPrimaryGoal === "massa"
              ? 1.04
              : gymPrimaryGoal === "resistenza"
                ? 1.0
                : 0.96;
      demand = clamp(demand * modeComplexityBoost * goalDemandBoost, 0.25, 2.0);
    }
    if (sportFamily === "technical") {
      const objectiveVariety = Math.max(1, new Set(technicalDayModules.flatMap((m) => m.objectives)).size);
      const intensityLoad =
        technicalDayModules.reduce(
          (acc, m) => acc + (m.intensity === "Massimale" ? 1.25 : m.intensity === "Alta" ? 1.12 : m.intensity === "Media" ? 1.0 : 0.9),
          0,
        ) / Math.max(1, technicalDayModules.length);
      const techComplexityBoost = clamp(1 + (objectiveVariety - 1) * 0.03, 1, 1.28);
      demand = clamp(demand * techComplexityBoost * clamp(intensityLoad, 0.85, 1.25), 0.25, 2.0);
    }
    if (sportFamily === "lifestyle") {
      const avgRpe =
        lifestyleDayModules.reduce((acc, m) => acc + clamp(m.intensityRpe, 1, 10), 0) / Math.max(1, lifestyleDayModules.length);
      const breathingVariety = Math.max(1, new Set(lifestyleDayModules.map((m) => m.breathingCadence)).size);
      const lifestyleBoost = clamp((avgRpe / 4.2) * (1 + (breathingVariety - 1) * 0.02), 0.75, 1.2);
      demand = clamp(demand * lifestyleBoost, 0.25, 1.8);
    }

    setPhases((prev) =>
      prev.map((p, idx) => {
        const phaseFactor =
          p.phase === "base" ? 0.88 :
          p.phase === "build" ? 1.02 :
          p.phase === "refine" ? 1.08 :
          p.phase === "peak" ? 0.92 :
          p.phase === "deload" ? 0.72 : 1.0;
        const progressionFactor = 1 + (idx / Math.max(1, prev.length - 1)) * 0.06;
        const strengthObjective = (p.macroObjective as GymMacroObjective | undefined) ?? "forza";
        const strengthObjectiveBoost =
          strengthObjective === "potenza" || strengthObjective === "neuromuscolare"
            ? 1.08
            : strengthObjective === "forza" || strengthObjective === "ipertrofia_miofibrillare"
              ? 1.06
              : strengthObjective === "massa" || strengthObjective === "ipertrofia_sarcoplasmatica"
                ? 1.04
                : strengthObjective === "definizione"
                  ? 0.95
                  : 0.9;
        const baseTss = 320 * demand * phaseFactor * progressionFactor + 90 * volumeBias + 50 * intensityBias + 30 * climbingBias;
        const tss = Math.round(
          clamp(
            sportFamily === "strength" ? baseTss * strengthObjectiveBoost : baseTss,
            180,
            760,
          ),
        );
        const sessions = Math.round(
          clamp(
            sportFamily === "strength"
              ? gymTrainingDaysPerWeek + (p.phase === "deload" ? -1 : 0)
              : 5 + 1.2 * volumeBias + 0.6 * intensityBias + (p.phase === "deload" ? -2 : 0),
            1,
            9,
          ),
        );
        const hintTag = (viryaContext?.strategyHints ?? []).slice(0, 3).join(",");
        const note = [
          `GoalMap ${weeksToGoal}w`,
          `Demand ${demand.toFixed(2)}`,
          `Vol ${volumeBias.toFixed(2)}`,
          `Int ${intensityBias.toFixed(2)}`,
          `Climb ${climbingBias.toFixed(2)}`,
          hintTag ? `Hints ${hintTag}` : "",
        ].join(" · ");
        return {
          ...p,
          weeklyTss: tss,
          sessionsPerWeek: sessions,
          notes: p.notes ? `${p.notes} | ${note}` : note,
        };
      }),
    );
  }

  function viryaStructureTag() {
    if (sportFamily === "strength") {
      const types = Array.from(new Set(gymDayModules.map((m) => m.exerciseType).filter(Boolean)));
      return `GYM_STRUCTURE goal=${gymPrimaryGoal};types=${types.join(",") || "none"};days=${gymTrainingDaysPerWeek};week_custom=true`;
    }
    if (sportFamily === "technical" && defaultTechnicalDrill) {
      const uniqueObjectives = Array.from(new Set(technicalDayModules.flatMap((m) => m.objectives))).join(",");
      return `TECH_STRUCTURE drill=${defaultTechnicalDrill.title};days=${technicalTrainingDaysPerWeek};objectives=${uniqueObjectives || "none"};week_custom=true`;
    }
    if (sportFamily === "lifestyle") {
      const practices = Array.from(new Set(lifestyleDayModules.map((m) => m.practiceType))).join(",");
      return `LIFESTYLE_STRUCTURE protocol=Lifestyle;days=${lifestyleTrainingDaysPerWeek};practices=${practices || "none"};week_custom=true`;
    }
    return "AEROBIC_STRUCTURE periodized";
  }

  function serializeViryaSessionContract(input: {
    family: SportFamily;
    discipline: string;
    sessionName: string;
    phase: PhaseType;
    durationMinutes: number;
    tss: number;
    kcal: number;
    adaptationTarget?: string;
    methodology?: string;
    blocks?: Pro2BuilderBlockContract[];
  }) {
    const firstNote = [viryaStructureTag(), input.methodology ? `methodology=${input.methodology}` : ""].filter(Boolean).join(" · ");
    const blocks = input.blocks?.length
      ? input.blocks.map((b, i) =>
          i === 0 && firstNote
            ? { ...b, notes: b.notes ? `${firstNote} | ${b.notes}` : firstNote }
            : b,
        )
      : [];
    return serializePro2BuilderSessionContract({
      version: 1,
      source: "virya",
      family: input.family,
      discipline: input.discipline,
      sessionName: input.sessionName,
      phase: input.phase,
      adaptationTarget: input.adaptationTarget,
      plannedSessionDurationMinutes: input.durationMinutes,
      summary: {
        durationSec: Math.max(0, Math.round(input.durationMinutes * 60)),
        tss: Math.max(0, Math.round(input.tss)),
        kcal: Math.max(0, Math.round(input.kcal)),
        kj: Math.max(0, Math.round(input.kcal * 4.184)),
        avgPowerW: 0,
      },
      blocks,
    });
  }

  function mapViryaPhaseToEnginePhase(phase: PhaseType): SessionGoalRequest["phase"] {
    if (phase === "base") return "base";
    if (phase === "build") return "build";
    if (phase === "deload") return "taper";
    return "peak";
  }

  function viryaDomainForSession(family: SportFamily, disciplineName: string): TrainingDomain {
    if (family === "strength") return "gym";
    if (family === "technical") {
      return ["Boxe", "Karate", "Judo", "Muay Thai"].includes(disciplineName) ? "combat" : "team_sport";
    }
    if (family === "lifestyle") return "mind_body";
    return "endurance";
  }

  function deriveStrengthAdaptation(module: GymDayModule): AdaptationTarget {
    const objectiveText = `${gymPrimaryGoal} ${module.districtObjective} ${module.methodology}`.toLowerCase();
    if (/(potenza|rapid)/.test(objectiveText)) return "power_output";
    if (/(mobil|stretch|postural)/.test(objectiveText)) return "mobility_capacity";
    if (/(circuit|resist|definiz)/.test(objectiveText)) return "lactate_clearance";
    return "max_strength";
  }

  function deriveTechnicalAdaptation(module: TechnicalDayModule): AdaptationTarget {
    const objectiveText = module.objectives.join(" ").toLowerCase();
    if (objectiveText.includes("recupero")) return "recovery";
    if (objectiveText.includes("aerobico")) return "mitochondrial_density";
    if (objectiveText.includes("anaerobico")) return "lactate_tolerance";
    if (objectiveText.includes("velocita")) return "power_output";
    return "skill_transfer";
  }

  function deriveLifestyleAdaptation(module: LifestyleDayModule): AdaptationTarget {
    const objectiveText = `${module.objective} ${module.practiceType}`.toLowerCase();
    if (/(recupero|stress|respir|medit)/.test(objectiveText)) return "recovery";
    if (/(mobil|flessibil)/.test(objectiveText)) return "mobility_capacity";
    return "movement_quality";
  }

  function deriveAerobicAdaptation(phase: PhaseType, goalSummary: string): AdaptationTarget {
    const goalText = goalSummary.toLowerCase();
    if (goalText.includes("recovery") || goalText.includes("recuper")) return "recovery";
    if (goalText.includes("vo2") || goalText.includes("z5")) return "vo2_max_support";
    if (goalText.includes("lactate") || goalText.includes("soglia")) return "lactate_clearance";
    if (phase === "base") return "mitochondrial_density";
    if (phase === "build") return "lactate_clearance";
    if (phase === "deload") return "recovery";
    return "vo2_max_support";
  }

  function deriveViryaRequest(input: {
    family: SportFamily;
    discipline: string;
    phase: PhaseType;
    objective?: string;
    methodology?: string;
    tss: number;
    gymModule?: GymDayModule;
    technicalModule?: TechnicalDayModule;
    lifestyleModule?: LifestyleDayModule;
  }): {
    adaptationTarget: AdaptationTarget;
    domain: TrainingDomain;
    intensityHint: string;
    objectiveDetail: string;
  } {
    if (input.family === "strength" && input.gymModule) {
      return {
        adaptationTarget: deriveStrengthAdaptation(input.gymModule),
        domain: "gym",
        intensityHint: `${input.gymModule.methodology} · ${input.gymModule.districtObjective}`,
        objectiveDetail: `${input.gymModule.district} / ${input.gymModule.exerciseType}`,
      };
    }
    if (input.family === "technical" && input.technicalModule) {
      return {
        adaptationTarget: deriveTechnicalAdaptation(input.technicalModule),
        domain: viryaDomainForSession("technical", input.discipline),
        intensityHint: `${input.technicalModule.intensity} · ${input.technicalModule.methodology}`,
        objectiveDetail: input.technicalModule.objectives.join(" > "),
      };
    }
    if (input.family === "lifestyle" && input.lifestyleModule) {
      return {
        adaptationTarget: deriveLifestyleAdaptation(input.lifestyleModule),
        domain: "mind_body",
        intensityHint: `RPE ${input.lifestyleModule.intensityRpe} · ${input.lifestyleModule.breathingCadence}`,
        objectiveDetail: `${input.lifestyleModule.practiceType} · ${input.lifestyleModule.objective}`,
      };
    }
    return {
      adaptationTarget: deriveAerobicAdaptation(input.phase, input.objective ?? ""),
      domain: "endurance",
      intensityHint:
        deriveAerobicAdaptation(input.phase, input.objective ?? "") === "vo2_max_support"
          ? "Z5-focused aerobic power"
          : deriveAerobicAdaptation(input.phase, input.objective ?? "") === "recovery"
            ? "Z1-Z2 recovery aerobic"
            : "Z2-Z4 periodized aerobic distribution",
      objectiveDetail: input.objective ?? input.methodology ?? "periodized endurance support",
    };
  }

  async function materializeViryaSessionContract(input: {
    family: SportFamily;
    discipline: string;
    sessionName: string;
    phase: PhaseType;
    durationMinutes: number;
    tss: number;
    kcal: number;
    objective?: string;
    methodology?: string;
    gymModule?: GymDayModule;
    technicalModule?: TechnicalDayModule;
    lifestyleModule?: LifestyleDayModule;
  }) {
    const request = deriveViryaRequest(input);
    const fallbackBlocks = buildViryaBlocks(input);
    if (!selectedAthleteId) {
      return serializeViryaSessionContract({
        family: input.family,
        discipline: input.discipline,
        sessionName: input.sessionName,
        phase: input.phase,
        durationMinutes: input.durationMinutes,
        tss: input.tss,
        kcal: input.kcal,
        adaptationTarget: request.adaptationTarget,
        methodology: input.methodology,
        blocks: fallbackBlocks,
      });
    }
    const engineRes = await generateBuilderSession({
      athleteId: selectedAthleteId,
      request: {
        sport: input.discipline.toLowerCase(),
        domain: request.domain,
        goalLabel: input.sessionName,
        adaptationTarget: request.adaptationTarget,
        sessionMinutes: input.durationMinutes,
        phase: mapViryaPhaseToEnginePhase(input.phase),
        tssTargetHint: input.tss,
        intensityHint: request.intensityHint,
        objectiveDetail: request.objectiveDetail,
      },
    });
    if (!("ok" in engineRes) || !engineRes.ok) {
      return serializeViryaSessionContract({
        family: input.family,
        discipline: input.discipline,
        sessionName: input.sessionName,
        phase: input.phase,
        durationMinutes: input.durationMinutes,
        tss: input.tss,
        kcal: input.kcal,
        adaptationTarget: request.adaptationTarget,
        methodology: input.methodology,
        blocks: fallbackBlocks,
      });
    }
    const operationalScaling = (
      engineRes as { operationalScaling?: BuilderSessionOperationalScalingViewModel | null }
    ).operationalScaling;
    const effectiveDuration = operationalScaling?.sessionMinutesEffective ?? input.durationMinutes;
    const effectiveTss = operationalScaling?.tssTargetHintEffective ?? input.tss;
    const effectiveKcal =
      operationalScaling?.applied && operationalScaling.loadScale > 0
        ? Math.max(1, Math.round(input.kcal * operationalScaling.loadScale))
        : input.kcal;
    const effectiveMethodology = operationalScaling?.applied
      ? [input.methodology, `[EMPATHY operational scale ${operationalScaling.loadScalePct}%] ${operationalScaling.headline}`]
          .filter(Boolean)
          .join(" | ")
      : input.methodology;

    const mediaFromFallback = (index: number) =>
      fallbackBlocks[index]?.lifestyleRx?.mediaUrl ?? fallbackBlocks[0]?.lifestyleRx?.mediaUrl;

    const blocks = materializePro2BlocksFromEngine({
      session: engineRes.session,
      blockExercises: Array.isArray(engineRes.blockExercises)
        ? (engineRes.blockExercises as { exercises?: Array<{ name?: string }> }[])
        : undefined,
      fallbackBlocks,
      fallbackDurationMinutes: input.durationMinutes,
      fallbackTarget: input.objective,
      fallbackIntensityCue: request.intensityHint,
      fallbackNotes: request.objectiveDetail,
      mediaResolver: mediaFromFallback,
    });

    return serializeViryaSessionContract({
      family: input.family,
      discipline: input.discipline,
      sessionName: input.sessionName,
      phase: input.phase,
      durationMinutes: effectiveDuration,
      tss: effectiveTss,
      kcal: effectiveKcal,
      adaptationTarget: request.adaptationTarget,
      methodology: effectiveMethodology,
      blocks,
    });
  }

  function buildViryaBlocks(input: {
    family: SportFamily;
    discipline: string;
    durationMinutes: number;
    objective?: string;
    methodology?: string;
    gymModule?: GymDayModule;
    technicalModule?: TechnicalDayModule;
    lifestyleModule?: LifestyleDayModule;
  }): Pro2BuilderBlockContract[] {
    if (input.family === "strength" && input.gymModule) {
      return [
        {
          id: `virya-strength-${input.gymModule.dayIndex}`,
          label: `${input.gymModule.district} · ${input.gymModule.exerciseType}`,
          kind: "strength_sets",
          durationMinutes: input.durationMinutes,
          target: input.gymModule.districtObjective,
          intensityCue: input.objective,
          notes: `method=${input.gymModule.methodology};district=${input.gymModule.district};exerciseType=${input.gymModule.exerciseType}`,
        },
      ];
    }
    if (input.family === "technical" && input.technicalModule) {
      const drill = getTechnicalDrillsForDiscipline(input.discipline)[0] ?? defaultTechnicalDrill;
      const mediaUrl = drill ? getTechnicalDrillMediaUrl(drill) : undefined;
      return [
        {
          id: `virya-technical-${input.technicalModule.dayIndex}`,
          label: input.technicalModule.exerciseType,
          kind: "technical_drill",
          durationMinutes: input.durationMinutes,
          target: input.technicalModule.objectives.join(" > "),
          intensityCue: input.technicalModule.intensity,
          notes: [
            `method=${input.technicalModule.methodology};objectives=${input.technicalModule.objectives.join(",")}`,
            mediaUrl ? `virya_media_url=${mediaUrl}` : "",
          ]
            .filter(Boolean)
            .join(";"),
        },
      ];
    }
    if (input.family === "lifestyle" && input.lifestyleModule) {
      const protocol = getLifestyleProtocolsForDiscipline(input.discipline)[0] ?? defaultLifestyleProtocol;
      const mediaUrl = protocol ? getLifestyleProtocolMediaUrl(protocol) : undefined;
      return [
        {
          id: `virya-lifestyle-${input.lifestyleModule.dayIndex}`,
          label: input.lifestyleModule.practiceType,
          kind: "flow_recovery",
          durationMinutes: input.durationMinutes,
          target: input.lifestyleModule.objective,
          intensityCue: `RPE ${input.lifestyleModule.intensityRpe}`,
          notes: `breathing=${input.lifestyleModule.breathingCadence};holdFlow=${input.lifestyleModule.holdOrFlow};method=${input.lifestyleModule.methodology}`,
          lifestyleRx: mediaUrl ? { mediaUrl } : undefined,
        },
      ];
    }
    return [
      {
        id: `virya-aerobic-${input.discipline.toLowerCase().replace(/\s+/g, "-")}`,
        label: input.discipline,
        kind: "steady",
        durationMinutes: input.durationMinutes,
        target: input.objective,
        intensityCue: "periodized_aerobic",
        notes: `method=${input.methodology ?? "annual_periodized_distribution"}`,
      },
    ];
  }

  async function generateOnCalendar() {
    setError(null);
    setSuccess(null);
    if (!selectedAthleteId) {
      setError("Atleta non disponibile per la generazione.");
      return;
    }
    if (!phases.length) {
      setError("Aggiungi almeno una fase.");
      return;
    }
    setSaving(true);
    const tag = `[VIRYA:${planName.trim() || "Annual"}]`;
    const contextHint = (viryaContext?.strategyHints ?? []).slice(0, 4).join(",");
    const rows: {
      athlete_id: string;
      date: string;
      type: string;
      duration_minutes: number;
      tss_target: number;
      kcal_target: number;
      notes: string;
    }[] = [];
    const scheduleOffsets = [1, 2, 3, 4, 5, 6, 0];
    const activeSports = sportTargets
      .filter((t) => (t.sport ?? "").trim() !== "")
      .map((t) => ({
        ...t,
        sport: t.sport.trim(),
        share: Math.max(0, t.loadSharePct ?? 0),
      }));

    for (const phase of phases) {
      const weekCount = weeksBetween(phase.start, phase.end);
      for (let w = 0; w < weekCount; w += 1) {
        const weekStart = addDays(phase.start, w * 7);
        const wm = resolveWeekMetrics(phase, w, weekStart);
        const objNote = wm.objectives.length ? `week_focus=${wm.objectives.join("+")}` : "";
        if (sportFamily === "strength") {
          const weekCfg = gymWeekCustomizations[weekStart];
          const weekSessions = wm.sessions;
          const loadPct = Math.max(50, Math.min(180, weekCfg?.loadPct ?? 100));
          const adjustedWeeklyTss = wm.weeklyTss;
          const modules = weekCfg?.modules?.length
            ? weekCfg.modules
            : gymDayModules.length
              ? gymDayModules
              : buildGymDayModules(weekSessions);
          const tssPerSession = Math.round((adjustedWeeklyTss / weekSessions) * clamp(objectiveDemand, 0.88, 1.25));
          const baseDuration =
            gymPrimaryGoal === "potenza" || gymPrimaryGoal === "rapidita"
              ? 55
              : gymPrimaryGoal === "forza"
                ? 70
                : gymPrimaryGoal === "massa"
                  ? 75
                  : gymPrimaryGoal === "definizione"
                    ? 60
                    : 65;
          for (let s = 0; s < weekSessions; s += 1) {
            const dayOffset = scheduleOffsets[s % scheduleOffsets.length];
            const module = modules[s % modules.length];
            const phaseObj = phase.macroObjective ?? gymPrimaryGoal;
            const serializedContract = await materializeViryaSessionContract({
              family: "strength",
              discipline: "Gym",
              sessionName: `${planName || "VIRYA"} · ${phaseLabels[phase.phase]} · Gym`,
              phase: phase.phase,
              durationMinutes: baseDuration,
              tss: tssPerSession,
              kcal: Math.round(tssPerSession * 9.5),
              objective: String(phaseObj),
              methodology: module.methodology,
              gymModule: module,
            });
            rows.push({
              athlete_id: selectedAthleteId,
              date: addDays(weekStart, dayOffset),
              type: "gym",
              duration_minutes: baseDuration,
              tss_target: tssPerSession,
              kcal_target: Math.round(tssPerSession * 9.5),
              notes: [
                `${tag} ${phaseLabels[phase.phase]} · ${phase.mesocycle} · ${objective} · GymGoal ${gymPrimaryGoal} · MacroObjective ${phaseObj} · LoadWeek ${loadPct}% (${loadStatusLabel(loadPct)}) · Giorno${module.dayIndex} distretto=${module.district} obiettivo=${module.districtObjective} esercizio=${module.exerciseType} metodologia=${module.methodology} · ${objNote} · Hints: ${contextHint || "none"} · ${viryaStructureTag()}`,
                serializedContract,
              ].join(" | "),
            });
          }
        } else if (sportFamily === "technical") {
          const weekCfg = technicalWeekCustomizations[weekStart];
          const weekSessions = wm.sessions;
          const loadPct = Math.max(50, Math.min(180, weekCfg?.loadPct ?? 100));
          const adjustedWeeklyTss = wm.weeklyTss;
          const modules = weekCfg?.modules?.length
            ? weekCfg.modules
            : technicalDayModules.length
              ? technicalDayModules
              : buildTechnicalDayModules(weekSessions);
          const tssPerSession = Math.round((adjustedWeeklyTss / weekSessions) * clamp(objectiveDemand, 0.88, 1.25));
          const baseDuration = 80;
          for (let s = 0; s < weekSessions; s += 1) {
            const dayOffset = scheduleOffsets[s % scheduleOffsets.length];
            const module = modules[s % modules.length];
            const phaseObj = phase.macroObjective ?? "tecnico";
            const sequence = module.objectives.length ? module.objectives.join(" > ") : "N/A";
            const serializedContract = await materializeViryaSessionContract({
              family: "technical",
              discipline,
              sessionName: `${planName || "VIRYA"} · ${phaseLabels[phase.phase]} · ${discipline}`,
              phase: phase.phase,
              durationMinutes: baseDuration,
              tss: tssPerSession,
              kcal: Math.round(tssPerSession * 9.0),
              objective: sequence,
              methodology: module.methodology,
              technicalModule: module,
            });
            rows.push({
              athlete_id: selectedAthleteId,
              date: addDays(weekStart, dayOffset),
              type: discipline.toLowerCase(),
              duration_minutes: baseDuration,
              tss_target: tssPerSession,
              kcal_target: Math.round(tssPerSession * 9.0),
              notes: [
                `${tag} ${phaseLabels[phase.phase]} · ${phase.mesocycle} · ${objective} · Modulo C Tecnico-Tattico · MacroObjective ${phaseObj} · LoadWeek ${loadPct}% (${loadStatusLabel(loadPct)}) · Giorno${module.dayIndex} obiettivi=${sequence} esercizio=${module.exerciseType} intensita=${module.intensity} metodo=${module.methodology} · ${objNote} · Hints: ${contextHint || "none"} · ${viryaStructureTag()}`,
                serializedContract,
              ].join(" | "),
            });
          }
        } else if (sportFamily === "lifestyle") {
          const weekCfg = lifestyleWeekCustomizations[weekStart];
          const weekSessions = wm.sessions;
          const loadPct = Math.max(50, Math.min(180, weekCfg?.loadPct ?? 100));
          const adjustedWeeklyTss = wm.weeklyTss;
          const modules = weekCfg?.modules?.length
            ? weekCfg.modules
            : lifestyleDayModules.length
              ? lifestyleDayModules
              : buildLifestyleDayModules(weekSessions);
          const tssPerSession = Math.round((adjustedWeeklyTss / weekSessions) * clamp(objectiveDemand, 0.85, 1.15));
          const baseDuration = 50;
          for (let s = 0; s < weekSessions; s += 1) {
            const dayOffset = scheduleOffsets[s % scheduleOffsets.length];
            const module = modules[s % modules.length];
            const phaseObj = phase.macroObjective ?? "lifestyle";
            const serializedContract = await materializeViryaSessionContract({
              family: "lifestyle",
              discipline,
              sessionName: `${planName || "VIRYA"} · ${phaseLabels[phase.phase]} · ${discipline}`,
              phase: phase.phase,
              durationMinutes: baseDuration,
              tss: tssPerSession,
              kcal: Math.round(tssPerSession * 7.8),
              objective: module.objective,
              methodology: module.methodology,
              lifestyleModule: module,
            });
            rows.push({
              athlete_id: selectedAthleteId,
              date: addDays(weekStart, dayOffset),
              type: discipline.toLowerCase(),
              duration_minutes: baseDuration,
              tss_target: tssPerSession,
              kcal_target: Math.round(tssPerSession * 7.8),
              notes: [
                `${tag} ${phaseLabels[phase.phase]} · ${phase.mesocycle} · ${objective} · Modulo D Lifestyle · MacroObjective ${phaseObj} · LoadWeek ${loadPct}% (${loadStatusLabel(loadPct)}) · Giorno${module.dayIndex} objective=${module.objective} pratica=${module.practiceType} RPE=${module.intensityRpe} breathing=${module.breathingCadence} holdFlow=${module.holdOrFlow} method=${module.methodology} · ${objNote} · Hints: ${contextHint || "none"} · ${viryaStructureTag()}`,
                serializedContract,
              ].join(" | "),
            });
          }
        } else {
          const normalizedSports =
            activeSports.length > 0
              ? activeSports
              : [{ ...emptyTargetSport(discipline), sport: discipline, share: 100 }];
          const sharesSum = normalizedSports.reduce((s, sp) => s + Math.max(0, sp.share), 0);
          let dayCursor = 0;

          for (const sportTarget of normalizedSports) {
            const normalizedShare =
              sharesSum > 0 ? Math.max(0, sportTarget.share) / sharesSum : 1 / normalizedSports.length;
            const sportWeeklyTss = Math.max(20, Math.round(wm.weeklyTss * normalizedShare));
            const sportSessions = Math.max(1, Math.round(wm.sessions * normalizedShare));
            const tssPerSession = Math.round((sportWeeklyTss / sportSessions) * clamp(objectiveDemand, 0.85, 1.25));
            const hoursForSport =
              wm.hoursPerWeek != null ? wm.hoursPerWeek * normalizedShare : null;
            const durationFromObjective = sportTarget.durationMin != null
              ? Math.round(
                  sportTarget.durationMin *
                    (phase.phase === "base"
                      ? 0.42
                      : phase.phase === "build"
                        ? 0.5
                        : phase.phase === "refine"
                          ? 0.56
                          : 0.38),
                )
              : 0;
            const duration =
              hoursForSport != null && sportSessions > 0
                ? Math.max(30, Math.round((hoursForSport * 60) / sportSessions))
                : Math.max(30, durationFromObjective || Math.round((tssPerSession / 0.9) * 1.2));
            for (let s = 0; s < sportSessions; s += 1) {
              const dayOffset = scheduleOffsets[(dayCursor + s) % scheduleOffsets.length];
              const serializedContract = await materializeViryaSessionContract({
                family: "aerobic",
                discipline: sportTarget.sport,
                sessionName: `${planName || "VIRYA"} · ${phaseLabels[phase.phase]} · ${sportTarget.sport}`,
                phase: phase.phase,
                durationMinutes: duration,
                tss: tssPerSession,
                kcal: Math.round(tssPerSession * 10.5),
                objective: goalSummary,
                methodology: "annual_periodized_distribution",
              });
              rows.push({
                athlete_id: selectedAthleteId,
                date: addDays(weekStart, dayOffset),
                type: sportTarget.sport.toLowerCase(),
                duration_minutes: duration,
                tss_target: tssPerSession,
                kcal_target: Math.round(tssPerSession * 10.5),
                notes: [
                  `${tag} ${phaseLabels[phase.phase]} · ${phase.mesocycle} · ${objective} · Sport ${sportTarget.sport} (${Math.round(normalizedShare * 100)}%) · Target: ${goalSummary} · ${objNote} · Hints: ${contextHint || "none"} · ${viryaStructureTag()}`,
                  serializedContract,
                ].join(" | "),
              });
            }
            dayCursor += sportSessions;
          }
        }
      }
    }

    try {
      await replaceTrainingPlannerCalendar({
        athleteId: selectedAthleteId,
        replaceTag: replacePrevious ? tag : undefined,
        rows,
      });
      setSuccess(`Piano VIRYA creato: ${rows.length} sessioni inviate in Calendar.`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Errore inatteso durante la generazione.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function applyPlanPeriod() {
    const s = planWindowStart.trim();
    const e = planWindowEnd.trim();
    if (!s || !e || new Date(e) < new Date(s)) {
      setError("Intervallo date non valido (fine prima dell’inizio).");
      return;
    }
    setError(null);
    const next = defaultPhases(s);
    if (next.length === 0) return;
    next[next.length - 1] = { ...next[next.length - 1], end: e };
    setPhases(next);
  }

  function applyClassicPeriodization() {
    const s = planWindowStart.trim();
    const e = planWindowEnd.trim();
    if (!s || !e || new Date(e) < new Date(s)) {
      setError("Imposta date inizio/fine valide al passo 3 prima di generare le fasi.");
      return;
    }
    setError(null);
    const startMs = new Date(s).getTime();
    const endMs = new Date(e).getTime();
    const totalDays = Math.max(7, Math.floor((endMs - startMs) / 86400000) + 1);
    let n1 = Math.max(7, Math.floor(totalDays * 0.28));
    let n2 = Math.max(7, Math.floor(totalDays * 0.36));
    let n3 = Math.max(5, Math.floor(totalDays * 0.16));
    let n4 = totalDays - n1 - n2 - n3;
    if (n4 < 7) {
      n4 = 7;
      n2 = Math.max(7, n2 - (7 - (totalDays - n1 - n2 - n3)));
    }
    const baseEnd = addDays(s, n1 - 1);
    const buildEnd = addDays(baseEnd, n2);
    const taperEnd = addDays(buildEnd, n3);
    const peakEnd = e;
    setPhases([
      {
        id: crypto.randomUUID(),
        start: s,
        end: baseEnd,
        phase: "base",
        mesocycle: "M1",
        weeklyTss: 440,
        sessionsPerWeek: 6,
        notes: "Preparazione di base — volume e fondamentali",
      },
      {
        id: crypto.randomUUID(),
        start: addDays(baseEnd, 1),
        end: buildEnd,
        phase: "build",
        mesocycle: "M2",
        weeklyTss: 540,
        sessionsPerWeek: 7,
        notes: "Costruzione — incremento carico specifico",
      },
      {
        id: crypto.randomUUID(),
        start: addDays(buildEnd, 1),
        end: taperEnd,
        phase: "deload",
        mesocycle: "M3",
        weeklyTss: 380,
        sessionsPerWeek: 5,
        notes: "Tapering pre-evento — riduzione volume",
      },
      {
        id: crypto.randomUUID(),
        start: addDays(taperEnd, 1),
        end: peakEnd,
        phase: "peak",
        mesocycle: "M4",
        weeklyTss: 420,
        sessionsPerWeek: 5,
        notes: "Picco di forma — qualità e intensità",
      },
    ]);
    setWeeklyProgramOverrides({});
  }

  function patchWeeklyOverride(
    weekStart: string,
    patch: Partial<{ weeklyTss: number; sessionsPerWeek: number; hoursPerWeek: number; objectives: WeekObjectiveKey[] }>,
  ) {
    setWeeklyProgramOverrides((prev) => ({
      ...prev,
      [weekStart]: { ...prev[weekStart], ...patch },
    }));
  }

  function clearWeeklyHours(weekStart: string) {
    setWeeklyProgramOverrides((prev) => {
      const cur = { ...prev[weekStart] };
      delete cur.hoursPerWeek;
      return { ...prev, [weekStart]: cur };
    });
  }

  function toggleWeekObjective(weekStart: string, id: WeekObjectiveKey) {
    setWeeklyProgramOverrides((prev) => {
      const cur = prev[weekStart]?.objectives ?? [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...prev, [weekStart]: { ...prev[weekStart], objectives: next } };
    });
  }

  function resolveWeekMetrics(phase: PhasePlan, weekIndexInPhase: number, weekStart: string) {
    const progressive = phase.phase === "build" ? 1 + Math.min(0.14, weekIndexInPhase * 0.02) : 1;
    const taper = phase.phase === "peak" || phase.phase === "deload" ? Math.max(0.68, 1 - weekIndexInPhase * 0.08) : 1;
    const baseTss = Math.round(phase.weeklyTss * progressive * taper);
    const custom =
      sportFamily === "strength"
        ? gymWeekCustomizations[weekStart]
        : sportFamily === "technical"
          ? technicalWeekCustomizations[weekStart]
          : sportFamily === "lifestyle"
            ? lifestyleWeekCustomizations[weekStart]
            : undefined;
    const loadPct = custom ? clamp(custom.loadPct, 50, 180) : 100;
    const computedTss = Math.round(baseTss * (loadPct / 100));
    const defaultSessions = Math.max(
      1,
      Math.min(
        7,
        sportFamily === "strength"
          ? gymTrainingDaysPerWeek
          : sportFamily === "technical"
            ? technicalTrainingDaysPerWeek
            : sportFamily === "lifestyle"
              ? lifestyleTrainingDaysPerWeek
              : phase.sessionsPerWeek,
      ),
    );
    const sessionsFromCustom = custom?.sessionsPerWeek;
    const computedSessions = Math.max(1, Math.min(7, sessionsFromCustom ?? defaultSessions));
    const ov = weeklyProgramOverrides[weekStart];
    return {
      weeklyTss: ov?.weeklyTss ?? computedTss,
      sessions: ov?.sessionsPerWeek != null ? clamp(ov.sessionsPerWeek, 1, 7) : computedSessions,
      hoursPerWeek: ov?.hoursPerWeek,
      objectives: ov?.objectives ?? [],
    };
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/25 via-black/50 to-black/80 p-5 shadow-inner">
        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-violet-300/90">Virya · Pro 2</p>
        <h2 className="text-xl font-semibold tracking-tight text-white">Piano annuale</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Percorso guidato in quattro passi — stesso motore sessione del builder. Deploy batch su Calendar solo quando sei pronto.
        </p>
        {viryaHeroStats.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {viryaHeroStats.map((s) => (
              <span
                key={s.label}
                className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-slate-300"
              >
                <span className="text-slate-500">{s.label}:</span> {s.value}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {success}
        </div>
      ) : null}
      {contextLoading ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Sincronizzazione contesto atleta (recovery / operativo)…
        </div>
      ) : null}

      <nav className="flex flex-wrap gap-2 border-b border-white/10 pb-4" aria-label="Passi Virya">
        {(
          [
            { n: 1 as const, label: "Macro", desc: "A · B · C · D" },
            { n: 2 as const, label: "Sport", desc: "Disciplina" },
            { n: 3 as const, label: "Periodo", desc: "Date piano" },
            { n: 4 as const, label: "Stagione", desc: "Cardine · eventi · fasi" },
            { n: 5 as const, label: "Settimane", desc: "Griglia · Calendar" },
          ] as const
        ).map((s) => (
          <button
            key={s.n}
            type="button"
            onClick={() => setViryaStep(s.n)}
            className={cn(
              "flex min-w-[128px] flex-1 flex-col items-start rounded-xl border px-3 py-2.5 text-left transition sm:min-w-[150px]",
              viryaStep === s.n
                ? "border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.08)]"
                : "border-white/10 bg-black/25 hover:border-white/20",
            )}
          >
            <span className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-500">Passo {s.n}</span>
            <span className="text-sm font-semibold text-white">{s.label}</span>
            <span className="text-[0.7rem] leading-tight text-slate-500">{s.desc}</span>
          </button>
        ))}
      </nav>

      {viryaStep === 1 ? (
        <Pro2SectionCard
          accent="violet"
          title="1 · Macro famiglia"
          subtitle="Aerobico, Gym, Tecnico-tattico o Lifestyle — una sola guida la struttura annuale"
          icon={Layers}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {sportFamilies.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setSportFamily(f.id);
                  setDiscipline(f.sports[0]);
                  setSportTargetValue(0, "sport", f.sports[0]);
                  if (f.id === "strength") setDiscipline("Gym");
                }}
                className={cn(
                  "flex flex-col gap-2 rounded-2xl border p-4 text-left transition",
                  sportFamily === f.id
                    ? "border-cyan-400/55 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                    : "border-white/10 bg-black/35 hover:border-white/25",
                )}
              >
                <span className="text-2xl" aria-hidden>
                  {f.id === "aerobic" ? "⚡" : f.id === "strength" ? "🏋️" : f.id === "technical" ? "🎯" : "🧘"}
                </span>
                <span className="text-sm font-semibold text-white">{f.label}</span>
                <span className="text-xs text-slate-500">
                  {f.sports.slice(0, 5).join(", ")}
                  {f.sports.length > 5 ? "…" : ""}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/45 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/25"
              onClick={() => setViryaStep(2)}
            >
              Continua <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </Pro2SectionCard>
      ) : null}

      {viryaStep === 2 ? (
        <Pro2SectionCard
          accent="cyan"
          title="2 · Sport e disciplina"
          subtitle="Scegli la disciplina operativa coerente con la macro"
          icon={Dumbbell}
        >
          <p className="mb-3 text-xs text-slate-400">
            Macro attiva:{" "}
            <span className="font-semibold text-cyan-200">
              {sportFamilies.find((x) => x.id === sportFamily)?.label ?? sportFamily}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {familySports.map((sport) => (
              <button
                key={sport}
                type="button"
                onClick={() => {
                  setDiscipline(sport);
                  setSportTargetValue(0, "sport", sport);
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                  discipline === sport
                    ? "border-fuchsia-400/55 bg-fuchsia-500/15 text-fuchsia-50"
                    : "border-white/15 bg-black/35 text-slate-300 hover:border-white/30",
                )}
              >
                <span aria-hidden>{sportIcon(sport)}</span>
                {sport}
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5"
              onClick={() => setViryaStep(1)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Indietro
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/45 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/25"
              onClick={() => setViryaStep(3)}
            >
              Continua <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </Pro2SectionCard>
      ) : null}

      {viryaStep === 3 ? (
        <Pro2SectionCard
          accent="amber"
          title="3 · Periodo del piano"
          subtitle="Intervallo stagionale; al passo successivo obiettivo cardine, eventi e macro-fasi"
          icon={CalendarRange}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
                Data inizio
              </span>
              <input
                type="date"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white"
                value={planWindowStart}
                onChange={(e) => setPlanWindowStart(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
                Data fine
              </span>
              <input
                type="date"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white"
                value={planWindowEnd}
                onChange={(e) => setPlanWindowEnd(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Preset durata</span>
            <div className="flex flex-wrap gap-2">
              {[
                { w: 12, label: "12 settimane" },
                { w: 24, label: "24 settimane" },
                { w: 52, label: "52 settimane (annuale)" },
              ].map((p) => (
                <button
                  key={p.w}
                  type="button"
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:border-amber-400/45 hover:bg-amber-500/10"
                  onClick={() => {
                    const base = planWindowStart || start;
                    setPlanWindowStart(base);
                    setPlanWindowEnd(addDays(base, p.w * 7 - 1));
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
              onClick={applyPlanPeriod}
            >
              Applica periodo alle fasi
            </button>
            <span className="text-xs text-slate-500">
              Rigenera mesocicli dalla data di inizio; l’ultima fase termina alla data fine.
            </span>
          </div>
          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5"
              onClick={() => setViryaStep(2)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Indietro
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/45 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/25"
              onClick={() => setViryaStep(4)}
            >
              Obiettivo, eventi e fasi <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </Pro2SectionCard>
      ) : null}

      {viryaStep === 4 ? (
        <div className="space-y-6">
          <Pro2SectionCard
            accent="rose"
            title="4 · Obiettivo cardine"
            subtitle="La ragione della stagione — guida hint, copy piano e note in calendario"
            icon={Target}
          >
            <label className="block">
              <span className="mb-2 block text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
                Obiettivo cardine
              </span>
              <textarea
                className="min-h-[100px] w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-slate-600"
                rows={4}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Es. doppio picco su gare X/Y, soglia e VO2, gestione lattato in chiave 40k…"
              />
            </label>
          </Pro2SectionCard>

          <Pro2SectionCard
            accent="cyan"
            title="Eventi e date intermedie"
            subtitle="Gare, test, milestone — ancorano taper e picco"
            icon={Flag}
          >
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
                onClick={addRace}
              >
                + Aggiungi evento
              </button>
            </div>
            <div className="space-y-2">
              {races.map((race) => (
                <div
                  key={race.id}
                  className="grid gap-2 rounded-xl border border-white/10 bg-black/30 p-3 sm:grid-cols-[140px_1fr_140px_100px_40px] sm:items-center"
                >
                  <input
                    className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
                    type="date"
                    value={race.date}
                    onChange={(e) => updateRace(race.id, { date: e.target.value })}
                  />
                  <input
                    className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
                    value={race.name}
                    onChange={(e) => updateRace(race.id, { name: e.target.value })}
                    placeholder="Nome evento"
                  />
                  <select
                    className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
                    value={race.raceType}
                    onChange={(e) => updateRace(race.id, { raceType: e.target.value as RaceType })}
                  >
                    <option value="warmup">Warm-up</option>
                    <option value="milestone">Milestone / intermedio</option>
                    <option value="test">Test</option>
                    <option value="goal">Gara obiettivo</option>
                  </select>
                  <select
                    className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
                    value={race.priority}
                    onChange={(e) => updateRace(race.id, { priority: e.target.value as "A" | "B" | "C" })}
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </select>
                  <button
                    type="button"
                    className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-slate-300 hover:bg-white/10"
                    onClick={() => removeRace(race.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </Pro2SectionCard>

          <Pro2SectionCard
            accent="violet"
            title="Macro-periodi di preparazione"
            subtitle="Base, costruzione, taper pre-evento, picco — genera quattro fasi sulle date del passo 3"
            icon={CalendarRange}
          >
            <p className="mb-3 text-xs text-slate-400">
              Il template ripartisce la finestra <span className="font-mono text-slate-300">{planWindowStart}</span> →{" "}
              <span className="font-mono text-slate-300">{planWindowEnd}</span> in quattro blocchi coerenti. Puoi
              rifinire date e TSS nel passo successivo (tabella fasi e griglia settimanale).
            </p>
            <button
              type="button"
              className="rounded-xl border border-violet-500/45 bg-violet-500/15 px-4 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-500/25"
              onClick={applyClassicPeriodization}
            >
              Genera fasi classiche (base · costruzione · taper · picco)
            </button>
            <p className="mt-2 text-[0.7rem] text-slate-500">
              Sovrascrive l’elenco fasi attuale e azzera le personalizzazioni settimanali finché non le reimposti al passo 5.
            </p>
          </Pro2SectionCard>

          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5"
              onClick={() => setViryaStep(3)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Indietro
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/45 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/25"
              onClick={() => setViryaStep(5)}
            >
              Griglia settimanale e Calendar <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {viryaStep === 5 ? (
        <div className="space-y-6">
          <Pro2SectionCard
            accent="slate"
            title="Contesto · KPI"
            subtitle="Goal, readiness, loop adattamento (da memoria atleta)"
            icon={Activity}
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {viryaSummaryCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
                  <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">{card.label}</div>
                  <div className="mt-0.5 text-sm font-semibold text-white">{card.value}</div>
                </div>
              ))}
            </div>
          </Pro2SectionCard>

          {operationalContext ? (
            <Pro2SectionCard
              accent="emerald"
              title="Modulazione operativa"
              subtitle="Carico scalato, recovery, segnali bio e piano vs reale"
              icon={LineChart}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Carico</div>
                  <div className="mt-1 text-lg font-semibold text-white">{operationalContext.loadScalePct}%</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Modalità</div>
                  <div className="mt-1 text-sm text-slate-200">{operationalContext.headline}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Recovery</div>
                  <div className="mt-1 text-sm text-slate-200">
                    {recoverySummary
                      ? [
                          recoverySummary.status,
                          recoverySummary.sleepDurationHours != null ? `${recoverySummary.sleepDurationHours}h` : null,
                          recoverySummary.hrvMs != null ? `HRV ${recoverySummary.hrvMs}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"
                      : "—"}
                  </div>
                </div>
                {bioenergeticModulation ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 sm:col-span-2 lg:col-span-1">
                    <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Bioenergetica</div>
                    <div className="mt-1 text-sm text-slate-200">
                      {bioenergeticModulation.mitochondrialReadinessScore}/100 · copertura{" "}
                      {bioenergeticModulation.signalCoveragePct}% · ±{bioenergeticModulation.inputUncertaintyPct}%
                    </div>
                  </div>
                ) : null}
                {adaptationLoop ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 sm:col-span-2">
                    <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Piano / reale</div>
                    <div className="mt-1 text-sm text-slate-200">
                      {adaptationLoop.executionCompliancePct.toFixed(0)}% compliance · Δ
                      {adaptationLoop.executionDeltaTss > 0 ? "+" : ""}
                      {adaptationLoop.executionDeltaTss.toFixed(0)} TSS · {adaptationLoop.nextAction}
                    </div>
                  </div>
                ) : null}
              </div>
            </Pro2SectionCard>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/15 px-4 py-3 text-sm">
            <span className="font-semibold text-fuchsia-200">Riepilogo passi 1–4</span>
            <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-slate-200">
              {sportFamilies.find((x) => x.id === sportFamily)?.label ?? sportFamily}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-white">{discipline}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">
              {planWindowStart} → {planWindowEnd}
            </span>
            <button
              type="button"
              className="ml-auto text-xs font-semibold text-cyan-300 hover:text-cyan-200"
              onClick={() => setViryaStep(1)}
            >
              Modifica flusso guidato
            </button>
          </div>

          <Pro2SectionCard
            accent="violet"
            className="!border-pink-500/35 !bg-black bg-none from-transparent via-transparent to-transparent shadow-[inset_0_1px_0_rgba(251,113,133,0.12)]"
            title="5 · Programma settimanale"
            subtitle="Volume (TSS), sedute, ore disponibili e focus fisiologici — usati in generazione Calendar"
            icon={TableProperties}
          >
            <div className="max-h-[min(520px,60vh)] overflow-auto rounded-xl border border-pink-500/20 bg-black">
              <table className="w-full min-w-[800px] border-collapse text-left text-xs text-slate-200">
                <thead className="sticky top-0 z-10 border-b border-pink-500/25 bg-black backdrop-blur-sm">
                  <tr>
                    <th className="whitespace-nowrap p-2 font-semibold text-pink-200/80">#</th>
                    <th className="whitespace-nowrap p-2 font-semibold text-pink-200/80">Inizio sett.</th>
                    <th className="whitespace-nowrap p-2 font-semibold text-pink-200/80">Fase</th>
                    <th className="whitespace-nowrap p-2 font-semibold text-orange-200/90">TSS</th>
                    <th className="whitespace-nowrap p-2 font-semibold text-orange-200/90">Sedute</th>
                    <th className="whitespace-nowrap p-2 font-semibold text-orange-200/90">Ore sett.</th>
                    <th className="min-w-[260px] p-2 font-semibold text-pink-200/80">Obiettivi (multipli)</th>
                  </tr>
                </thead>
                <tbody>
                  {programWeekRows.map((row) => {
                    const pc = phaseColor(row.phaseType);
                    const rowBg = phaseRowBackground(row.phaseType);
                    const bdr = phaseCellBorder(row.phaseType);
                    return (
                    <tr
                      key={row.weekStart}
                      className="border-b border-white/[0.04]"
                      style={{ backgroundColor: rowBg }}
                    >
                      <td className="p-2 font-mono font-semibold" style={{ color: pc }}>
                        {row.week}
                      </td>
                      <td className="p-2 font-mono text-[0.7rem]" style={{ color: `${pc}dd` }}>
                        {row.weekStart}
                      </td>
                      <td className="p-2 font-bold" style={{ color: pc }}>
                        {row.phase}
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          className="w-20 rounded-lg border px-2 py-1 font-mono font-bold outline-none transition focus:ring-2"
                          style={{
                            borderColor: bdr,
                            backgroundColor: `${pc}24`,
                            color: pc,
                            boxShadow: `inset 0 0 0 1px ${pc}20`,
                          }}
                          value={row.displayTss}
                          onChange={(e) =>
                            patchWeeklyOverride(row.weekStart, {
                              weeklyTss: Math.max(0, Math.round(Number(e.target.value) || 0)),
                            })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          max={7}
                          className="w-14 rounded-lg border px-2 py-1 font-mono font-semibold outline-none transition focus:ring-2"
                          style={{
                            borderColor: bdr,
                            backgroundColor: `${pc}20`,
                            color: "#f8fafc",
                          }}
                          value={row.displaySessions}
                          onChange={(e) =>
                            patchWeeklyOverride(row.weekStart, {
                              sessionsPerWeek: clamp(Math.round(Number(e.target.value) || 1), 1, 7),
                            })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          placeholder="—"
                          className="w-16 rounded-lg border px-2 py-1 font-mono outline-none transition focus:ring-2"
                          style={{
                            borderColor: bdr,
                            backgroundColor: `${pc}18`,
                            color: "#e2e8f0",
                          }}
                          value={row.hoursPerWeek ?? ""}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            if (v === "") clearWeeklyHours(row.weekStart);
                            else patchWeeklyOverride(row.weekStart, { hoursPerWeek: Math.max(0, Number(v) || 0) });
                          }}
                        />
                      </td>
                      <td className="p-2" style={{ backgroundColor: `${pc}0c` }}>
                        <div className="flex flex-wrap gap-1">
                          {WEEK_FOCUS_OPTIONS.map((opt) => {
                            const on = row.objectives.includes(opt.id);
                            const st = WEEK_FOCUS_CHIP_STYLES[opt.id];
                            return (
                              <button
                                key={`${row.weekStart}-${opt.id}`}
                                type="button"
                                onClick={() => toggleWeekObjective(row.weekStart, opt.id)}
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold transition",
                                  on ? st.on : st.off,
                                )}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Valori iniziali dalle fasi; modifiche qui hanno priorità sulla generazione. Le ore settimanali (macro aerobico)
              ripartiscono la durata media per seduta.
            </p>
          </Pro2SectionCard>

          <Pro2SectionCard
            accent="cyan"
            title="Salva sul Calendar"
            subtitle="Batch su planned_workouts — POST /api/training/planned (contratto Virya)"
            icon={CalendarRange}
          >
            <p className="mb-3 text-sm text-slate-300">
              Qui si materializza il piano: finché non premi il pulsante, le sedute restano solo in questa pagina. In basso
              trovi la stessa azione con anteprima carico annuale; usa quella che preferisci.
            </p>
            <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-black/40"
                checked={replacePrevious}
                onChange={(e) => setReplacePrevious(e.target.checked)}
              />
              <span>Sostituisci sessioni già generate con lo stesso tag piano (notes che iniziano con [VIRYA:…])</span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-xl border border-cyan-500/50 bg-cyan-500/20 px-5 py-3 text-sm font-semibold text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.12)] hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void generateOnCalendar()}
                disabled={saving || !selectedAthleteId || phases.length === 0}
                title={
                  !selectedAthleteId
                    ? "Seleziona / carica contesto atleta"
                    : phases.length === 0
                      ? "Aggiungi fasi (passo 4) prima di generare"
                      : undefined
                }
              >
                {saving ? "Generazione in corso…" : "Genera piano annuale su Calendar"}
              </button>
              <Link
                href="/training/calendar"
                className="text-sm font-semibold text-cyan-300 underline decoration-cyan-500/40 hover:text-cyan-200"
              >
                Apri Calendar →
              </Link>
            </div>
          </Pro2SectionCard>

          <div className="flex justify-start">
            <button
              type="button"
              className="text-xs font-semibold text-slate-400 underline decoration-white/20 hover:text-cyan-300"
              onClick={() => setViryaStep(4)}
            >
              ← Torna a obiettivo cardine, eventi e macro-fasi
            </button>
          </div>

      <section className="viz-grid">
        <article className="viz-card builder-panel rounded-2xl !border-pink-500/30 !bg-black p-5 text-white shadow-[inset_0_1px_0_rgba(251,146,60,0.08)]">
          <h3 className="viz-title">Piano annuale</h3>
          <div className="form-grid-two">
            <label className="form-field">
              <span>Nome piano</span>
              <input className="form-input" value={planName} onChange={(e) => setPlanName(e.target.value)} />
            </label>
            <label className="form-field">
              <span>{sportFamily === "strength" ? "Modulo" : "Disciplina"}</span>
              <input
                className="form-input"
                value={
                  sportFamily === "strength"
                    ? "B · Gym & Performance"
                    : sportFamily === "technical"
                      ? "C · Sport tecnici/tattici"
                      : sportFamily === "lifestyle"
                        ? "D · Lifestyle"
                        : discipline
                }
                onChange={(e) => setDiscipline(e.target.value)}
                disabled={sportFamily === "strength" || sportFamily === "technical" || sportFamily === "lifestyle"}
              />
            </label>
          </div>
          <label className="form-field" style={{ marginTop: "10px" }}>
            <span>Obiettivo piano annuale (coach)</span>
            <textarea
              className="form-textarea min-h-[5rem] w-full rounded-xl border border-pink-500/25 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30"
              rows={4}
              placeholder="Descrivi l’obiettivo cardine della stagione per l’atleta…"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            />
            <span className="mt-1 block text-[0.7rem] text-slate-500">Modificabile in qualsiasi momento; viene propagato nelle note di generazione.</span>
          </label>
          {sportFamily === "aerobic" ? (
            <p className="mt-4 rounded-xl border border-orange-400/25 bg-orange-500/[0.06] px-3 py-2.5 text-xs leading-relaxed text-orange-100/90">
              Ogni piano Virya è <span className="font-semibold text-pink-200">mono-disciplina</span>: per più sport crea piani separati (stesso flusso guidato). La disciplina attiva è quella scelta al passo 2; la generazione Calendar usa solo quella.
            </p>
          ) : sportFamily === "strength" ? (
            <div style={{ marginTop: "10px", display: "grid", gap: "10px" }}>
              <div className="profile-subpanel">
                <div className="session-title-copy">1 · Intervallo periodo</div>
                <div className="form-grid-two">
                  <label className="form-field">
                    <span>Data inizio piano</span>
                    <input className="form-input" type="date" value={gymPlanStart} onChange={(e) => setGymPlanStart(e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>Data fine piano</span>
                    <input className="form-input" type="date" value={gymPlanEnd} onChange={(e) => setGymPlanEnd(e.target.value)} />
                  </label>
                </div>
              </div>
              <div className="profile-subpanel">
                <div className="session-title-copy">2 · Macrofasi</div>
                <div className="form-grid-two">
                  <label className="form-field">
                    <span>Numero macrofasi</span>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={8}
                      value={gymMacroPhaseCount}
                      onChange={(e) => setGymMacroPhaseCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                    />
                  </label>
                  <div className="form-field" style={{ display: "flex", alignItems: "end" }}>
                    <button type="button" className="btn-secondary" onClick={regenerateGymMacroPlan}>
                      Genera macrofasi automatiche
                    </button>
                  </div>
                </div>
              </div>
              <div className="profile-subpanel">
                <div className="session-title-copy">3 · Modulo settimanale coach</div>
                <div className="form-grid-two">
                  <label className="form-field">
                    <span>Settimana da customizzare</span>
                    <select className="form-select" value={selectedGymWeekStart} onChange={(e) => setSelectedGymWeekStart(e.target.value)}>
                      {programWeekRows.slice(0, 52).map((w) => (
                        <option key={`gym-week-opt-${w.weekStart}`} value={w.weekStart}>
                          Settimana {w.week} · {new Date(w.weekStart).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Giorni allenamento / week</span>
                    <select
                      className="form-select"
                      value={selectedWeekConfig().sessionsPerWeek}
                      onChange={(e) => {
                        const nextDays = Math.max(1, Math.min(7, Number(e.target.value) || 1));
                        const baseModules = selectedWeekConfig().modules.slice(0, nextDays);
                        const modules = baseModules.length ? baseModules : buildGymDayModules(nextDays);
                        while (modules.length < nextDays) {
                          const day = modules.length + 1;
                          modules.push({
                            dayIndex: day,
                            district: day % 2 === 0 ? "Petto" : "Gambe",
                            districtObjective: "Forza",
                            exerciseType: "Pesi",
                            methodology: "Lento controllato",
                          });
                        }
                        updateSelectedWeekConfig({ sessionsPerWeek: nextDays, modules });
                      }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <option key={`gym-days-${d}`} value={d}>
                          {d} giorni
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Volume settimana (% vs TSS macrofase)</span>
                    <input
                      className="form-input"
                      type="number"
                      min={50}
                      max={180}
                      value={selectedWeekConfig().loadPct}
                      onChange={(e) => {
                        const pct = Math.max(50, Math.min(180, Number(e.target.value) || 100));
                        updateSelectedWeekConfig({ loadPct: pct });
                      }}
                    />
                  </label>
                  <label className="form-field">
                    <span>Obiettivo Gym annuale</span>
                    <select className="form-select" value={gymPrimaryGoal} onChange={(e) => setGymPrimaryGoal(e.target.value as GymPrimaryGoal)}>
                      {gymGoalLabels.map((g) => (
                        <option key={`gym-goal-select-${g.id}`} value={g.id}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="builder-zone-legend" style={{ marginTop: "8px" }}>
                  <span className="builder-zone-chip">
                    Stato volume: {loadStatusLabel(selectedWeekConfig().loadPct)} ({selectedWeekConfig().loadPct}%)
                  </span>
                  <Link href={`/training/calendar?date=${selectedGymWeekStart}`} style={{ color: "var(--empathy-primary)", textDecoration: "none", alignSelf: "center" }}>
                    Apri settimana in Calendar →
                  </Link>
                </div>
                <small style={{ color: "var(--empathy-text-muted)" }}>
                  Regola volume: Scarico 50-99% · Stabile 100% · Carico 101-180%.
                </small>
                <div style={{ marginTop: "8px", overflowX: "auto" }}>
                  <table className="table-shell">
                    <thead>
                      <tr>
                        <th>Giorno</th>
                        <th>Distretti allenati</th>
                        <th>Obiettivo distretto</th>
                        <th>Tipo esercizio</th>
                        <th>Metodologia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedWeekConfig().modules.slice(0, selectedWeekConfig().sessionsPerWeek).map((row) => (
                        <tr key={`gym-day-module-${row.dayIndex}`}>
                          <td>Giorno {row.dayIndex}</td>
                          <td>
                            <select
                              className="form-select"
                              value={row.district}
                              onChange={(e) =>
                                updateSelectedWeekConfig({
                                  modules: selectedWeekConfig().modules.map((m) => (m.dayIndex === row.dayIndex ? { ...m, district: e.target.value } : m)),
                                })
                              }
                            >
                              {gymDistrictOptions.map((opt) => (
                                <option key={`district-${row.dayIndex}-${opt}`} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={row.districtObjective}
                              onChange={(e) =>
                                updateSelectedWeekConfig({
                                  modules: selectedWeekConfig().modules.map((m) => (m.dayIndex === row.dayIndex ? { ...m, districtObjective: e.target.value } : m)),
                                })
                              }
                            >
                              {gymDistrictObjectiveOptions.map((opt) => (
                                <option key={`district-obj-${row.dayIndex}-${opt}`} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={row.exerciseType}
                              onChange={(e) =>
                                updateSelectedWeekConfig({
                                  modules: selectedWeekConfig().modules.map((m) => (m.dayIndex === row.dayIndex ? { ...m, exerciseType: e.target.value } : m)),
                                })
                              }
                            >
                              {gymExerciseTypeOptions.map((opt) => (
                                <option key={`ex-type-${row.dayIndex}-${opt}`} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={row.methodology}
                              onChange={(e) =>
                                updateSelectedWeekConfig({
                                  modules: selectedWeekConfig().modules.map((m) => (m.dayIndex === row.dayIndex ? { ...m, methodology: e.target.value } : m)),
                                })
                              }
                            >
                              {gymMethodologyOptions.map((opt) => (
                                <option key={`method-${row.dayIndex}-${opt}`} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : sportFamily === "technical" ? (
            <div style={{ marginTop: "10px", display: "grid", gap: "10px" }}>
              <div className="profile-subpanel">
                <div className="session-title-copy">1 · Intervallo periodo</div>
                <div className="form-grid-two">
                  <label className="form-field">
                    <span>Data inizio piano</span>
                    <input className="form-input" type="date" value={technicalPlanStart} onChange={(e) => setTechnicalPlanStart(e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>Data fine piano</span>
                    <input className="form-input" type="date" value={technicalPlanEnd} onChange={(e) => setTechnicalPlanEnd(e.target.value)} />
                  </label>
                </div>
              </div>
              <div className="profile-subpanel">
                <div className="session-title-copy">2 · Macrofasi</div>
                <div className="form-grid-two">
                  <label className="form-field">
                    <span>Numero macrofasi</span>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={8}
                      value={technicalMacroPhaseCount}
                      onChange={(e) => setTechnicalMacroPhaseCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                    />
                  </label>
                  <div className="form-field" style={{ display: "flex", alignItems: "end" }}>
                    <button type="button" className="btn-secondary" onClick={regenerateTechnicalMacroPlan}>
                      Genera macrofasi automatiche
                    </button>
                  </div>
                </div>
              </div>
              <div className="profile-subpanel">
                <div className="session-title-copy">3 · Modulo settimanale coach</div>
                <div className="form-grid-two">
                  <label className="form-field">
                    <span>Settimana da customizzare</span>
                    <select className="form-select" value={selectedTechnicalWeekStart} onChange={(e) => setSelectedTechnicalWeekStart(e.target.value)}>
                      {programWeekRows.slice(0, 52).map((w) => (
                        <option key={`tech-week-opt-${w.weekStart}`} value={w.weekStart}>
                          Settimana {w.week} · {new Date(w.weekStart).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Giorni allenamento / week</span>
                    <select
                      className="form-select"
                      value={selectedTechnicalWeekConfig().sessionsPerWeek}
                      onChange={(e) => {
                        const nextDays = Math.max(1, Math.min(7, Number(e.target.value) || 1));
                        const baseModules = selectedTechnicalWeekConfig().modules.slice(0, nextDays);
                        const modules = baseModules.length ? baseModules : buildTechnicalDayModules(nextDays);
                        while (modules.length < nextDays) {
                          const day = modules.length + 1;
                          modules.push({
                            dayIndex: day,
                            objectives: ["Condizione fisica", "Tecnica con modulo"],
                            exerciseType: "Lavoro tattico a reparti",
                            intensity: "Media",
                            methodology: "Progressivo",
                          });
                        }
                        updateSelectedTechnicalWeekConfig({ sessionsPerWeek: nextDays, modules });
                      }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <option key={`tech-days-${d}`} value={d}>
                          {d} giorni
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Volume settimana (% vs TSS macrofase)</span>
                    <input
                      className="form-input"
                      type="number"
                      min={50}
                      max={180}
                      value={selectedTechnicalWeekConfig().loadPct}
                      onChange={(e) => {
                        const pct = Math.max(50, Math.min(180, Number(e.target.value) || 100));
                        updateSelectedTechnicalWeekConfig({ loadPct: pct });
                      }}
                    />
                  </label>
                </div>
                <div className="builder-zone-legend" style={{ marginTop: "8px" }}>
                  <span className="builder-zone-chip">
                    Stato volume: {loadStatusLabel(selectedTechnicalWeekConfig().loadPct)} ({selectedTechnicalWeekConfig().loadPct}%)
                  </span>
                  <Link href={`/training/calendar?date=${selectedTechnicalWeekStart}`} style={{ color: "var(--empathy-primary)", textDecoration: "none", alignSelf: "center" }}>
                    Apri settimana in Calendar →
                  </Link>
                </div>
                <small style={{ color: "var(--empathy-text-muted)" }}>
                  Regola volume: Scarico 50-99% · Stabile 100% · Carico 101-180%.
                </small>
                <div style={{ marginTop: "8px", overflowX: "auto" }}>
                  <table className="table-shell">
                    <thead>
                      <tr>
                        <th>Giorno</th>
                        <th>Obiettivo del giorno (sequenza)</th>
                        <th>Tipo esercizio</th>
                        <th>Intensita</th>
                        <th>Metodo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTechnicalWeekConfig().modules.slice(0, selectedTechnicalWeekConfig().sessionsPerWeek).map((row) => (
                        <tr key={`tech-day-module-${row.dayIndex}`}>
                          <td>Giorno {row.dayIndex}</td>
                          <td>
                            <div className="builder-zone-legend" style={{ marginBottom: "6px" }}>
                              {row.objectives.map((obj, idx) => (
                                <span key={`obj-seq-${row.dayIndex}-${idx}`} className="builder-zone-chip">
                                  {idx + 1}. {obj}
                                </span>
                              ))}
                            </div>
                            <div className="builder-zone-legend">
                              {technicalObjectiveOptions.map((obj) => (
                                <button
                                  key={`obj-opt-${row.dayIndex}-${obj}`}
                                  type="button"
                                  className={`builder-zone-chip ${row.objectives.includes(obj) ? "builder-chip-active" : ""}`}
                                  onClick={() => {
                                    const current = selectedTechnicalWeekConfig().modules;
                                    updateSelectedTechnicalWeekConfig({
                                      modules: current.map((m) =>
                                        m.dayIndex === row.dayIndex
                                          ? {
                                              ...m,
                                              objectives: m.objectives.includes(obj)
                                                ? m.objectives.filter((x) => x !== obj)
                                                : [...m.objectives, obj],
                                            }
                                          : m,
                                      ),
                                    });
                                  }}
                                >
                                  {obj}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={row.exerciseType}
                              onChange={(e) =>
                                updateSelectedTechnicalWeekConfig({
                                  modules: selectedTechnicalWeekConfig().modules.map((m) =>
                                    m.dayIndex === row.dayIndex ? { ...m, exerciseType: e.target.value } : m,
                                  ),
                                })
                              }
                            >
                              {technicalExerciseTypeOptions.map((opt) => (
                                <option key={`tech-ex-${row.dayIndex}-${opt}`} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={row.intensity}
                              onChange={(e) =>
                                updateSelectedTechnicalWeekConfig({
                                  modules: selectedTechnicalWeekConfig().modules.map((m) =>
                                    m.dayIndex === row.dayIndex ? { ...m, intensity: e.target.value } : m,
                                  ),
                                })
                              }
                            >
                              {technicalIntensityOptions.map((opt) => (
                                <option key={`tech-int-${row.dayIndex}-${opt}`} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={row.methodology}
                              onChange={(e) =>
                                updateSelectedTechnicalWeekConfig({
                                  modules: selectedTechnicalWeekConfig().modules.map((m) =>
                                    m.dayIndex === row.dayIndex ? { ...m, methodology: e.target.value } : m,
                                  ),
                                })
                              }
                            >
                              {technicalMethodologyOptions.map((opt) => (
                                <option key={`tech-method-${row.dayIndex}-${opt}`} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: "10px", display: "grid", gap: "10px" }}>
              <div className="profile-subpanel">
                <div className="session-title-copy">1 · Intervallo periodo</div>
                <div className="form-grid-two">
                  <label className="form-field">
                    <span>Data inizio piano</span>
                    <input className="form-input" type="date" value={lifestylePlanStart} onChange={(e) => setLifestylePlanStart(e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>Data fine piano</span>
                    <input className="form-input" type="date" value={lifestylePlanEnd} onChange={(e) => setLifestylePlanEnd(e.target.value)} />
                  </label>
                </div>
              </div>
              <div className="profile-subpanel">
                <div className="session-title-copy">2 · Macrofasi</div>
                <div className="form-grid-two">
                  <label className="form-field">
                    <span>Numero macrofasi</span>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={8}
                      value={lifestyleMacroPhaseCount}
                      onChange={(e) => setLifestyleMacroPhaseCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                    />
                  </label>
                  <div className="form-field" style={{ display: "flex", alignItems: "end" }}>
                    <button type="button" className="btn-secondary" onClick={regenerateLifestyleMacroPlan}>
                      Genera macrofasi automatiche
                    </button>
                  </div>
                </div>
              </div>
              <div className="profile-subpanel">
                <div className="session-title-copy">3 · Modulo settimanale coach</div>
                <div className="form-grid-two">
                  <label className="form-field">
                    <span>Settimana da customizzare</span>
                    <select className="form-select" value={selectedLifestyleWeekStart} onChange={(e) => setSelectedLifestyleWeekStart(e.target.value)}>
                      {programWeekRows.slice(0, 52).map((w) => (
                        <option key={`life-week-opt-${w.weekStart}`} value={w.weekStart}>
                          Settimana {w.week} · {new Date(w.weekStart).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Giorni allenamento / week</span>
                    <select
                      className="form-select"
                      value={selectedLifestyleWeekConfig().sessionsPerWeek}
                      onChange={(e) => {
                        const nextDays = Math.max(1, Math.min(7, Number(e.target.value) || 1));
                        const baseModules = selectedLifestyleWeekConfig().modules.slice(0, nextDays);
                        const modules = baseModules.length ? baseModules : buildLifestyleDayModules(nextDays);
                        while (modules.length < nextDays) {
                          const day = modules.length + 1;
                          modules.push({
                            dayIndex: day,
                            objective: "Recupero attivo",
                            practiceType: "Yoga flow",
                            intensityRpe: 4,
                            breathingCadence: "4-2-6",
                            holdOrFlow: "Flow continuo",
                            methodology: "Respirazione guidata",
                          });
                        }
                        updateSelectedLifestyleWeekConfig({ sessionsPerWeek: nextDays, modules });
                      }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <option key={`life-days-${d}`} value={d}>
                          {d} giorni
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Volume settimana (% vs TSS macrofase)</span>
                    <input
                      className="form-input"
                      type="number"
                      min={50}
                      max={180}
                      value={selectedLifestyleWeekConfig().loadPct}
                      onChange={(e) => {
                        const pct = Math.max(50, Math.min(180, Number(e.target.value) || 100));
                        updateSelectedLifestyleWeekConfig({ loadPct: pct });
                      }}
                    />
                  </label>
                </div>
                <div className="builder-zone-legend" style={{ marginTop: "8px" }}>
                  <span className="builder-zone-chip">
                    Stato volume: {loadStatusLabel(selectedLifestyleWeekConfig().loadPct)} ({selectedLifestyleWeekConfig().loadPct}%)
                  </span>
                  <Link href={`/training/calendar?date=${selectedLifestyleWeekStart}`} style={{ color: "var(--empathy-primary)", textDecoration: "none", alignSelf: "center" }}>
                    Apri settimana in Calendar →
                  </Link>
                </div>
                <small style={{ color: "var(--empathy-text-muted)" }}>
                  Regola volume: Scarico 50-99% · Stabile 100% · Carico 101-180%.
                </small>
                <div style={{ marginTop: "8px", overflowX: "auto" }}>
                  <table className="table-shell">
                    <thead>
                      <tr>
                        <th>Giorno</th>
                        <th>Obiettivo</th>
                        <th>Tipo di pratica</th>
                        <th>Intensita RPE</th>
                        <th>Cadenza respiratoria</th>
                        <th>Tenuta / Flow</th>
                        <th>Metodologia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedLifestyleWeekConfig().modules.slice(0, selectedLifestyleWeekConfig().sessionsPerWeek).map((row) => (
                        <tr key={`life-day-module-${row.dayIndex}`}>
                          <td>Giorno {row.dayIndex}</td>
                          <td>
                            <select
                              className="form-select"
                              value={row.objective}
                              onChange={(e) =>
                                updateSelectedLifestyleWeekConfig({
                                  modules: selectedLifestyleWeekConfig().modules.map((m) =>
                                    m.dayIndex === row.dayIndex ? { ...m, objective: e.target.value } : m,
                                  ),
                                })
                              }
                            >
                              {lifestyleObjectiveOptions.map((opt) => (
                                <option key={`life-obj-${row.dayIndex}-${opt}`} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={row.practiceType}
                              onChange={(e) =>
                                updateSelectedLifestyleWeekConfig({
                                  modules: selectedLifestyleWeekConfig().modules.map((m) =>
                                    m.dayIndex === row.dayIndex ? { ...m, practiceType: e.target.value } : m,
                                  ),
                                })
                              }
                            >
                              {lifestylePracticeOptions.map((opt) => (
                                <option key={`life-practice-${row.dayIndex}-${opt}`} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="form-input"
                              type="number"
                              min={1}
                              max={10}
                              step={1}
                              value={row.intensityRpe}
                              onChange={(e) =>
                                updateSelectedLifestyleWeekConfig({
                                  modules: selectedLifestyleWeekConfig().modules.map((m) =>
                                    m.dayIndex === row.dayIndex ? { ...m, intensityRpe: Math.max(1, Math.min(10, Number(e.target.value) || 1)) } : m,
                                  ),
                                })
                              }
                            />
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={row.breathingCadence}
                              onChange={(e) =>
                                updateSelectedLifestyleWeekConfig({
                                  modules: selectedLifestyleWeekConfig().modules.map((m) =>
                                    m.dayIndex === row.dayIndex ? { ...m, breathingCadence: e.target.value } : m,
                                  ),
                                })
                              }
                            >
                              {lifestyleBreathingOptions.map((opt) => (
                                <option key={`life-breath-${row.dayIndex}-${opt}`} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={row.holdOrFlow}
                              onChange={(e) =>
                                updateSelectedLifestyleWeekConfig({
                                  modules: selectedLifestyleWeekConfig().modules.map((m) =>
                                    m.dayIndex === row.dayIndex ? { ...m, holdOrFlow: e.target.value } : m,
                                  ),
                                })
                              }
                            >
                              {lifestyleHoldFlowOptions.map((opt) => (
                                <option key={`life-hold-${row.dayIndex}-${opt}`} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={row.methodology}
                              onChange={(e) =>
                                updateSelectedLifestyleWeekConfig({
                                  modules: selectedLifestyleWeekConfig().modules.map((m) =>
                                    m.dayIndex === row.dayIndex ? { ...m, methodology: e.target.value } : m,
                                  ),
                                })
                              }
                            >
                              {lifestyleMethodologyOptions.map((opt) => (
                                <option key={`life-method-${row.dayIndex}-${opt}`} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-orange-400/50 bg-orange-500/15 px-3 py-1.5 text-xs font-semibold text-orange-100 hover:bg-orange-500/25"
              onClick={autoTuneFromGoal}
            >
              Auto-tune fasi dal target
            </button>
          </div>
          <div className="mt-5">
            <div className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-pink-300">Resoconto fasi</div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {phases.map((p) => (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-[0_0_0_1px_rgba(251,113,133,0.08)]"
                >
                  <div className="h-1.5 w-full" style={{ background: phaseColor(p.phase) }} />
                  <div className="p-3">
                    <div className="text-sm font-bold text-white">{phaseLabels[p.phase]}</div>
                    <div className="mt-1 font-mono text-[0.7rem] text-slate-400">
                      {p.start} → {p.end}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-md border border-orange-400/40 bg-orange-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-orange-100">
                        TSS {p.weeklyTss}/sett.
                      </span>
                      <span className="rounded-md border border-pink-400/40 bg-pink-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-pink-100">
                        {p.sessionsPerWeek} sedute/sett.
                      </span>
                    </div>
                    {p.mesocycle ? <div className="mt-2 text-[0.65rem] text-slate-500">{p.mesocycle}</div> : null}
                    {p.notes ? <div className="mt-1 text-[0.62rem] leading-snug text-slate-600">{p.notes}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

      </section>

      <section className="viz-card builder-panel" style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
          <h3 className="viz-title" style={{ margin: 0 }}>Fasi, mesocicli, carico/scarico</h3>
          <button type="button" className="btn-primary" onClick={addPhase}>+ Fase</button>
        </div>
        <table className="table-shell">
          <thead>
            <tr>
              <th>Inizio</th>
              <th>Fine</th>
              <th>Fase</th>
              {(sportFamily === "strength" || sportFamily === "technical" || sportFamily === "lifestyle") && <th>Obiettivo macrofase</th>}
              <th>Mesociclo</th>
              <th>TSS/w</th>
              <th>Sedute/w</th>
              <th>Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {phases.map((p) => (
              <tr key={p.id} style={{ background: `${phaseColor(p.phase)}14` }}>
                <td><input className="form-input" type="date" value={p.start} onChange={(e) => updatePhase(p.id, { start: e.target.value })} /></td>
                <td><input className="form-input" type="date" value={p.end} onChange={(e) => updatePhase(p.id, { end: e.target.value })} /></td>
                <td>
                  <select
                    className="form-select"
                    value={p.phase}
                    style={{ borderColor: phaseColor(p.phase), color: phaseColor(p.phase) }}
                    onChange={(e) => updatePhase(p.id, { phase: e.target.value as PhaseType })}
                  >
                    <option value="base">Base</option>
                    <option value="build">Costruzione</option>
                    <option value="refine">Rifinitura</option>
                    <option value="peak">Forma</option>
                    <option value="deload">Scarico</option>
                    <option value="second_peak">Secondo picco</option>
                  </select>
                </td>
                {(sportFamily === "strength" || sportFamily === "technical" || sportFamily === "lifestyle") && (
                  <td>
                    <select
                      className="form-select"
                      value={
                        p.macroObjective ??
                        (sportFamily === "strength"
                          ? "forza"
                          : sportFamily === "technical"
                            ? "tecnico_tattico"
                            : "lifestyle_balance")
                      }
                      onChange={(e) => updatePhase(p.id, { macroObjective: e.target.value })}
                    >
                      {sportFamily === "strength"
                        ? gymMacroObjectiveLabels.map((g) => (
                            <option key={`macro-obj-${p.id}-${g.id}`} value={g.id}>
                              {g.label}
                            </option>
                          ))
                        : sportFamily === "technical"
                          ? [
                            <option key={`macro-obj-${p.id}-tecnico_tattico`} value="tecnico_tattico">Tecnico-tattico</option>,
                            <option key={`macro-obj-${p.id}-offensiva`} value="offensiva">Offensiva</option>,
                            <option key={`macro-obj-${p.id}-difensiva`} value="difensiva">Difensiva</option>,
                            <option key={`macro-obj-${p.id}-mista`} value="mista">Mista</option>,
                          ]
                          : [
                              <option key={`macro-obj-${p.id}-lifestyle_balance`} value="lifestyle_balance">Balance</option>,
                              <option key={`macro-obj-${p.id}-respirazione`} value="respirazione">Respirazione</option>,
                              <option key={`macro-obj-${p.id}-mobilita`} value="mobilita">Mobilita</option>,
                              <option key={`macro-obj-${p.id}-recovery`} value="recovery">Recovery</option>,
                            ]}
                    </select>
                  </td>
                )}
                <td><input className="form-input" value={p.mesocycle} onChange={(e) => updatePhase(p.id, { mesocycle: e.target.value })} /></td>
                <td>
                  <input
                    className="form-input"
                    type="number"
                    value={p.weeklyTss}
                    style={{ borderColor: tssColor(p.weeklyTss), color: tssColor(p.weeklyTss) }}
                    onChange={(e) => updatePhase(p.id, { weeklyTss: Number(e.target.value) || 0 })}
                  />
                </td>
                <td><input className="form-input" type="number" value={p.sessionsPerWeek} onChange={(e) => updatePhase(p.id, { sessionsPerWeek: Number(e.target.value) || 0 })} /></td>
                <td><input className="form-input" value={p.notes} onChange={(e) => updatePhase(p.id, { notes: e.target.value })} /></td>
                <td><button type="button" className="btn-primary" style={{ background: "rgba(255,255,255,0.12)" }} onClick={() => removePhase(p.id)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="viz-grid">
        <article className="viz-card builder-panel">
          <h3 className="viz-title">Annual Load Projection</h3>
          <div className="annual-grid">
            {annualLoad.map((tss, idx) => {
              const intensity = tss / maxAnnual;
              const bg =
                intensity > 0.78
                  ? "rgba(251,191,36,0.85)"
                  : intensity > 0.55
                    ? "rgba(255,106,0,0.8)"
                    : intensity > 0.3
                      ? "rgba(4,190,129,0.65)"
                      : intensity > 0
                        ? "rgba(255,255,255,0.15)"
                        : "rgba(255,255,255,0.06)";
              return <div key={idx} className="annual-cell" style={{ background: bg }} title={`Week ${idx + 1} · TSS ${tss}`} />;
            })}
          </div>
          <div className="builder-zone-legend" style={{ marginTop: "10px" }}>
            <span className="builder-zone-chip" style={{ borderColor: "#00e08d", color: "#00e08d", backgroundColor: "#00e08d22" }}>Low</span>
            <span className="builder-zone-chip" style={{ borderColor: "#ffd60a", color: "#ffd60a", backgroundColor: "#ffd60a22" }}>Medium</span>
            <span className="builder-zone-chip" style={{ borderColor: "#ff9e00", color: "#ff9e00", backgroundColor: "#ff9e0022" }}>High</span>
            <span className="builder-zone-chip" style={{ borderColor: "#ff00a8", color: "#ff00a8", backgroundColor: "#ff00a822" }}>Peak</span>
          </div>
          <p style={{ marginTop: "10px", color: "var(--empathy-text-muted)", fontSize: "12px" }}>
            Piano annuale pronto per il loop dinamico: Calendar → Analyzer → Adaptation.
          </p>
        </article>
        <article className="viz-card builder-panel">
          <h3 className="viz-title">Master plan annuale (week/day navigator)</h3>
          <div style={{ maxHeight: "340px", overflowY: "auto" }}>
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Start</th>
                  <th>Phase</th>
                  <th>Sessions</th>
                  <th>TSS</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {programWeekRows.slice(0, 52).map((w) => {
                  const pc = phaseColor(w.phaseType);
                  return (
                  <tr key={`${w.week}-${w.weekStart}`} style={{ backgroundColor: phaseRowBackground(w.phaseType) }}>
                    <td style={{ color: pc, fontWeight: 700 }}>W{w.week}</td>
                    <td style={{ color: `${pc}cc` }}>{new Date(w.weekStart).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}</td>
                    <td>
                      <span
                        className="builder-zone-chip"
                        style={{
                          borderColor: pc,
                          color: pc,
                          backgroundColor: `${pc}28`,
                          fontWeight: 700,
                        }}
                      >
                        {w.phase}
                      </span>
                    </td>
                    <td style={{ color: "#f1f5f9", fontWeight: 600 }}>{w.displaySessions}</td>
                    <td style={{ color: pc, fontWeight: 800 }}>{w.displayTss}</td>
                    <td>
                      <Link href={`/training/calendar?date=${w.weekStart}`} style={{ color: pc, textDecoration: "none", fontWeight: 600 }}>
                        Week/Day →
                      </Link>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: "10px", color: "var(--empathy-text-muted)", fontSize: "12px" }}>
            Apri una week specifica in Calendar e modifica/sostituisci la singola seduta direttamente dal giorno.
          </p>
        </article>
        <article className="viz-card builder-panel">
          <h3 className="viz-title">Deploy piano su Calendar</h3>
          <p style={{ margin: "0 0 10px 0", color: "var(--empathy-text-muted)", fontSize: "13px" }}>
            VIRYA genera le sedute previste. Dopo esecuzione reale, EMPATHY confronta previsto/eseguito e riadatta training + nutrition + fueling.
          </p>
          <label className="form-field" style={{ marginBottom: "10px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" checked={replacePrevious} onChange={(e) => setReplacePrevious(e.target.checked)} />
              Sostituisci precedenti sessioni generate con lo stesso piano
            </span>
          </label>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void generateOnCalendar()}
              disabled={saving || !selectedAthleteId || phases.length === 0}
              title={
                !selectedAthleteId
                  ? "Seleziona / carica contesto atleta"
                  : phases.length === 0
                    ? "Aggiungi fasi (passo 4) prima di generare"
                    : undefined
              }
            >
              {saving ? "Generazione..." : "Genera piano annuale"}
            </button>
            <Link href="/training/calendar" style={{ color: "var(--empathy-primary)", textDecoration: "none", alignSelf: "center" }}>
              Apri Calendar →
            </Link>
          </div>
        </article>
      </section>
        </div>
      ) : null}
    </div>
  );
}
