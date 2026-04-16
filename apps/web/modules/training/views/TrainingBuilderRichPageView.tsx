"use client";

import {
  formatExecutedWorkoutSummary,
  type ExecutedWorkout,
  type PlannedWorkout,
} from "@empathy/domain-training";
import {
  Activity,
  Bike,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  Clock,
  Flame,
  Heart,
  LayoutGrid,
  Sparkles,
  Timer,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BuilderGymManualComposer } from "@/components/training/BuilderGymManualComposer";
import { BuilderLifestyleManualComposer } from "@/components/training/BuilderLifestyleManualComposer";
import { BuilderManualComposer } from "@/components/training/BuilderManualComposer";
import { BuilderTechnicalManualComposer } from "@/components/training/BuilderTechnicalManualComposer";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import { TrainingPlannedWindowContextStrip } from "@/components/training/TrainingPlannedWindowContextStrip";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { ResearchTraceScientificPanel } from "@/components/training/ResearchTraceScientificPanel";
import { ReplicateStatusStrip } from "@/components/training/ReplicateStatusStrip";
import { SessionBlockIntensityChart } from "@/components/training/SessionBlockIntensityChart";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import {
  buildPro2BuilderSessionContract,
  defaultManualPlanBlock,
  manualPlanBlocksToChartSegments,
  manualPlanBlocksToGeneratedSession,
  type ManualPlanBlock,
} from "@/lib/training/builder/manual-plan-block";
import {
  buildPro2GymSchedaSessionContract,
  gymManualRowsToChartSegments,
  gymManualRowsToGeneratedSession,
  type Pro2GymManualRow,
} from "@/lib/training/builder/pro2-gym-manual-plan";
import {
  buildPro2LifestyleSchedaSessionContract,
  lifestyleManualRowsToChartSegments,
  lifestyleManualRowsToGeneratedSession,
  type Pro2LifestyleManualRow,
} from "@/lib/training/builder/pro2-lifestyle-manual-plan";
import {
  buildPro2TechnicalSchedaSessionContract,
  technicalManualRowsToChartSegments,
  technicalManualRowsToGeneratedSession,
  type Pro2TechnicalManualRow,
} from "@/lib/training/builder/pro2-technical-manual-plan";
import {
  buildPro2GymRowsFromCatalog,
  extractPreferredExerciseNamesFromBlockExercises,
} from "@/lib/training/builder/pro2-gym-catalog-plan";
import { PRO2_GYM_EXECUTION_STYLES } from "@/lib/training/builder/gym-execution-styles";
import { pro2PaletteSportToBlock1SportTag } from "@/lib/training/domain-blocks/block1-strength-functional";
import { fetchUnifiedBuilderExercises } from "@/modules/training/services/training-builder-catalog-api";
import { macroIdForSport, SPORT_MACRO_SECTORS, type SportMacroId } from "@/lib/training/builder/sport-macro-palette";
import { trainingDomainForPaletteSport } from "@/lib/training/sport-domain-map";
import { estimateTssFromSegments } from "@/lib/training/builder/tss-estimate";
import { serializePro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { GymExerciseMediaThumb } from "@/components/training/GymExerciseMediaThumb";
import {
  TECHNICAL_ATHLETIC_QUALITY_OPTIONS,
  type AdaptationTarget,
  type GymContractionEmphasis,
  type GymEquipmentChannel,
  type GymGenerationProfile,
  type TechnicalAthleticQualityId,
  type TechnicalGameContext,
  type TechnicalWorkPhase,
} from "@/lib/training/engine";
import { sessionBlocksToChartSegments } from "@/lib/training/engine/block-chart-segments";
import { generateBuilderSession } from "@/modules/training/services/training-engine-api";
import { insertPlannedWorkoutFromEngineSession } from "@/modules/training/services/training-planned-api";
import type { TrainingPlannedWindowOkViewModel, TrainingTwinContextStripViewModel } from "@/api/training/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import type { ReadSpineCoverageSummary } from "@/lib/platform/read-spine-coverage";
import { fetchNutritionViewModel } from "@/modules/nutrition/services/nutrition-api";
import { fetchProfileViewModel } from "@/modules/profile/services/profile-api";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { formatPlannedWorkoutCardTitle } from "@/lib/training/planned/format-planned-workout-title";

function initialManualPlanBlocks(): ManualPlanBlock[] {
  return [{ ...defaultManualPlanBlock("steady", "Blocco 1"), minutes: 20, seconds: 0, intensity: "Z2" }];
}

/** Data calendario locale (non UTC): allineata a griglia Calendario e `input type="date"`. */
function localCalendarDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addCalendarDays(isoDate: string, deltaDays: number): string {
  const key = isoDate.slice(0, 10);
  const base = new Date(`${key}T12:00:00`);
  if (Number.isNaN(base.getTime())) return key;
  base.setDate(base.getDate() + deltaDays);
  return localCalendarDateString(base);
}

/** Finestra fetch KPI: include ancore date picker + margine, così sedute lontane restano visibili. */
function builderPlannedWindowRange(plannedDateStr: string, manualPlannedDateStr: string): { from: string; to: string } {
  const today = localCalendarDateString();
  let from = addCalendarDays(today, -7);
  let to = addCalendarDays(today, 120);
  const anchors = [plannedDateStr, manualPlannedDateStr].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  for (const a of anchors) {
    const lo = addCalendarDays(a, -14);
    const hi = addCalendarDays(a, 14);
    if (lo < from) from = lo;
    if (hi > to) to = hi;
  }
  return { from, to };
}

type WindowErr = { ok: false; error?: string };

function sumPlannedTss(rows: PlannedWorkout[]): number {
  return rows.reduce((acc, w) => acc + (Number.isFinite(w.tssTarget) ? w.tssTarget : 0), 0);
}

function sumExecutedTss(rows: ExecutedWorkout[]): number {
  return rows.reduce((acc, w) => acc + (Number.isFinite(w.tss) ? w.tss : 0), 0);
}

function sumMinutesPlanned(rows: PlannedWorkout[]): number {
  return rows.reduce((acc, w) => acc + (Number.isFinite(w.durationMinutes) ? w.durationMinutes : 0), 0);
}

function sumMinutesExecuted(rows: ExecutedWorkout[]): number {
  return rows.reduce((acc, w) => acc + (Number.isFinite(w.durationMinutes) ? w.durationMinutes : 0), 0);
}

const ACCENT_KPI: Record<
  "cyan" | "orange" | "violet" | "emerald" | "slate",
  {
    border: string;
    bg: string;
    ring: string;
    bar: string;
    value: string;
    iconWrap: string;
    icon: string;
    glow: string;
  }
> = {
  cyan: {
    border: "border-cyan-500/45",
    bg: "bg-gradient-to-br from-cyan-950/55 via-slate-950/40 to-black/50",
    ring: "ring-1 ring-cyan-400/25",
    bar: "from-cyan-400 via-teal-400 to-cyan-600",
    value: "text-cyan-50",
    iconWrap:
      "bg-cyan-500/40 text-cyan-50 border-2 border-cyan-300/60 shadow-[0_0_16px_rgba(34,211,238,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]",
    icon: "drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]",
    glow: "shadow-[0_0_24px_rgba(34,211,238,0.12)]",
  },
  orange: {
    border: "border-orange-500/45",
    bg: "bg-gradient-to-br from-orange-950/50 via-zinc-950/40 to-black/50",
    ring: "ring-1 ring-orange-400/25",
    bar: "from-orange-400 via-amber-400 to-orange-600",
    value: "text-orange-50",
    iconWrap:
      "bg-orange-500/40 text-orange-50 border-2 border-orange-300/60 shadow-[0_0_16px_rgba(251,146,60,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]",
    icon: "drop-shadow-[0_0_6px_rgba(255,255,255,0.45)]",
    glow: "shadow-[0_0_24px_rgba(251,146,60,0.12)]",
  },
  violet: {
    border: "border-violet-500/45",
    bg: "bg-gradient-to-br from-violet-950/50 via-zinc-950/40 to-black/50",
    ring: "ring-1 ring-violet-400/25",
    bar: "from-violet-400 via-fuchsia-400 to-violet-600",
    value: "text-violet-50",
    iconWrap:
      "bg-violet-500/40 text-violet-50 border-2 border-violet-300/60 shadow-[0_0_16px_rgba(167,139,250,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]",
    icon: "drop-shadow-[0_0_6px_rgba(255,255,255,0.45)]",
    glow: "shadow-[0_0_24px_rgba(167,139,250,0.12)]",
  },
  emerald: {
    border: "border-emerald-500/45",
    bg: "bg-gradient-to-br from-emerald-950/50 via-zinc-950/40 to-black/50",
    ring: "ring-1 ring-emerald-400/25",
    bar: "from-emerald-400 via-teal-400 to-emerald-600",
    value: "text-emerald-50",
    iconWrap:
      "bg-emerald-500/40 text-emerald-50 border-2 border-emerald-300/60 shadow-[0_0_16px_rgba(52,211,153,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]",
    icon: "drop-shadow-[0_0_6px_rgba(255,255,255,0.45)]",
    glow: "shadow-[0_0_24px_rgba(52,211,153,0.12)]",
  },
  slate: {
    border: "border-white/20",
    bg: "bg-gradient-to-br from-zinc-900/60 to-black/50",
    ring: "ring-1 ring-white/10",
    bar: "from-zinc-500 via-zinc-400 to-zinc-600",
    value: "text-gray-100",
    iconWrap: "bg-zinc-600/50 text-zinc-100 border-2 border-zinc-400/40 shadow-inner",
    icon: "",
    glow: "",
  },
};

function KpiCard({
  label,
  value,
  hint,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: keyof typeof ACCENT_KPI;
  icon: typeof Activity;
}) {
  const a = ACCENT_KPI[accent];
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 backdrop-blur-sm ${a.border} ${a.bg} ${a.ring} ${a.glow}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-95 ${a.bar}`}
        aria-hidden
      />
      <div className="relative pt-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">{label}</p>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.iconWrap}`}
            aria-hidden
          >
            <Icon className={`h-5 w-5 ${a.icon}`} strokeWidth={2.35} />
          </div>
        </div>
        <p className={`mt-2 font-mono text-2xl font-bold tracking-tight drop-shadow-sm ${a.value}`}>{value}</p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      </div>
    </div>
  );
}

