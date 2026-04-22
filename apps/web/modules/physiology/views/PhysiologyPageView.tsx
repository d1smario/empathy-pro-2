"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAthleteContext } from "@/core";
import { computeLactateEngine, computeMaxOxidateEngine } from "@/engines";
import { estimateVo2FromDevice, type SupportedSport } from "@/lib/engines/vo2-estimator";
import {
  computeMetabolicProfileEngine,
  METABOLIC_CP_ENGINE_REVISION,
  powerComponentRowNearestSec,
} from "@/lib/engines/critical-power-engine";
import { parseGasExchangeExport } from "@/lib/physiology/gas-exchange-file-parser";
import type { GasExchangeParseResult } from "@/lib/physiology/gas-exchange-file-parser";
import { substrateOxidationRatesFromGasExchange } from "@/lib/physiology/substrate-from-gas-exchange";
import { vo2LMinAtTimeOnset, vo2OnsetFractionAtTime } from "@/lib/physiology/vo2-on-kinetics";
import { estimatePeakBloodLactateMmol } from "@/lib/physiology/lactate-steady-state-curve";
import { METABOLIC_SIGNAL_SCHEMA_VERSION } from "@/lib/physiology/metabolic-signal-contracts";
import { gutMetricsFromTaxa } from "@/lib/physiology/derive-gut-metrics-from-context";
import {
  LactateAnalysisDataSourcesCard,
  type HealthBioGlucoseMeta,
  type SegmentAttachmentMeta,
} from "@/components/physiology/LactateAnalysisDataSourcesCard";
import { LactateMetabolicContextTiles } from "@/components/physiology/LactateMetabolicContextTiles";
import { LactatePro2NumericEngineParams } from "@/components/physiology/LactatePro2NumericEngineParams";
import { LactateWorkoutPickerPro2 } from "@/components/physiology/LactateWorkoutPickerPro2";
import { MaxOxMetabolicContextTiles } from "@/components/physiology/MaxOxMetabolicContextTiles";
import { MaxOxSegmentPanelPro2, type MaxOxSegmentForm } from "@/components/physiology/MaxOxSegmentPanelPro2";
import { MaxOxPro2NumericEngineParams } from "@/components/physiology/MaxOxPro2NumericEngineParams";
import { PhysiologyPro2LactateLab } from "@/components/physiology/PhysiologyPro2LactateLab";
import { PhysiologyPro2MaxOxLab } from "@/components/physiology/PhysiologyPro2MaxOxLab";
import { MetabolicPowerComponentsStackChart } from "@/components/physiology/MetabolicPowerComponentsStackChart";
import { PhysiologyPro2MetabolicDashboard } from "@/components/physiology/PhysiologyPro2MetabolicDashboard";
import { MultiscaleBottleneckPanelPro2 } from "@/components/knowledge/MultiscaleBottleneckPanelPro2";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { cn } from "@/lib/cn";
import {
  fetchPhysiologyHistoryAndFtp,
  savePhysiologySnapshot,
} from "@/modules/physiology/services/physiology-snapshot-api";
import { clearVo2maxLab, saveVo2maxLab } from "@/modules/physiology/services/vo2max-lab-api";
import Link from "next/link";
import { Activity, BookOpen, Layers, Network } from "lucide-react";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function zoneColorFromName(name: string): string {
  if (name.startsWith("Z1")) return "#00c2ff";
  if (name.startsWith("Z2")) return "#00e08d";
  if (name.startsWith("Z3")) return "#b6ff35";
  if (name.startsWith("Z4")) return "#ffd60a";
  if (name.startsWith("Z5")) return "#ff9e00";
  return "#9ca3af";
}

function maxOxStateColor(state: string): string {
  const lower = state.toLowerCase();
  if (lower.includes("critical") || lower.includes("severe")) return "#ff5d5d";
  if (lower.includes("limited") || lower.includes("warning")) return "#ffd60a";
  return "#00e08d";
}

function choGapColor(gap: number): string {
  if (gap > 25) return "#ff5d5d";
  if (gap > 10) return "#ffd60a";
  return "#00e08d";
}

function bottleneckColor(index: number): string {
  if (index >= 0.75) return "#ff5d5d";
  if (index >= 0.55) return "#ffd60a";
  return "#00e08d";
}

function maxOxBottleneckLabel(kind: string): string {
  if (kind === "central_delivery") return "Delivery centrale O2";
  if (kind === "peripheral_utilization") return "Utilizzo periferico/mitocondriale";
  if (kind === "glycolytic_pressure") return "Pressione glicolitica";
  if (kind === "oxidative_ceiling") return "Tetto aerobico (CP / capacità)";
  return "Bilanciato";
}

type CpPoint = { label: string; sec: number };
type LabSection = "metabolic_profile" | "lactate_analysis" | "max_oxidate";
type LabRun = {
  id: string;
  section: LabSection;
  model_version: string;
  created_at: string;
  input_payload?: Record<string, unknown> | null;
  output_payload: Record<string, unknown> | null;
};

function labHistorySectionTitle(section: LabSection): string {
  if (section === "metabolic_profile") return "Metabolic profile";
  if (section === "lactate_analysis") return "Lactate analysis";
  return "Max Oxidate";
}

type WorkoutSample = {
  id: string;
  date: string;
  duration_min: number;
  tss: number;
  sport: string;
  power_w: number | null;
  velocity_m_min: number | null;
  grade_pct: number | null;
  elevation_gain_m: number | null;
  core_temp_c: number | null;
  skin_temp_c: number | null;
  rer: number | null;
  vo2_l_min: number | null;
  vco2_l_min: number | null;
  smo2: number | null;
  lactate_mmol_l: number | null;
  glucose_mmol_l: number | null;
};

type PubmedItem = {
  source: "pubmed";
  pmid: string;
  title: string;
  journal: string | null;
  pub_date: string | null;
  authors: string[];
  url: string;
};

const CP_POINTS: CpPoint[] = [
  { label: "5s", sec: 5 },
  { label: "15s", sec: 15 },
  { label: "30s", sec: 30 },
  { label: "60s", sec: 60 },
  { label: "3m", sec: 180 },
  { label: "5m", sec: 300 },
  { label: "12m", sec: 720 },
  { label: "20m", sec: 1200 },
];

function initialEmptyCpInputs(): Record<string, string> {
  return Object.fromEntries(CP_POINTS.map((p) => [p.label, ""]));
}

/** Campi vuoti per atleta: si compilano a mano o da import sessione (nessun demo pre-fill). */
const LACTATE_DEFAULT_INPUT: Record<string, string> = {
  duration_min: "",
  power_w: "",
  ftp_w: "",
  body_mass_kg: "",
  velocity_m_min: "",
  grade_pct: "",
  efficiency: "",
  vo2_l_min: "",
  vco2_l_min: "",
  rer: "",
  smo2_rest: "",
  smo2_work: "",
  lactate_oxidation_pct: "",
  cori_pct: "",
  cho_ingested_g_h: "",
  gut_absorption_pct: "",
  microbiota_sequestration_pct: "",
  gut_training_pct: "",
  core_temp_c: "",
  glucose_mmol_l: "",
  candida_overgrowth_pct: "",
  bifidobacteria_pct: "",
  akkermansia_pct: "",
  butyrate_producers_pct: "",
  endotoxin_risk_pct: "",
};

const MAXOX_DEFAULT_INPUT: Record<string, string> = {
  vo2_l_min: "",
  body_mass_kg: "",
  /** Durata finestra test (min): allinea il split CP (P_oss) in Metabolic profile. */
  duration_min: "60",
  power_w: "",
  velocity_m_min: "",
  grade_pct: "",
  ftp_w: "",
  efficiency: "",
  rer: "",
  smo2_rest_pct: "",
  smo2_work_pct: "",
  lactate_mmol_l: "",
  lactate_trend_mmol_h: "",
  core_temp_c: "",
  hemoglobin_g_dl: "",
  sao2_pct: "",
};

/** Campi stringa lab ripristinabili da `input_payload` snapshot. */
function patchLabStringsFromPayload(payload: Record<string, unknown>, allowedKeys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of allowedKeys) {
    const raw = payload[k];
    if (raw == null || raw === "") continue;
    const s = typeof raw === "number" && Number.isFinite(raw) ? String(raw) : String(raw).trim();
    if (s !== "") out[k] = s;
  }
  return out;
}

type SourceTag = "auto" | "manual" | "default" | "mixed";
type PrecedenceSource = "measured" | "manual" | "preset" | "default";
type Vo2InputMode = "device" | "test";
type RerInputMode = "auto" | "manual";
type MicrobiotaSourceMode = "health_bio" | "preset" | "manual";
type DysbiosisPreset = "eubiosi" | "lieve" | "moderata" | "severa" | "grave";

type ProCheckRow = {
  key: string;
  label: string;
  valueText: string;
  source: SourceTag;
  inRange: boolean;
  evidenceReady: boolean;
  aligned: boolean;
  rangeText: string;
};

function reliabilityBadge(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "High reliability", color: "#00e08d" };
  if (score >= 70) return { label: "Medium reliability", color: "#ffd60a" };
  return { label: "Low reliability", color: "#ff5d5d" };
}