const ADAPTATION_OPTIONS: { value: AdaptationTarget; label: string }[] = [
  { value: "mitochondrial_density", label: "Densità mitocondriale" },
  { value: "vo2_max_support", label: "Supporto VO₂max" },
  { value: "lactate_tolerance", label: "Tolleranza lattato" },
  { value: "lactate_clearance", label: "Clearance lattato" },
  { value: "max_strength", label: "Forza max (alta tensione)" },
  { value: "hypertrophy_mixed", label: "Massa · ipertrofia integrata" },
  {
    value: "hypertrophy_myofibrillar",
    label: "Fibrillare · alta intensità, volume contenuto (misti / potenza)",
  },
  {
    value: "hypertrophy_sarcoplasmic",
    label: "Sarcoplasmica · sfinimento, alto volume (massa / forza pura)",
  },
  { value: "neuromuscular_adaptation", label: "Neuromuscolare · intento velocità / RFD" },
  { value: "power_output", label: "Potenza esplosiva" },
  { value: "movement_quality", label: "Qualità movimento" },
  { value: "mobility_capacity", label: "Mobilità" },
  { value: "skill_transfer", label: "Transfer skill" },
  { value: "recovery", label: "Recovery" },
];

/** Adattamenti ammessi per macro A–D (coerenti col dominio motore). */
const ADAPTATION_BY_MACRO: Record<SportMacroId, AdaptationTarget[]> = {
  aerobic: [
    "mitochondrial_density",
    "vo2_max_support",
    "lactate_tolerance",
    "lactate_clearance",
    "recovery",
    "movement_quality",
  ],
  strength: [
    "max_strength",
    "hypertrophy_mixed",
    "hypertrophy_myofibrillar",
    "hypertrophy_sarcoplasmic",
    "neuromuscular_adaptation",
    "power_output",
    "movement_quality",
    "lactate_tolerance",
    "recovery",
  ],
  technical: ["skill_transfer", "movement_quality", "power_output", "lactate_tolerance", "recovery"],
  lifestyle: ["mobility_capacity", "recovery", "movement_quality", "mitochondrial_density"],
};

function defaultAdaptationForMacro(m: SportMacroId): AdaptationTarget {
  const row = ADAPTATION_BY_MACRO[m];
  return row[0] ?? "mitochondrial_density";
}

function defaultSessionMinutesForMacro(m: SportMacroId): number {
  if (m === "strength") return 60;
  if (m === "technical") return 75;
  if (m === "lifestyle") return 45;
  return 60;
}

function sportBelongsToMacro(sportVal: string, macroId: SportMacroId): boolean {
  const sector = SPORT_MACRO_SECTORS.find((x) => x.id === macroId);
  if (!sector) return false;
  const s = sportVal.trim().toLowerCase();
  return sector.sports.some((c) => c.sport.trim().toLowerCase() === s);
}

/** Preset one-tap per Gym / Tecnici: stesso engine, meno campi esposti. */
type EngineQuickPreset = {
  id: string;
  label: string;
  adaptation: AdaptationTarget;
  minutes: number;
  phase: "base" | "build" | "peak" | "taper";
};

const ENGINE_QUICK_GYM: EngineQuickPreset[] = [
  { id: "g-max", label: "Forza max · 60′", adaptation: "max_strength", minutes: 60, phase: "base" },
  { id: "g-mass", label: "Massa integrata · 60′", adaptation: "hypertrophy_mixed", minutes: 60, phase: "build" },
  { id: "g-myo", label: "Fibrillare · intenso 45′", adaptation: "hypertrophy_myofibrillar", minutes: 45, phase: "build" },
  { id: "g-sarco", label: "Sarcoplasmica · volume 60′", adaptation: "hypertrophy_sarcoplasmic", minutes: 60, phase: "build" },
  { id: "g-neuro", label: "Neuromuscolare · 45′", adaptation: "neuromuscular_adaptation", minutes: 45, phase: "base" },
  { id: "g-pow", label: "Potenza · 45′", adaptation: "power_output", minutes: 45, phase: "build" },
];

const GYM_EQUIPMENT_CHIPS: { id: GymEquipmentChannel; label: string }[] = [
  { id: "free_weight", label: "Libero / bilanciere" },
  { id: "bodyweight", label: "Corpo libero" },
  { id: "cable", label: "Cavi" },
  { id: "elastic", label: "Elastici" },
  { id: "machine", label: "Macchinari" },
];

const GYM_CONTRACTION_CHIPS: { id: GymContractionEmphasis; label: string }[] = [
  { id: "standard", label: "Standard" },
  { id: "eccentric", label: "Eccentrica" },
  { id: "isometric", label: "Isometrica" },
  { id: "plyometric", label: "Pliometrica" },
];

const ENGINE_QUICK_TECHNICAL: EngineQuickPreset[] = [
  { id: "t-skill", label: "Drill & transfer · 50′", adaptation: "skill_transfer", minutes: 50, phase: "base" },
  { id: "t-tech", label: "Tecnico · 60′", adaptation: "movement_quality", minutes: 60, phase: "build" },
  { id: "t-pace", label: "Ritmo / potenza · 40′", adaptation: "power_output", minutes: 40, phase: "peak" },
  { id: "t-lac", label: "Tolleranza lattato · 55′", adaptation: "lactate_tolerance", minutes: 55, phase: "build" },
  { id: "t-rec", label: "Recovery attivo · 35′", adaptation: "recovery", minutes: 35, phase: "taper" },
];

const ENGINE_QUICK_LIFESTYLE: EngineQuickPreset[] = [
  { id: "l-mob", label: "Mobilità · 45′", adaptation: "mobility_capacity", minutes: 45, phase: "base" },
  { id: "l-rec", label: "Recovery profondo · 40′", adaptation: "recovery", minutes: 40, phase: "taper" },
  { id: "l-qual", label: "Qualità movimento · 50′", adaptation: "movement_quality", minutes: 50, phase: "base" },
  { id: "l-aero", label: "Aerobico dolce · 55′", adaptation: "mitochondrial_density", minutes: 55, phase: "base" },
];

type EngineGenerateOverrides = Partial<{
  adaptation: AdaptationTarget;
  sessionMinutes: number;
  phase: "base" | "build" | "peak" | "taper";
}>;

/**
 * Builder = unico motore sessione; Vyria annuale userà solo questo endpoint per materializzare.
 */