function parseNum(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toSupportedSport(sportRaw: string | null | undefined): SupportedSport {
  const sport = (sportRaw ?? "").toLowerCase();
  if (sport.includes("run")) return "running";
  if (sport.includes("swim")) return "swimming";
  if (sport.includes("ski")) return "xc_ski";
  return "cycling";
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function estimateRerFromFtpIntensity(intensityPctFtp: number, fatOxAdaptation: number) {
  const i = clamp(intensityPctFtp, 40, 130);
  const points = [
    { x: 40, y: 0.76 },
    { x: 55, y: 0.8 },
    { x: 70, y: 0.86 },
    { x: 80, y: 0.9 },
    { x: 90, y: 0.93 },
    { x: 100, y: 0.95 },
    { x: 108, y: 1.0 },
    { x: 120, y: 1.03 },
    { x: 130, y: 1.05 },
  ];
  let base = 0.9;
  for (let idx = 0; idx < points.length - 1; idx += 1) {
    const left = points[idx];
    const right = points[idx + 1];
    if (i >= left.x && i <= right.x) {
      const t = (i - left.x) / (right.x - left.x);
      base = lerp(left.y, right.y, t);
      break;
    }
  }
  // Below threshold, better fat adaptation shifts RER downward.
  const belowThresholdFactor = clamp((95 - i) / 35, 0, 1);
  const adaptationShift = (0.5 - clamp(fatOxAdaptation, 0, 1)) * 0.08 * belowThresholdFactor;
  return clamp(base + adaptationShift, 0.72, 1.05);
}

function sourceFromInputs(
  keys: string[],
  current: Record<string, string>,
  autoBase: Record<string, number> | null,
  defaults: Record<string, string>,
): SourceTag {
  const tags = keys.map((key) => {
    const currentNum = parseNum(current[key] ?? "");
    if (currentNum == null) return "default" as const;
    const autoNum = autoBase?.[key];
    if (autoNum != null) {
      const tol = Math.max(0.5, Math.abs(autoNum) * 0.02);
      if (Math.abs(currentNum - autoNum) <= tol) return "auto" as const;
      return "manual" as const;
    }
    const defNum = parseNum(defaults[key] ?? "");
    if (defNum != null && Math.abs(currentNum - defNum) <= Math.max(0.5, Math.abs(defNum) * 0.02)) return "default" as const;
    return "manual" as const;
  });

  const uniq = Array.from(new Set(tags));
  if (uniq.length === 1) return uniq[0];
  return "mixed";
}

const MICROBIOTA_FIELDS = new Set([
  "candida_overgrowth_pct",
  "bifidobacteria_pct",
  "akkermansia_pct",
  "butyrate_producers_pct",
  "endotoxin_risk_pct",
]);

function resolveInputByPrecedence(params: {
  key: string;
  current: Record<string, string>;
  autoBase: Record<string, number> | null;
  defaults: Record<string, string>;
  presetMode: boolean;
  allowManualOverride?: boolean;
}): { value: number; source: PrecedenceSource } {
  const { key, current, autoBase, defaults, presetMode, allowManualOverride } = params;
  const currentNum = parseNum(current[key] ?? "");
  const autoNumRaw = autoBase?.[key];
  const autoNum = typeof autoNumRaw === "number" && Number.isFinite(autoNumRaw) ? autoNumRaw : null;
  const defaultNum = parseNum(defaults[key] ?? "");
  const currentSource: PrecedenceSource =
    presetMode && MICROBIOTA_FIELDS.has(key) ? "preset" : "manual";

  // Rule: real measured data has precedence.
  // Exception: explicit manual override modes (e.g., VO2 test) can override measured values.
  if (allowManualOverride && currentNum != null) return { value: currentNum, source: currentSource };
  if (autoNum != null) return { value: autoNum, source: "measured" };
  if (currentNum != null) return { value: currentNum, source: currentSource };
  if (defaultNum != null) return { value: defaultNum, source: "default" };
  return { value: 0, source: "default" };
}

function estimateUncertaintyPct(sources: PrecedenceSource[]) {
  const total = Math.max(1, sources.length);
  const measured = sources.filter((s) => s === "measured").length / total;
  const manual = sources.filter((s) => s === "manual").length / total;
  const preset = sources.filter((s) => s === "preset").length / total;
  const defaults = sources.filter((s) => s === "default").length / total;
  const pct = 6 + manual * 6 + preset * 12 + defaults * 22 + (1 - measured) * 6;
  return Math.round(clamp(pct, 5, 40));
}

export default function MetabolicLabPage() {
  const { athleteId, role, loading, userId } = useAthleteContext();
  const [section, setSection] = useState<"profile" | "lactate" | "maxox">("profile");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<LabRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [autoInfo, setAutoInfo] = useState<string | null>(null);
  const [evidenceItems, setEvidenceItems] = useState<PubmedItem[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [autoLactateBaseline, setAutoLactateBaseline] = useState<Record<string, number> | null>(null);
  const [autoMaxOxBaseline, setAutoMaxOxBaseline] = useState<Record<string, number> | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutSample[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>("");
  const [showValidationConsole, setShowValidationConsole] = useState(false);
  const [lactateRerMode, setLactateRerMode] = useState<RerInputMode>("auto");
  const [microbiotaSourceMode, setMicrobiotaSourceMode] = useState<MicrobiotaSourceMode>("health_bio");
  const [dysbiosisPreset, setDysbiosisPreset] = useState<DysbiosisPreset>("eubiosi");
  const [hasHealthMicrobiotaProfile, setHasHealthMicrobiotaProfile] = useState(false);
  const [healthBioGlucoseMeta, setHealthBioGlucoseMeta] = useState<HealthBioGlucoseMeta | null>(null);
  const [healthBioCoreTempCBaseline, setHealthBioCoreTempCBaseline] = useState<number | null>(null);
  const [profileVo2maxLMin, setProfileVo2maxLMin] = useState<number | null>(null);
  const [profileVo2maxMlMinKg, setProfileVo2maxMlMinKg] = useState<number | null>(null);
  /** Peso profilo da API (allinea motore CP / L·min quando i campi lab massa sono vuoti). */
  const [athleteProfileWeightKg, setAthleteProfileWeightKg] = useState<number | null>(null);
  /** ISO `created_at` ultimo snapshot salvato per sezione (da `metabolic_lab_runs`). */
  const [lastLabSavedAt, setLastLabSavedAt] = useState<{
    metabolic: string | null;
    lactate: string | null;
    maxox: string | null;
  }>({ metabolic: null, lactate: null, maxox: null });
  const [fatOxAdaptation, setFatOxAdaptation] = useState(0.5);
  const [profileCalcTick, setProfileCalcTick] = useState(0);
  const [lactateCalcTick, setLactateCalcTick] = useState(0);
  const [lactateSegmentAttachment, setLactateSegmentAttachment] = useState<SegmentAttachmentMeta>(null);
  const [maxOxCalcTick, setMaxOxCalcTick] = useState(0);
  const [profileLastRecalcAt, setProfileLastRecalcAt] = useState<number | null>(null);
  const [lactateLastRecalcAt, setLactateLastRecalcAt] = useState<number | null>(null);
  const [maxOxLastRecalcAt, setMaxOxLastRecalcAt] = useState<number | null>(null);
  const [maxOxSegmentLastVo2LMin, setMaxOxSegmentLastVo2LMin] = useState<number | null>(null);
  const [maxOxSegmentLastO2TotalL, setMaxOxSegmentLastO2TotalL] = useState<number | null>(null);
  const [maxOxSegmentLastDurationMin, setMaxOxSegmentLastDurationMin] = useState<number | null>(null);
  const [lactateSport, setLactateSport] = useState<SupportedSport>("cycling");
  const [maxOxSport, setMaxOxSport] = useState<SupportedSport>("cycling");
  const [lactateVo2Mode, setLactateVo2Mode] = useState<Vo2InputMode>("device");
  const [maxOxVo2Mode, setMaxOxVo2Mode] = useState<Vo2InputMode>("device");
  const [profileRecalcHint, setProfileRecalcHint] = useState<string | null>(null);
  const [metabolicProfileJsonHint, setMetabolicProfileJsonHint] = useState<string | null>(null);
  const [labVo2ManualInput, setLabVo2ManualInput] = useState("");
  const [labVo2Saving, setLabVo2Saving] = useState(false);
  const [labVo2Message, setLabVo2Message] = useState<string | null>(null);
  const [gasFileName, setGasFileName] = useState<string | null>(null);
  const [gasParseResult, setGasParseResult] = useState<GasExchangeParseResult | null>(null);

  const [cpInputs, setCpInputs] = useState<Record<string, string>>(() => initialEmptyCpInputs());

  const [lactateInput, setLactateInput] = useState({ ...LACTATE_DEFAULT_INPUT });

  const [maxOxInput, setMaxOxInput] = useState({ ...MAXOX_DEFAULT_INPUT });

  const cpCurveHasData = useMemo(
    () => CP_POINTS.some((p) => (parseFloat(String(cpInputs[p.label] ?? "").replace(",", ".")) || 0) > 0),
    [cpInputs],
  );

  const selectedHistoryRow = useMemo(
    () => (selectedHistoryId ? history.find((r) => r.id === selectedHistoryId) ?? null : null),
    [history, selectedHistoryId],
  );

  function microbiotaPresetValues(level: DysbiosisPreset) {
    if (level === "eubiosi") {
      return {
        candida_overgrowth_pct: "8",
        bifidobacteria_pct: "18",
        akkermansia_pct: "8",
        butyrate_producers_pct: "28",
        endotoxin_risk_pct: "12",
      };
    }
    if (level === "lieve") {
      return {
        candida_overgrowth_pct: "15",
        bifidobacteria_pct: "14",
        akkermansia_pct: "6",
        butyrate_producers_pct: "22",
        endotoxin_risk_pct: "20",
      };
    }
    if (level === "moderata") {
      return {
        candida_overgrowth_pct: "28",
        bifidobacteria_pct: "10",
        akkermansia_pct: "4",
        butyrate_producers_pct: "18",
        endotoxin_risk_pct: "35",
      };
    }
    if (level === "severa") {
      return {
        candida_overgrowth_pct: "42",
        bifidobacteria_pct: "7",
        akkermansia_pct: "3",
        butyrate_producers_pct: "14",
        endotoxin_risk_pct: "52",
      };
    }
    return {
      candida_overgrowth_pct: "58",
      bifidobacteria_pct: "4",
      akkermansia_pct: "2",
      butyrate_producers_pct: "9",
      endotoxin_risk_pct: "72",
    };
  }

  const labBodyMassKg = useMemo(() => {
    const l = parseFloat(String(lactateInput.body_mass_kg).replace(",", "."));
    const m = parseFloat(String(maxOxInput.body_mass_kg).replace(",", "."));
    const lactateT = String(lactateInput.body_mass_kg ?? "").trim();
    const maxOxT = String(maxOxInput.body_mass_kg ?? "").trim();
    if (lactateT !== "" && Number.isFinite(l) && l > 30 && l < 250) return l;
    if (maxOxT !== "" && Number.isFinite(m) && m > 30 && m < 250) return m;
    if (athleteProfileWeightKg != null && athleteProfileWeightKg > 30 && athleteProfileWeightKg < 250) {
      return athleteProfileWeightKg;
    }
    if (Number.isFinite(l) && l > 30) return l;
    if (Number.isFinite(m) && m > 30) return m;
    return 70;
  }, [lactateInput.body_mass_kg, maxOxInput.body_mass_kg, athleteProfileWeightKg]);

  const cpModel = useMemo(() => {
    const cpPoints = CP_POINTS.map((p) => ({
      sec: p.sec,
      powerW: parseFloat(cpInputs[p.label]) || 0,
    }));
    return computeMetabolicProfileEngine({
      cpPoints,
      bodyMassKg: labBodyMassKg,
      efficiency: parseFloat(lactateInput.efficiency) || 0.24,
    });
  }, [cpInputs, lactateInput.efficiency, labBodyMassKg, profileCalcTick]);

  const gasExchangeSubstrateProfile = useMemo(() => {
    const vo2 = parseFloat(String(lactateInput.vo2_l_min).replace(",", "."));
    const vco2Raw = parseFloat(String(lactateInput.vco2_l_min).replace(",", "."));
    const vco2 =
      Number.isFinite(vco2Raw) && vco2Raw > 0.02 ? vco2Raw : Number.isFinite(vo2) && vo2 > 0 ? vo2 * 0.92 : NaN;
    if (!Number.isFinite(vo2) || vo2 < 0.15 || !Number.isFinite(vco2)) return null;
    return substrateOxidationRatesFromGasExchange(vo2, vco2);
  }, [lactateInput.vo2_l_min, lactateInput.vco2_l_min]);

  const vo2OnsetPreview = useMemo(() => {
    const tau = cpModel.vo2OnsetTauSecDefault;
    const vmax = cpModel.vo2maxLMin;
    const t = 60;
    return {
      tau,
      vo2At60sLMin: vo2LMinAtTimeOnset(vmax, t, tau),
      fracAt60s: vo2OnsetFractionAtTime(t, tau),
    };
  }, [cpModel.vo2OnsetTauSecDefault, cpModel.vo2maxLMin]);

  const athleteBodyMassForGasImport = useMemo(() => {
    const m = parseFloat(String(lactateInput.body_mass_kg).replace(",", ".")) ||
      parseFloat(String(maxOxInput.body_mass_kg).replace(",", "."));
    if (Number.isFinite(m) && m > 30) return m;
    if (athleteProfileWeightKg != null && athleteProfileWeightKg > 30) return athleteProfileWeightKg;
    return undefined;
  }, [lactateInput.body_mass_kg, maxOxInput.body_mass_kg, athleteProfileWeightKg]);

  const lactateResolved = useMemo(() => {
    const values: Record<string, number> = {};
    const sources: Record<string, PrecedenceSource> = {};
    for (const key of Object.keys(LACTATE_DEFAULT_INPUT)) {
      const allowManualOverride =
        (key === "vo2_l_min" && lactateVo2Mode === "test") ||
        (key === "rer" && lactateRerMode === "manual") ||
        (MICROBIOTA_FIELDS.has(key) && microbiotaSourceMode === "manual");
      const resolved = resolveInputByPrecedence({
        key,
        current: lactateInput,
        autoBase: autoLactateBaseline,
        defaults: LACTATE_DEFAULT_INPUT,
        presetMode: microbiotaSourceMode === "preset",
        allowManualOverride,
      });
      values[key] = resolved.value;
      sources[key] = resolved.source;
    }
    return {
      values,
      sources,
      uncertaintyPct: estimateUncertaintyPct(Object.values(sources)),
    };
  }, [lactateInput, autoLactateBaseline, lactateVo2Mode, lactateRerMode, microbiotaSourceMode]);

  const lactateGutDerived = useMemo(() => {
    if (microbiotaSourceMode === "manual") return null;
    const v = lactateResolved.values;
    return gutMetricsFromTaxa({
      candida_overgrowth_pct: v.candida_overgrowth_pct,
      bifidobacteria_pct: v.bifidobacteria_pct,
      akkermansia_pct: v.akkermansia_pct,
      butyrate_producers_pct: v.butyrate_producers_pct,
      endotoxin_risk_pct: v.endotoxin_risk_pct,
    });
  }, [microbiotaSourceMode, lactateResolved]);

  const lactateEngineNumericValues = useMemo(() => {
    const v = { ...lactateResolved.values };
    if (microbiotaSourceMode !== "manual" && lactateGutDerived) {
      v.gut_absorption_pct = lactateGutDerived.gut_absorption_pct;
      v.microbiota_sequestration_pct = lactateGutDerived.microbiota_sequestration_pct;
      v.gut_training_pct = lactateGutDerived.gut_training_pct;
    }
    return v;
  }, [lactateResolved, microbiotaSourceMode, lactateGutDerived]);

  const lactateSourcesForSnapshot = useMemo(() => {
    const s = { ...lactateResolved.sources };
    if (microbiotaSourceMode !== "manual") {
      const tag: PrecedenceSource = microbiotaSourceMode === "health_bio" ? "measured" : "preset";
      s.gut_absorption_pct = tag;
      s.microbiota_sequestration_pct = tag;
      s.gut_training_pct = tag;
    }
    return s;
  }, [lactateResolved, microbiotaSourceMode]);

  const lactateUncertaintyPct = useMemo(
    () => estimateUncertaintyPct(Object.values(lactateSourcesForSnapshot)),
    [lactateSourcesForSnapshot],
  );

  const lactateParamsDisplayInput = useMemo(() => {
    if (microbiotaSourceMode === "manual" || !lactateGutDerived) return lactateInput;
    return {
      ...lactateInput,
      gut_absorption_pct: String(lactateGutDerived.gut_absorption_pct),
      microbiota_sequestration_pct: String(lactateGutDerived.microbiota_sequestration_pct),
      gut_training_pct: String(lactateGutDerived.gut_training_pct),
    };
  }, [lactateInput, microbiotaSourceMode, lactateGutDerived]);

  const maxOxResolved = useMemo(() => {
    const values: Record<string, number> = {};
    const sources: Record<string, PrecedenceSource> = {};
    for (const key of Object.keys(MAXOX_DEFAULT_INPUT)) {
      const resolved = resolveInputByPrecedence({
        key,
        current: maxOxInput,
        autoBase: autoMaxOxBaseline,
        defaults: MAXOX_DEFAULT_INPUT,
        presetMode: false,
        allowManualOverride: key === "vo2_l_min" && maxOxVo2Mode === "test",
      });
      values[key] = resolved.value;
      sources[key] = resolved.source;
    }
    return {
      values,
      sources,
      uncertaintyPct: estimateUncertaintyPct(Object.values(sources)),
    };
  }, [maxOxInput, autoMaxOxBaseline, maxOxVo2Mode]);

  /** %FTP e motori Lactate/MaxOx: con curva CP vuota non usare FTP derivato dal fallback motore CP. */
  const physiologyLabFtpW = useMemo(() => {
    const labFtp = lactateResolved.values.ftp_w || 0;
    if (cpCurveHasData) return Math.max(1, cpModel.ftp, labFtp);
    return Math.max(1, labFtp);
  }, [cpCurveHasData, cpModel.ftp, lactateResolved.values.ftp_w]);
  const maxOxLabFtpW = useMemo(() => {
    const labFtp = maxOxResolved.values.ftp_w || 0;
    if (cpCurveHasData) return Math.max(1, cpModel.ftp, labFtp);
    return Math.max(1, labFtp);
  }, [cpCurveHasData, cpModel.ftp, maxOxResolved.values.ftp_w]);

  const lactateVo2Estimate = useMemo(() => {
    return estimateVo2FromDevice({
      sport: lactateSport,
      bodyMassKg: lactateResolved.values.body_mass_kg || maxOxResolved.values.body_mass_kg || 70,
      rer: lactateResolved.values.rer || 0.95,
      efficiency: lactateResolved.values.efficiency || 0.24,
      powerW: lactateResolved.values.power_w || 0,
      velocityMMin: lactateResolved.values.velocity_m_min || 0,
      gradeFraction: (lactateResolved.values.grade_pct || 0) / 100,
    });
  }, [lactateSport, lactateResolved, maxOxResolved.values.body_mass_kg]);

  const lactateVo2Used =
    lactateVo2Mode === "test"
      ? lactateResolved.values.vo2_l_min || lactateVo2Estimate.vo2LMin
      : lactateVo2Estimate.vo2LMin;

  const lactateIntensityPctFtp = ((lactateResolved.values.power_w || 0) / physiologyLabFtpW) * 100;
  const lactateRerUsed =
    lactateRerMode === "auto"
      ? estimateRerFromFtpIntensity(lactateIntensityPctFtp, fatOxAdaptation)
      : lactateResolved.values.rer || 0.95;

  function syncMaxOxFromMetabolicProfile() {
    const eff = parseFloat(lactateInput.efficiency.replace(",", ".")) || 0.24;
    setMaxOxInput((s) => ({
      ...s,
      ftp_w: String(Math.round(cpModel.ftp)),
      body_mass_kg: String(labBodyMassKg.toFixed(1)),
      efficiency: String(eff),
    }));
    setMaxOxVo2Mode("device");
    setMaxOxCalcTick((n) => n + 1);
    setMaxOxLastRecalcAt(Date.now());
  }

  function syncMaxOxFromLactateLab() {
    const lv = lactateResolved.values;
    const rer = lactateRerUsed;
    setMaxOxInput((s) => ({
      ...s,
      body_mass_kg: String(lv.body_mass_kg),
      duration_min: String(Math.max(0.5, lv.duration_min || 60)),
      ftp_w: String(Math.round(lv.ftp_w)),
      efficiency: String(lv.efficiency),
      rer: String(Number(rer.toFixed(3))),
      power_w: String(Math.round(lv.power_w)),
      velocity_m_min: String(Number(lv.velocity_m_min.toFixed(2))),
      grade_pct: String(Number(lv.grade_pct.toFixed(2))),
      smo2_rest_pct: String(Math.round(lv.smo2_rest)),
      smo2_work_pct: String(Math.round(lv.smo2_work)),
      core_temp_c: String(lv.core_temp_c),
    }));
    setMaxOxSport(lactateSport);
    setMaxOxVo2Mode("device");
    setMaxOxCalcTick((n) => n + 1);
    setMaxOxLastRecalcAt(Date.now());
  }

  function applyMaxOxSegmentForm(form: MaxOxSegmentForm) {
    const dur = Math.max(0.01, parseFloat(String(form.duration_min).replace(",", ".")) || 1);
    const p = parseFloat(String(form.power_w).replace(",", ".")) || 0;
    if (p < 1) return;

    const eff =
      parseFloat(lactateInput.efficiency.replace(",", ".")) ||
      parseFloat(maxOxInput.efficiency.replace(",", ".")) ||
      0.24;
    const bm = labBodyMassKg;
    const ftpFromForm =
      Math.max(
        parseFloat(String(maxOxInput.ftp_w).replace(",", ".")) || 0,
        parseFloat(String(lactateInput.ftp_w).replace(",", ".")) || 0,
      ) || 0;
    const ftp = Math.max(1, ftpFromForm, cpCurveHasData ? cpModel.ftp : 0);

    const elev = parseFloat(String(form.elevation_m).replace(",", "."));
    const dist = parseFloat(String(form.distance_km).replace(",", "."));
    const manualG = parseFloat(String(form.grade_pct).replace(",", "."));
    let gradePct = 0;
    if (Number.isFinite(manualG)) gradePct = manualG;
    else if (Number.isFinite(elev) && Number.isFinite(dist) && dist > 0) gradePct = (elev / (dist * 1000)) * 100;
    else gradePct = parseFloat(maxOxInput.grade_pct.replace(",", ".")) || 0;

    const velRaw = parseFloat(String(form.velocity_m_min).replace(",", "."));
    const vel = Number.isFinite(velRaw) ? velRaw : 0;

    const intensityPct = (p / ftp) * 100;
    const rer = estimateRerFromFtpIntensity(intensityPct, fatOxAdaptation);
    const segVo2 = estimateVo2FromDevice({
      sport: maxOxSport,
      bodyMassKg: bm,
      rer,
      efficiency: eff,
      powerW: p,
      velocityMMin: vel,
      gradeFraction: gradePct / 100,
    });

    setMaxOxSegmentLastVo2LMin(segVo2.vo2LMin);
    setMaxOxSegmentLastO2TotalL(segVo2.vo2LMin * dur);
    setMaxOxSegmentLastDurationMin(dur);

    const parseOptInt = (t: string) => {
      const x = parseFloat(t.trim().replace(",", "."));
      return Number.isFinite(x) ? String(Math.round(x)) : undefined;
    };
    const parseOptFloat = (t: string) => {
      const x = parseFloat(t.trim().replace(",", "."));
      return Number.isFinite(x) ? String(Number(x.toFixed(2))) : undefined;
    };

    setMaxOxInput((s) => ({
      ...s,
      duration_min: String(Number(dur.toFixed(1))),
      power_w: String(Math.round(p)),
      ftp_w: String(Math.round(ftp)),
      body_mass_kg: String(bm.toFixed(1)),
      efficiency: String(eff),
      grade_pct: String(Number(gradePct.toFixed(2))),
      velocity_m_min: String(Number(vel.toFixed(2))),
      rer: String(Number(rer.toFixed(3))),
      vo2_l_min: String(segVo2.vo2LMin.toFixed(3)),
      smo2_work_pct: form.smo2_work.trim() ? parseOptInt(form.smo2_work) ?? s.smo2_work_pct : s.smo2_work_pct,
      smo2_rest_pct: form.smo2_rest.trim() ? parseOptInt(form.smo2_rest) ?? s.smo2_rest_pct : s.smo2_rest_pct,
      lactate_mmol_l: form.lactate_mmol.trim() ? parseOptFloat(form.lactate_mmol) ?? s.lactate_mmol_l : s.lactate_mmol_l,
      core_temp_c: form.core_temp_c.trim() ? parseOptFloat(form.core_temp_c) ?? s.core_temp_c : s.core_temp_c,
    }));
    setMaxOxVo2Mode("device");
    setMaxOxCalcTick((n) => n + 1);
    setMaxOxLastRecalcAt(Date.now());
  }

  const lactateModel = useMemo(() => {
    const v = lactateEngineNumericValues;
    return computeLactateEngine({
      durationMin: v.duration_min || 60,
      powerW: v.power_w || 0,
      ftpW: physiologyLabFtpW,
      efficiency: v.efficiency || 0.24,
      vo2LMin: lactateVo2Used,
      vco2LMin: v.vco2_l_min || undefined,
      rer: lactateRerUsed,
      smo2Rest: v.smo2_rest || 70,
      smo2Work: v.smo2_work || 40,
      lactateOxidationPct: v.lactate_oxidation_pct || 70,
      coriPct: v.cori_pct || 18,
      choIngestedGH: v.cho_ingested_g_h || 0,
      gutAbsorptionPct: v.gut_absorption_pct || 88,
      microbiotaSequestrationPct: v.microbiota_sequestration_pct || 6,
      gutTrainingPct: v.gut_training_pct || 75,
      coreTempC: v.core_temp_c || undefined,
      candidaOvergrowthPct: v.candida_overgrowth_pct || undefined,
      bifidobacteriaPct: v.bifidobacteria_pct || undefined,
      akkermansiaPct: v.akkermansia_pct || undefined,
      butyrateProducersPct: v.butyrate_producers_pct || undefined,
      endotoxinRiskPct: v.endotoxin_risk_pct || undefined,
      bloodGlucoseMmolL: (() => {
        const g = v.glucose_mmol_l;
        return Number.isFinite(g) && g >= 2.2 && g <= 22 ? g : undefined;
      })(),
      ...(cpCurveHasData
        ? { cpW: cpModel.cp, wPrimeJ: cpModel.wPrimeJ, glycolyticIndexProxy: cpModel.vlamax }
        : {}),
    });
  }, [
    lactateEngineNumericValues,
    lactateVo2Used,
    lactateRerUsed,
    lactateCalcTick,
    physiologyLabFtpW,
    cpCurveHasData,
    cpModel.cp,
    cpModel.wPrimeJ,
    cpModel.vlamax,
  ]);

  const lactateStrategy = useMemo(() => {
    const choGap = Math.max(0, lactateModel.glucoseRequiredForStrategyG - lactateModel.choAvailableG);
    return {
      choGap,
      fuelingAction: choGap > 20 ? "Increase intra CHO or absorption efficiency." : "CHO availability aligned.",
      lactateAction: lactateModel.lactateAccumG > lactateModel.lactateOxidizedG * 0.55 ? "Reduce glycolytic peaks." : "Lactate balance stable.",
    };
  }, [lactateModel]);

  const lactateReliability = useMemo(() => {
    let score = 100;
    const energySplitGap = Math.abs(lactateModel.energyDemandKcal - (lactateModel.choKcal + lactateModel.nonChoKcal));
    if (energySplitGap > 30) score -= 15;
    const aerobicAnaerobicGap = Math.abs(lactateModel.energyDemandKcal - (lactateModel.aerobicKcal + lactateModel.anaerobicKcal));
    if (aerobicAnaerobicGap > 45) score -= 15;
    if (lactateModel.lactateProducedG < lactateModel.lactateOxidizedG + lactateModel.lactateCoriG) score -= 20;
    if (lactateModel.intensityPctFtp > 110 && lactateModel.anaerobicKcal < 0.08 * lactateModel.energyDemandKcal) score -= 20;
    if (lactateModel.choAvailableG < lactateModel.exogenousOxidizedG) score -= 10;
    if (lactateModel.glucoseRequiredForStrategyG < 0 || lactateModel.glycogenCombustedNetG < 0) score -= 10;
    const bgObs = lactateModel.bloodGlucoseMmolL;
    if (bgObs != null && bgObs < 4.0 && lactateModel.intensityPctFtp > 92) score -= 12;
    if (lactateVo2Mode === "test") {
      const gap = Math.abs(lactateVo2Used - lactateVo2Estimate.vo2LMin) / Math.max(0.2, lactateVo2Estimate.vo2LMin);
      if (gap > 0.18) score -= 20;
    }
    return Math.max(0, Math.round(score));
  }, [lactateModel, lactateVo2Mode, lactateVo2Used, lactateVo2Estimate.vo2LMin]);

  const maxOxVo2Estimate = useMemo(() => {
    return estimateVo2FromDevice({
      sport: maxOxSport,
      bodyMassKg: maxOxResolved.values.body_mass_kg || 70,
      rer: maxOxResolved.values.rer || 0.92,
      efficiency: maxOxResolved.values.efficiency || 0.24,
      powerW: maxOxResolved.values.power_w || 0,
      velocityMMin: maxOxResolved.values.velocity_m_min || 0,
      gradeFraction: (maxOxResolved.values.grade_pct || 0) / 100,
    });
  }, [maxOxSport, maxOxResolved]);

  const maxOxVo2AtPowerL = maxOxVo2Estimate.vo2LMin;

  const maxOxVo2CapacitySource = useMemo(():
    | "metabolic_engine_vo2max"
    | "power_estimate"
    | "test_manual" => {
    if (maxOxVo2Mode === "test") return "test_manual";
    if (cpCurveHasData && cpModel.vo2maxLMin >= 0.35) return "metabolic_engine_vo2max";
    return "power_estimate";
  }, [maxOxVo2Mode, cpCurveHasData, cpModel.vo2maxLMin]);

  /** Capacità ossidativa massima nel modello: solo curva CP (VO₂max motore), mai VO₂max anagrafico isolato. */
  const maxOxVo2Used =
    maxOxVo2Mode === "test"
      ? maxOxResolved.values.vo2_l_min > 0.2
        ? maxOxResolved.values.vo2_l_min
        : maxOxVo2AtPowerL
      : cpCurveHasData && cpModel.vo2maxLMin >= 0.35
        ? cpModel.vo2maxLMin
        : maxOxVo2AtPowerL;

  /** Lettura VO₂ a carico (stima da potenza o valore test): input al motore per coerenza domanda vs tetto. */
  const maxOxVo2AtLoadLMin =
    maxOxVo2Mode === "test"
      ? maxOxResolved.values.vo2_l_min > 0.2
        ? maxOxResolved.values.vo2_l_min
        : maxOxVo2AtPowerL
      : maxOxVo2AtPowerL;

  const maxOxBodyMassKg = maxOxResolved.values.body_mass_kg || 70;
  const maxOxVo2MlKgCapacity = (maxOxVo2Used * 1000) / Math.max(1, maxOxBodyMassKg);

  const maxOxOxidativeCeilingVo2LMin = useMemo(() => {
    if (cpCurveHasData && cpModel.vo2maxLMin >= 0.35) return cpModel.vo2maxLMin;
    return undefined;
  }, [cpCurveHasData, cpModel.vo2maxLMin]);

  /** Durata finestra test (s): tabella CP usa 60…3600 s — oltre 60′ si aggancia alla riga più vicina. */
  const maxOxTestDurationSec = useMemo(() => {
    const m = parseFloat(String(maxOxInput.duration_min).replace(",", "."));
    const dm = Number.isFinite(m) && m > 0.05 ? m : 60;
    return Math.round(Math.min(180, Math.max(0.5, dm)) * 60);
  }, [maxOxInput.duration_min]);

  const maxOxCpPowerSplitRow = useMemo(() => {
    if (!cpCurveHasData || !cpModel.powerComponents?.length) return null;
    return powerComponentRowNearestSec(cpModel.powerComponents, maxOxTestDurationSec);
  }, [cpCurveHasData, cpModel.powerComponents, maxOxTestDurationSec]);

  const maxOxModel = useMemo(() => {
    return computeMaxOxidateEngine({
      vo2LMin: maxOxVo2AtLoadLMin,
      bodyMassKg: maxOxResolved.values.body_mass_kg || 70,
      powerW: maxOxResolved.values.power_w || 0,
      ftpW: maxOxLabFtpW,
      ...(cpCurveHasData ? { cpW: cpModel.cp } : {}),
      oxidativeCeilingVo2LMin: maxOxOxidativeCeilingVo2LMin,
      ...(cpCurveHasData && maxOxCpPowerSplitRow != null && maxOxCpPowerSplitRow.aerobicW > 1
        ? {
            cpAerobicWFromProfile: maxOxCpPowerSplitRow.aerobicW,
            durationSecForCpSplit: maxOxTestDurationSec,
          }
        : {}),
      efficiency: maxOxResolved.values.efficiency || 0.24,
      rer: maxOxResolved.values.rer || 0.92,
      smo2RestPct: maxOxResolved.values.smo2_rest_pct || 70,
      smo2WorkPct: maxOxResolved.values.smo2_work_pct || 40,
      lactateMmolL: maxOxResolved.values.lactate_mmol_l || 0,
      lactateTrendMmolH: maxOxResolved.values.lactate_trend_mmol_h || 0,
      coreTempC: maxOxResolved.values.core_temp_c || undefined,
      hemoglobinGdL: maxOxResolved.values.hemoglobin_g_dl || 14.5,
      sao2Pct: maxOxResolved.values.sao2_pct || 97,
    });
  }, [
    maxOxResolved,
    maxOxVo2AtLoadLMin,
    maxOxCalcTick,
    cpCurveHasData,
    cpModel.cp,
    maxOxLabFtpW,
    maxOxOxidativeCeilingVo2LMin,
    maxOxCpPowerSplitRow,
    maxOxTestDurationSec,
  ]);

  const maxOxReliability = useMemo(() => {
    let score = 100;
    if (maxOxModel.oxidativeCapacityKcalMin <= 0) score -= 25;
    const pwr = maxOxResolved.values.power_w || 0;
    if (pwr > 25 && maxOxModel.requiredKcalMin <= 0) score -= 20;
    if (maxOxModel.oxidativeDemandKcalMin > maxOxModel.requiredKcalMin + 0.5) score -= 20;
    if (maxOxModel.utilizationRatioPct < 5 || maxOxModel.utilizationRatioPct > 250) score -= 20;
    if (maxOxModel.extractionPct < 5 || maxOxModel.extractionPct > 85) score -= 10;
    if (maxOxModel.centralDeliveryIndex < 0.55 || maxOxModel.centralDeliveryIndex > 1.2) score -= 10;
    if (maxOxModel.peripheralUtilizationIndex < 0.45 || maxOxModel.peripheralUtilizationIndex > 1.2) score -= 10;
    if (maxOxModel.intensityPctFtp > 115 && maxOxModel.bottleneckType === "balanced") score -= 15;
    if (maxOxVo2Mode === "test") {
      const gap = Math.abs(maxOxVo2Used - maxOxVo2AtPowerL) / Math.max(0.2, maxOxVo2AtPowerL);
      if (gap > 0.18) score -= 20;
    } else if (maxOxVo2CapacitySource === "power_estimate") {
      const gap = Math.abs(maxOxVo2Used - maxOxVo2AtPowerL) / Math.max(0.2, maxOxVo2AtPowerL);
      if (gap > 0.18) score -= 20;
    }
    return Math.max(0, Math.round(score));
  }, [maxOxModel, maxOxVo2Mode, maxOxVo2Used, maxOxVo2AtPowerL, maxOxVo2CapacitySource, maxOxResolved.values.power_w]);

  const maxOxSummary = useMemo(() => {
    const ratio = maxOxModel.utilizationRatioPct;
    const ratioText =
      ratio >= 120 ? "domanda oltre capacita ossidativa" :
      ratio >= 100 ? "domanda al limite della capacita ossidativa" :
      "domanda sotto capacita ossidativa";
    const bottleneckText = maxOxBottleneckLabel(maxOxModel.bottleneckType);
    const redoxText =
      maxOxModel.redoxStressIndex >= 65 ? "stress redox alto" :
      maxOxModel.redoxStressIndex >= 35 ? "stress redox moderato" :
      "stress redox basso";
    return { ratioText, bottleneckText, redoxText };
  }, [maxOxModel]);

  const selectedWorkout = useMemo(
    () => workouts.find((w) => w.id === selectedWorkoutId) ?? null,
    [workouts, selectedWorkoutId],
  );
  function applyWorkoutToLactate(workout: WorkoutSample) {
    const mappedSport = toSupportedSport(workout.sport);
    setLactateSport(mappedSport);
    setLactateInput((s) => {
      const fallbackDuration = Number.isFinite(parseFloat(s.duration_min)) ? parseFloat(s.duration_min) : 60;
      const fallbackPower = Number.isFinite(parseFloat(s.power_w)) ? parseFloat(s.power_w) : 0;
      const fallbackVelocity = Number.isFinite(parseFloat(s.velocity_m_min)) ? parseFloat(s.velocity_m_min) : 0;
      const fallbackGrade = Number.isFinite(parseFloat(s.grade_pct)) ? parseFloat(s.grade_pct) : 0;
      const fallbackRer = Number.isFinite(parseFloat(s.rer)) ? parseFloat(s.rer) : 0.95;
      const fallbackSmo2 = Number.isFinite(parseFloat(s.smo2_work)) ? parseFloat(s.smo2_work) : 40;
      const fallbackVo2 = Number.isFinite(parseFloat(s.vo2_l_min)) ? parseFloat(s.vo2_l_min) : 0;
      const fallbackVco2 = Number.isFinite(parseFloat(s.vco2_l_min)) ? parseFloat(s.vco2_l_min) : (fallbackVo2 * fallbackRer);
      const fallbackCoreTemp = Number.isFinite(parseFloat(s.core_temp_c)) ? parseFloat(s.core_temp_c) : 37.2;
      const fallbackGlucose = Number.isFinite(parseFloat(s.glucose_mmol_l)) ? parseFloat(s.glucose_mmol_l) : NaN;

      const duration = Math.max(1, workout.duration_min || fallbackDuration);
      const power = Math.max(0, (workout.power_w ?? fallbackPower));
      const velocity = workout.velocity_m_min ?? fallbackVelocity;
      const grade = workout.grade_pct ?? fallbackGrade;
      const rer = workout.rer ?? fallbackRer;
      const smo2 = workout.smo2 ?? fallbackSmo2;
      const vo2 = workout.vo2_l_min ?? fallbackVo2;
      const vco2 = workout.vco2_l_min ?? fallbackVco2;
      const coreTemp = workout.core_temp_c ?? fallbackCoreTemp;
      const glucoseRaw = workout.glucose_mmol_l ?? fallbackGlucose;
      const glucose = Number.isFinite(glucoseRaw) ? glucoseRaw : NaN;

      return {
        ...s,
        duration_min: String(Math.round(duration)),
        power_w: String(Math.round(power)),
        velocity_m_min: String(Number(velocity.toFixed(2))),
        grade_pct: String(Number(grade.toFixed(2))),
        rer: String(Number(rer.toFixed(2))),
        smo2_work: String(Math.round(smo2)),
        body_mass_kg: s.body_mass_kg,
        vo2_l_min: String(Number(vo2.toFixed(2))),
        vco2_l_min: String(Number(vco2.toFixed(2))),
        core_temp_c: String(Number(coreTemp.toFixed(2))),
        glucose_mmol_l: Number.isFinite(glucose) ? String(Number(glucose.toFixed(2))) : s.glucose_mmol_l,
      };
    });
  }

  const resetPhysiologyDraftForAthleteSwitch = useCallback(() => {
    setCpInputs(initialEmptyCpInputs());
    setLactateInput({ ...LACTATE_DEFAULT_INPUT });
    setMaxOxInput({ ...MAXOX_DEFAULT_INPUT });
    setAutoLactateBaseline(null);
    setAutoMaxOxBaseline(null);
    setSelectedWorkoutId("");
    setWorkouts([]);
    setHistory([]);
    setSelectedHistoryId(null);
    setAthleteProfileWeightKg(null);
    setLastLabSavedAt({ metabolic: null, lactate: null, maxox: null });
    setAutoInfo(null);
    setSaveMessage(null);
    setError(null);
    setGasFileName(null);
    setGasParseResult(null);
    setLabVo2ManualInput("");
    setLabVo2Message(null);
    setProfileRecalcHint(null);
    setMetabolicProfileJsonHint(null);
    setEvidenceItems([]);
    setEvidenceError(null);
    setLactateSegmentAttachment(null);
    setHealthBioGlucoseMeta(null);
    setHealthBioCoreTempCBaseline(null);
  }, []);

  function applyWorkoutToMaxOx(workout: WorkoutSample) {
    const mappedSport = toSupportedSport(workout.sport);
    setMaxOxSport(mappedSport);
    setMaxOxInput((s) => {
      const fallbackPower = Number.isFinite(parseFloat(s.power_w)) ? parseFloat(s.power_w) : 0;
      const fallbackVelocity = Number.isFinite(parseFloat(s.velocity_m_min)) ? parseFloat(s.velocity_m_min) : 0;
      const fallbackGrade = Number.isFinite(parseFloat(s.grade_pct)) ? parseFloat(s.grade_pct) : 0;
      const fallbackRer = Number.isFinite(parseFloat(s.rer)) ? parseFloat(s.rer) : 0.92;
      const fallbackVo2 = Number.isFinite(parseFloat(s.vo2_l_min)) ? parseFloat(s.vo2_l_min) : 0;
      const fallbackLactate = Number.isFinite(parseFloat(s.lactate_mmol_l)) ? parseFloat(s.lactate_mmol_l) : 0;
      const fallbackSmo2 = Number.isFinite(parseFloat(s.smo2_work_pct)) ? parseFloat(s.smo2_work_pct) : 40;
      const fallbackDur = Number.isFinite(parseFloat(s.duration_min)) ? parseFloat(s.duration_min) : 60;

      const power = Math.max(0, (workout.power_w ?? fallbackPower));
      const velocity = workout.velocity_m_min ?? fallbackVelocity;
      const grade = workout.grade_pct ?? fallbackGrade;
      const rer = workout.rer ?? fallbackRer;
      const vo2 = workout.vo2_l_min ?? fallbackVo2;
      const lactate = workout.lactate_mmol_l ?? fallbackLactate;
      const workSmo2 = workout.smo2 ?? fallbackSmo2;
      const inferredRestSmo2 = Math.max(55, Math.min(85, workSmo2 + 18));
      const duration = Math.max(0.5, workout.duration_min || fallbackDur);
      return {
        ...s,
        duration_min: String(Math.round(duration)),
        power_w: String(Math.round(power)),
        velocity_m_min: String(Number(velocity.toFixed(2))),
        grade_pct: String(Number(grade.toFixed(2))),
        rer: String(Number(rer.toFixed(2))),
        vo2_l_min: String(Number(vo2.toFixed(2))),
        lactate_mmol_l: String(Number(lactate.toFixed(2))),
        smo2_work_pct: String(Math.round(workSmo2)),
        smo2_rest_pct: String(Math.round(inferredRestSmo2)),
      };
    });
  }

  function importHistoryRowToForms(row: LabRun) {
    if (row.section === "metabolic_profile") {
      setSection("profile");
      const inp = row.input_payload;
      setCpInputs(() => {
        const next = initialEmptyCpInputs();
        if (inp && typeof inp === "object") {
          for (const p of CP_POINTS) {
            const raw = (inp as Record<string, unknown>)[p.label];
            if (raw == null || raw === "") continue;
            const s = String(raw).trim();
            if (s === "") continue;
            next[p.label] = s;
          }
        }
        return next;
      });
      setSaveMessage("Snapshot Metabolic profile importato negli input.");
      setError(null);
      return;
    }
    if (row.section === "lactate_analysis") {
      setSection("lactate");
      const lacIn = row.input_payload;
      if (lacIn && typeof lacIn === "object") {
        const rec = lacIn as Record<string, unknown>;
        const patch = patchLabStringsFromPayload(rec, Object.keys(LACTATE_DEFAULT_INPUT));
        if (Object.keys(patch).length > 0) {
          setLactateInput((s) => ({ ...s, ...patch }));
        }
        if (typeof rec.sport === "string") setLactateSport(toSupportedSport(rec.sport));
        if (rec.vo2_mode === "device" || rec.vo2_mode === "test") setLactateVo2Mode(rec.vo2_mode);
        if (rec.rer_mode === "auto" || rec.rer_mode === "manual") setLactateRerMode(rec.rer_mode);
        if (
          rec.microbiota_source_mode === "health_bio" ||
          rec.microbiota_source_mode === "preset" ||
          rec.microbiota_source_mode === "manual"
        ) {
          setMicrobiotaSourceMode(rec.microbiota_source_mode);
        }
        const dp = rec.dysbiosis_preset;
        if (dp === "eubiosi" || dp === "lieve" || dp === "moderata" || dp === "severa" || dp === "grave") {
          setDysbiosisPreset(dp);
        }
        const foa = rec.fat_oxidation_adaptation;
        if (typeof foa === "number" && Number.isFinite(foa)) {
          setFatOxAdaptation(clamp(foa, 0, 1));
        }
        if (rec.segment_attachment != null && typeof rec.segment_attachment === "object") {
          setLactateSegmentAttachment(rec.segment_attachment as SegmentAttachmentMeta);
        }
        if (rec.health_bio_glucose != null && typeof rec.health_bio_glucose === "object") {
          setHealthBioGlucoseMeta(rec.health_bio_glucose as HealthBioGlucoseMeta);
        }
        if (typeof rec.health_bio_core_temp_c === "number" && Number.isFinite(rec.health_bio_core_temp_c)) {
          setHealthBioCoreTempCBaseline(rec.health_bio_core_temp_c);
        }
        setLactateCalcTick((n) => n + 1);
      }
      setSaveMessage("Snapshot Lactate analysis importato negli input.");
      setError(null);
      return;
    }
    if (row.section === "max_oxidate") {
      setSection("maxox");
      const oxIn = row.input_payload;
      if (oxIn && typeof oxIn === "object") {
        const rec = oxIn as Record<string, unknown>;
        const patch = patchLabStringsFromPayload(rec, Object.keys(MAXOX_DEFAULT_INPUT));
        if (Object.keys(patch).length > 0) {
          setMaxOxInput((s) => ({ ...s, ...patch }));
        }
        if (typeof rec.sport === "string") setMaxOxSport(toSupportedSport(rec.sport));
        if (rec.vo2_mode === "device" || rec.vo2_mode === "test") setMaxOxVo2Mode(rec.vo2_mode);
        setMaxOxCalcTick((n) => n + 1);
      }
      setSaveMessage("Snapshot Max oxidate importato negli input.");
      setError(null);
    }
  }

  async function loadHistory(activeAthleteId: string) {
    setHistoryLoading(true);
    setSelectedHistoryId(null);
    try {
      setLastLabSavedAt({ metabolic: null, lactate: null, maxox: null });
      const payload = await fetchPhysiologyHistoryAndFtp(activeAthleteId);
      const hist = (payload.history as LabRun[]) ?? [];
      setHistory(hist);
      const latestMetabolicRow =
        (payload.latestMetabolicProfileRun as LabRun | null | undefined) ??
        hist.find((r) => r.section === "metabolic_profile");
      setLastLabSavedAt((prev) => ({
        ...prev,
        metabolic: typeof latestMetabolicRow?.created_at === "string" ? latestMetabolicRow.created_at : null,
      }));
      const inp = latestMetabolicRow?.input_payload;
      setCpInputs(() => {
        const next = initialEmptyCpInputs();
        if (inp && typeof inp === "object") {
          for (const p of CP_POINTS) {
            const raw = (inp as Record<string, unknown>)[p.label];
            if (raw == null || raw === "") continue;
            const s = String(raw).trim();
            if (s === "") continue;
            next[p.label] = s;
          }
        }
        return next;
      });
      const apiWorkouts = (payload.workouts as WorkoutSample[] | undefined) ?? [];
      setWorkouts(apiWorkouts);
      if (apiWorkouts.length > 0) {
        setSelectedWorkoutId((prev) => (prev && apiWorkouts.some((w) => w.id === prev) ? prev : apiWorkouts[0].id));
      } else {
        setSelectedWorkoutId("");
      }
      if (payload.autoInputs?.sessionsAnalyzed && payload.autoInputs.sessionsAnalyzed > 0) {
        setAutoInfo(`Auto-decode attivo: ${payload.autoInputs.sessionsAnalyzed} sessioni analizzate.`);
      } else {
        setAutoInfo(null);
      }
      const pVo2L =
        payload.profileVo2maxLMin != null && Number.isFinite(payload.profileVo2maxLMin)
          ? payload.profileVo2maxLMin
          : null;
      const pVo2Ml =
        payload.profileVo2maxMlMinKg != null && Number.isFinite(payload.profileVo2maxMlMinKg)
          ? payload.profileVo2maxMlMinKg
          : null;
      setProfileVo2maxLMin(pVo2L);
      setProfileVo2maxMlMinKg(pVo2Ml);

      const aw =
        payload.athleteWeightKg != null && Number.isFinite(payload.athleteWeightKg) && payload.athleteWeightKg > 30
          ? Number(payload.athleteWeightKg)
          : null;
      setAthleteProfileWeightKg(aw);
      if (aw != null) {
        setLactateInput((s) => ({
          ...s,
          body_mass_kg: s.body_mass_kg.trim() === "" ? String(Number(aw.toFixed(1))) : s.body_mass_kg,
        }));
        setMaxOxInput((s) => ({
          ...s,
          body_mass_kg: s.body_mass_kg.trim() === "" ? String(Number(aw.toFixed(1))) : s.body_mass_kg,
        }));
      }

      if (payload.microbiotaProfile) {
        setHasHealthMicrobiotaProfile(true);
        if (microbiotaSourceMode === "health_bio") {
          setLactateInput((s) => ({
            ...s,
            candida_overgrowth_pct: String(payload.microbiotaProfile?.candida_overgrowth_pct ?? s.candida_overgrowth_pct),
            bifidobacteria_pct: String(payload.microbiotaProfile?.bifidobacteria_pct ?? s.bifidobacteria_pct),
            akkermansia_pct: String(payload.microbiotaProfile?.akkermansia_pct ?? s.akkermansia_pct),
            butyrate_producers_pct: String(payload.microbiotaProfile?.butyrate_producers_pct ?? s.butyrate_producers_pct),
            endotoxin_risk_pct: String(payload.microbiotaProfile?.endotoxin_risk_pct ?? s.endotoxin_risk_pct),
          }));
        }
      } else {
        setHasHealthMicrobiotaProfile(false);
        if (microbiotaSourceMode === "health_bio") {
          setMicrobiotaSourceMode("preset");
        }
      }

      setHealthBioGlucoseMeta(payload.healthBioGlucose ?? null);
      setHealthBioCoreTempCBaseline(
        payload.healthBioCoreTempC != null && Number.isFinite(payload.healthBioCoreTempC)
          ? payload.healthBioCoreTempC
          : null,
      );

      const lacAuto = payload.autoInputs?.lactate;
      const lactateBaselinePartial: Record<string, number> = {};
      if (lacAuto && typeof lacAuto.glucose_mmol_l === "number" && Number.isFinite(lacAuto.glucose_mmol_l)) {
        lactateBaselinePartial.glucose_mmol_l = lacAuto.glucose_mmol_l;
      }
      if (lacAuto && typeof lacAuto.core_temp_c === "number" && Number.isFinite(lacAuto.core_temp_c)) {
        lactateBaselinePartial.core_temp_c = lacAuto.core_temp_c;
      }
      setAutoLactateBaseline(Object.keys(lactateBaselinePartial).length ? lactateBaselinePartial : null);

      if (payload.healthBioGlucose != null) {
        const hbG = payload.healthBioGlucose;
        setLactateInput((s) => ({
          ...s,
          glucose_mmol_l:
            s.glucose_mmol_l.trim() === "" ? String(Number(hbG.mmol_l.toFixed(2))) : s.glucose_mmol_l,
        }));
      }
      if (payload.healthBioCoreTempC != null && Number.isFinite(payload.healthBioCoreTempC)) {
        const hbT = payload.healthBioCoreTempC;
        setLactateInput((s) => ({
          ...s,
          core_temp_c: s.core_temp_c.trim() === "" ? String(Number(hbT.toFixed(2))) : s.core_temp_c,
        }));
      }

      const lacRow =
        (payload.latestLactateRun as LabRun | null | undefined) ??
        hist.find((r) => r.section === "lactate_analysis");
      setLastLabSavedAt((prev) => ({
        ...prev,
        lactate: typeof lacRow?.created_at === "string" ? lacRow.created_at : null,
      }));
      const lacIn = lacRow?.input_payload;
      if (lacIn && typeof lacIn === "object") {
        const rec = lacIn as Record<string, unknown>;
        const patch = patchLabStringsFromPayload(rec, Object.keys(LACTATE_DEFAULT_INPUT));
        if (Object.keys(patch).length > 0) {
          setLactateInput((s) => ({ ...s, ...patch }));
        }
        if (typeof rec.sport === "string") setLactateSport(toSupportedSport(rec.sport));
        if (rec.vo2_mode === "device" || rec.vo2_mode === "test") setLactateVo2Mode(rec.vo2_mode);
        if (rec.rer_mode === "auto" || rec.rer_mode === "manual") setLactateRerMode(rec.rer_mode);
        if (
          rec.microbiota_source_mode === "health_bio" ||
          rec.microbiota_source_mode === "preset" ||
          rec.microbiota_source_mode === "manual"
        ) {
          setMicrobiotaSourceMode(rec.microbiota_source_mode);
        }
        const dp = rec.dysbiosis_preset;
        if (dp === "eubiosi" || dp === "lieve" || dp === "moderata" || dp === "severa" || dp === "grave") {
          setDysbiosisPreset(dp);
        }
        const foa = rec.fat_oxidation_adaptation;
        if (typeof foa === "number" && Number.isFinite(foa)) {
          setFatOxAdaptation(clamp(foa, 0, 1));
        }
        if (rec.segment_attachment != null && typeof rec.segment_attachment === "object") {
          setLactateSegmentAttachment(rec.segment_attachment as SegmentAttachmentMeta);
        }
        if (rec.health_bio_glucose != null && typeof rec.health_bio_glucose === "object") {
          setHealthBioGlucoseMeta(rec.health_bio_glucose as HealthBioGlucoseMeta);
        }
        if (typeof rec.health_bio_core_temp_c === "number" && Number.isFinite(rec.health_bio_core_temp_c)) {
          setHealthBioCoreTempCBaseline(rec.health_bio_core_temp_c);
        }
        setLactateCalcTick((n) => n + 1);
      }

      const oxRow =
        (payload.latestMaxOxRun as LabRun | null | undefined) ?? hist.find((r) => r.section === "max_oxidate");
      setLastLabSavedAt((prev) => ({
        ...prev,
        maxox: typeof oxRow?.created_at === "string" ? oxRow.created_at : null,
      }));
      const oxIn = oxRow?.input_payload;
      if (oxIn && typeof oxIn === "object") {
        const rec = oxIn as Record<string, unknown>;
        const patch = patchLabStringsFromPayload(rec, Object.keys(MAXOX_DEFAULT_INPUT));
        if (Object.keys(patch).length > 0) {
          setMaxOxInput((s) => ({ ...s, ...patch }));
        }
        if (typeof rec.sport === "string") setMaxOxSport(toSupportedSport(rec.sport));
        if (rec.vo2_mode === "device" || rec.vo2_mode === "test") setMaxOxVo2Mode(rec.vo2_mode);
        setMaxOxCalcTick((n) => n + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento storico physiology");
      setHistory([]);
      setAthleteProfileWeightKg(null);
      setLastLabSavedAt({ metabolic: null, lactate: null, maxox: null });
      setSelectedHistoryId(null);
      setWorkouts([]);
      setSelectedWorkoutId("");
      setProfileVo2maxLMin(null);
      setProfileVo2maxMlMinKg(null);
      setAutoLactateBaseline(null);
      setAutoMaxOxBaseline(null);
      setHealthBioGlucoseMeta(null);
      setHealthBioCoreTempCBaseline(null);
    }
    setHistoryLoading(false);
  }

  useEffect(() => {
    if (!athleteId || !userId) return;
    resetPhysiologyDraftForAthleteSwitch();
    void loadHistory(athleteId);
  }, [athleteId, userId, resetPhysiologyDraftForAthleteSwitch]);

  useEffect(() => {
    if (microbiotaSourceMode !== "preset") return;
    const preset = microbiotaPresetValues(dysbiosisPreset);
    setLactateInput((s) => ({ ...s, ...preset }));
  }, [microbiotaSourceMode, dysbiosisPreset]);

  async function saveSnapshot(runSection: LabSection, inputPayload: Record<string, unknown>, outputPayload: Record<string, unknown>) {
    if (!athleteId) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    const createdBy = typeof window !== "undefined" ? window.localStorage.getItem("empathy_current_user_id") : null;
    const payloadVersion =
      typeof outputPayload.version === "string"
        ? outputPayload.version
        : typeof outputPayload.model_version === "string"
          ? outputPayload.model_version
          : "v0.2";
    try {
      await savePhysiologySnapshot({
        athleteId,
        runSection,
        modelVersion: payloadVersion,
        inputPayload,
        outputPayload,
        createdBy,
        profileUpdate:
          runSection === "metabolic_profile"
            ? {
              ftp_watts: cpModel.ftp,
              lt1_watts: cpModel.lt1,
              lt2_watts: cpModel.lt2,
              v_lamax: cpModel.vlamax,
              vo2max_ml_min_kg: cpModel.vo2maxMlMinKg,
              cp_watts: cpModel.cp,
              }
            : null,
      });
      setSaveMessage("Snapshot salvato: Metabolic Lab + profilo fisiologico (Supabase) aggiornati.");
      setProfileRecalcHint(null);
      await loadHistory(athleteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore salvataggio snapshot physiology");
    }
    setSaving(false);
  }

  async function runEvidenceCheck() {
    setEvidenceLoading(true);
    setEvidenceError(null);
    try {
      const q =
        section === "lactate"
          ? "exercise lactate oxidation cori cycle glycogen endurance"
          : section === "maxox"
            ? "maximal oxidative capacity VO2 oxygen delivery mitochondrial utilization exercise"
            : "critical power FTP substrate oxidation endurance zones";
      const res = await fetch(`/api/knowledge/pubmed?q=${encodeURIComponent(q)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await res.json()) as { items?: PubmedItem[]; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Evidence fetch failed");
      setEvidenceItems(payload.items ?? []);
    } catch (err) {
      setEvidenceError(err instanceof Error ? err.message : "Evidence fetch failed");
      setEvidenceItems([]);
    }
    setEvidenceLoading(false);
  }

  const proCheckRows = useMemo<ProCheckRow[]>(() => {
    const evidenceReady = evidenceItems.length > 0;
    if (section === "lactate") {
      const rows: Array<{
        key: string;
        label: string;
        value: number;
        valueText: string;
        min: number;
        max: number;
        keys: string[];
      }> = [
        { key: "intensity", label: "Intensity %FTP", value: lactateModel.intensityPctFtp, valueText: `${lactateModel.intensityPctFtp.toFixed(0)} %FTP`, min: 40, max: 140, keys: ["power_w", "ftp_w"] },
        { key: "glycolytic", label: "CHO share", value: lactateModel.glycolyticSharePct, valueText: `${lactateModel.glycolyticSharePct.toFixed(0)}%`, min: 25, max: 98, keys: ["rer", "smo2_work", "smo2_rest", "glucose_mmol_l"] },
        { key: "lactate_prod", label: "Lattato prodotto", value: lactateModel.lactateProducedG, valueText: `${lactateModel.lactateProducedG.toFixed(1)} g`, min: 5, max: 450, keys: ["power_w", "duration_min", "smo2_work"] },
        { key: "lactate_acc", label: "Lattato accumulato", value: lactateModel.lactateAccumG, valueText: `${lactateModel.lactateAccumG.toFixed(1)} g`, min: 0, max: 220, keys: ["lactate_oxidation_pct", "cori_pct"] },
        { key: "cho_avail", label: "CHO disponibili", value: lactateModel.choAvailableG, valueText: `${lactateModel.choAvailableG.toFixed(1)} g`, min: 0, max: 220, keys: ["cho_ingested_g_h", "gut_absorption_pct", "microbiota_sequestration_pct"] },
        { key: "glyc_net", label: "Glicogeno netto", value: lactateModel.glycogenCombustedNetG, valueText: `${lactateModel.glycogenCombustedNetG.toFixed(1)} g`, min: 0, max: 420, keys: ["duration_min", "power_w", "ftp_w"] },
      ];
      return rows.map((row) => {
        const source = sourceFromInputs(row.keys, lactateInput, autoLactateBaseline, LACTATE_DEFAULT_INPUT);
        const inRange = row.value >= row.min && row.value <= row.max;
        const aligned = inRange && evidenceReady && source !== "default";
        return {
          key: row.key,
          label: row.label,
          valueText: row.valueText,
          source,
          inRange,
          evidenceReady,
          aligned,
          rangeText: `${row.min} - ${row.max}`,
        };
      });
    }
    if (section === "maxox") {
      const rows: Array<{
        key: string;
        label: string;
        value: number;
        valueText: string;
        min: number;
        max: number;
        keys: string[];
      }> = [
        { key: "vo2rel", label: "VO2 rel", value: maxOxModel.vo2RelMlKgMin, valueText: `${maxOxModel.vo2RelMlKgMin.toFixed(1)} ml/kg/min`, min: 25, max: 95, keys: ["vo2_l_min", "body_mass_kg"] },
        {
          key: "util_ratio",
          label: "Saturazione ossidativa (P_oss / capacità)",
          value: maxOxModel.utilizationRatioPct,
          valueText: `${maxOxModel.utilizationRatioPct.toFixed(0)}%`,
          min: 5,
          max: 200,
          keys: ["power_w", "efficiency", "vo2_l_min"],
        },
        { key: "extract", label: "Extraction", value: maxOxModel.extractionPct, valueText: `${maxOxModel.extractionPct.toFixed(1)}%`, min: 8, max: 85, keys: ["smo2_rest_pct", "smo2_work_pct"] },
        { key: "central", label: "Central delivery", value: maxOxModel.centralDeliveryIndex, valueText: `${maxOxModel.centralDeliveryIndex.toFixed(2)}`, min: 0.6, max: 1.2, keys: ["hemoglobin_g_dl", "sao2_pct"] },
        { key: "peripheral", label: "Peripheral utilization", value: maxOxModel.peripheralUtilizationIndex, valueText: `${maxOxModel.peripheralUtilizationIndex.toFixed(2)}`, min: 0.45, max: 1.2, keys: ["smo2_rest_pct", "smo2_work_pct", "lactate_mmol_l"] },
        { key: "bottleneck", label: "Bottleneck index", value: maxOxModel.bottleneckIndex, valueText: `${maxOxModel.bottleneckIndex.toFixed(2)}`, min: 0, max: 1.2, keys: ["lactate_mmol_l", "lactate_trend_mmol_h", "power_w"] },
      ];
      return rows.map((row) => {
        const source = sourceFromInputs(row.keys, maxOxInput, autoMaxOxBaseline, MAXOX_DEFAULT_INPUT);
        const inRange = row.value >= row.min && row.value <= row.max;
        const aligned = inRange && evidenceReady && source !== "default";
        return {
          key: row.key,
          label: row.label,
          valueText: row.valueText,
          source,
          inRange,
          evidenceReady,
          aligned,
          rangeText: `${row.min} - ${row.max}`,
        };
      });
    }
    return [];
  }, [
    section,
    evidenceItems.length,
    lactateModel,
    maxOxModel,
    lactateInput,
    maxOxInput,
    autoLactateBaseline,
    autoMaxOxBaseline,
  ]);

  const alignedRows = proCheckRows.filter((row) => row.aligned);
  const blockedRows = proCheckRows.filter((row) => !row.aligned);
  const canAccessValidationConsole = role === "coach";

  const runProfileRecalc = useCallback(() => {
    setProfileCalcTick((n) => n + 1);
    setProfileLastRecalcAt(Date.now());
    setSaveMessage(null);
    setProfileRecalcHint(
      "Calcolo aggiornato in questa pagina. La curva CP non si archivia da sola: premi «Salva snapshot Metabolic profile» (Supabase + profilo fisiologico). Alla riapertura si ricarica l’ultimo salvataggio Metabolic profile per questo atleta.",
    );
    window.setTimeout(() => setProfileRecalcHint(null), 14000);
    requestAnimationFrame(() => {
      document.getElementById("physiology-live-metabolic-summary")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  useEffect(() => {
    if (!athleteId || !canAccessValidationConsole || !showValidationConsole) return;
    void runEvidenceCheck();
  }, [athleteId, section, canAccessValidationConsole, showValidationConsole]);

  if (loading) {
    return (
      <Pro2ModulePageShell
        eyebrow="Physiology · Metabolic Lab"
        eyebrowClassName={moduleEyebrowClass("physiology")}
        title="Caricamento…"
        description="Risoluzione contesto atleta."
      >
        <p className="text-sm text-slate-500">Caricamento contesto atleta…</p>
      </Pro2ModulePageShell>
    );
  }

  if (!athleteId) {
    return (
      <Pro2ModulePageShell
        eyebrow="Physiology · Metabolic Lab"
        eyebrowClassName={moduleEyebrowClass("physiology")}
        title="Metabolic Lab"
        description="CP, Lactate e Max Oxidate richiedono un atleta attivo nel contesto."
        headerActions={
          <Pro2Link
            href="/access"
            variant="secondary"
            className="justify-center border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15"
          >
            Accesso
          </Pro2Link>
        }
      >
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-400">
          Nessun atleta attivo. Se sei coach, seleziona un atleta in Athletes. Se sei privato, collega il tuo profilo in
          Accesso.
        </div>
      </Pro2ModulePageShell>
    );
  }

  const physiologyTabClass = (active: boolean, tone: "cyan" | "amber" | "rose") =>
    cn(
      "rounded-full border px-4 py-2 text-sm font-semibold transition",
      active
        ? tone === "cyan"
          ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
          : tone === "amber"
            ? "border-amber-500/50 bg-amber-500/15 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.12)]"
            : "border-rose-500/50 bg-rose-500/15 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.12)]"
        : "border-white/10 bg-black/30 text-gray-500 hover:border-white/20 hover:text-gray-300",
    );

  return (
    <Pro2ModulePageShell
      eyebrow="Physiology · Metabolic Lab"
      eyebrowClassName={moduleEyebrowClass("physiology")}
      title="Model-driven physiology"
      description={
        <>
          Motori versionati: <span className="text-cyan-200/90">Critical Power</span>,{" "}
          <span className="text-amber-200/90">Lactate</span>, <span className="text-rose-200/90">Max Oxidate</span>.
          Reality &gt; plan; snapshot salvabili come in V1.
        </>
      }
      headerActions={
        <>
          <Pro2Link
            href="/profile"
            variant="secondary"
            className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
          >
            Profile
          </Pro2Link>
          <Pro2Link
            href="/training/builder"
            variant="secondary"
            className="justify-center border border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15"
          >
            Builder
          </Pro2Link>
          <Pro2Link
            href="/physiology/bioenergetics"
            variant="secondary"
            className="justify-center border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15"
          >
            Hub bioenergetico
          </Pro2Link>
        </>
      }
    >
      <div className="space-y-8">
      {error ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div> : null}
      {saveMessage ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {saveMessage}
        </div>
      ) : null}
      {profileRecalcHint ? (
        <div className="rounded-2xl border border-slate-500/30 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
          {profileRecalcHint}
        </div>
      ) : null}
      {canAccessValidationConsole ? (
        <div className="rounded-2xl border border-violet-500/25 bg-violet-950/20 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <small className="text-xs text-slate-400">Validation console interna (visibile solo a coach/staff).</small>
            <Pro2Button
              type="button"
              variant="secondary"
              className="border border-violet-500/35 bg-violet-500/10 hover:bg-violet-500/15"
              onClick={() => setShowValidationConsole((s) => !s)}
            >
              {showValidationConsole ? "Nascondi validazione" : "Mostra validazione"}
            </Pro2Button>
          </div>
        </div>
      ) : null}
      {canAccessValidationConsole && showValidationConsole ? (
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "999px", padding: "4px 10px" }}>
              Lactate reliability: <strong style={{ color: reliabilityBadge(lactateReliability).color }}>{lactateReliability}%</strong>
            </span>
            <span style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "999px", padding: "4px 10px" }}>
              MaxOx reliability: <strong style={{ color: reliabilityBadge(maxOxReliability).color }}>{maxOxReliability}%</strong>
            </span>
            <span style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "999px", padding: "4px 10px" }}>
              Lactate uncertainty: <strong style={{ color: "#ffd60a" }}>±{lactateUncertaintyPct}%</strong>
            </span>
            <span style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "999px", padding: "4px 10px" }}>
              MaxOx uncertainty: <strong style={{ color: "#ffd60a" }}>±{maxOxResolved.uncertaintyPct}%</strong>
            </span>
          </div>
          <Pro2Button type="button" variant="primary" onClick={runEvidenceCheck} disabled={evidenceLoading}>
            {evidenceLoading ? "Checking evidence..." : "Validate with PubMed"}
          </Pro2Button>
        </div>
        {evidenceError && <div className="alert-error" style={{ marginTop: "10px", marginBottom: 0 }}>{evidenceError}</div>}
        {evidenceItems.length > 0 && (
          <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
            {evidenceItems.slice(0, 5).map((item) => (
              <a
                key={item.pmid}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  background: "#0f1117",
                }}
              >
                <strong style={{ display: "block", marginBottom: "2px" }}>{item.title}</strong>
                <small style={{ color: "var(--empathy-text-muted)" }}>
                  {item.journal ?? "Journal n/a"} · {item.pub_date ?? "date n/a"} · PMID {item.pmid}
                </small>
              </a>
            ))}
          </div>
        )}
        {(section === "lactate" || section === "maxox") && (
          <div style={{ marginTop: "12px" }}>
            <h4 className="viz-title" style={{ marginBottom: "8px" }}>
              Pro Check - source + literature alignment
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px", marginBottom: "8px" }}>
              <div style={{ border: "1px solid rgba(0,224,141,0.35)", borderRadius: "8px", padding: "8px", background: "#0f1815" }}>
                <strong style={{ color: "#00e08d" }}>Aligned (published): {alignedRows.length}</strong>
                <div style={{ marginTop: "6px", display: "grid", gap: "4px", fontSize: "12px" }}>
                  {alignedRows.length === 0 ? <span>Nessun valore allineato.</span> : alignedRows.map((row) => <span key={`ok-${row.key}`}>{row.label}: {row.valueText}</span>)}
                </div>
              </div>
              <div style={{ border: "1px solid rgba(255,93,93,0.35)", borderRadius: "8px", padding: "8px", background: "#1a1012" }}>
                <strong style={{ color: "#ff5d5d" }}>Blocked (not published): {blockedRows.length}</strong>
                <div style={{ marginTop: "6px", display: "grid", gap: "4px", fontSize: "12px" }}>
                  {blockedRows.length === 0 ? <span>Tutti i valori sono allineati.</span> : blockedRows.map((row) => <span key={`ko-${row.key}`}>{row.label}</span>)}
                </div>
              </div>
            </div>
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Value</th>
                  <th>Source</th>
                  <th>Study range</th>
                  <th>Evidence</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {proCheckRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <strong>{row.label}</strong>
                      <div style={{ fontSize: "12px", opacity: 0.8 }}>{row.valueText}</div>
                    </td>
                    <td>{row.source}</td>
                    <td>
                      {row.rangeText} {row.inRange ? "✓" : "✕"}
                    </td>
                    <td>{row.evidenceReady ? "synced" : "missing"}</td>
                    <td style={{ color: row.aligned ? "#00e08d" : "#ff5d5d", fontWeight: 700 }}>
                      {row.aligned ? "ALIGNED" : "BLOCKED"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">
              Regola: un valore e pubblicabile solo se source-check valido + range fisiologico in letteratura + evidenza disponibile.
            </p>
          </div>
        )}
      </div>
      ) : null}

      <Pro2SectionCard accent="slate" icon={BookOpen} title="Ruolo Metabolic Lab nella piattaforma" subtitle="Cosa salviamo, cosa vedi al rientro, dove fluiscono i dati">
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200 marker:text-cyan-400/80">
            Integrazione Training, Nutrition e roadmap Builder
          </summary>
          <div className="mt-3 space-y-3 text-xs leading-relaxed text-slate-400">
            <p>
              <strong className="text-slate-200">Metabolic profile</strong> — Curva Critical Power (durate → W), FTP/LT, VO₂max stimato, tabelle zona/substrato. All&apos;ingresso ripristiniamo{" "}
              <strong>l&apos;ultimo snapshot salvato</strong> su Supabase. Il profilo canonico (stesso schema usato da Virya/Builder) include FTP, CP, LT e i punti CP (
              <code className="rounded bg-black/30 px-1 font-mono text-[0.65rem]">cpCurveInputsW</code>
              ) per allineare le zone: oggi le zone in{" "}
              <Link href="/training" className="text-cyan-300 underline-offset-2 hover:underline">
                Training
              </Link>{" "}
              seguono il <strong>profilo fisiologico</strong> (FTP/LT); il collegamento puntuale di ogni durata CP al calendario è il passo successivo esplicito in product.
            </p>
            <p>
              <strong className="text-slate-200">Lactate analysis</strong> — Ripristino dell&apos;<strong>ultimo test salvato</strong> (input + motore). Serve a quantificare uso CHO, assorbimento intestinale, ossidazione e{" "}
              <strong>ciclo di Cori</strong> (riconversione lattato → glucosio): segnali strutturati consumabili da{" "}
              <Link href="/nutrition" className="text-cyan-300 underline-offset-2 hover:underline">
                Nutrition
              </Link>{" "}
              per fueling e aderenza (non sostituisce il solver pasti: arricchisce i vincoli metabolici).
            </p>
            <p>
              <strong className="text-slate-200">Max oxidate</strong> — Capacità ossidativa e andamento nel tempo; ripristino dell&apos;<strong>ultima analisi salvata</strong>. Utile per sforzi aerobici prolungati e, in roadmap, per affinare{" "}
              <strong>zone aerobiche</strong> e strategie nel Builder quando il contesto fisiologico sarà cablato anche lì.
            </p>
          </div>
        </details>
      </Pro2SectionCard>

      <div
        id="physiology-live-metabolic-summary"
        className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-slate-900/95 to-black/50 p-4"
      >
        {cpCurveHasData ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs font-bold text-cyan-200/90">VO₂max stimato</span>
              <span className="text-xl font-extrabold text-cyan-50">
                {cpModel.vo2maxMlMinKg.toFixed(1)}{" "}
                <span className="text-sm font-semibold text-cyan-200/80">ml/kg/min</span>
              </span>
              <span className="text-sm text-slate-400">≈ {cpModel.vo2maxLMin.toFixed(2)} L/min</span>
              <span className="text-sm text-slate-500">
                · CP {cpModel.cp.toFixed(0)} W · FTP {cpModel.ftp.toFixed(0)} W
              </span>
              <span className="font-mono text-[0.65rem] text-slate-600">{METABOLIC_CP_ENGINE_REVISION}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Valori sempre calcolati dai punti CP (scheda Metabolic profile). La colonna Preview nello storico è lo snapshot salvato; i numeri qui sono dal motore attuale. Se non vedi la revisione motore sopra, riavvia{" "}
              <code className="rounded bg-black/40 px-1">npm run dev</code> e hard refresh.
            </p>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-slate-400">
            Curva CP vuota per questo atleta: compila le potenze in Metabolic profile (o ripristinale dallo snapshot) prima di usare i numeri riassuntivi CP/FTP/VO₂max stimato.
          </p>
        )}
      </div>

      <div className="sticky top-0 z-30 -mx-1 mb-4 flex flex-wrap gap-2 border-b border-white/10 bg-slate-950/90 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-slate-950/80">
        <button
          type="button"
          className={physiologyTabClass(section === "profile", "cyan")}
          onClick={() => setSection("profile")}
        >
          Metabolic profile
        </button>
        <button
          type="button"
          className={physiologyTabClass(section === "lactate", "amber")}
          onClick={() => setSection("lactate")}
        >
          Lactate analysis
        </button>
        <button
          type="button"
          className={physiologyTabClass(section === "maxox", "rose")}
          onClick={() => setSection("maxox")}
        >
          Max oxidate
        </button>
      </div>

      {section === "profile" ? (
        <div className="space-y-8">
          {lastLabSavedAt.metabolic ? (
            <p className="text-xs text-slate-400">
              Ultimo snapshot <strong className="text-slate-200">Metabolic profile</strong> salvato:{" "}
              <span className="tabular-nums text-cyan-200/90">
                {new Date(lastLabSavedAt.metabolic).toLocaleString("it-IT")}
              </span>
            </p>
          ) : (
            <p className="text-xs text-amber-200/85">
              Nessuno snapshot Metabolic profile in archivio: dopo aver compilato la curva CP, usa <strong>Salva snapshot</strong> per conservare l&apos;analisi e vederla al prossimo accesso.
            </p>
          )}
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Pro2Button
                type="button"
                variant="primary"
                disabled={saving || !cpCurveHasData}
                onClick={() =>
                  saveSnapshot("metabolic_profile", cpInputs, {
                    cp: cpModel.cp,
                    ftp: cpModel.ftp,
                    lt1: cpModel.lt1,
                    lt2: cpModel.lt2,
                    fatmax: cpModel.fatmax,
                    vlamax: cpModel.vlamax,
                    vo2max_ml_min_kg: cpModel.vo2maxMlMinKg,
                    vo2max_l_min: cpModel.vo2maxLMin,
                    vo2max_estimate: cpModel.vo2maxEstimate,
                    vo2max_model_version: "empathy-vo2max-metabolic-v3",
                    sprintReserve: cpModel.sprintReserve,
                    wPrimeJ: cpModel.wPrimeJ,
                    pcrCapacityJ: cpModel.pcrCapacityJ,
                    glycolyticCapacityJ: cpModel.glycolyticCapacityJ,
                    fitR2: cpModel.fitR2,
                    fitConfidence: cpModel.fitConfidence,
                    fitModel: cpModel.fitModel,
                    phenotype: cpModel.phenotype,
                    substrateTable: cpModel.substrateTable,
                    powerComponents: cpModel.powerComponents,
                    cpWorkTimeLinear: cpModel.cpWorkTimeLinear,
                    vo2OnsetTauSecDefault: cpModel.vo2OnsetTauSecDefault,
                    gasExchangeSubstrate: gasExchangeSubstrateProfile,
                    metabolic_signal_schema_version: METABOLIC_SIGNAL_SCHEMA_VERSION,
                    metabolic_cp_engine_revision: METABOLIC_CP_ENGINE_REVISION,
                  })
                }
              >
                {saving ? "Salvataggio…" : "Salva snapshot Metabolic profile"}
              </Pro2Button>
              <Pro2Button
                type="button"
                variant="secondary"
                className="border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15"
                onClick={runProfileRecalc}
              >
                Ricalcola (solo schermo)
              </Pro2Button>
              <Pro2Button
                type="button"
                variant="secondary"
                className="border border-slate-500/35 bg-slate-500/10 hover:bg-slate-500/15"
                onClick={async () => {
                  const cpPoints = CP_POINTS.map((p) => ({
                    sec: p.sec,
                    powerW: parseFloat(cpInputs[p.label]) || 0,
                  }));
                  const payload = {
                    export_version: "empathy-metabolic-profile-v1",
                    exported_at: new Date().toISOString(),
                    body_mass_kg: labBodyMassKg,
                    vo2max: {
                      estimated_ml_kg_min: cpModel.vo2maxMlMinKg,
                      estimated_l_min: cpModel.vo2maxLMin,
                      estimate_model_version: cpModel.vo2maxEstimate.modelVersion,
                      profile_lab_ml_kg_min: profileVo2maxMlMinKg,
                      profile_lab_l_min: profileVo2maxLMin,
                    },
                    glycolytic_index_proxy: cpModel.vlamax,
                    glycolytic_index_note:
                      "Adimensional glycolytic proxy from CP engine, typical band ~0.3–0.8; not laboratory V̇La max (mmol·L⁻¹·s⁻¹).",
                    peak_blood_lactate_schematic_mmol_l: estimatePeakBloodLactateMmol(cpModel.vlamax),
                    critical_power_model: {
                      cp_w: cpModel.cp,
                      ftp_w: cpModel.ftp,
                      w_prime_j: cpModel.wPrimeJ,
                      lt1_w: cpModel.lt1,
                      lt2_w: cpModel.lt2,
                      fatmax_w: cpModel.fatmax,
                      sprint_reserve_w: cpModel.sprintReserve,
                      phenotype: cpModel.phenotype,
                      fit_r2: cpModel.fitR2,
                      fit_confidence: cpModel.fitConfidence,
                      cp_input_points: cpPoints,
                    },
                    vo2max_estimate_detail: cpModel.vo2maxEstimate,
                    cp_work_time_linear: cpModel.cpWorkTimeLinear,
                    vo2_onset_tau_sec_default: cpModel.vo2OnsetTauSecDefault,
                    vo2_onset_preview_60s: vo2OnsetPreview,
                    gas_exchange_substrate: gasExchangeSubstrateProfile,
                    metabolic_signal_schema_version: METABOLIC_SIGNAL_SCHEMA_VERSION,
                    metabolic_cp_engine_revision: METABOLIC_CP_ENGINE_REVISION,
                  };
                  try {
                    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                    setMetabolicProfileJsonHint("JSON copiato.");
                    window.setTimeout(() => setMetabolicProfileJsonHint(null), 2800);
                  } catch {
                    setMetabolicProfileJsonHint("Copia non riuscita.");
                    window.setTimeout(() => setMetabolicProfileJsonHint(null), 4000);
                  }
                }}
              >
                Copia JSON profilo
              </Pro2Button>
              {metabolicProfileJsonHint ? (
                <span className="text-xs text-slate-500">{metabolicProfileJsonHint}</span>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-slate-400 sm:max-w-md">
              Stesso flusso V1: verde = snapshot + profilo. VO₂max da carta/file nella card sotto. Substrati da gas quando imposti VO₂/VCO₂ in{" "}
              <span
                role="button"
                tabIndex={0}
                className="cursor-pointer text-cyan-300 underline"
                onClick={() => setSection("lactate")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSection("lactate");
                  }
                }}
              >
                Lactate analysis
              </span>
              .
            </p>
            {profileLastRecalcAt ? (
              <p className="text-[0.7rem] text-slate-500 sm:ml-auto sm:text-right">
                Ultimo ricalcolo locale: {new Date(profileLastRecalcAt).toLocaleTimeString("it-IT")}
              </p>
            ) : null}
          </div>

          <Pro2SectionCard
            accent="cyan"
            title="VO₂max da laboratorio"
            subtitle="Manuale o import CSV/TXT (Cosmed / export tabulare). Aggiorna physiological_profiles + audit metabolic_lab_runs (vo2max_lab)."
            icon={Activity}
          >
            <p className="mb-3 text-sm text-slate-400">
              {profileVo2maxMlMinKg != null ? (
                <>
                  <strong className="text-slate-200">Profilo attuale:</strong> {profileVo2maxMlMinKg.toFixed(1)} ml/kg/min
                  {profileVo2maxLMin != null ? ` (~${profileVo2maxLMin.toFixed(2)} L/min)` : ""}.
                </>
              ) : (
                <>Nessun VO₂max da lab sul profilo: inserisci un valore o importa un file.</>
              )}
            </p>
            {labVo2Message ? <p className="mb-3 text-sm text-emerald-300/95">{labVo2Message}</p> : null}
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                VO₂max noto (ml/kg/min)
                <input
                  className="mt-1 w-full rounded-lg border border-slate-600/60 bg-black/40 px-3 py-2 text-sm text-white"
                  type="text"
                  inputMode="decimal"
                  placeholder="es. 58.5"
                  value={labVo2ManualInput}
                  onChange={(e) => setLabVo2ManualInput(e.target.value)}
                />
              </label>
              <div className="flex items-end">
                <Pro2Button
                  type="button"
                  variant="primary"
                  disabled={labVo2Saving || !athleteId}
                  onClick={async () => {
                    if (!athleteId) return;
                    const v = parseFloat(labVo2ManualInput.replace(",", "."));
                    if (!Number.isFinite(v) || v < 10 || v > 100) {
                      setLabVo2Message("Inserisci un valore plausibile (circa 20–95 ml/kg/min).");
                      return;
                    }
                    setLabVo2Saving(true);
                    setLabVo2Message(null);
                    setError(null);
                    try {
                      const res = await saveVo2maxLab({
                        athleteId,
                        vo2max_ml_min_kg: v,
                        source: "manual",
                      });
                      setProfileVo2maxMlMinKg(res.vo2max_ml_min_kg);
                      const bm =
                        parseFloat(String(lactateInput.body_mass_kg).replace(",", ".")) ||
                        parseFloat(String(maxOxInput.body_mass_kg).replace(",", ".")) ||
                        70;
                      setProfileVo2maxLMin((res.vo2max_ml_min_kg * bm) / 1000);
                      setLabVo2Message("Salvato sul profilo fisiologico e registrato in Metabolic Lab (vo2max_lab).");
                      await loadHistory(athleteId);
                    } catch (err) {
                      setLabVo2Message(err instanceof Error ? err.message : "Errore salvataggio");
                    } finally {
                      setLabVo2Saving(false);
                    }
                  }}
                >
                  {labVo2Saving ? "Salvataggio…" : "Salva VO₂max manuale"}
                </Pro2Button>
              </div>
            </div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
              File export (Cosmed / Cortex / CSV)
              <input
                className="mt-1 block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-600/80 file:px-3 file:py-1.5 file:text-white"
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setGasFileName(f.name);
                  setLabVo2Message(null);
                  try {
                    const text = await f.text();
                    setGasParseResult(parseGasExchangeExport(text, { bodyMassKg: athleteBodyMassForGasImport }));
                  } catch {
                    setGasParseResult({ ok: false, error: "Lettura file non riuscita." });
                  }
                  e.target.value = "";
                }}
              />
            </label>
            {gasFileName ? (
              <p className="mb-2 text-xs text-slate-500">
                File: <strong className="text-slate-300">{gasFileName}</strong>
                {athleteBodyMassForGasImport != null
                  ? ` · massa per parser: ${athleteBodyMassForGasImport} kg`
                  : " · imposta massa in Lactate/MaxOx se l’export ha solo VO₂ assoluto"}
              </p>
            ) : null}
            {gasParseResult ? (
              gasParseResult.ok ? (
                <div className="mb-3 space-y-2">
                  <p className="text-sm text-slate-300">
                    Picco stimato: <strong>{gasParseResult.vo2maxMlMinKg.toFixed(1)} ml/kg/min</strong>
                    {gasParseResult.vo2maxLMin != null ? ` (~${gasParseResult.vo2maxLMin.toFixed(2)} L/min)` : ""} · riga #
                    {gasParseResult.peakRowIndex + 1} · {gasParseResult.rowCount} righe
                  </p>
                  <Pro2Button
                    type="button"
                    variant="secondary"
                    className="border border-cyan-500/40"
                    disabled={labVo2Saving || !athleteId}
                    onClick={async () => {
                      if (!athleteId || !gasParseResult.ok) return;
                      setLabVo2Saving(true);
                      setLabVo2Message(null);
                      setError(null);
                      try {
                        const res = await saveVo2maxLab({
                          athleteId,
                          vo2max_ml_min_kg: gasParseResult.vo2maxMlMinKg,
                          source: "gas_exchange_file",
                          note: gasFileName,
                          parsePreview: {
                            matchedColumns: gasParseResult.matchedColumns,
                            peakRowIndex: gasParseResult.peakRowIndex,
                            rowCount: gasParseResult.rowCount,
                          },
                        });
                        setProfileVo2maxMlMinKg(res.vo2max_ml_min_kg);
                        const bm =
                          parseFloat(String(lactateInput.body_mass_kg).replace(",", ".")) ||
                          parseFloat(String(maxOxInput.body_mass_kg).replace(",", ".")) ||
                          70;
                        setProfileVo2maxLMin((res.vo2max_ml_min_kg * bm) / 1000);
                        setLabVo2Message("VO₂max da file salvato sul profilo.");
                        await loadHistory(athleteId);
                      } catch (err) {
                        setLabVo2Message(err instanceof Error ? err.message : "Errore salvataggio");
                      } finally {
                        setLabVo2Saving(false);
                      }
                    }}
                  >
                    {labVo2Saving ? "Salvataggio…" : "Applica VO₂max da file al profilo"}
                  </Pro2Button>
                </div>
              ) : (
                <p className="mb-3 text-sm text-rose-300">{gasParseResult.error}</p>
              )
            ) : null}
            <Pro2Button
              type="button"
              variant="secondary"
              className="border border-slate-600/50"
              disabled={labVo2Saving || !athleteId}
              onClick={async () => {
                if (!athleteId) return;
                setLabVo2Saving(true);
                setLabVo2Message(null);
                try {
                  await clearVo2maxLab(athleteId);
                  setProfileVo2maxMlMinKg(null);
                  setProfileVo2maxLMin(null);
                  setGasParseResult(null);
                  setGasFileName(null);
                  setLabVo2Message("VO₂max da lab rimosso dal profilo.");
                  await loadHistory(athleteId);
                } catch (err) {
                  setLabVo2Message(err instanceof Error ? err.message : "Errore reset");
                } finally {
                  setLabVo2Saving(false);
                }
              }}
            >
              Rimuovi VO₂max da lab dal profilo
            </Pro2Button>
          </Pro2SectionCard>

          {cpCurveHasData ? (
            <details className="collapsible-card">
              <summary className="cursor-pointer text-sm font-semibold text-slate-300">
                Cross-check: cinetica VO₂ (60 s) e substrati da gas (Lactate)
              </summary>
              <div className="mt-3 space-y-3 text-sm text-slate-400">
                <table className="table-shell">
                  <tbody>
                    <tr>
                      <th scope="row" className="text-left">
                        τ VO₂ default (onset)
                      </th>
                      <td>
                        {vo2OnsetPreview.tau} s ({cpModel.phenotype})
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className="text-left">
                        VO₂ a 60 s (modello)
                      </th>
                      <td>
                        {vo2OnsetPreview.vo2At60sLMin.toFixed(2)} L/min ≈ {(vo2OnsetPreview.fracAt60s * 100).toFixed(0)}% di VO₂max stimato (
                        {cpModel.vo2maxLMin.toFixed(2)} L/min)
                      </td>
                    </tr>
                  </tbody>
                </table>
                {gasExchangeSubstrateProfile ? (
                  <p>
                    RER {gasExchangeSubstrateProfile.rer.toFixed(3)} · CHO {gasExchangeSubstrateProfile.choGPerMin.toFixed(3)} g/min · FAT{" "}
                    {gasExchangeSubstrateProfile.fatGPerMin.toFixed(3)} g/min
                    {!gasExchangeSubstrateProfile.plausible ? " (fuori banda consigliata)" : ""}
                  </p>
                ) : (
                  <p>Substrati da gas: imposta VO₂ e VCO₂ (L/min) in Lactate analysis (stesso schema V1).</p>
                )}
              </div>
            </details>
          ) : null}

          <PhysiologyPro2MetabolicDashboard
            cpPointDefs={CP_POINTS}
            cpInputs={cpInputs}
            onCpInputChange={(label, value) => setCpInputs((s) => ({ ...s, [label]: value }))}
            model={cpModel}
            sessionCount={workouts.length}
            autoDecodeText={autoInfo}
            bodyMassKg={labBodyMassKg}
            profileVo2maxMlMinKg={profileVo2maxMlMinKg}
            profileVo2maxLMin={profileVo2maxLMin}
          />

          {cpCurveHasData ? (
            <>
          <MetabolicPowerComponentsStackChart
            rows={cpModel.powerComponents}
            engineRevision={METABOLIC_CP_ENGINE_REVISION}
          />

          <details className="collapsible-card" style={{ marginBottom: "14px" }}>
            <summary>Power components · tre vie metaboliche (P = CP + W′/t)</summary>
            <p className="session-sub-copy" style={{ marginBottom: 10, maxWidth: "58rem" }}>
              <strong>P = CP + W′/t</strong>. <strong>PCr</strong>: min su W′/t con <strong>(E<sub>PCr</sub>/t)·e<sup>−t/τ</sup></strong>. <strong>Glicolisi</strong>:{" "}
              <strong>W′/t − P<sub>PCr</sub> + CP·f<sub>∥</sub>(t)</strong> (soglia). Colonna <strong>Ossidativo</strong> = residuo. Le colonne <strong>kJ</strong> sono{" "}
              <strong>P·t alla durata della riga</strong> (energia in quel bin): i kJ PCr <strong>non</strong> restano uguali al variare di t (vecchio modello: E/t fisso).
            </p>
            <table className="table-shell" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>Durata</th>
                  <th>P modello</th>
                  <th>Ossidativo</th>
                  <th>PCr</th>
                  <th>Glicolisi</th>
                  <th>kJ oss @t</th>
                  <th>kJ PCr @t</th>
                  <th>kJ glic @t</th>
                </tr>
              </thead>
              <tbody>
                {cpModel.powerComponents.map((row) => (
                  <tr key={row.sec}>
                    <td>{row.label}</td>
                    <td>{row.modelPowerW.toFixed(0)} W</td>
                    <td>{row.aerobicW.toFixed(0)} W ({(row.aerobicPct * 100).toFixed(0)}%)</td>
                    <td>{row.pcrW.toFixed(0)} W</td>
                    <td>
                      {row.glycolyticW.toFixed(0)} W (
                      {((row.glycolyticW / Math.max(1, row.modelPowerW)) * 100).toFixed(0)}%)
                    </td>
                    <td>{row.aerobicKJ.toFixed(1)}</td>
                    <td>{row.pcrKJ.toFixed(1)}</td>
                    <td>{row.glycolyticKJ.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <details className="collapsible-card">
            <summary>Zones & substrates</summary>
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Zona</th>
                  <th>Range W</th>
                  <th>RER stimato</th>
                  <th>kcal/h</th>
                  <th>CHO g/h</th>
                  <th>FAT g/h</th>
                </tr>
              </thead>
              <tbody>
                {cpModel.substrateTable.map((z) => {
                  const zoneColor = zoneColorFromName(z.name);
                  return (
                  <tr key={z.name} style={{ background: `${zoneColor}10` }}>
                    <td>
                      <span
                        className="builder-zone-chip"
                        style={{
                          borderColor: zoneColor,
                          color: zoneColor,
                          backgroundColor: `${zoneColor}22`,
                        }}
                      >
                        {z.name}
                      </span>
                    </td>
                    <td>{z.low.toFixed(0)}-{z.high.toFixed(0)}</td>
                    <td>{z.rer.toFixed(2)}</td>
                    <td>{z.kcalH.toFixed(0)}</td>
                    <td>{z.choG.toFixed(1)}</td>
                    <td>{z.fatG.toFixed(1)}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </details>
            </>
          ) : null}
        </div>
      ) : null}

      {section === "lactate" ? (
        <div>
          {lastLabSavedAt.lactate ? (
            <p className="mb-3 text-xs text-slate-400">
              Ultimo snapshot <strong className="text-slate-200">Lactate analysis</strong> caricato:{" "}
              <span className="tabular-nums text-amber-200/90">
                {new Date(lastLabSavedAt.lactate).toLocaleString("it-IT")}
              </span>
            </p>
          ) : (
            <p className="mb-3 text-xs text-amber-200/85">
              Nessuno snapshot Lactate salvato: dopo l&apos;analisi premi <strong>Salva snapshot Lactate Analysis</strong> per conservare input e output e ritrovarli qui.
            </p>
          )}
          <PhysiologyPro2LactateLab
            model={lactateModel}
            reliabilityPct={lactateReliability}
            uncertaintyPct={lactateUncertaintyPct}
            vo2Used={lactateVo2Used}
            vo2EstL={lactateVo2Estimate.vo2LMin}
            vo2MlKg={lactateVo2Estimate.vo2MlKgMin}
            rerUsed={lactateRerUsed}
            choGap={lactateStrategy.choGap}
            fuelingHint={lactateStrategy.fuelingAction}
            lactateHint={lactateStrategy.lactateAction}
            sessionCount={workouts.length}
            autoDecodeText={autoInfo}
            ftpW={physiologyLabFtpW}
            lt1W={cpModel.lt1}
            lt2W={cpModel.lt2}
            vlamax={cpModel.vlamax}
            profileVo2maxMlMinKg={cpModel.vo2maxMlMinKg}
            intensityPctFtp={lactateIntensityPctFtp}
          >
          <div className="physiology-pro2-lab-page-panel physiology-pro2-lab-page-panel--lac-pick">
            <LactateWorkoutPickerPro2
              workouts={workouts}
              selectedWorkoutId={selectedWorkoutId}
              onSelectWorkoutId={(id) => {
                setSelectedWorkoutId(id);
                const w = workouts.find((x) => x.id === id);
                if (w) applyWorkoutToLactate(w);
              }}
            />
          </div>
          <div className="physiology-pro2-lab-page-panel physiology-pro2-lab-page-panel--lac-ctx">
            <LactateMetabolicContextTiles
              lactateSport={lactateSport}
              setLactateSport={setLactateSport}
              lactateVo2Mode={lactateVo2Mode}
              setLactateVo2Mode={setLactateVo2Mode}
              lactateRerMode={lactateRerMode}
              setLactateRerMode={setLactateRerMode}
              microbiotaSourceMode={microbiotaSourceMode}
              setMicrobiotaSourceMode={setMicrobiotaSourceMode}
              dysbiosisPreset={dysbiosisPreset}
              setDysbiosisPreset={setDysbiosisPreset}
              fatOxAdaptation={fatOxAdaptation}
              setFatOxAdaptation={(v) => setFatOxAdaptation(clamp(v, 0, 1))}
              hasHealthMicrobiotaProfile={hasHealthMicrobiotaProfile}
              lactateVo2Used={lactateVo2Used}
              lactateVo2EstL={lactateVo2Estimate.vo2LMin}
              lactateVo2MlKg={lactateVo2Estimate.vo2MlKgMin}
            />
          </div>
          <div className="physiology-pro2-lab-page-panel physiology-pro2-lab-page-panel--lac-sources">
            <LactateAnalysisDataSourcesCard
              segmentAttachment={lactateSegmentAttachment}
              onSegmentFile={setLactateSegmentAttachment}
              hasHealthMicrobiotaProfile={hasHealthMicrobiotaProfile}
              healthBioGlucose={healthBioGlucoseMeta}
              healthBioCoreTempC={healthBioCoreTempCBaseline}
            />
          </div>
          <div className="physiology-pro2-lab-page-panel">
            <LactatePro2NumericEngineParams
              input={lactateParamsDisplayInput}
              onInputChange={(key, v) => setLactateInput((s) => ({ ...s, [key]: v }))}
              vo2Mode={lactateVo2Mode}
              rerMode={lactateRerMode}
              microbiotaSourceMode={microbiotaSourceMode}
            />
          </div>
          <div className="physiology-pro2-lab-page-panel physiology-pro2-lab-page-panel--notes">
          <details className="collapsible-card physiology-pro2-lab-details">
            <summary>Note pipeline CHO &amp; strategia</summary>
            <div className="session-sub-copy" style={{ marginBottom: 0 }}>
              Pipeline CHO: {lactateModel.choIngestedTotalG.toFixed(1)} g ingeriti · assorbimento parete {lactateModel.gutAbsorptionYieldPctOfIngested.toFixed(1)}% · − {lactateModel.microbiotaSequestrationG.toFixed(1)} g sequestro = {lactateModel.choIntoBloodstreamG.toFixed(1)} g disponibili al sangue (ossidati esogeni: {lactateModel.exogenousOxidizedG.toFixed(1)} g).
            </div>
            <div className="nutrition-compliance-strip physiology-pro2-lab-compliance" style={{ marginTop: "12px" }}>
              <span style={{ color: choGapColor(lactateStrategy.choGap), fontWeight: 700 }}>
                CHO gap: {lactateStrategy.choGap.toFixed(0)} g
              </span>
              <span>{lactateStrategy.fuelingAction}</span>
              <span>{lactateStrategy.lactateAction}</span>
            </div>
          </details>
          </div>
          <div className="physiology-pro2-lab-footer-actions">
            <Pro2Button
              type="button"
              variant="secondary"
              className="border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15"
              onClick={() => {
                setLactateCalcTick((n) => n + 1);
                setLactateLastRecalcAt(Date.now());
              }}
            >
              Ricalcola lactate
            </Pro2Button>
            <small className="text-xs text-slate-500">
              {lactateLastRecalcAt
                ? `Ultimo ricalcolo: ${new Date(lactateLastRecalcAt).toLocaleTimeString("it-IT")} · Auto-update attivo a ogni modifica input.`
                : "Auto-update attivo a ogni modifica input."}
            </small>
            <Pro2Button
              type="button"
              variant="primary"
              disabled={saving}
              onClick={() =>
                saveSnapshot(
                  "lactate_analysis",
                  {
                    ...lactateInput,
                    ...(lactateGutDerived
                      ? {
                          gut_absorption_pct: String(lactateGutDerived.gut_absorption_pct),
                          microbiota_sequestration_pct: String(lactateGutDerived.microbiota_sequestration_pct),
                          gut_training_pct: String(lactateGutDerived.gut_training_pct),
                        }
                      : {}),
                    sport: lactateSport,
                    vo2_mode: lactateVo2Mode,
                    vo2_estimated_l_min: lactateVo2Estimate.vo2LMin,
                    vo2_used_l_min: lactateVo2Used,
                    vo2_method: lactateVo2Estimate.method,
                    rer_mode: lactateRerMode,
                    rer_used: lactateRerUsed,
                    input_precedence_policy: "measured>manual>preset>default",
                    input_uncertainty_pct: lactateUncertaintyPct,
                    input_sources: lactateSourcesForSnapshot,
                    microbiota_source_mode: microbiotaSourceMode,
                    dysbiosis_preset: dysbiosisPreset,
                    fat_oxidation_adaptation: fatOxAdaptation,
                    source_workout_id: selectedWorkout?.id ?? null,
                    source_workout_date: selectedWorkout?.date ?? null,
                    segment_attachment: lactateSegmentAttachment,
                    health_bio_glucose: healthBioGlucoseMeta,
                    health_bio_core_temp_c: healthBioCoreTempCBaseline,
                  },
                  lactateModel,
                )
              }
            >
              {saving ? "Salvataggio..." : "Salva snapshot Lactate Analysis"}
            </Pro2Button>
          </div>
          </PhysiologyPro2LactateLab>
        </div>
      ) : null}

      {section === "maxox" ? (
        <div>
          {lastLabSavedAt.maxox ? (
            <p className="mb-3 text-xs text-slate-400">
              Ultimo snapshot <strong className="text-slate-200">Max oxidate</strong> caricato:{" "}
              <span className="tabular-nums text-rose-200/90">
                {new Date(lastLabSavedAt.maxox).toLocaleString("it-IT")}
              </span>
            </p>
          ) : (
            <p className="mb-3 text-xs text-amber-200/85">
              Nessuno snapshot Max oxidate salvato: dopo l&apos;analisi usa <strong>Salva snapshot Max Oxidate</strong> per conservare capacità ossidativa e indici.
            </p>
          )}
          <PhysiologyPro2MaxOxLab
            model={maxOxModel}
            reliabilityPct={maxOxReliability}
            uncertaintyPct={maxOxResolved.uncertaintyPct}
            bottleneckLabel={maxOxSummary.bottleneckText}
            ratioSummary={maxOxSummary.ratioText}
            redoxSummary={maxOxSummary.redoxText}
            vo2Used={maxOxVo2Used}
            vo2AtPowerL={maxOxVo2AtPowerL}
            vo2MlKgCapacity={maxOxVo2MlKgCapacity}
            vo2MlKgAtPower={maxOxVo2Estimate.vo2MlKgMin}
            vo2CapacitySource={maxOxVo2CapacitySource}
            vo2maxMlMinKgForCaption={cpCurveHasData && cpModel.vo2maxLMin >= 0.35 ? cpModel.vo2maxMlMinKg : null}
            vo2maxLMinForCaption={cpCurveHasData && cpModel.vo2maxLMin >= 0.35 ? cpModel.vo2maxLMin : null}
            maxOxVo2Mode={maxOxVo2Mode}
            sessionCount={workouts.length}
            autoDecodeText={autoInfo}
          >
          <div className="physiology-pro2-lab-page-panel physiology-pro2-lab-page-panel--lac-pick">
            <LactateWorkoutPickerPro2
              variant="maxox"
              workouts={workouts}
              selectedWorkoutId={selectedWorkoutId}
              onSelectWorkoutId={(id) => {
                setSelectedWorkoutId(id);
                const w = workouts.find((x) => x.id === id);
                if (w) applyWorkoutToMaxOx(w);
              }}
            />
          </div>
          <MaxOxSegmentPanelPro2
            onSyncProfile={syncMaxOxFromMetabolicProfile}
            onSyncLactate={syncMaxOxFromLactateLab}
            onApplySegment={applyMaxOxSegmentForm}
            lastSegmentVo2LMin={maxOxSegmentLastVo2LMin}
            lastSegmentO2TotalL={maxOxSegmentLastO2TotalL}
            lastSegmentDurationMin={maxOxSegmentLastDurationMin}
          />
          <div className="physiology-pro2-lab-page-panel physiology-pro2-lab-page-panel--lac-ctx">
            <MaxOxMetabolicContextTiles
              maxOxSport={maxOxSport}
              setMaxOxSport={setMaxOxSport}
              maxOxVo2Mode={maxOxVo2Mode}
              setMaxOxVo2Mode={setMaxOxVo2Mode}
              maxOxVo2Used={maxOxVo2Used}
              maxOxVo2EstL={maxOxVo2AtPowerL}
              maxOxVo2MlKg={maxOxVo2Estimate.vo2MlKgMin}
              vo2CapacitySource={maxOxVo2CapacitySource}
              segmentVo2LMin={maxOxSegmentLastVo2LMin}
              segmentO2TotalL={maxOxSegmentLastO2TotalL}
              segmentDurationMin={maxOxSegmentLastDurationMin}
            />
          </div>
          <div className="physiology-pro2-lab-page-panel">
            <div className="physiology-pro2-mini-banner">Fonte capacità VO₂ · riepilogo</div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs leading-relaxed text-slate-300">
              <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-rose-200/90">
                VO₂ usato come capacità (max)
              </div>
              <div className="text-lg font-bold text-slate-100">{maxOxVo2Used.toFixed(2)} L/min</div>
              <div className="mt-2 text-slate-400">
                {maxOxVo2CapacitySource === "test_manual" ? (
                  <>
                    <strong className="text-slate-200">Test manuale.</strong> A questa potenza stimato ~
                    {maxOxVo2Estimate.vo2LMin.toFixed(2)} L/min ({maxOxVo2Estimate.vo2MlKgMin.toFixed(1)} ml/kg/min).
                  </>
                ) : maxOxVo2CapacitySource === "metabolic_engine_vo2max" ? (
                  <>
                    <strong className="text-slate-200">VO₂max da Metabolic Profile</strong> (blend CP/W′):{" "}
                    {cpModel.vo2maxMlMinKg.toFixed(1)} ml/kg/min · {maxOxVo2Used.toFixed(2)} L/min @{" "}
                    {labBodyMassKg.toFixed(0)} kg. A questa potenza ~{maxOxVo2Estimate.vo2LMin.toFixed(2)} L/min.
                  </>
                ) : (
                  <>
                    <strong className="text-slate-200">Solo stima da potenza</strong> ({maxOxVo2Estimate.vo2LMin.toFixed(2)}{" "}
                    L/min, {maxOxVo2Estimate.vo2MlKgMin.toFixed(1)} ml/kg/min) — per una capacità massima credibile compila la
                    curva CP in Metabolic profile (VO₂max motore); il lab non usa più il VO₂max anagrafico come tetto.
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="physiology-pro2-lab-page-panel">
            <MaxOxPro2NumericEngineParams
              input={maxOxInput}
              onInputChange={(key, v) => setMaxOxInput((s) => ({ ...s, [key]: v }))}
              vo2Mode={maxOxVo2Mode}
            />
          </div>

          <div className="physiology-pro2-lab-page-panel">
            <div className="physiology-pro2-mini-banner">Indici principali · saturazione e bottleneck</div>
            <div className="physiology-lab-pro2-kpi-grid">
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Potenza input · CP profilo</div>
                <div className="physiology-lab-pro2-kpi-value">
                  {(maxOxResolved.values.power_w || 0).toFixed(0)} W · CP {cpModel.cp.toFixed(0)} W
                </div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Durata test · riga split CP</div>
                <div className="physiology-lab-pro2-kpi-value">
                  {(Number.isFinite(maxOxResolved.values.duration_min) && maxOxResolved.values.duration_min > 0
                    ? maxOxResolved.values.duration_min
                    : 60
                  ).toFixed(1)}{" "}
                  min
                  {maxOxCpPowerSplitRow ? (
                    <>
                      {" · "}
                      <span className="text-slate-400">{maxOxCpPowerSplitRow.label}</span>
                      <span className="tabular-nums text-slate-500">
                        {" "}
                        ({(maxOxCpPowerSplitRow.sec / 60).toFixed(0)}′)
                      </span>
                    </>
                  ) : cpCurveHasData ? (
                    <span className="text-slate-500"> — nessun split</span>
                  ) : (
                    <span className="text-slate-500"> — compila CP</span>
                  )}
                </div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Tetto meccanico ossidativo (P_oss)</div>
                <div className="physiology-lab-pro2-kpi-value physiology-lab-pro2-kpi-value--cyan">
                  {maxOxModel.cpMechanicalAerobicCeilingW.toFixed(0)} W
                  {maxOxCpPowerSplitRow ? (
                    <span className="mt-1 block text-[0.65rem] font-normal leading-snug text-slate-500">
                      P modello {maxOxCpPowerSplitRow.modelPowerW.toFixed(0)} W · glic {maxOxCpPowerSplitRow.glycolyticW.toFixed(0)} W · PCr{" "}
                      {maxOxCpPowerSplitRow.pcrW.toFixed(0)} W
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">VO₂max capacità (L/min · ml/kg/min)</div>
                <div className="physiology-lab-pro2-kpi-value physiology-lab-pro2-kpi-value--cyan">
                  {maxOxVo2Used.toFixed(2)} ·{" "}
                  {((maxOxVo2Used * 1000) / Math.max(1, labBodyMassKg)).toFixed(1)}
                </div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Intensità test</div>
                <div className="physiology-lab-pro2-kpi-value">{maxOxModel.intensityPctFtp.toFixed(0)} %FTP</div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Capacità ossidativa (netta)</div>
                <div className="physiology-lab-pro2-kpi-value physiology-lab-pro2-kpi-value--cyan">
                  {maxOxModel.oxidativeCapacityKcalMin.toFixed(2)} kcal/min
                </div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Domanda totale</div>
                <div className="physiology-lab-pro2-kpi-value">{maxOxModel.requiredKcalMin.toFixed(2)} kcal/min</div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Domanda ossidativa (P_oss @ durata)</div>
                <div className="physiology-lab-pro2-kpi-value physiology-lab-pro2-kpi-value--cyan">
                  {maxOxModel.oxidativeDemandKcalMin.toFixed(2)} kcal/min
                </div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Potenza non ossidativa (residuo)</div>
                <div className="physiology-lab-pro2-kpi-value">{maxOxModel.glycolyticPowerDemandW.toFixed(0)} W</div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Saturazione ossidativa</div>
                <div className="physiology-lab-pro2-kpi-value">{maxOxModel.utilizationRatioPct.toFixed(0)}%</div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Coerenza VO₂ grezza</div>
                <div className="physiology-lab-pro2-kpi-value">{maxOxModel.utilizationVo2CoherencePct.toFixed(0)}%</div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Stress delivery (totale/netta)</div>
                <div className="physiology-lab-pro2-kpi-value">{maxOxModel.utilizationDeliveryStressPct.toFixed(0)}%</div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Collo di bottiglia ossidativo</div>
                <div className="physiology-lab-pro2-kpi-value physiology-lab-pro2-kpi-value--pink">
                  {maxOxModel.oxidativeBottleneckIndex.toFixed(0)}/100
                </div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Stress redox</div>
                <div className="physiology-lab-pro2-kpi-value">{maxOxModel.redoxStressIndex.toFixed(0)}/100</div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Tipo limite</div>
                <div className="physiology-lab-pro2-kpi-value">{maxOxSummary.bottleneckText}</div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Affidabilità / incertezza</div>
                <div className="physiology-lab-pro2-kpi-value">
                  {maxOxReliability}% / ±{maxOxResolved.uncertaintyPct}%
                </div>
              </div>
            </div>
          </div>
          <div className="physiology-pro2-lab-page-panel">
            <div className="physiology-pro2-mini-banner">Delivery · periferia · estrazione</div>
            <div className="physiology-lab-pro2-kpi-grid">
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Delivery centrale O₂</div>
                <div className="physiology-lab-pro2-kpi-value physiology-lab-pro2-kpi-value--cyan">
                  {maxOxModel.centralDeliveryIndex.toFixed(2)}
                </div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Utilizzo periferico</div>
                <div className="physiology-lab-pro2-kpi-value">{maxOxModel.peripheralUtilizationIndex.toFixed(2)}</div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">Estrazione SmO₂</div>
                <div className="physiology-lab-pro2-kpi-value">{maxOxModel.extractionPct.toFixed(1)}%</div>
              </div>
              <div className="physiology-lab-pro2-kpi">
                <div className="physiology-lab-pro2-kpi-label">NADH / riossidazione</div>
                <div className="physiology-lab-pro2-kpi-value">
                  {(maxOxModel.nadhPressureIndex * 100).toFixed(0)}% / {(maxOxModel.reoxidationCapacityIndex * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>

          <div className="physiology-pro2-lab-page-panel physiology-pro2-lab-page-panel--notes">
          <details className="collapsible-card physiology-pro2-lab-details">
            <summary>Note lettura MaxOx</summary>
            <div className="session-sub-copy" style={{ marginBottom: 0 }}>
              Lettura rapida: {maxOxSummary.ratioText}, limite dominante = {maxOxSummary.bottleneckText.toLowerCase()}, {maxOxSummary.redoxText}.
            </div>
          </details>
          </div>
          <div className="physiology-pro2-lab-footer-actions">
            <Pro2Button
              type="button"
              variant="secondary"
              className="border border-rose-500/35 bg-rose-500/10 hover:bg-rose-500/15"
              onClick={() => {
                setMaxOxCalcTick((n) => n + 1);
                setMaxOxLastRecalcAt(Date.now());
              }}
            >
              Ricalcola maxox
            </Pro2Button>
            <small className="text-xs text-slate-500">
              {maxOxLastRecalcAt
                ? `Ultimo ricalcolo: ${new Date(maxOxLastRecalcAt).toLocaleTimeString("it-IT")}`
                : "Premi ricalcola per forzare il refresh del modello."}
            </small>
            <Pro2Button
              type="button"
              variant="primary"
              disabled={saving}
              onClick={() =>
                saveSnapshot(
                  "max_oxidate",
                  {
                    ...maxOxInput,
                    sport: maxOxSport,
                    vo2_mode: maxOxVo2Mode,
                    vo2_at_power_l_min: maxOxVo2AtPowerL,
                    vo2_estimated_l_min: maxOxVo2AtPowerL,
                    vo2_used_l_min: maxOxVo2Used,
                    vo2_method:
                      maxOxVo2CapacitySource === "metabolic_engine_vo2max"
                        ? "metabolic_profile_cp_vo2max"
                        : maxOxVo2CapacitySource === "test_manual"
                          ? "test_manual"
                          : maxOxVo2Estimate.method,
                    vo2_capacity_source: maxOxVo2CapacitySource,
                    vo2_reading_at_load_l_min: maxOxVo2AtLoadLMin,
                    cp_power_split_duration_sec: maxOxModel.cpPowerSplitDurationSec,
                    cp_mechanical_aerobic_ceiling_w: maxOxModel.cpMechanicalAerobicCeilingW,
                    cp_power_component_label: maxOxCpPowerSplitRow?.label ?? null,
                    metabolic_cp_engine_revision: METABOLIC_CP_ENGINE_REVISION,
                    profile_vo2max_ml_min_kg: profileVo2maxMlMinKg,
                    profile_vo2max_l_min: profileVo2maxLMin,
                    input_precedence_policy: "measured>manual>preset>default",
                    input_uncertainty_pct: maxOxResolved.uncertaintyPct,
                    input_sources: maxOxResolved.sources,
                    source_workout_id: selectedWorkout?.id ?? null,
                    source_workout_date: selectedWorkout?.date ?? null,
                  },
                  maxOxModel,
                )
              }
            >
              {saving ? "Salvataggio..." : "Salva snapshot Max Oxidate"}
            </Pro2Button>
          </div>
          </PhysiologyPro2MaxOxLab>
        </div>
      ) : null}

      <Pro2SectionCard
        accent="cyan"
        icon={Network}
        title="Multiscala biologica · bottleneck (interpretazione)"
        subtitle="Twin + lab → @empathy/domain-knowledge — solo narrativa e tag, non sovrascrive il twin"
      >
        <p className="mb-3 text-xs leading-relaxed text-slate-500">
          Priorità L1–L6 e nodi ontologia attivati in modo <strong>deterministico</strong>. I numeri canonici restano nei motori
          fisiologia / bioenergetica.
        </p>
        <MultiscaleBottleneckPanelPro2 athleteId={athleteId} />
      </Pro2SectionCard>

      <Pro2SectionCard
        accent="slate"
        icon={Layers}
        title="Metabolic Lab history"
        subtitle="Tendina snapshot + import negli input — dettaglio JSON sotto"
      >
        <p className="mb-3 text-xs leading-relaxed text-slate-500">
          I KPI nella pagina usano il <strong>motore attuale</strong> (
          <code className="rounded bg-black/30 px-1 font-mono text-[0.65rem]">{METABOLIC_CP_ENGINE_REVISION}</code>
          ). Qui sotto è lo <strong>snapshot congelato</strong> al salvataggio.
        </p>
        {historyLoading ? (
          <p className="text-sm text-slate-500">Caricamento storico…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">Nessuno snapshot salvato.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex min-w-[min(100%,280px)] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Archivio snapshot
                <select
                  className="w-full max-w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                  value={selectedHistoryId ?? ""}
                  onChange={(e) => setSelectedHistoryId(e.target.value ? e.target.value : null)}
                >
                  <option value="">Seleziona uno snapshot…</option>
                  {history.map((row) => (
                    <option key={row.id} value={row.id}>
                      {new Date(row.created_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                      {labHistorySectionTitle(row.section)} · {row.model_version}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2 pb-0.5">
                <Pro2Button
                  type="button"
                  variant="primary"
                  className="text-xs"
                  disabled={!selectedHistoryRow}
                  onClick={() => {
                    if (selectedHistoryRow) importHistoryRowToForms(selectedHistoryRow);
                  }}
                >
                  Importa negli input
                </Pro2Button>
                <Pro2Button
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  disabled={!selectedHistoryRow}
                  onClick={() => setSelectedHistoryId(null)}
                >
                  Deseleziona
                </Pro2Button>
              </div>
            </div>
            {selectedHistoryRow ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">
                      {labHistorySectionTitle(selectedHistoryRow.section)}
                    </span>
                    {" · "}
                    {new Date(selectedHistoryRow.created_at).toLocaleString("it-IT")}
                    {" · "}
                    <span className="font-mono">{selectedHistoryRow.model_version}</span>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">input_payload</p>
                    <pre className="max-h-72 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[0.7rem] leading-relaxed text-slate-300">
                      {JSON.stringify(selectedHistoryRow.input_payload ?? {}, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">output_payload</p>
                    <pre className="max-h-72 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[0.7rem] leading-relaxed text-slate-300">
                      {JSON.stringify(selectedHistoryRow.output_payload ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Pro2SectionCard>

      <p className="text-xs text-slate-600">
        Contesto: {role === "coach" ? "Coach" : "Privato"} · Atleta {athleteId.slice(0, 8)}…
      </p>
      </div>
    </Pro2ModulePageShell>
  );
}