export default function TrainingBuilderRichPageView() {
  const searchParams = useSearchParams();
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [planned, setPlanned] = useState<PlannedWorkout[]>([]);
  const [executed, setExecuted] = useState<ExecutedWorkout[]>([]);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const [readSpineCoverage, setReadSpineCoverage] = useState<ReadSpineCoverageSummary | null>(null);
  const [twinContextStrip, setTwinContextStrip] = useState<TrainingTwinContextStripViewModel | null>(null);
  /** Deve stare prima del fetch calendario: la finestra include queste date ± margine (non solo oggi±7/28). */
  const [plannedDate, setPlannedDate] = useState(() => localCalendarDateString());
  const [manualPlannedDate, setManualPlannedDate] = useState(() => localCalendarDateString());

  /** Calendario → builder: `?date=YYYY-MM-DD` (e in futuro `replace_planned_id` per punto B). */
  const dateFromQuery = searchParams.get("date");
  useEffect(() => {
    if (!dateFromQuery || !/^\d{4}-\d{2}-\d{2}$/.test(dateFromQuery)) return;
    setPlannedDate(dateFromQuery);
    setManualPlannedDate(dateFromQuery);
  }, [dateFromQuery]);

  useEffect(() => {
    if (ctxLoading) return;
    if (!athleteId) {
      setPlanned([]);
      setExecuted([]);
      setRange(null);
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      setErr("Seleziona un atleta attivo (coach) o completa il profilo.");
      setLoading(false);
      return;
    }
    let c = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { from, to } = builderPlannedWindowRange(plannedDate, manualPlannedDate);
        const q = new URLSearchParams({
          athleteId,
          from,
          to,
        });
        const res = await fetch(`/api/training/planned-window?${q}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: await buildSupabaseAuthHeaders(),
        });
        const json = (await res.json()) as TrainingPlannedWindowOkViewModel | WindowErr;
        if (c) return;
        if (!res.ok || !json.ok) {
          setPlanned([]);
          setExecuted([]);
          setRange(null);
          setReadSpineCoverage(null);
          setTwinContextStrip(null);
          setErr(("error" in json && json.error) || "Lettura calendario non riuscita.");
          return;
        }
        setPlanned(json.planned);
        setExecuted(json.executed ?? []);
        setRange({ from: json.from, to: json.to });
        setReadSpineCoverage(json.readSpineCoverage ?? null);
        setTwinContextStrip(json.twinContextStrip ?? null);
      } catch {
        if (!c) {
          setErr("Errore di rete.");
          setReadSpineCoverage(null);
          setTwinContextStrip(null);
        }
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [athleteId, ctxLoading, calendarRefresh, plannedDate, manualPlannedDate]);

  const stats = useMemo(() => {
    const pTss = sumPlannedTss(planned);
    const eTss = sumExecutedTss(executed);
    const pMin = sumMinutesPlanned(planned);
    const eMin = sumMinutesExecuted(executed);
    return {
      pTss,
      eTss,
      pMin,
      eMin,
      sessionsPlanned: planned.length,
      sessionsExecuted: executed.length,
    };
  }, [planned, executed]);

  const [adaptation, setAdaptation] = useState<AdaptationTarget>("mitochondrial_density");
  const [phase, setPhase] = useState<"base" | "build" | "peak" | "taper">("base");
  const [sessionMinutes, setSessionMinutes] = useState(60);
  const [sport, setSport] = useState("cycling");
  const activeMacroId = useMemo(() => macroIdForSport(sport), [sport]);
  const currentSportLabel = useMemo(() => {
    const sector = SPORT_MACRO_SECTORS.find((x) => x.id === activeMacroId);
    const chip = sector?.sports.find((c) => c.sport.trim().toLowerCase() === sport.trim().toLowerCase());
    return chip?.label ?? sport;
  }, [activeMacroId, sport]);

  useEffect(() => {
    if (activeMacroId !== "aerobic") {
      setLengthMode("time");
    }
    setSessionMinutes(defaultSessionMinutesForMacro(activeMacroId));
    const allowed = ADAPTATION_BY_MACRO[activeMacroId];
    setAdaptation((prev) => (allowed.includes(prev) ? prev : defaultAdaptationForMacro(activeMacroId)));
  }, [activeMacroId]);
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<Awaited<ReturnType<typeof generateBuilderSession>> | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveOkId, setSaveOkId] = useState<string | null>(null);

  const [intensityUnit, setIntensityUnit] = useState<"watt" | "hr">("watt");
  const [ftpW, setFtpW] = useState(250);
  const [hrMax, setHrMax] = useState(185);
  const [lengthMode, setLengthMode] = useState<"time" | "distance">("time");
  const [speedRefKmh, setSpeedRefKmh] = useState(32);
  const [manualSessionName, setManualSessionName] = useState("Seduta coach Pro 2");
  const [manualPlanBlocks, setManualPlanBlocks] = useState<ManualPlanBlock[]>(initialManualPlanBlocks);
  const [manualSaveBusy, setManualSaveBusy] = useState(false);
  const [manualSaveErr, setManualSaveErr] = useState<string | null>(null);
  const [manualSaveOkId, setManualSaveOkId] = useState<string | null>(null);
  const [manualActiveIndex, setManualActiveIndex] = useState(0);
  /** Durata pianificata sul calendario (coach): separata dalla somma dei segmenti del grafico. */
  const [manualSessionDurationMinutes, setManualSessionDurationMinutes] = useState(60);
  /** Scheda palestra (V1 model): solo macro B; mai blocchi watt/FC del composer aerobico. */
  const [gymManualRows, setGymManualRows] = useState<Pro2GymManualRow[]>([]);
  /** Scheda lifestyle (macro D): playbook mind-body + righe prescrittive come Gym. */
  const [lifestyleManualRows, setLifestyleManualRows] = useState<Pro2LifestyleManualRow[]>([]);
  const [physioHint, setPhysioHint] = useState<string | null>(null);
  const [gymEquipChannels, setGymEquipChannels] = useState<GymEquipmentChannel[]>([]);
  const [gymContraction, setGymContraction] = useState<GymContractionEmphasis>("standard");
  /** Stile esecuzione usato dal generatore scheda (parità V1 `executionStyle` nella materializzazione). */
  const [gymAutoExecutionStyle, setGymAutoExecutionStyle] = useState("");

  /** Macro C · moduli tecnico-tattici (V1 Virya: obiettivi + metodologia → EVidenza nel motore). */
  const [techWorkPhase, setTechWorkPhase] = useState<TechnicalWorkPhase>("technique");
  const [techGameContext, setTechGameContext] = useState<TechnicalGameContext>("build_up");
  const [techQualities, setTechQualities] = useState<TechnicalAthleticQualityId[]>([]);
  const [technicalManualRows, setTechnicalManualRows] = useState<Pro2TechnicalManualRow[]>([]);

  const planOpts = useMemo(
    () => ({
      unit: intensityUnit,
      ftpW: Math.max(1, ftpW),
      hrMax: Math.max(1, hrMax),
      lengthMode,
      speedRefKmh: Math.max(1, speedRefKmh),
    }),
    [intensityUnit, ftpW, hrMax, lengthMode, speedRefKmh],
  );

  const adaptationAllowed = useMemo(() => ADAPTATION_BY_MACRO[activeMacroId], [activeMacroId]);

  const gymEngineProfile = useMemo((): GymGenerationProfile | undefined => {
    if (activeMacroId !== "strength") return undefined;
    const equipmentChannels = gymEquipChannels.length ? gymEquipChannels : undefined;
    const contraction = gymContraction !== "standard" ? gymContraction : undefined;
    if (!equipmentChannels && !contraction) return undefined;
    return { equipmentChannels, contraction };
  }, [activeMacroId, gymEquipChannels, gymContraction]);

  useEffect(() => {
    if (activeMacroId !== "strength") {
      setGymEquipChannels([]);
      setGymContraction("standard");
      setGymManualRows([]);
      setGymAutoExecutionStyle("");
    }
  }, [activeMacroId]);

  useEffect(() => {
    if (activeMacroId !== "lifestyle") {
      setLifestyleManualRows([]);
    }
  }, [activeMacroId]);

  const manualSession = useMemo(() => {
    if (activeMacroId === "strength") {
      return gymManualRowsToGeneratedSession({ sport, rows: gymManualRows, adaptationTarget: adaptation });
    }
    if (activeMacroId === "lifestyle") {
      return lifestyleManualRowsToGeneratedSession({ sport, rows: lifestyleManualRows, adaptationTarget: adaptation });
    }
    if (activeMacroId === "technical") {
      return technicalManualRowsToGeneratedSession({ sport, rows: technicalManualRows, adaptationTarget: adaptation });
    }
    return manualPlanBlocksToGeneratedSession({
      sport,
      blocks: manualPlanBlocks,
      opts: planOpts,
      family: activeMacroId,
      adaptationTarget: adaptation,
    });
  }, [sport, gymManualRows, lifestyleManualRows, technicalManualRows, activeMacroId, adaptation, manualPlanBlocks, planOpts]);
  const manualChartSegments = useMemo(() => {
    if (activeMacroId === "strength") {
      return gymManualRowsToChartSegments(gymManualRows);
    }
    if (activeMacroId === "lifestyle") {
      return lifestyleManualRowsToChartSegments(lifestyleManualRows);
    }
    if (activeMacroId === "technical") {
      return technicalManualRowsToChartSegments(technicalManualRows);
    }
    return manualPlanBlocksToChartSegments(manualPlanBlocks, planOpts);
  }, [activeMacroId, gymManualRows, lifestyleManualRows, technicalManualRows, manualPlanBlocks, planOpts]);

  const manualTssPreview = useMemo(() => estimateTssFromSegments(manualChartSegments), [manualChartSegments]);

  const genChartSegments = useMemo(() => {
    if (!genResult || !("ok" in genResult) || !genResult.ok) return [];
    return sessionBlocksToChartSegments(genResult.session.blocks);
  }, [genResult]);

  const genTssPreview = useMemo(() => estimateTssFromSegments(genChartSegments), [genChartSegments]);

  useEffect(() => {
    setManualActiveIndex((i) => Math.min(i, Math.max(0, manualPlanBlocks.length - 1)));
  }, [manualPlanBlocks.length]);

  useEffect(() => {
    if (!athleteId) {
      setPhysioHint(null);
      return;
    }
    if (macroIdForSport(sport) === "strength") {
      setPhysioHint(null);
      return;
    }
    let c = false;
    (async () => {
      try {
        const vm = await fetchProfileViewModel(athleteId);
        if (c || vm.error) {
          if (!c) setPhysioHint(null);
          return;
        }
        const phys =
          vm.physiologyState?.physiologicalProfile ?? vm.athleteMemory?.physiology?.physiologicalProfile;
        if (!phys) {
          if (!c) setPhysioHint(null);
          return;
        }
        const p = phys;
        const hint: string[] = [];
        if (typeof p.ftpWatts === "number" && p.ftpWatts > 0) {
          setFtpW(Math.round(p.ftpWatts));
          hint.push(`FTP ${Math.round(p.ftpWatts)} W`);
        }
        if (typeof p.lt2HeartRate === "number" && p.lt2HeartRate > 0) {
          const hm = Math.min(220, Math.max(155, Math.round(p.lt2HeartRate / 0.88)));
          setHrMax(hm);
          hint.push(`FC max ~${hm} bpm`);
        } else if (typeof p.lt1HeartRate === "number" && p.lt1HeartRate > 0) {
          const hm = Math.min(220, Math.max(155, Math.round(p.lt1HeartRate / 0.72)));
          setHrMax(hm);
          hint.push(`FC max ~${hm} bpm`);
        }
        setPhysioHint(hint.length ? `Da fisiologia: ${hint.join(" · ")}` : null);
      } catch {
        if (!c) setPhysioHint(null);
      }
    })();
    return () => {
      c = true;
    };
  }, [athleteId, sport]);

  const runGenerate = useCallback(
    async (overrides?: EngineGenerateOverrides) => {
      if (!athleteId) return;
      const adaptationUse = overrides?.adaptation ?? adaptation;
      const sessionMinutesUse = overrides?.sessionMinutes ?? sessionMinutes;
      const phaseUse = overrides?.phase ?? phase;
      if (overrides?.adaptation != null) setAdaptation(overrides.adaptation);
      if (overrides?.sessionMinutes != null) setSessionMinutes(overrides.sessionMinutes);
      if (overrides?.phase != null) setPhase(overrides.phase);
      setGenBusy(true);
      setGenErr(null);
      setGenResult(null);
      const paletteDomain = trainingDomainForPaletteSport(sport);
      const out = await generateBuilderSession({
        athleteId,
        applyOperationalScaling: false,
        request: {
          sport,
          ...(paletteDomain ? { domain: paletteDomain } : {}),
          goalLabel: adaptationUse,
          adaptationTarget: adaptationUse,
          sessionMinutes: sessionMinutesUse,
          phase: phaseUse,
          ...(activeMacroId === "strength" && gymEngineProfile ? { gymProfile: gymEngineProfile } : {}),
          ...(activeMacroId === "technical"
            ? {
                technicalModuleFocus: {
                  workPhase: techWorkPhase,
                  gameContext: techGameContext,
                  athleticQualities: techQualities,
                },
              }
            : {}),
        },
      });
      if ("error" in out) {
        setGenBusy(false);
        setGenErr(out.error);
        return;
      }

      if (activeMacroId === "strength") {
        const sportTag = pro2PaletteSportToBlock1SportTag(sport);
        const { rows: catalogRows, error: catErr } = await fetchUnifiedBuilderExercises({
          sportTag,
          limit: 400,
        });
        if (catErr || catalogRows.length === 0) {
          setGenBusy(false);
          setGenErr(catErr ?? "Catalogo EMPATHY non disponibile per materializzare la scheda.");
          setGenResult(null);
          return;
        }
        const preferred = extractPreferredExerciseNamesFromBlockExercises(out.blockExercises);
        const built = buildPro2GymRowsFromCatalog({
          sourceRows: catalogRows,
          activeSportTag: sportTag,
          adaptation: adaptationUse,
          executionStyle: gymAutoExecutionStyle,
          preferredExerciseNames: preferred.length ? preferred : undefined,
        });
        if (built.length === 0) {
          setGenBusy(false);
          setGenErr(
            "Il motore ha proposto una struttura ma nessun esercizio del catalogo risulta compatibile. Prova altro adattamento o disciplina.",
          );
          setGenResult(null);
          return;
        }
        setGymManualRows(built);
        setManualSessionDurationMinutes(sessionMinutesUse);
        const goalLabel = String((out.session as { goalLabel?: string }).goalLabel ?? "").trim();
        if (goalLabel) setManualSessionName(goalLabel);
      }

      setGenResult(out);
      setSaveErr(null);
      setSaveOkId(null);
      setGenBusy(false);
    },
    [
      athleteId,
      adaptation,
      phase,
      sessionMinutes,
      sport,
      activeMacroId,
      gymEngineProfile,
      gymAutoExecutionStyle,
      techWorkPhase,
      techGameContext,
      techQualities,
    ],
  );

  const saveToCalendar = useCallback(async () => {
    if (!athleteId || !genResult || !("ok" in genResult) || !genResult.ok) return;
    setSaveBusy(true);
    setSaveErr(null);
    setSaveOkId(null);

    const renderProfile = {
      intensityUnit,
      ftpW: Math.max(1, ftpW),
      hrMax: Math.max(1, hrMax),
      lengthMode,
      speedRefKmh: Math.max(1, speedRefKmh),
    };

    let session = genResult.session;
    let extraNotesLines: string[] | undefined;

    if (activeMacroId === "strength") {
      const scheda = gymManualRowsToGeneratedSession({
        sport,
        rows: gymManualRows,
        adaptationTarget: adaptation,
      });
      if (!scheda) {
        setSaveBusy(false);
        setSaveErr("Scheda vuota: rigenera o applica esercizi dal catalogo.");
        return;
      }
      session = scheda;
      const contract = buildPro2GymSchedaSessionContract({
        rows: gymManualRows,
        renderProfile,
        discipline: currentSportLabel || sport.trim() || "Gym",
        sessionName: manualSessionName.trim() || "Scheda Pro 2",
        adaptationTarget: adaptation,
        phase,
      });
      extraNotesLines = [serializePro2BuilderSessionContract(contract)];
    }

    const res = await insertPlannedWorkoutFromEngineSession({
      athleteId,
      date: plannedDate,
      session,
      extraNotesLines,
    });
    setSaveBusy(false);
    if (!res.ok) {
      setSaveErr(res.error);
      return;
    }
    setSaveOkId(res.plannedWorkoutId ?? "ok");
    setCalendarRefresh((n) => n + 1);
  }, [
    athleteId,
    genResult,
    plannedDate,
    activeMacroId,
    gymManualRows,
    sport,
    adaptation,
    currentSportLabel,
    manualSessionName,
    phase,
    intensityUnit,
    ftpW,
    hrMax,
    lengthMode,
    speedRefKmh,
  ]);

  const saveManualToCalendar = useCallback(async () => {
    if (!athleteId || !manualSession) return;
    setManualSaveBusy(true);
    setManualSaveErr(null);
    setManualSaveOkId(null);
    const renderProfile = {
      intensityUnit,
      ftpW: Math.max(1, ftpW),
      hrMax: Math.max(1, hrMax),
      lengthMode,
      speedRefKmh: Math.max(1, speedRefKmh),
    };
    const contract =
      activeMacroId === "strength"
        ? buildPro2GymSchedaSessionContract({
            rows: gymManualRows,
            renderProfile,
            discipline: currentSportLabel || sport.trim() || "Gym",
            sessionName: manualSessionName.trim() || "Scheda Pro 2",
            adaptationTarget: adaptation,
            phase,
          })
        : activeMacroId === "lifestyle"
          ? buildPro2LifestyleSchedaSessionContract({
              rows: lifestyleManualRows,
              renderProfile,
              discipline: currentSportLabel || sport.trim() || "Lifestyle",
              sessionName: manualSessionName.trim() || "Scheda lifestyle Pro 2",
              adaptationTarget: adaptation,
              phase,
            })
          : activeMacroId === "technical"
            ? buildPro2TechnicalSchedaSessionContract({
                rows: technicalManualRows,
                renderProfile,
                discipline: currentSportLabel || sport.trim() || "Sport tecnico",
                sessionName: manualSessionName.trim() || "Scheda tecnica Pro 2",
                adaptationTarget: adaptation,
                phase,
                technicalModuleFocus: {
                  workPhase: techWorkPhase,
                  gameContext: techGameContext,
                  athleticQualities: techQualities,
                },
              })
            : buildPro2BuilderSessionContract({
                blocks: manualPlanBlocks,
                renderProfile,
                discipline: sport.trim() || "Endurance",
                sessionName: manualSessionName.trim() || "Sessione Pro 2",
                adaptationTarget: adaptation,
                phase,
                family: activeMacroId,
              });
    const jsonLine = serializePro2BuilderSessionContract(contract);
    const res = await insertPlannedWorkoutFromEngineSession({
      athleteId,
      date: manualPlannedDate,
      session: manualSession,
      extraNotesLines: [jsonLine],
    });
    setManualSaveBusy(false);
    if (!res.ok) {
      setManualSaveErr(res.error);
      return;
    }
    setManualSaveOkId(res.plannedWorkoutId ?? "ok");
    setCalendarRefresh((n) => n + 1);
  }, [
    athleteId,
    manualSession,
    manualPlannedDate,
    manualPlanBlocks,
    gymManualRows,
    lifestyleManualRows,
    technicalManualRows,
    techWorkPhase,
    techGameContext,
    techQualities,
    currentSportLabel,
    intensityUnit,
    ftpW,
    hrMax,
    lengthMode,
    speedRefKmh,
    sport,
    manualSessionName,
    adaptation,
    phase,
    activeMacroId,
  ]);

  const upcoming = useMemo(() => {
    const today = localCalendarDateString();
    return [...planned]
      .filter((w) => w.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [planned]);

  const [nutritionLine, setNutritionLine] = useState<string | null>(null);
  const [nutritionBusy, setNutritionBusy] = useState(false);
  const [nutritionErr, setNutritionErr] = useState<string | null>(null);

  const refreshNutritionContext = useCallback(async () => {
    if (!athleteId) return;
    setNutritionBusy(true);
    setNutritionErr(null);
    try {
      const vm = await fetchNutritionViewModel({ athleteId, date: plannedDate });
      if (vm.error) {
        setNutritionErr(vm.error);
        setNutritionLine(null);
        return;
      }
      const p = vm.plan;
      const src =
        vm.planSource === "calendar_training_solver"
          ? "da calendario"
          : vm.planSource === "nutrition_plans"
            ? "da piano nutrizione"
            : "nessun allenamento in calendario per questo giorno";
      setNutritionLine(
        `${p.calories} kcal · CHO ${p.carbsG}g · PRO ${p.proteinsG}g · FAT ${p.fatsG}g · H₂O ${p.hydrationMl}ml · ${src}` +
          (typeof vm.plannedSessionsCount === "number" ? ` · sedute pianific. ${vm.plannedSessionsCount}` : ""),
      );
    } catch (e) {
      setNutritionErr(e instanceof Error ? e.message : "Errore lettura nutrizione");
      setNutritionLine(null);
    } finally {
      setNutritionBusy(false);
    }
  }, [athleteId, plannedDate]);

  useEffect(() => {
    if (!athleteId) return;
    void refreshNutritionContext();
  }, [athleteId, plannedDate, calendarRefresh, refreshNutritionContext]);

  const showData = !ctxLoading && !loading && !err;

  return (
    <div className="min-h-full bg-gradient-to-b from-zinc-950 via-black to-black px-4 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.25em] text-orange-400">Training · Builder</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Crea sessione</h1>
            <p className="mt-2 max-w-xl text-sm text-gray-400">
              KPI da calendario reale; generazione sessione tramite <code className="text-orange-200/90">/api/training/engine/generate</code>{" "}
              (motore deterministico). Vyria annuale resta downstream e riusa questo stesso punto.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pro2Link
              href="/training"
              variant="ghost"
              className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:border-cyan-400/50 hover:bg-cyan-500/15"
            >
              Hub training
            </Pro2Link>
            <Pro2Link
              href="/dashboard"
              variant="secondary"
              className="justify-center border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15"
            >
              Dashboard
            </Pro2Link>
          </div>
        </header>

        <div className="scroll-mt-28">
          <TrainingSubnav />
        </div>

        {athleteId && readSpineCoverage ? (
          <TrainingPlannedWindowContextStrip
            className="mb-4"
            label="Builder"
            readSpineCoverage={readSpineCoverage}
            twinContextStrip={twinContextStrip}
          />
        ) : null}

        <section
          aria-label="Contesto generativo e asset"
          className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5 shadow-inner"
        >
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-violet-400">
            Builder · contesto generativo
          </p>
          <p className="mt-1 max-w-3xl text-xs text-gray-500">
            Knowledge library e asset esterni sono di supporto e audit: il motore sessione resta deterministico; nessun redirect o
            blocco se i dati mancano (fallback locale in-modulo).
          </p>
          {!athleteId ? (
            <p className="mt-3 text-sm text-gray-500">Seleziona un atleta attivo per caricare tracce e contesto nutrizione.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <ResearchTraceScientificPanel athleteId={athleteId} limit={6} compact />
              <ReplicateStatusStrip />
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-300/90">Nutrizione · giorno seduta engine</p>
                    <p className="mt-0.5 font-mono text-[0.7rem] text-gray-500">{plannedDate}</p>
                  </div>
                  <Pro2Button
                    type="button"
                    variant="secondary"
                    disabled={nutritionBusy}
                    className="border-emerald-500/35 bg-emerald-500/10 text-xs hover:bg-emerald-500/15"
                    onClick={() => void refreshNutritionContext()}
                  >
                    {nutritionBusy ? "Lettura…" : "Aggiorna sintesi"}
                  </Pro2Button>
                </div>
                {nutritionErr ? <p className="mt-2 text-xs text-amber-200/90">{nutritionErr}</p> : null}
                {nutritionLine ? (
                  <p className="mt-2 text-sm text-gray-200">{nutritionLine}</p>
                ) : !nutritionErr && !nutritionBusy ? (
                  <p className="mt-2 text-xs text-gray-500">Solo lettura API nutrizione — utile per allineare fueling mentale al giorno scelto.</p>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section aria-label="KPI finestra" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="TSS pianificato"
            value={showData ? Math.round(stats.pTss).toString() : "—"}
            hint={range ? `${range.from} → ${range.to}` : undefined}
            accent="cyan"
            icon={Flame}
          />
          <KpiCard
            label="TSS eseguito"
            value={showData ? Math.round(stats.eTss).toString() : "—"}
            hint="Nella stessa finestra"
            accent="orange"
            icon={Activity}
          />
          <KpiCard
            label="Sessioni (pian. / eseg.)"
            value={showData ? `${stats.sessionsPlanned} / ${stats.sessionsExecuted}` : "—"}
            accent="violet"
            icon={Timer}
          />
          <KpiCard
            label="Minuti totali"
            value={showData ? `${Math.round(stats.pMin + stats.eMin)}` : "—"}
            hint="Pianificato + eseguito (somma grezza)"
            accent="emerald"
            icon={Heart}
          />
        </section>

        <section
          aria-label="Famiglie sessione"
          className="rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/[0.12] via-orange-950/[0.08] to-black/85 p-6 shadow-inner"
        >
          <div className="mb-5 flex flex-wrap items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-fuchsia-400/45 bg-fuchsia-500/35 text-fuchsia-50 shadow-[0_0_16px_rgba(217,70,239,0.35)]">
              <LayoutGrid className="h-5 w-5" strokeWidth={2.35} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">Sport per settore (A → D)</h2>
              <p className="mt-1 text-sm text-gray-400">
                Prima scegli macro e disciplina; dominio motore (endurance / gym / hyrox / crossfit / team_sport / combat /
                mind_body) alimenta generazione engine e builder manuale sotto.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {SPORT_MACRO_SECTORS.map((m) => {
              const sel = activeMacroId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => {
                    if (!sportBelongsToMacro(sport, m.id)) {
                      setSport(m.sports[0]?.sport ?? sport);
                    }
                  }}
                  className={`flex w-full min-h-[11rem] flex-col justify-between gap-4 rounded-2xl border-2 px-4 py-4 text-left transition sm:min-h-[12rem] sm:px-5 sm:py-5 ${m.macroIdle} ${sel ? m.macroActive : "opacity-95 hover:brightness-110 hover:opacity-100"}`}
                >
                  <div className="min-w-0">
                    <p className="text-base font-black leading-tight tracking-tight text-white sm:text-lg">{m.shortLabel}</p>
                    <p className="mt-1 line-clamp-2 text-[0.68rem] font-medium leading-snug text-white/80 sm:text-xs">{m.title}</p>
                  </div>
                  <div className="-mx-1 flex flex-row flex-nowrap items-center gap-2 overflow-x-auto border-t border-white/20 pt-3 [scrollbar-width:thin]">
                    {m.sports.map((s) => (
                      <span
                        key={s.sport}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/25 p-0.5 shadow-inner ring-1 ring-white/10 sm:h-11 sm:w-11"
                        title={s.label}
                        aria-hidden
                      >
                        <SportDisciplineGlyph glyph={s.glyph} className="h-8 w-8 sm:h-9 sm:w-9" />
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {(() => {
            const sector = SPORT_MACRO_SECTORS.find((x) => x.id === activeMacroId) ?? SPORT_MACRO_SECTORS[0];
            return (
              <div
                className={`mt-5 rounded-2xl border-2 border-white/10 bg-black/50 p-4 sm:p-5 ${
                  sector.id === "aerobic"
                    ? "shadow-[inset_0_0_40px_rgba(34,211,238,0.06)]"
                    : sector.id === "strength"
                      ? "shadow-[inset_0_0_40px_rgba(251,146,60,0.06)]"
                      : sector.id === "technical"
                        ? "shadow-[inset_0_0_40px_rgba(192,132,252,0.07)]"
                        : "shadow-[inset_0_0_40px_rgba(52,211,153,0.06)]"
                }`}
              >
                <p className="text-sm font-bold text-white">{sector.title}</p>
                <p className="mt-1 text-xs text-gray-500">{sector.blurb}</p>
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {sector.sports.map((chip) => {
                    const active = sport.trim().toLowerCase() === chip.sport.trim().toLowerCase();
                    return (
                      <button
                        key={`${sector.id}-${chip.label}`}
                        type="button"
                        onClick={() => setSport(chip.sport)}
                        className={`group flex flex-col items-center gap-2 rounded-xl border border-transparent p-2 transition hover:border-white/15 hover:bg-white/[0.04] ${
                          active ? "border-white/25 bg-white/[0.08] ring-2 ring-white/30" : ""
                        }`}
                      >
                        <span
                          className={`flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-2xl border-2 bg-black/20 shadow-inner transition group-hover:scale-[1.04] ${chip.iconRing}`}
                        >
                          <SportDisciplineGlyph glyph={chip.glyph} className="h-9 w-9" />
                        </span>
                        <span className="text-center text-[0.65rem] font-bold leading-tight text-white">{chip.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </section>

        <section
          aria-label="Genera sessione (builder engine)"
          className={`rounded-2xl border p-6 ${
            activeMacroId === "strength"
              ? "border-fuchsia-500/35 bg-gradient-to-br from-violet-950/25 via-fuchsia-950/15 to-orange-950/20"
              : activeMacroId === "technical"
                ? "border-violet-500/35 bg-gradient-to-br from-violet-500/[0.1] via-fuchsia-950/15 to-black/40"
                : activeMacroId === "lifestyle"
                  ? "border-emerald-500/35 bg-gradient-to-br from-emerald-500/[0.1] via-teal-950/20 to-black/40"
                  : "border-cyan-500/30 bg-gradient-to-br from-cyan-500/[0.08] via-violet-950/10 to-black/40"
          }`}
        >
          <h2 className="text-lg font-bold text-white">Genera sessione</h2>
          {activeMacroId === "strength" ? (
            <p className="mt-1 text-sm text-gray-400">
              Stesso flusso efficace di V1: il motore propone la struttura (nomi esercizio), poi si materializza la{" "}
              <span className="text-fuchsia-200">scheda sul catalogo EMPATHY</span> con serie, ripetute, recuperi e immagini. Dominio da palette (
              <code className="text-orange-200/90">gym / hyrox / crossfit</code>). Disciplina:{" "}
              <span className="font-semibold text-orange-200">{currentSportLabel}</span>.
            </p>
          ) : activeMacroId === "technical" ? (
            <p className="mt-1 text-sm text-gray-400">
              Concentrati su tecnica, tattica, schemi e moduli (come V1 Virya): la parte aerobico-pura resta in A · Aerobico.
              Il builder stima un <span className="text-violet-200/95">TSS</span> da confrontare con RPE / carico interno. Dominio{" "}
              <code className="text-violet-300/80">team_sport / combat</code>. Disciplina:{" "}
              <span className="font-semibold text-violet-200">{currentSportLabel}</span>.
            </p>
          ) : activeMacroId === "lifestyle" ? (
            <p className="mt-1 text-sm text-gray-400">
              Preset per mobilità, recovery, qualità movimento e lavoro aerobico leggero (mind-body). Dominio{" "}
              <code className="text-emerald-300/80">mind_body</code>. Disciplina:{" "}
              <span className="font-semibold text-emerald-200">{currentSportLabel}</span>.
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-400">
              Macro aerobica: input compatti (regole Pro 2). Output: blocchi + esercizi da libreria deterministica. Profilo da{" "}
              <code className="text-cyan-400/70">physiological_profiles</code>, twin da <code className="text-gray-500">twin_states</code> se presente.
            </p>
          )}

          {activeMacroId === "strength" ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-orange-300/90">Preset generativi</p>
              <div className="flex flex-wrap gap-2">
                {ENGINE_QUICK_GYM.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!athleteId || genBusy}
                    onClick={() => void runGenerate({ adaptation: p.adaptation, sessionMinutes: p.minutes, phase: p.phase })}
                    className="min-w-[10rem] flex-1 rounded-2xl border-2 border-orange-400/35 bg-gradient-to-br from-orange-600/90 to-amber-700/90 px-4 py-3 text-left text-sm font-bold text-white shadow-[0_0_20px_rgba(251,146,60,0.2)] transition hover:brightness-110 disabled:opacity-40"
                  >
                    <Sparkles className="mb-1 h-4 w-4 text-amber-100 opacity-90" aria-hidden />
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-orange-500/20 bg-black/25 p-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-orange-200/90">Attrezzi · filtro libreria</p>
                <p className="mt-1 text-xs text-gray-500">
                  Allineato a V1 (pesi, corpo libero, cavi, elastici, macchinari). Nessun chip = nessun filtro stretto.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {GYM_EQUIPMENT_CHIPS.map((ch) => {
                    const on = gymEquipChannels.includes(ch.id);
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() =>
                          setGymEquipChannels((prev) =>
                            prev.includes(ch.id) ? prev.filter((x) => x !== ch.id) : [...prev, ch.id],
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          on
                            ? "border-orange-400 bg-orange-500/30 text-white"
                            : "border-white/15 bg-black/40 text-gray-400 hover:border-white/25"
                        }`}
                      >
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-wider text-orange-200/90">
                  Contrazione / stile (letteratura + V1)
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {GYM_CONTRACTION_CHIPS.map((ch) => {
                    const sel = gymContraction === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setGymContraction(ch.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          sel
                            ? "border-amber-300 bg-amber-500/25 text-amber-50"
                            : "border-white/15 bg-black/40 text-gray-400 hover:border-white/25"
                        }`}
                      >
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
                <label className="mt-3 flex max-w-lg flex-col gap-1 text-[0.65rem] text-gray-400">
                  Stile esecuzione nella scheda generata (come V1 <code className="text-gray-500">executionStyle</code>)
                  <select
                    className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                    value={gymAutoExecutionStyle}
                    onChange={(e) => setGymAutoExecutionStyle(e.target.value)}
                  >
                    <option value="">Standard · usa solo prescrizione deterministica</option>
                    {PRO2_GYM_EXECUTION_STYLES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <details className="rounded-xl border border-white/10 bg-black/30">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-300 marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="underline decoration-orange-400/50 decoration-1 underline-offset-2">Durata, fase e adattamento</span>
                  <span className="ml-2 text-xs text-gray-500">(opzionale)</span>
                </summary>
                <div className="flex flex-wrap items-end gap-3 border-t border-white/10 px-4 pb-4 pt-3">
                  <div className="flex min-w-[11rem] flex-1 items-start gap-2 rounded-xl border border-violet-500/35 bg-violet-500/10 p-3 sm:min-w-[10rem]">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Adattamento
                      <select
                        className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                        value={adaptation}
                        onChange={(e) => setAdaptation(e.target.value as AdaptationTarget)}
                      >
                        {ADAPTATION_OPTIONS.filter((o) => adaptationAllowed.includes(o.value)).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex min-w-[8rem] items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
                    <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Fase
                      <select
                        className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                        value={phase}
                        onChange={(e) => setPhase(e.target.value as typeof phase)}
                      >
                        <option value="base">base</option>
                        <option value="build">build</option>
                        <option value="peak">peak</option>
                        <option value="taper">taper</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex w-[6.5rem] items-start gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 p-3">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Min
                      <input
                        type="number"
                        min={20}
                        max={180}
                        className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                        value={sessionMinutes}
                        onChange={(e) => setSessionMinutes(Number(e.target.value))}
                      />
                    </label>
                  </div>
                </div>
              </details>
              <Pro2Button
                type="button"
                variant="primary"
                className="!inline-flex !w-full !items-center !justify-center !gap-2 !bg-gradient-to-r !from-orange-500 !to-amber-600 !shadow-lg !shadow-orange-500/25 sm:!w-auto"
                disabled={!athleteId || genBusy}
                onClick={() => void runGenerate()}
              >
                <Flame className="h-4 w-4 text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.55)]" aria-hidden />
                {genBusy ? "Generazione…" : "Genera con impostazioni attuali"}
              </Pro2Button>
            </div>
          ) : activeMacroId === "technical" ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-violet-300/90">Preset generativi</p>
              <div className="flex flex-wrap gap-2">
                {ENGINE_QUICK_TECHNICAL.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!athleteId || genBusy}
                    onClick={() => void runGenerate({ adaptation: p.adaptation, sessionMinutes: p.minutes, phase: p.phase })}
                    className="min-w-[10rem] flex-1 rounded-2xl border-2 border-violet-400/35 bg-gradient-to-br from-violet-600/90 to-fuchsia-700/90 px-4 py-3 text-left text-sm font-bold text-white shadow-[0_0_20px_rgba(167,139,250,0.2)] transition hover:brightness-110 disabled:opacity-40"
                  >
                    <Sparkles className="mb-1 h-4 w-4 text-violet-100 opacity-90" aria-hidden />
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.07] p-4">
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-violet-200/95">
                  Struttura modulare · Macro C
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Allinea fase di lavoro, contesto di gioco e qualità atletica: il motore arricchisce cue e traccia (come obiettivi V1:
                  fase offensiva/difensiva, schemi, modulo tecnico).
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">Fase di lavoro</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {(
                        [
                          { id: "technique" as const, label: "Tecnica" },
                          { id: "tactics" as const, label: "Tattica" },
                        ] as const
                      ).map((opt) => {
                        const sel = techWorkPhase === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setTechWorkPhase(opt.id)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              sel
                                ? "border-fuchsia-300 bg-fuchsia-500/25 text-fuchsia-50"
                                : "border-white/15 bg-black/40 text-gray-400 hover:border-white/25"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">Contesto</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {(
                        [
                          { id: "defensive" as const, label: "Difensivo" },
                          { id: "build_up" as const, label: "Impostazione" },
                          { id: "offensive" as const, label: "Offensivo" },
                        ] as const
                      ).map((opt) => {
                        const sel = techGameContext === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setTechGameContext(opt.id)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              sel
                                ? "border-violet-300 bg-violet-500/25 text-violet-50"
                                : "border-white/15 bg-black/40 text-gray-400 hover:border-white/25"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">Qualità atletica (multipla)</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {TECHNICAL_ATHLETIC_QUALITY_OPTIONS.map((q) => {
                        const on = techQualities.includes(q.id);
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() =>
                              setTechQualities((prev) =>
                                prev.includes(q.id) ? prev.filter((x) => x !== q.id) : [...prev, q.id],
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              on
                                ? "border-violet-400 bg-violet-600/20 text-white"
                                : "border-white/15 bg-black/40 text-gray-400 hover:border-white/25"
                            }`}
                          >
                            {q.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <details className="rounded-xl border border-white/10 bg-black/30">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-300 marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="underline decoration-violet-400/50 decoration-1 underline-offset-2">Durata, fase e adattamento</span>
                  <span className="ml-2 text-xs text-gray-500">(opzionale)</span>
                </summary>
                <div className="flex flex-wrap items-end gap-3 border-t border-white/10 px-4 pb-4 pt-3">
                  <div className="flex min-w-[11rem] flex-1 items-start gap-2 rounded-xl border border-violet-500/35 bg-violet-500/10 p-3 sm:min-w-[10rem]">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Adattamento
                      <select
                        className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                        value={adaptation}
                        onChange={(e) => setAdaptation(e.target.value as AdaptationTarget)}
                      >
                        {ADAPTATION_OPTIONS.filter((o) => adaptationAllowed.includes(o.value)).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex min-w-[8rem] items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
                    <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Fase
                      <select
                        className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                        value={phase}
                        onChange={(e) => setPhase(e.target.value as typeof phase)}
                      >
                        <option value="base">base</option>
                        <option value="build">build</option>
                        <option value="peak">peak</option>
                        <option value="taper">taper</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex w-[6.5rem] items-start gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 p-3">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Min
                      <input
                        type="number"
                        min={20}
                        max={180}
                        className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                        value={sessionMinutes}
                        onChange={(e) => setSessionMinutes(Number(e.target.value))}
                      />
                    </label>
                  </div>
                </div>
              </details>
              <Pro2Button
                type="button"
                variant="primary"
                className="!inline-flex !w-full !items-center !justify-center !gap-2 !bg-gradient-to-r !from-violet-600 !via-fuchsia-600 !to-orange-500 !shadow-lg !shadow-violet-500/25 sm:!w-auto"
                disabled={!athleteId || genBusy}
                onClick={() => void runGenerate()}
              >
                <Flame className="h-4 w-4 text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]" aria-hidden />
                {genBusy ? "Generazione…" : "Genera con impostazioni attuali"}
              </Pro2Button>
            </div>
          ) : activeMacroId === "lifestyle" ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-300/90">Preset generativi · Lifestyle</p>
              <div className="flex flex-wrap gap-2">
                {ENGINE_QUICK_LIFESTYLE.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!athleteId || genBusy}
                    onClick={() => void runGenerate({ adaptation: p.adaptation, sessionMinutes: p.minutes, phase: p.phase })}
                    className="min-w-[10rem] flex-1 rounded-2xl border-2 border-emerald-400/35 bg-gradient-to-br from-emerald-600/90 to-teal-700/90 px-4 py-3 text-left text-sm font-bold text-white shadow-[0_0_20px_rgba(52,211,153,0.18)] transition hover:brightness-110 disabled:opacity-40"
                  >
                    <Sparkles className="mb-1 h-4 w-4 text-emerald-100 opacity-90" aria-hidden />
                    {p.label}
                  </button>
                ))}
              </div>
              <details className="rounded-xl border border-white/10 bg-black/30">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-300 marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="underline decoration-emerald-400/50 decoration-1 underline-offset-2">Durata, fase e adattamento</span>
                  <span className="ml-2 text-xs text-gray-500">(opzionale)</span>
                </summary>
                <div className="flex flex-wrap items-end gap-3 border-t border-white/10 px-4 pb-4 pt-3">
                  <div className="flex min-w-[11rem] flex-1 items-start gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 sm:min-w-[10rem]">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Adattamento
                      <select
                        className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                        value={adaptation}
                        onChange={(e) => setAdaptation(e.target.value as AdaptationTarget)}
                      >
                        {ADAPTATION_OPTIONS.filter((o) => adaptationAllowed.includes(o.value)).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex min-w-[8rem] items-start gap-2 rounded-xl border border-teal-500/35 bg-teal-500/10 p-3">
                    <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Fase
                      <select
                        className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                        value={phase}
                        onChange={(e) => setPhase(e.target.value as typeof phase)}
                      >
                        <option value="base">base</option>
                        <option value="build">build</option>
                        <option value="peak">peak</option>
                        <option value="taper">taper</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex w-[6.5rem] items-start gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 p-3">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                      Min
                      <input
                        type="number"
                        min={20}
                        max={180}
                        className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                        value={sessionMinutes}
                        onChange={(e) => setSessionMinutes(Number(e.target.value))}
                      />
                    </label>
                  </div>
                </div>
              </details>
              <Pro2Button
                type="button"
                variant="primary"
                className="!inline-flex !w-full !items-center !justify-center !gap-2 !bg-gradient-to-r !from-emerald-600 !via-teal-600 !to-cyan-600 !shadow-lg !shadow-emerald-500/25 sm:!w-auto"
                disabled={!athleteId || genBusy}
                onClick={() => void runGenerate()}
              >
                <Flame className="h-4 w-4 text-emerald-100 drop-shadow-[0_0_8px_rgba(167,243,208,0.5)]" aria-hidden />
                {genBusy ? "Generazione…" : "Genera con impostazioni attuali"}
              </Pro2Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="flex min-w-[11rem] flex-1 items-start gap-2 rounded-xl border border-violet-500/35 bg-violet-500/10 p-3 sm:min-w-[10rem]">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" aria-hidden />
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                  Adattamento
                  <select
                    className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                    value={adaptation}
                    onChange={(e) => setAdaptation(e.target.value as AdaptationTarget)}
                  >
                    {ADAPTATION_OPTIONS.filter((o) => adaptationAllowed.includes(o.value)).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex min-w-[8rem] items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
                <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                  Fase
                  <select
                    className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                    value={phase}
                    onChange={(e) => setPhase(e.target.value as typeof phase)}
                  >
                    <option value="base">base</option>
                    <option value="build">build</option>
                    <option value="peak">peak</option>
                    <option value="taper">taper</option>
                  </select>
                </label>
              </div>
              <div className="flex w-[6.5rem] items-start gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 p-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                  Min
                  <input
                    type="number"
                    min={20}
                    max={180}
                    className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                    value={sessionMinutes}
                    onChange={(e) => setSessionMinutes(Number(e.target.value))}
                  />
                </label>
              </div>
              <div className="flex min-w-[9rem] flex-1 items-start gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 p-3 sm:min-w-[8rem]">
                <Bike className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
                  Sport
                  <input
                    type="text"
                    className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                  />
                </label>
              </div>
              <Pro2Button
                type="button"
                variant="primary"
                className="!inline-flex !items-center !gap-2 !bg-gradient-to-r !from-cyan-600 !via-teal-600 !to-violet-600 !shadow-lg !shadow-cyan-500/25"
                disabled={!athleteId || genBusy}
                onClick={() => void runGenerate()}
              >
                <Flame className="h-4 w-4 text-cyan-100 drop-shadow-[0_0_8px_rgba(103,232,249,0.45)]" aria-hidden />
                {genBusy ? "Generazione…" : "Genera sessione"}
              </Pro2Button>
            </div>
          )}
          {genErr ? (
            <p className="mt-4 text-sm text-amber-300" role="alert">
              {genErr}
            </p>
          ) : null}
          {genResult && "ok" in genResult && genResult.ok ? (
            <div className="mt-6 space-y-4 rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
              {activeMacroId === "strength" ? (
                <div className="space-y-3 rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-violet-950/30 via-fuchsia-950/10 to-orange-950/20 p-4">
                  <p className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-violet-200 via-fuchsia-200 to-orange-200">
                    Scheda generata ({gymManualRows.length} esercizi) · TSS stimato ~{manualTssPreview}
                  </p>
                  <p className="text-xs text-gray-500">
                    Stessa logica V1: nomi dal motore, abbinamento deterministico al catalogo EMPATHY. Affina serie e carichi nel composer sotto.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {gymManualRows.map((row) => (
                      <div
                        key={row.id}
                        className="flex gap-3 rounded-2xl border border-violet-500/25 bg-black/35 p-3 shadow-inner"
                      >
                        <GymExerciseMediaThumb
                          src={row.mediaUrl}
                          alt={row.name}
                          catalogExerciseId={row.exerciseId}
                          fallbackLabel={row.name}
                          className="h-28 w-28 shrink-0 rounded-xl border border-fuchsia-500/20 object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold leading-snug text-white">{row.name}</p>
                          <p className="mt-2 font-mono text-xs text-orange-100/90">
                            {row.sets}×{row.reps}
                            {row.loadKg != null && row.loadKg > 0 ? ` · ${row.loadKg} kg` : ""}
                            {row.pct1Rm != null && row.pct1Rm > 0 ? ` · ~${row.pct1Rm}% 1RM` : ""} · rec {row.restSec}s
                            {(row.chainLabel ?? "").trim() ? ` · gruppo ${(row.chainLabel ?? "").trim()}` : ""}
                          </p>
                          {row.quickIncomplete ? (
                            <p className="mt-1 text-[0.65rem] text-orange-300/90">Scheda veloce (incompleta)</p>
                          ) : null}
                          {row.executionStyle ? (
                            <p className="mt-1 text-[0.65rem] text-gray-400">{row.executionStyle}</p>
                          ) : null}
                          {(row.notes ?? "").trim() ? (
                            <p className="mt-1 line-clamp-2 text-[0.65rem] text-pink-200/80">{row.notes}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className={`rounded-xl border p-3 ${
                    activeMacroId === "lifestyle"
                      ? "border-emerald-500/30 bg-gradient-to-br from-emerald-950/25 to-black/45"
                      : activeMacroId === "technical"
                        ? "border-violet-500/30 bg-gradient-to-br from-violet-950/20 to-black/45"
                        : "border-cyan-500/25 bg-gradient-to-br from-cyan-950/15 to-black/45"
                  }`}
                >
                  <SessionBlockIntensityChart
                    segments={genChartSegments}
                    title="Grafico sessione (auto)"
                    estimatedTss={genTssPreview}
                  />
                </div>
              )}
              <div className="flex flex-wrap items-end gap-3 border-b border-white/10 pb-4">
                <label className="flex flex-col gap-1 text-xs text-gray-500">
                  Data calendario
                  <input
                    type="date"
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                  />
                </label>
                <Pro2Button
                  type="button"
                  variant="secondary"
                  className="!border-orange-400/40 !bg-orange-500/15 !text-orange-100"
                  disabled={saveBusy}
                  onClick={() => void saveToCalendar()}
                >
                  {saveBusy ? "Salvataggio…" : "Salva nel calendario"}
                </Pro2Button>
              </div>
              {saveErr ? (
                <p className="text-sm text-amber-300" role="alert">
                  {saveErr}
                </p>
              ) : null}
              {saveOkId ? (
                <p className="text-sm text-emerald-300/90">
                  Salvato su planned_workouts per il{" "}
                  <span className="font-mono text-emerald-200">{plannedDate}</span>
                  {saveOkId !== "ok" ? ` (id ${saveOkId.slice(0, 8)}…)` : ""}. Apri il calendario su quel giorno:{" "}
                  <Pro2Link
                    href={`/training/calendar?date=${encodeURIComponent(plannedDate)}`}
                    variant="ghost"
                    className="!inline-flex border border-emerald-500/40 px-2 py-0.5 text-xs"
                  >
                    Calendario
                  </Pro2Link>
                </p>
              ) : null}
              <p className="font-mono text-[0.65rem] text-gray-500">{genResult.source}</p>
              <p className="text-gray-300">
                Profilo fisiologico: {genResult.physiologyPresent ? "sì" : "no"} · Twin: {genResult.twinPresent ? "sì" : "no"}
              </p>
              {activeMacroId !== "strength" ? (
                <ul className="space-y-3">
                  {(genResult.blockExercises as Array<{ order: number; label: string; exercises: Array<{ name?: string }> }>).map(
                    (b) => (
                      <li key={b.order} className="border-b border-white/5 pb-3 last:border-0">
                        <span className="font-bold text-white">
                          {b.order}. {b.label}
                        </span>
                        <ul className="mt-1 list-disc pl-5 text-gray-400">
                          {b.exercises.map((ex) => (
                            <li key={ex.name}>{ex.name ?? "—"}</li>
                          ))}
                        </ul>
                      </li>
                    ),
                  )}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        {activeMacroId === "strength" ? (
          <BuilderGymManualComposer
            athleteId={athleteId}
            physioHint={physioHint}
            gymRows={gymManualRows}
            setGymRows={setGymManualRows}
            manualSessionName={manualSessionName}
            setManualSessionName={setManualSessionName}
            manualChartSegments={manualChartSegments}
            manualPlannedDate={manualPlannedDate}
            setManualPlannedDate={setManualPlannedDate}
            manualSessionDurationMinutes={manualSessionDurationMinutes}
            setManualSessionDurationMinutes={setManualSessionDurationMinutes}
            paletteSport={sport}
            currentSportLabel={currentSportLabel}
            manualSaveBusy={manualSaveBusy}
            onSaveManual={() => void saveManualToCalendar()}
            manualSaveErr={manualSaveErr}
            manualSaveOkId={manualSaveOkId}
            canSave={Boolean(manualSession)}
            estimatedTss={manualTssPreview}
          />
        ) : activeMacroId === "technical" ? (
          <BuilderTechnicalManualComposer
            athleteId={athleteId}
            physioHint={physioHint}
            paletteSport={sport}
            currentSportLabel={currentSportLabel}
            technicalManualRows={technicalManualRows}
            setTechnicalManualRows={setTechnicalManualRows}
            technicalModuleFocus={{
              workPhase: techWorkPhase,
              gameContext: techGameContext,
              athleticQualities: techQualities,
            }}
            manualSessionName={manualSessionName}
            setManualSessionName={setManualSessionName}
            manualChartSegments={manualChartSegments}
            manualPlannedDate={manualPlannedDate}
            setManualPlannedDate={setManualPlannedDate}
            manualSessionDurationMinutes={manualSessionDurationMinutes}
            setManualSessionDurationMinutes={setManualSessionDurationMinutes}
            manualSaveBusy={manualSaveBusy}
            onSaveManual={() => void saveManualToCalendar()}
            manualSaveErr={manualSaveErr}
            manualSaveOkId={manualSaveOkId}
            canSave={Boolean(manualSession)}
            estimatedTss={manualTssPreview}
          />
        ) : activeMacroId === "lifestyle" ? (
          <BuilderLifestyleManualComposer
            athleteId={athleteId}
            physioHint={physioHint}
            lifestyleRows={lifestyleManualRows}
            setLifestyleRows={setLifestyleManualRows}
            manualSessionName={manualSessionName}
            setManualSessionName={setManualSessionName}
            manualChartSegments={manualChartSegments}
            manualPlannedDate={manualPlannedDate}
            setManualPlannedDate={setManualPlannedDate}
            manualSessionDurationMinutes={manualSessionDurationMinutes}
            setManualSessionDurationMinutes={setManualSessionDurationMinutes}
            paletteSport={sport}
            currentSportLabel={currentSportLabel}
            manualSaveBusy={manualSaveBusy}
            onSaveManual={() => void saveManualToCalendar()}
            manualSaveErr={manualSaveErr}
            manualSaveOkId={manualSaveOkId}
            canSave={Boolean(manualSession)}
            estimatedTss={manualTssPreview}
          />
        ) : (
          <BuilderManualComposer
            athleteId={athleteId}
            macroFamily={activeMacroId}
            physioHint={physioHint}
            manualPlanBlocks={manualPlanBlocks}
            setManualPlanBlocks={setManualPlanBlocks}
            activeIndex={manualActiveIndex}
            setActiveIndex={setManualActiveIndex}
            intensityUnit={intensityUnit}
            setIntensityUnit={setIntensityUnit}
            ftpW={ftpW}
            setFtpW={setFtpW}
            hrMax={hrMax}
            setHrMax={setHrMax}
            lengthMode={lengthMode}
            setLengthMode={setLengthMode}
            speedRefKmh={speedRefKmh}
            setSpeedRefKmh={setSpeedRefKmh}
            manualSessionName={manualSessionName}
            setManualSessionName={setManualSessionName}
            manualChartSegments={manualChartSegments}
            manualPlannedDate={manualPlannedDate}
            setManualPlannedDate={setManualPlannedDate}
            manualSaveBusy={manualSaveBusy}
            onSaveManual={() => void saveManualToCalendar()}
            manualSaveErr={manualSaveErr}
            manualSaveOkId={manualSaveOkId}
            canSave={Boolean(manualSession)}
            estimatedTss={manualTssPreview}
            manualSessionDurationMinutes={manualSessionDurationMinutes}
            setManualSessionDurationMinutes={setManualSessionDurationMinutes}
          />
        )}

        <section
          aria-label="Prossime sessioni pianificate"
          className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/[0.14] via-black/55 to-violet-950/[0.12] p-6 shadow-inner"
        >
          <div className="mb-4 flex flex-wrap items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-cyan-400/45 bg-cyan-500/35 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.3)]">
              <CalendarDays className="h-5 w-5" strokeWidth={2.35} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">Prossime pianificate</h2>
              <p className="mt-1 text-sm text-gray-400">Ordinate per data, dalla finestra API.</p>
            </div>
          </div>
          {ctxLoading || loading ? (
            <div className="mt-4 h-10 w-full max-w-xs animate-pulse rounded-full bg-cyan-500/15" />
          ) : null}
          {err ? (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
              {err}
            </p>
          ) : null}
          {showData && upcoming.length === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-cyan-500/25 bg-black/40 px-6 py-14 text-center">
              <CalendarOff className="h-14 w-14 text-cyan-400 drop-shadow-[0_0_18px_rgba(34,211,238,0.35)]" aria-hidden />
              <p className="mt-5 text-base font-semibold text-white">Nessuna sessione futura nella finestra</p>
              <p className="mt-2 max-w-sm text-sm text-gray-500">
                Pianifica dal builder sopra o attendi il refresh del calendario: qui vedrai le prossime sedute come card colorate.
              </p>
            </div>
          ) : null}
          {showData && upcoming.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {upcoming.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/35 via-black/45 to-violet-950/20 px-3 py-3 shadow-sm"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/45 bg-cyan-500/20 px-3 py-1 font-mono text-xs font-semibold text-cyan-100 shadow-inner">
                    <CalendarDays className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
                    {w.date}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-white">{formatPlannedWorkoutCardTitle(w)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {showData && executed.length > 0 ? (
            <div className="mt-8 border-t border-orange-500/20 pt-6">
              <h3 className="flex items-center gap-2 text-sm font-bold text-orange-100">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-400/40 bg-orange-500/25 text-orange-200 shadow-[0_0_10px_rgba(251,146,60,0.25)]">
                  <Activity className="h-4 w-4" strokeWidth={2.35} aria-hidden />
                </span>
                Ultime eseguite (max 5)
              </h3>
              <ul className="mt-3 flex flex-col gap-2">
                {[...executed]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 5)
                  .map((w) => (
                    <li
                      key={w.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-orange-500/25 bg-gradient-to-r from-orange-950/25 to-black/50 px-3 py-2.5 text-sm"
                    >
                      <span className="inline-flex rounded-full border border-orange-400/40 bg-orange-500/15 px-2.5 py-0.5 font-mono text-xs text-orange-100">
                        {w.date}
                      </span>
                      <span className="text-gray-200">{formatExecutedWorkoutSummary(w)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
