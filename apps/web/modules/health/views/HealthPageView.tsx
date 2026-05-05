"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Dna,
  Droplets,
  Flame,
  Heart,
  HeartPulse,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2Button } from "@/components/ui/empathy";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import {
  fetchHealthPanelsTimeline,
  fetchHealthSystemMap,
  patchHealthStagingRun,
  type HealthSystemMapViewModel,
  type HealthStagingRunAction,
  type HealthTimelineFetchDiagnostics,
  uploadHealthDocument,
  type HealthPanelTimelineRow,
} from "@/modules/health/services/health-module-api";

/** Build produzione: niente KPI / grafici riempiti con serie demo quando mancano referti. */
const SHOW_HEALTH_DEMO_FALLBACK_DATA = process.env.NODE_ENV !== "production";

const DEMO_INFLAMMATION_RADAR = [
  { subject: "PCR-us", A: 78, fullMark: 100 },
  { subject: "IL-6", A: 72, fullMark: 100 },
  { subject: "TNF-α", A: 68, fullMark: 100 },
  { subject: "Omocisteina", A: 74, fullMark: 100 },
  { subject: "LDL-ox", A: 70, fullMark: 100 },
];

const DEMO_MICROBIOTA_RADAR = [
  { subject: "Firmicutes", A: 44, fullMark: 100 },
  { subject: "Bacteroidetes", A: 38, fullMark: 100 },
  { subject: "Proteobacteria", A: 8, fullMark: 100 },
  { subject: "Actinobacteria", A: 6, fullMark: 100 },
  { subject: "Diversità", A: 72, fullMark: 100 },
];

const DEMO_HORMONES_BAR = [
  { name: "Cortisolo AM", val: 16 },
  { name: "Cortisolo PM", val: 11 },
  { name: "Testosterone", val: 520 },
  { name: "TSH", val: 1.6 },
  { name: "T3 libera", val: 3.9 },
  { name: "T4 libera", val: 1.2 },
];

const DEMO_BLOOD_TREND = [
  { label: "Ott 2025", emoglobina: 15.2, ferritina: 78, vit_d: 32, b12: 380, glicemia: 88 },
  { label: "Nov 2025", emoglobina: 15.8, ferritina: 82, vit_d: 38, b12: 400, glicemia: 86 },
  { label: "Dic 2025", emoglobina: 16.1, ferritina: 90, vit_d: 42, b12: 430, glicemia: 85 },
  { label: "Gen 2026", emoglobina: 16.3, ferritina: 95, vit_d: 45, b12: 450, glicemia: 84 },
  { label: "Feb 2026", emoglobina: 16.4, ferritina: 97, vit_d: 47, b12: 465, glicemia: 83 },
  { label: "Mar 2026", emoglobina: 16.5, ferritina: 98, vit_d: 48, b12: 470, glicemia: 83 },
];

const EPIGENETIC_RINGS = [
  { name: "Metilazione", value: 85, fill: "#a855f7" },
  { name: "Età biologica", value: 72, fill: "#ec4899" },
  { name: "Stress oss.", value: 65, fill: "#f97316" },
  { name: "Detox", value: 78, fill: "#22c55e" },
  { name: "Riparazione", value: 88, fill: "#3b82f6" },
];

/** Radar “pathway” epigenetici (0–100, score qualitativo). */
const DEMO_EPIGENETIC_RADAR = [
  { subject: "Metilazione", A: 82, fullMark: 100 },
  { subject: "Longevità", A: 76, fullMark: 100 },
  { subject: "Infiamm. cronica", A: 71, fullMark: 100 },
  { subject: "Detox genico", A: 79, fullMark: 100 },
  { subject: "Riparazione DNA", A: 86, fullMark: 100 },
];

const DEMO_EPIGENETIC_TREND = [
  { label: "Set", metilazione: 78, detox: 72, riparazione: 84 },
  { label: "Ott", metilazione: 80, detox: 74, riparazione: 85 },
  { label: "Nov", metilazione: 81, detox: 76, riparazione: 86 },
  { label: "Dic", metilazione: 83, detox: 77, riparazione: 87 },
  { label: "Gen", metilazione: 84, detox: 78, riparazione: 87 },
  { label: "Feb", metilazione: 85, detox: 78, riparazione: 88 },
];

/** Stress ossidativo — assi da referto (d-ROMs, BAP, glutatione, …). */
const DEMO_OXIDATIVE_RADAR = [
  { subject: "d-ROMs ↓", A: 68, fullMark: 100 },
  { subject: "BAP ↑", A: 74, fullMark: 100 },
  { subject: "Glutatione", A: 70, fullMark: 100 },
  { subject: "SOD", A: 72, fullMark: 100 },
  { subject: "Catalasi", A: 69, fullMark: 100 },
];

/** Equilibrio endocrino (assi funzionali, 0–100). */
const DEMO_ENDOCRINE_RADAR = [
  { subject: "Asse HPA", A: 73, fullMark: 100 },
  { subject: "Asse HPG", A: 78, fullMark: 100 },
  { subject: "Tiroide", A: 81, fullMark: 100 },
  { subject: "Surreni / DHEA", A: 75, fullMark: 100 },
  { subject: "GH / IGF-1", A: 71, fullMark: 100 },
];

function readNum(obj: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(String(v).replace(",", "."));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Più basso è il marker infiammatorio, più alto è lo score (0–100, euristica). */
function inflammationAxisScore(value: number | null, refHigh: number, demo: number): number {
  if (value == null) return demo;
  const ratio = value / refHigh;
  return Math.max(8, Math.min(100, 100 - ratio * 85));
}

function capPercentDisplay(value: number | null, demo: number): number {
  if (value == null) return demo;
  return Math.max(0, Math.min(100, value));
}

function inflammationRadarFromPanel(panel: HealthPanelTimelineRow | undefined) {
  const v = (panel?.values as Record<string, unknown> | null) ?? null;
  const crp = readNum(v, ["crp_mg_l", "pcr", "hs_crp", "hs-crp"]);
  const il6 = readNum(v, ["il6", "il_6"]);
  const tnf = readNum(v, ["tnf_alpha", "tnf"]);
  const hcy = readNum(v, ["homocysteine", "omocisteina"]);
  const ox = readNum(v, ["oxidized_ldl", "ldl_ox"]);
  const hasAny = [crp, il6, tnf, hcy, ox].some((x) => x != null);
  const d = DEMO_INFLAMMATION_RADAR;
  if (!hasAny) {
    return SHOW_HEALTH_DEMO_FALLBACK_DATA ? { rows: d, isDemo: true as const } : { rows: [], isDemo: false as const };
  }
  return {
    rows: [
      { subject: "PCR-us", A: inflammationAxisScore(crp, 5, d[0].A), fullMark: 100 },
      { subject: "IL-6", A: inflammationAxisScore(il6, 10, d[1].A), fullMark: 100 },
      { subject: "TNF-α", A: inflammationAxisScore(tnf, 25, d[2].A), fullMark: 100 },
      { subject: "Omocisteina", A: inflammationAxisScore(hcy, 20, d[3].A), fullMark: 100 },
      { subject: "LDL-ox", A: inflammationAxisScore(ox, 80, d[4].A), fullMark: 100 },
    ],
    isDemo: false as const,
  };
}

function microbiotaRadarFromPanel(panel: HealthPanelTimelineRow | undefined) {
  const v = (panel?.values as Record<string, unknown> | null) ?? null;
  const f = readNum(v, ["firmicutes_pct", "firmicutes"]);
  const b = readNum(v, ["bacteroidetes_pct", "bacteroidetes"]);
  const p = readNum(v, ["proteobacteria_pct", "proteobacteria"]);
  const a = readNum(v, ["actinobacteria_pct", "actinobacteria"]);
  const div = readNum(v, ["diversity_shannon", "diversity", "alpha_diversity"]);
  const hasAny = [f, b, p, a, div].some((x) => x != null);
  const d = DEMO_MICROBIOTA_RADAR;
  if (!hasAny) {
    return SHOW_HEALTH_DEMO_FALLBACK_DATA ? { rows: d, isDemo: true as const } : { rows: [], isDemo: false as const };
  }
  const divScore = div != null ? Math.max(0, Math.min(100, (div / 4.5) * 100)) : d[4].A;
  return {
    rows: [
      { subject: "Firmicutes", A: capPercentDisplay(f, d[0].A), fullMark: 100 },
      { subject: "Bacteroidetes", A: capPercentDisplay(b, d[1].A), fullMark: 100 },
      { subject: "Proteobacteria", A: capPercentDisplay(p, d[2].A), fullMark: 100 },
      { subject: "Actinobacteria", A: capPercentDisplay(a, d[3].A), fullMark: 100 },
      { subject: "Diversità", A: divScore, fullMark: 100 },
    ],
    isDemo: false as const,
  };
}

function hormonesBarFromPanel(panel: HealthPanelTimelineRow | undefined) {
  const v = (panel?.values as Record<string, unknown> | null) ?? null;
  const am = readNum(v, ["cortisol_am", "cortisol_morning"]);
  const pm = readNum(v, ["cortisol_pm", "cortisol_evening"]);
  const tt = readNum(v, ["testosterone", "testosterone_ng_dl"]);
  const tsh = readNum(v, ["tsh"]);
  const t3 = readNum(v, ["t3", "ft3", "t3_libera"]);
  const t4 = readNum(v, ["t4", "ft4", "t4_libera"]);
  const d = DEMO_HORMONES_BAR;
  const hasAny = [am, pm, tt, tsh, t3, t4].some((x) => x != null);
  if (!hasAny)
    return SHOW_HEALTH_DEMO_FALLBACK_DATA ? { rows: d, isDemo: true as const } : { rows: [], isDemo: false as const };
  return {
    rows: [
      { name: "Cortisolo AM", val: am ?? d[0].val },
      { name: "Cortisolo PM", val: pm ?? d[1].val },
      { name: "Testosterone", val: tt ?? d[2].val },
      { name: "TSH", val: tsh ?? d[3].val },
      { name: "T3 libera", val: t3 ?? d[4].val },
      { name: "T4 libera", val: t4 ?? d[5].val },
    ],
    isDemo: false as const,
  };
}

function biologicalAgeRingScore(deltaYears: number | null, demo: number): number {
  if (deltaYears == null) return demo;
  return Math.max(12, Math.min(100, 100 - Math.abs(deltaYears) * 9));
}

function epigeneticRingsFromPanel(panel: HealthPanelTimelineRow | undefined): Array<{ name: string; value: number; fill: string }> {
  const missingPanel = !panel?.values || typeof panel.values !== "object";
  if (missingPanel && !SHOW_HEALTH_DEMO_FALLBACK_DATA) {
    return [];
  }
  const v = (panel?.values as Record<string, unknown> | null) ?? null;
  const meth = readNum(v, ["methylation_score", "metilazione", "methylation", "score_metilazione"]);
  const delta = readNum(v, ["biological_age_delta", "epigenetic_age_delta", "eta_bio_vs_crono"]);
  const ox = readNum(v, ["epigenetic_oxidative_stress", "stress_oss_epigenetico", "oxidative_epigenetic"]);
  const detox = readNum(v, ["epigenetic_detox", "detox_score", "detox_epigenetico"]);
  const repair = readNum(v, ["epigenetic_repair", "repair_score", "dna_repair"]);
  return EPIGENETIC_RINGS.map((r) => {
    if (r.name === "Metilazione") return { ...r, value: Math.round(capPercentDisplay(meth, r.value)) };
    if (r.name === "Età biologica") return { ...r, value: Math.round(biologicalAgeRingScore(delta, r.value)) };
    if (r.name === "Stress oss.") return { ...r, value: Math.round(capPercentDisplay(ox, r.value)) };
    if (r.name === "Detox") return { ...r, value: Math.round(capPercentDisplay(detox, r.value)) };
    if (r.name === "Riparazione") return { ...r, value: Math.round(capPercentDisplay(repair, r.value)) };
    return r;
  });
}

function epigeneticRadarFromPanel(panel: HealthPanelTimelineRow | undefined) {
  const rings = epigeneticRingsFromPanel(panel);
  const v = (panel?.values as Record<string, unknown> | null) ?? null;
  const hasNumeric = [
    readNum(v, ["methylation_score", "metilazione", "methylation"]),
    readNum(v, ["biological_age_delta", "epigenetic_age_delta"]),
    readNum(v, ["epigenetic_oxidative_stress", "stress_oss_epigenetico"]),
    readNum(v, ["epigenetic_detox", "detox_score"]),
    readNum(v, ["epigenetic_repair", "repair_score"]),
  ].some((x) => x != null);
  const d = DEMO_EPIGENETIC_RADAR;
  if (!hasNumeric) {
    return SHOW_HEALTH_DEMO_FALLBACK_DATA ? { rows: d, isDemo: true as const } : { rows: [], isDemo: false as const };
  }
  const subjects = ["Metilazione", "Longevità", "Infiamm. cronica", "Detox genico", "Riparazione DNA"];
  return {
    rows: rings.map((r, i) => ({
      subject: subjects[i] ?? r.name,
      A: capPercentDisplay(r.value, d[i]?.A ?? 72),
      fullMark: 100,
    })),
    isDemo: false as const,
  };
}

function rowFromEpigeneticTrendPanel(panel: HealthPanelTimelineRow): {
  label: string;
  metilazione: number | null;
  detox: number | null;
  riparazione: number | null;
} | null {
  const v = panel.values;
  if (!v || typeof v !== "object") return null;
  const rec = v as Record<string, unknown>;
  const metilazione = readNum(rec, ["methylation_score", "metilazione", "methylation"]);
  const detox = readNum(rec, ["epigenetic_detox", "detox_score"]);
  const riparazione = readNum(rec, ["epigenetic_repair", "repair_score"]);
  if (metilazione == null && detox == null && riparazione == null) return null;
  const label = panel.sample_date
    ? new Date(panel.sample_date).toLocaleDateString("it-IT", { month: "short", year: "2-digit" })
    : (panel.created_at?.slice(0, 7) ?? "n/d");
  return { label, metilazione, detox, riparazione };
}

/** d-ROMs più basso = migliore (score alto). */
function oxidativeRomsScore(val: number | null, demo: number): number {
  if (val == null) return demo;
  return Math.max(10, Math.min(100, 100 - val * 2.2));
}

function oxidativeBapScore(val: number | null, demo: number): number {
  if (val == null) return demo;
  return Math.max(15, Math.min(100, (val / 3500) * 100));
}

function oxidativeStressRadarFromPanel(panel: HealthPanelTimelineRow | undefined) {
  const v = (panel?.values as Record<string, unknown> | null) ?? null;
  const roms = readNum(v, ["roms_carr", "d_roms", "roms", "d_rom"]);
  const bap = readNum(v, ["bap_umol", "bap"]);
  const gsh = readNum(v, ["glutathione", "glutatione", "gsh"]);
  const sod = readNum(v, ["sod"]);
  const cat = readNum(v, ["catalase", "catalasi"]);
  const hasAny = [roms, bap, gsh, sod, cat].some((x) => x != null);
  const d = DEMO_OXIDATIVE_RADAR;
  if (!hasAny) {
    return SHOW_HEALTH_DEMO_FALLBACK_DATA ? { rows: d, isDemo: true as const } : { rows: [], isDemo: false as const };
  }
  return {
    rows: [
      { subject: "d-ROMs ↓", A: oxidativeRomsScore(roms, d[0].A), fullMark: 100 },
      { subject: "BAP ↑", A: oxidativeBapScore(bap, d[1].A), fullMark: 100 },
      { subject: "Glutatione", A: capPercentDisplay(gsh, d[2].A), fullMark: 100 },
      { subject: "SOD", A: capPercentDisplay(sod, d[3].A), fullMark: 100 },
      { subject: "Catalasi", A: capPercentDisplay(cat, d[4].A), fullMark: 100 },
    ],
    isDemo: false as const,
  };
}

function hpaAxisScore(am: number | null, pm: number | null, demo: number): number {
  if (am == null && pm == null) return demo;
  const base = am ?? pm ?? 12;
  const dist = Math.abs(base - 14);
  return Math.max(22, Math.min(100, 100 - dist * 5));
}

function hpgAxisScore(testNgDl: number | null, demo: number): number {
  if (testNgDl == null) return demo;
  if (testNgDl < 200) return 38;
  if (testNgDl > 1000) return 78;
  return Math.min(100, 48 + (testNgDl - 200) / 25);
}

function thyroidAxisScore(tsh: number | null, demo: number): number {
  if (tsh == null) return demo;
  const dist = Math.abs(tsh - 1.4);
  return Math.max(20, Math.min(100, 100 - dist * 28));
}

function dheaAxisScore(dhea: number | null, demo: number): number {
  if (dhea == null) return demo;
  return Math.max(18, Math.min(100, (dhea / 350) * 100));
}

function igfAxisScore(igf: number | null, demo: number): number {
  if (igf == null) return demo;
  return Math.max(20, Math.min(100, (igf / 280) * 100));
}

function endocrineRadarFromPanel(panel: HealthPanelTimelineRow | undefined) {
  const v = (panel?.values as Record<string, unknown> | null) ?? null;
  const am = readNum(v, ["cortisol_am", "cortisol_morning"]);
  const pm = readNum(v, ["cortisol_pm", "cortisol_evening"]);
  const tt = readNum(v, ["testosterone", "testosterone_ng_dl"]);
  const tsh = readNum(v, ["tsh"]);
  const dhea = readNum(v, ["dhea", "dhea_s", "dehydroepiandrosterone"]);
  const igf = readNum(v, ["igf1", "igf_1", "igf-1"]);
  const hasAny = [am, pm, tt, tsh, dhea, igf].some((x) => x != null);
  const d = DEMO_ENDOCRINE_RADAR;
  if (!hasAny) {
    return SHOW_HEALTH_DEMO_FALLBACK_DATA ? { rows: d, isDemo: true as const } : { rows: [], isDemo: false as const };
  }
  return {
    rows: [
      { subject: "Asse HPA", A: hpaAxisScore(am, pm, d[0].A), fullMark: 100 },
      { subject: "Asse HPG", A: hpgAxisScore(tt, d[1].A), fullMark: 100 },
      { subject: "Tiroide", A: thyroidAxisScore(tsh, d[2].A), fullMark: 100 },
      { subject: "Surreni / DHEA", A: dheaAxisScore(dhea, d[3].A), fullMark: 100 },
      { subject: "GH / IGF-1", A: igfAxisScore(igf, d[4].A), fullMark: 100 },
    ],
    isDemo: false as const,
  };
}

function isHormonePanelType(type: string | null | undefined): boolean {
  if (!type) return false;
  const t = type.trim().toLowerCase();
  return t === "hormones" || t === "hormonal" || t === "hormone";
}

function structuredValuesFieldCount(values: Record<string, unknown> | null | undefined): number {
  if (!values || typeof values !== "object") return 0;
  return Object.keys(values).filter((k) => k !== "import").length;
}

function rowFromBloodPanel(panel: HealthPanelTimelineRow): {
  label: string;
  emoglobina: number | null;
  ferritina: number | null;
  vit_d: number | null;
  b12: number | null;
  glicemia: number | null;
} | null {
  const v = panel.values;
  if (!v || typeof v !== "object") return null;
  const rec = v as Record<string, unknown>;
  const emoglobina = readNum(rec, ["emoglobina", "hemoglobin", "hb_g_dl", "hb"]);
  const ferritina = readNum(rec, ["ferritina", "ferritin", "ferritina_ng_ml"]);
  const vit_d = readNum(rec, ["vitamina_d", "vit_d", "vitamin_d", "25_oh_d"]);
  const b12 = readNum(rec, ["b12", "cobalamin", "vit_b12"]);
  const glicemiaMgDl = readNum(rec, ["glicemia", "glucose", "glucosio", "fasting_glucose_mg_dl"]);
  const glicemiaMmol = readNum(rec, ["glucose_mmol_l", "glucose_mmol", "glycemia_mmol_l"]);
  const glicemia = glicemiaMgDl ?? (glicemiaMmol != null ? Number((glicemiaMmol * 18.0182).toFixed(1)) : null);
  if (emoglobina == null && ferritina == null && vit_d == null && b12 == null && glicemia == null) return null;
  const label = panel.sample_date
    ? new Date(panel.sample_date).toLocaleDateString("it-IT", { month: "short", year: "numeric" })
    : (panel.created_at?.slice(0, 7) ?? "n/d");
  return { label, emoglobina, ferritina, vit_d, b12, glicemia };
}

const IMPORT_CARDS = [
  {
    panelType: "blood",
    title: "Esami del Sangue",
    desc: "Emocromo, metaboliti, vitamine, minerali",
    tags: ["Emoglobina", "Ferritina", "Vitamina D", "B12", "Glicemia", "HbA1c"],
    gradient: "from-rose-600 via-rose-500 to-pink-600",
    icon: Droplets,
  },
  {
    panelType: "microbiota",
    title: "Analisi Microbiota",
    desc: "Flora batterica intestinale, disbiosi",
    tags: ["Firmicutes", "Bacteroidetes", "Proteobacteria", "Diversità α", "SCFA"],
    gradient: "from-emerald-600 to-teal-500",
    icon: HeartPulse,
  },
  {
    panelType: "epigenetics",
    title: "Test Epigenetico",
    desc: "Metilazione DNA, espressione genica",
    tags: ["Metilazione", "Età biologica", "Stress ossidativo", "Detox"],
    gradient: "from-violet-600 to-fuchsia-600",
    icon: Dna,
  },
  {
    panelType: "hormones",
    title: "Profilo Ormonale",
    desc: "Cortisolo, testosterone, ormoni tiroidei",
    tags: ["Cortisolo", "Testosterone", "TSH", "T3", "T4", "DHEA"],
    gradient: "from-orange-600 to-red-600",
    icon: Heart,
  },
  {
    panelType: "inflammation",
    title: "Markers Infiammazione",
    desc: "PCR, citochine, omocisteina",
    tags: ["PCR-us", "IL-6", "TNF-α", "Omocisteina", "LDL-ox"],
    gradient: "from-amber-500 to-orange-600",
    icon: AlertTriangle,
  },
  {
    panelType: "oxidative_stress",
    title: "Stress Ossidativo",
    desc: "Radicali liberi, capacità antiossidante",
    tags: ["d-ROMs", "BAP", "Glutatione", "SOD", "Catalasi"],
    gradient: "from-sky-600 to-indigo-700",
    icon: Zap,
  },
] as const;

export default function HealthPageView() {
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [panels, setPanels] = useState<HealthPanelTimelineRow[]>([]);
  const [systemMap, setSystemMap] = useState<HealthSystemMapViewModel>({
    nodes: [],
    edges: [],
    bioenergeticsResponses: [],
    stagingRuns: [],
  });
  const [timelineErr, setTimelineErr] = useState<string | null>(null);
  const [timelineDiag, setTimelineDiag] = useState<HealthTimelineFetchDiagnostics | null>(null);
  const [systemMapErr, setSystemMapErr] = useState<string | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [uploadBusy, setUploadBusy] = useState<string | null>(null);
  const [stagingBusy, setStagingBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sampleDate, setSampleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadTimeline = useCallback(async () => {
    if (!athleteId) {
      setPanels([]);
      setTimelineErr(null);
      setTimelineDiag(null);
      setSystemMap({ nodes: [], edges: [], bioenergeticsResponses: [], stagingRuns: [] });
      setSystemMapErr(null);
      setLoadingTimeline(false);
      return;
    }
    setLoadingTimeline(true);
    const [{ panels: next, error, diagnostics }, { systemMap: nextMap, error: mapErr }] = await Promise.all([
      fetchHealthPanelsTimeline(athleteId),
      fetchHealthSystemMap(athleteId),
    ]);
    setPanels(next);
    setTimelineErr(error);
    setTimelineDiag(diagnostics);
    setSystemMap(nextMap);
    setSystemMapErr(mapErr);
    setLoadingTimeline(false);
  }, [athleteId]);

  useEffect(() => {
    if (ctxLoading) return;
    void loadTimeline();
  }, [ctxLoading, loadTimeline]);

  const bloodChartRows = useMemo(() => {
    const fromDb = panels
      .filter((p) => p.type === "blood")
      .map(rowFromBloodPanel)
      .filter((r): r is NonNullable<typeof r> => r != null)
      .reverse();
    if (fromDb.length >= 2) return fromDb;
    if (!SHOW_HEALTH_DEMO_FALLBACK_DATA) return fromDb.length ? fromDb : [];
    return DEMO_BLOOD_TREND.map((r) => ({
      label: r.label,
      emoglobina: r.emoglobina,
      ferritina: r.ferritina,
      vit_d: r.vit_d,
      b12: r.b12,
      glicemia: r.glicemia,
    }));
  }, [panels]);

  const usingDemoTrend = useMemo(() => {
    const fromDb = panels
      .filter((p) => p.type === "blood")
      .map(rowFromBloodPanel)
      .filter((r): r is NonNullable<typeof r> => r != null);
    return SHOW_HEALTH_DEMO_FALLBACK_DATA && fromDb.length < 2;
  }, [panels]);

  const latestInflammation = useMemo(() => panels.find((p) => p.type === "inflammation"), [panels]);
  const latestMicrobiota = useMemo(() => panels.find((p) => p.type === "microbiota"), [panels]);
  const latestHormones = useMemo(() => panels.find((p) => isHormonePanelType(p.type)), [panels]);
  const latestEpigenetics = useMemo(() => panels.find((p) => p.type === "epigenetics"), [panels]);
  const latestOxidative = useMemo(() => panels.find((p) => p.type === "oxidative_stress"), [panels]);

  const inflammationRadar = useMemo(() => inflammationRadarFromPanel(latestInflammation), [latestInflammation]);
  const microbiotaRadar = useMemo(() => microbiotaRadarFromPanel(latestMicrobiota), [latestMicrobiota]);
  const hormonesBar = useMemo(() => hormonesBarFromPanel(latestHormones), [latestHormones]);
  const epigeneticRings = useMemo(() => epigeneticRingsFromPanel(latestEpigenetics), [latestEpigenetics]);
  const epigeneticRadar = useMemo(() => epigeneticRadarFromPanel(latestEpigenetics), [latestEpigenetics]);
  const epigeneticTrend = useMemo(() => {
    const fromDb = panels
      .filter((p) => p.type === "epigenetics")
      .map(rowFromEpigeneticTrendPanel)
      .filter((r): r is NonNullable<typeof r> => r != null)
      .reverse();
    if (fromDb.length >= 2) return { rows: fromDb, isDemo: false as const };
    if (SHOW_HEALTH_DEMO_FALLBACK_DATA) return { rows: DEMO_EPIGENETIC_TREND, isDemo: true as const };
    return { rows: fromDb, isDemo: false as const };
  }, [panels]);
  const oxidativeRadar = useMemo(() => oxidativeStressRadarFromPanel(latestOxidative), [latestOxidative]);
  const endocrineRadar = useMemo(() => endocrineRadarFromPanel(latestHormones), [latestHormones]);

  const globalScores = useMemo(() => {
    const blood = panels.find((p) => p.type === "blood");
    const micro = panels.find((p) => p.type === "microbiota");
    const epi = panels.find((p) => p.type === "epigenetics");
    const pick = (row: HealthPanelTimelineRow | undefined, keys: string[], demoFallback: number): number | null => {
      const n = readNum((row?.values as Record<string, unknown>) ?? null, keys);
      if (n != null) return Math.round(Math.min(100, Math.max(0, n)));
      return SHOW_HEALTH_DEMO_FALLBACK_DATA ? demoFallback : null;
    };
    return {
      ematici: pick(blood, ["health_score_ematici", "score_ematici"], 92),
      microbiota: pick(micro, ["health_score_microbiota", "score_microbiota", "diversity_score"], 88),
      epigenetica: pick(epi, ["health_score_epigenetica", "score_epigenetica"], 85),
      totale: pick(blood, ["health_score_totale", "score_totale"], 90),
    };
  }, [panels]);

  async function onPickFile(panelType: string, file: File | null) {
    if (!file || !athleteId) return;
    setUploadBusy(panelType);
    setToast(null);
    const res = await uploadHealthDocument({
      athleteId,
      panelType,
      sampleDate,
      file,
    });
    setUploadBusy(null);
    if (!res.ok) {
      setToast(res.error ?? "Errore upload");
      return;
    }
    setToast(res.message ?? "Caricamento registrato.");
    void loadTimeline();
  }

  async function onPatchStagingRun(runId: string, status: HealthStagingRunAction) {
    if (!runId) return;
    setStagingBusy(`${runId}:${status}`);
    setToast(null);
    const res = await patchHealthStagingRun({
      runId,
      status,
      reason:
        status === "committed"
          ? "Validato da Health System Map"
          : status === "rejected"
            ? "Scartato da Health System Map"
            : "Archiviato da Health System Map",
    });
    setStagingBusy(null);
    if (!res.ok) {
      setToast(res.error ?? "Aggiornamento staging fallito");
      return;
    }
    setToast(status === "committed" ? "Staging validato." : status === "rejected" ? "Staging scartato." : "Staging archiviato.");
    void loadTimeline();
  }

  if (ctxLoading) {
    return (
      <div className="min-h-[40vh] px-6 py-16 text-center text-sm text-zinc-500">Caricamento contesto atleta…</div>
    );
  }

  if (!athleteId) {
    return (
      <Pro2ModulePageShell
        eyebrow="Health & Bio"
        eyebrowClassName={moduleEyebrowClass("health")}
        title="Diagnostica e longevità"
        description="Seleziona un atleta attivo (Accesso / Athletes) per importare esami e vedere l’archivio."
      >
        <p className="text-sm text-amber-200/90">Nessun atleta attivo.</p>
      </Pro2ModulePageShell>
    );
  }

  return (
    <Pro2ModulePageShell
      eyebrow="EMPATHY PRO 2.0"
      eyebrowClassName="bg-gradient-to-r from-fuchsia-400 to-orange-400 bg-clip-text text-transparent"
      title="Health & Bio Analysis"
      description={
        <span className="flex flex-wrap items-center gap-2 text-zinc-400">
          <Heart className="inline h-4 w-4 text-rose-400" strokeWidth={2} />
          <span>Diagnostica avanzata · memoria atleta · trend</span>
          <Sparkles className="inline h-4 w-4 text-violet-400" strokeWidth={2} />
        </span>
      }
    >
      <p className="text-center font-mono text-[0.6rem] font-bold uppercase tracking-[0.35em] text-fuchsia-300/90">
        Sangue · Microbiota · Epigenetica · Ormoni · Infiammazione · Stress
      </p>

      <div id="health-import" className="scroll-mt-24">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 py-4 text-sm font-black uppercase tracking-widest text-white shadow-[0_0_40px_rgba(168,85,247,0.35)] transition hover:brightness-110"
          onClick={() => document.getElementById("health-import-grid")?.scrollIntoView({ behavior: "smooth" })}
        >
          <Upload className="h-5 w-5" strokeWidth={2.5} />
          Importazione esami
          <Upload className="h-5 w-5" strokeWidth={2.5} />
        </button>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
            Data campione
            <input
              type="date"
              className="rounded border border-white/10 bg-zinc-900 px-2 py-1 text-white"
              value={sampleDate}
              onChange={(e) => setSampleDate(e.target.value)}
            />
          </label>
          {timelineErr ? <span className="text-amber-400">{timelineErr}</span> : null}
          {loadingTimeline ? <span>Sync archivio…</span> : null}
        </div>
      </div>

      {/* Health score globale */}
      <section
        className="rounded-2xl border border-purple-500/40 bg-gradient-to-b from-purple-950/20 to-black/80 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        aria-label="Health score globale"
      >
        <h2 className="text-center font-mono text-[0.7rem] font-bold uppercase tracking-[0.28em] text-fuchsia-300">
          Health score globale
        </h2>
        {!SHOW_HEALTH_DEMO_FALLBACK_DATA ? (
          <p className="mx-auto mt-3 max-w-lg text-center text-[0.7rem] text-zinc-500">
            In produzione i punteggi sintetici compaiono solo se presenti nei referti caricati — niente valori demo.
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            { k: "Ematici", v: globalScores.ematici, border: "border-red-500/50", bg: "bg-red-950/40", text: "text-rose-200" },
            { k: "Microbiota", v: globalScores.microbiota, border: "border-emerald-500/50", bg: "bg-emerald-950/40", text: "text-emerald-200" },
            { k: "Epigenetica", v: globalScores.epigenetica, border: "border-violet-500/50", bg: "bg-violet-950/40", text: "text-violet-200" },
            { k: "Score totale", v: globalScores.totale, border: "border-orange-500/50", bg: "bg-orange-950/40", text: "text-orange-200" },
          ] satisfies Array<{ k: string; v: number | null; border: string; bg: string; text: string }>).map((c) => (
            <div
              key={c.k}
              className={`rounded-xl border ${c.border} ${c.bg} px-4 py-5 text-center shadow-inner`}
            >
              <div className={`text-3xl font-black ${c.text}`}>{c.v ?? "—"}</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{c.k}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-6">
        <h2 className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.24em] text-cyan-300">
          System map 360 · interazioni cross-area
        </h2>
        <p className="mt-2 text-xs text-zinc-400">
          Nodi, archi causali e risposte bioenergetiche derivati dall&apos;estrazione normalizzata. Staging run incluse per il gate
          di interpretazione.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "Nodi", v: systemMap.nodes.length, border: "border-cyan-500/40", bg: "bg-cyan-950/35", text: "text-cyan-200" },
            { k: "Archi", v: systemMap.edges.length, border: "border-violet-500/40", bg: "bg-violet-950/35", text: "text-violet-200" },
            {
              k: "Bioenergetis",
              v: systemMap.bioenergeticsResponses.length,
              border: "border-amber-500/40",
              bg: "bg-amber-950/35",
              text: "text-amber-200",
            },
            {
              k: "Staging runs",
              v: systemMap.stagingRuns.length,
              border: "border-rose-500/40",
              bg: "bg-rose-950/35",
              text: "text-rose-200",
            },
          ].map((c) => (
            <div key={c.k} className={`rounded-xl border ${c.border} ${c.bg} px-4 py-4 text-center`}>
              <div className={`text-2xl font-black ${c.text}`}>{c.v}</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{c.k}</div>
            </div>
          ))}
        </div>
        {systemMapErr ? <p className="mt-3 text-xs text-amber-300/90">{systemMapErr}</p> : null}
        <details className="mt-4 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Dettaglio nodi e archi
          </summary>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-cyan-300/90">Nodi attivi</p>
              <div className="space-y-2">
                {systemMap.nodes.slice(0, 12).map((n, i) => (
                  <div key={`node-${i}-${String(n.id ?? n.node_key ?? i)}`} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs">
                    <div className="font-semibold text-zinc-100">{String(n.label ?? n.node_key ?? "node")}</div>
                    <div className="text-zinc-400">{String(n.area ?? "area")} · {String(n.observed_at ?? n.created_at ?? "n/d")}</div>
                  </div>
                ))}
                {!systemMap.nodes.length ? <p className="text-xs text-zinc-500">Nessun nodo disponibile.</p> : null}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-violet-300/90">Archi causali</p>
              <div className="space-y-2">
                {systemMap.edges.slice(0, 12).map((e, i) => (
                  <div key={`edge-${i}-${String(e.id ?? i)}`} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs">
                    <div className="font-semibold text-zinc-100">
                      {String(e.from_node_key ?? "?")} → {String(e.to_node_key ?? "?")}
                    </div>
                    <div className="text-zinc-400">
                      {String(e.effect_sign ?? "modulate")} · conf {typeof e.confidence === "number" ? e.confidence.toFixed(2) : "n/d"} ·{" "}
                      {String(e.rule_key ?? "rule-less")}
                    </div>
                  </div>
                ))}
                {!systemMap.edges.length ? <p className="text-xs text-zinc-500">Nessun arco disponibile.</p> : null}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-amber-300/90">Bioenergetis responses</p>
              <div className="space-y-2">
                {systemMap.bioenergeticsResponses.slice(0, 8).map((r, i) => (
                  <div key={`bio-${i}-${String(r.id ?? i)}`} className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-2.5 py-2 text-xs">
                    <div className="font-semibold text-amber-100">{String(r.title ?? r.response_key ?? "response")}</div>
                    <div className="text-amber-200/80">{String(r.category ?? "risk")} · {String(r.severity ?? "n/d")}</div>
                  </div>
                ))}
                {!systemMap.bioenergeticsResponses.length ? <p className="text-xs text-zinc-500">Nessuna risposta bioenergetica.</p> : null}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-rose-300/90">Interpretation staging</p>
              <div className="space-y-2">
                {systemMap.stagingRuns.slice(0, 8).map((s, i) => {
                  const runId = typeof s.id === "string" ? s.id : null;
                  return (
                    <div key={`staging-${i}-${String(s.id ?? i)}`} className="rounded-lg border border-rose-500/25 bg-rose-950/20 px-2.5 py-2 text-xs">
                      <div className="font-semibold text-rose-100">{String(s.domain ?? "domain")} · {String(s.status ?? "status")}</div>
                      <div className="text-rose-200/80">
                        conf {typeof s.confidence === "number" ? s.confidence.toFixed(2) : "n/d"} · {String(s.created_at ?? "n/d")}
                      </div>
                      {runId ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {[
                            { status: "committed" as const, label: "Valida" },
                            { status: "rejected" as const, label: "Scarta" },
                            { status: "archived" as const, label: "Archivia" },
                          ].map((action) => {
                            const busy = stagingBusy === `${runId}:${action.status}`;
                            return (
                              <button
                                key={action.status}
                                type="button"
                                disabled={Boolean(stagingBusy)}
                                onClick={() => void onPatchStagingRun(runId, action.status)}
                                className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-100 transition hover:border-rose-300/50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {busy ? "..." : action.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {!systemMap.stagingRuns.length ? <p className="text-xs text-zinc-500">Nessuna run staging recente.</p> : null}
              </div>
            </div>
          </div>
        </details>
      </section>

      {/* Griglia importazione */}
      <div id="health-import-grid" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 scroll-mt-24">
        {IMPORT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.panelType}
              className="flex flex-col overflow-hidden rounded-2xl border border-purple-500/25 bg-black/50 shadow-[0_0_0_1px_rgba(168,85,247,0.08)]"
            >
              <div
                className={`flex items-center gap-2 bg-gradient-to-r px-4 py-3 ${card.gradient}`}
              >
                <Icon className="h-5 w-5 text-white" strokeWidth={2} />
                <h3 className="text-sm font-bold uppercase tracking-wide text-white">{card.title}</h3>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-xs text-zinc-400">{card.desc}</p>
                <p className="mt-3 font-mono text-[0.55rem] font-bold uppercase tracking-wider text-zinc-500">
                  Parametri analizzati
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {card.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-purple-500/30 bg-purple-950/30 px-2 py-0.5 text-[10px] text-zinc-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <input
                  ref={(el) => {
                    fileRefs.current[card.panelType] = el;
                  }}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    void onPickFile(card.panelType, f ?? null);
                    e.target.value = "";
                  }}
                />
                <Pro2Button
                  type="button"
                  variant="secondary"
                  className="mt-auto w-full justify-center border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-600/80 to-pink-600/80 text-white hover:brightness-110"
                  disabled={uploadBusy === card.panelType}
                  onClick={() => fileRefs.current[card.panelType]?.click()}
                >
                  {uploadBusy === card.panelType ? (
                    "Invio…"
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Carica esame
                    </>
                  )}
                </Pro2Button>
              </div>
            </article>
          );
        })}
      </div>

      {toast ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-4 py-2 text-center text-sm text-emerald-200">
          {toast}
        </p>
      ) : null}

      {/* Epigenetica — anelli + radar pathway + trend */}
      <section className="space-y-6 rounded-2xl border border-violet-500/30 bg-black/40 p-6">
        <div>
          <div className="mb-1 flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
            <Dna className="h-5 w-5 text-violet-400" />
            <h2 className="text-lg font-bold text-violet-200">Epigenetica · metilazione e pathway</h2>
          </div>
          <p className="text-xs text-zinc-500">
            Anelli percentuali, radar sintetico e trend temporale (da panel <code className="text-violet-300/90">epigenetics</code>).
            {epigeneticRadar.isDemo && epigeneticTrend.isDemo ? " Dati demo finché mancano valori strutturati." : ""}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-violet-300/90">
              Profilo a ciambelle
            </h3>
            <div className="h-[260px] w-full">
              {epigeneticRings.length === 0 ? (
                <p className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
                  Carica un panel <code className="mx-1 text-violet-300/90">epigenetics</code> per questo profilo.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="20%"
                    outerRadius="100%"
                    data={epigeneticRings.map((r) => ({ ...r, fill: r.fill }))}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar background dataKey="value" cornerRadius={6} />
                    <Tooltip
                      formatter={(v: number) => [`${v}%`, ""]}
                      contentStyle={{ background: "#0a0a0c", border: "1px solid rgba(167,139,250,0.35)" }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {epigeneticRings.map((r) => (
                <div
                  key={r.name}
                  className="rounded-lg border border-white/10 px-2 py-2 text-center"
                  style={{ borderColor: `${r.fill}55` }}
                >
                  <div className="text-[10px] uppercase text-zinc-500">{r.name}</div>
                  <div className="text-lg font-black" style={{ color: r.fill }}>
                    {r.value}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-violet-300/90">
              Pathway · radar
            </h3>
            <div className="h-[300px] w-full">
              {epigeneticRadar.rows.length === 0 ? (
                <p className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
                  Nessun dato numerico epigenetico strutturato — importa un referto{' '}
                  <code className="mx-1 text-violet-300/90">epigenetics</code>.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="78%" data={epigeneticRadar.rows}>
                    <PolarGrid stroke="rgba(255,255,255,0.12)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#c4b5fd", fontSize: 9 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 9 }} />
                    <Radar name="Score" dataKey="A" stroke="#a855f7" fill="#a855f7" fillOpacity={0.35} strokeWidth={2} />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0c", border: "1px solid rgba(168,85,247,0.4)" }}
                      formatter={(v: number) => [`${Math.round(v)}`, ""]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-fuchsia-300/90">
            Trend metilazione / detox / riparazione
            {epigeneticTrend.isDemo ? " (demo)" : ""}
          </h3>
          <div className="h-[260px] w-full">
            {epigeneticTrend.rows.length === 0 ? (
              <p className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
                Servono almeno due estrazioni epigenetiche con metilazione / detox / riparazione per il trend.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={epigeneticTrend.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="epiMeth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="epiDetox" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="epiRep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#0a0a0c", border: "1px solid rgba(217,70,239,0.35)" }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="metilazione"
                  name="Metilazione"
                  stroke="#a855f7"
                  fill="url(#epiMeth)"
                  strokeWidth={2}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="detox"
                  name="Detox"
                  stroke="#22c55e"
                  fill="url(#epiDetox)"
                  strokeWidth={2}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="riparazione"
                  name="Riparazione"
                  stroke="#3b82f6"
                  fill="url(#epiRep)"
                  strokeWidth={2}
                  connectNulls
                />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Endocrino — radar equilibrio + bar referto */}
      <section className="rounded-2xl border border-orange-500/35 bg-black/40 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Heart className="h-5 w-5 text-orange-400" />
          <h2 className="text-lg font-bold text-orange-200">Sistema endocrino</h2>
        </div>
        <p className="text-xs text-zinc-500">
          Radar funzionale (HPA, HPG, tiroide, DHEA, IGF-1) e barre con valori di referto dal panel{" "}
          <code className="text-orange-300/90">hormones</code>.
          {endocrineRadar.isDemo && hormonesBar.isDemo ? " Dati demo finché mancano numeri." : ""}
        </p>
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-orange-300/90">
              Equilibrio assi
            </h3>
            <div className="h-[300px] w-full">
              {endocrineRadar.rows.length === 0 ? (
                <p className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
                  Carica un panel <code className="mx-1 text-orange-200/90">hormones</code> con numeri strutturati.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="78%" data={endocrineRadar.rows}>
                    <PolarGrid stroke="rgba(255,255,255,0.12)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#fdba74", fontSize: 9 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 9 }} />
                    <Radar name="Score" dataKey="A" stroke="#fb923c" fill="#fb923c" fillOpacity={0.32} strokeWidth={2} />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0c", border: "1px solid rgba(251,146,60,0.4)" }}
                      formatter={(v: number) => [`${Math.round(v)}`, ""]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-orange-300/90">
              Valori ormonali (referto)
            </h3>
            <div className="h-[300px] w-full">
              {hormonesBar.rows.length === 0 ? (
                <p className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
                  Nessun dato ormonale strutturato — importa un referto <code className="mx-1 text-orange-200/90">hormones</code>.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hormonesBar.rows} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 9 }} angle={-20} textAnchor="end" height={64} />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0c", border: "1px solid rgba(249,115,22,0.35)" }}
                      formatter={(v: number) => [v, ""]}
                    />
                    <Bar dataKey="val" name="Valore" fill="#ea580c" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stress ossidativo — radar */}
      <section className="rounded-2xl border border-sky-500/35 bg-black/40 p-6">
        <div className="mb-2 flex items-center gap-2">
          <Zap className="h-5 w-5 text-sky-400" />
          <h2 className="text-lg font-bold text-sky-200">Stress ossidativo · capacità antiossidante</h2>
        </div>
        <p className="text-xs text-zinc-500">
          d-ROMs, BAP, glutatione, enzimi (panel <code className="text-sky-300/90">oxidative_stress</code>).{" "}
          {oxidativeRadar.isDemo ? "Demo finché mancano valori." : ""}
        </p>
        <div className="mt-4 h-[300px] w-full max-w-lg mx-auto">
          {oxidativeRadar.rows.length === 0 ? (
            <p className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
              Carica un panel <code className="mx-1 text-sky-300">oxidative_stress</code> per vedere questo radar.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="78%" data={oxidativeRadar.rows}>
                <PolarGrid stroke="rgba(255,255,255,0.12)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#7dd3fc", fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 9 }} />
                <Radar name="Score" dataKey="A" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.35} strokeWidth={2} />
                <Tooltip
                  contentStyle={{ background: "#0a0a0c", border: "1px solid rgba(56,189,248,0.4)" }}
                  formatter={(v: number) => [`${Math.round(v)}`, ""]}
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Infiammazione — radar */}
      <section className="rounded-2xl border border-amber-500/30 bg-black/40 p-6">
        <div className="mb-2 flex items-center gap-2">
          <Flame className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-bold text-amber-200">Markers infiammatori</h2>
        </div>
        <p className="text-xs text-zinc-500">
          Radar · score sintetico (valori bassi = migliore){" "}
          {inflammationRadar.isDemo ? "— demo finché manca un panel `inflammation` con numeri" : ""}
        </p>
        <div className="mt-4 h-[300px] w-full max-w-lg mx-auto">
          {inflammationRadar.rows.length === 0 ? (
            <p className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
              Carica un panel <code className="mx-1 text-amber-200/90">inflammation</code> per questo grafico.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="78%" data={inflammationRadar.rows}>
                <PolarGrid stroke="rgba(255,255,255,0.12)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 9 }} />
                <Radar name="Score" dataKey="A" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.35} strokeWidth={2} />
                <Tooltip
                  contentStyle={{ background: "#0a0a0c", border: "1px solid rgba(245,158,11,0.35)" }}
                  formatter={(v: number) => [`${Math.round(v)}`, ""]}
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Microbiota — radar */}
      <section className="rounded-2xl border border-emerald-500/30 bg-black/40 p-6">
        <div className="mb-2 flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-emerald-200">Composizione microbiota</h2>
        </div>
        <p className="text-xs text-zinc-500">
          Percentuali / diversità (asse 0–100){" "}
          {microbiotaRadar.isDemo ? "— demo finché manca un panel `microbiota` con numeri" : ""}
        </p>
        <div className="mt-4 h-[300px] w-full max-w-lg mx-auto">
          {microbiotaRadar.rows.length === 0 ? (
            <p className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
              Carica un panel <code className="mx-1 text-emerald-200/90">microbiota</code> per questo grafico.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="78%" data={microbiotaRadar.rows}>
                <PolarGrid stroke="rgba(255,255,255,0.12)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 9 }} />
                <Radar name="Valore" dataKey="A" stroke="#34d399" fill="#34d399" fillOpacity={0.35} strokeWidth={2} />
                <Tooltip
                  contentStyle={{ background: "#0a0a0c", border: "1px solid rgba(52,211,153,0.35)" }}
                  formatter={(v: number) => [`${Math.round(v)}`, ""]}
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Storico + andamento ematici */}
      <section id="health-storico" className="scroll-mt-24 space-y-4">
        <div className="rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-3 text-center shadow-lg">
          <h2 className="flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest text-white">
            <Activity className="h-5 w-5" />
            Storico esami del sangue
            <Activity className="h-5 w-5" />
          </h2>
        </div>

        <div className="rounded-2xl border border-rose-500/25 bg-black/50 p-5">
          <h3 className="text-base font-bold text-pink-400">Andamento parametri ematici</h3>
          <p className="text-xs text-zinc-500">Ultimi 6 mesi · valori principali {usingDemoTrend ? "(demo finché mancano ≥2 punti reali)" : ""}</p>
          <div className="mt-4 h-[320px] w-full">
            {bloodChartRows.length === 0 ? (
              <p className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
                Servono almeno due punti ematici strutturati per il grafico — importa panel <code className="mx-1 text-rose-200/90">blood</code>.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bloodChartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0c", border: "1px solid rgba(244,63,94,0.35)" }}
                    labelStyle={{ color: "#fda4af" }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="emoglobina" name="Emoglobina (g/dL)" stroke="#f87171" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="ferritina" name="Ferritina (ng/mL)" stroke="#fb923c" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="vit_d" name="Vit. D (ng/mL)" stroke="#eab308" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="b12" name="B12 (pg/mL)" stroke="#4ade80" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="glicemia" name="Glicemia (mg/dL)" stroke="#60a5fa" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Archivio referti (fine pagina) */}
      <section className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5" aria-label="Archivio referti">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-cyan-400">Archivio referti</h3>
          {athleteId ? (
            <span
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400"
              title={`athleteId attivo: ${athleteId}`}
            >
              athlete: {athleteId.slice(0, 8)}…
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Pannelli da <code className="text-zinc-400">biomarker_panels</code> per l&apos;atleta attivo
          {!loadingTimeline && !timelineErr ? ` · ${panels.length} in memoria` : ""}.
        </p>
        <ul className="mt-4 divide-y divide-white/10">
          {loadingTimeline ? (
            <li className="py-6 text-center text-sm text-zinc-500">Caricamento archivio…</li>
          ) : null}
          {!loadingTimeline && timelineErr ? (
            <li className="py-4" role="alert">
              <p className="rounded-lg border border-amber-500/35 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
                Lettura archivio non riuscita: {timelineErr}
              </p>
              {timelineDiag ? (
                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                  {timelineDiag.requestedAthleteId ? (
                    <p>
                      Atleta richiesto:{" "}
                      <code className="text-zinc-300">{timelineDiag.requestedAthleteId}</code>
                    </p>
                  ) : null}
                  {timelineDiag.userProfileAthleteId &&
                  timelineDiag.userProfileAthleteId !== timelineDiag.requestedAthleteId ? (
                    <p className="text-amber-300/90">
                      Atleta collegato al tuo profilo:{" "}
                      <code className="text-amber-100">{timelineDiag.userProfileAthleteId}</code>{" "}
                      — l&apos;atleta attivo nella UI non corrisponde. Apri Athletes / Accesso e
                      seleziona quello con i referti, oppure rilancia il seed SQL su{" "}
                      <code className="text-amber-100">{timelineDiag.requestedAthleteId}</code>.
                    </p>
                  ) : null}
                  {timelineDiag.errorCode ? (
                    <p className="text-zinc-600">
                      Codice: <code className="text-zinc-400">{timelineDiag.errorCode}</code>
                      {typeof timelineDiag.httpStatus === "number"
                        ? ` · HTTP ${timelineDiag.httpStatus}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">
                  Se il problema persiste, esci e rientra oppure verifica che l&apos;atleta selezionato sia quello con i referti in
                  database.
                </p>
              )}
              <Pro2Button
                type="button"
                variant="secondary"
                className="mt-3 border-white/15 text-xs"
                onClick={() => void loadTimeline()}
              >
                Riprova
              </Pro2Button>
            </li>
          ) : null}
          {!loadingTimeline && !timelineErr && panels.length === 0 ? (
            <li className="py-6 text-center text-sm text-zinc-500">
              Nessun referto in archivio per questo atleta. Usa «Carica esame» sopra, oppure applica lo seed SQL sullo stesso{" "}
              <code className="text-zinc-400">athlete_id</code> attivo
              {athleteId ? (
                <>
                  {" "}(<code className="text-zinc-400">{athleteId}</code>)
                </>
              ) : null}
              .
            </li>
          ) : null}
          {!loadingTimeline &&
            panels.map((p) => {
              const vals = (p.values ?? null) as Record<string, unknown> | null;
              const imp = vals?.import as { filename?: string; status?: string; storage_path?: string } | undefined;
              const nFields = structuredValuesFieldCount(vals);
              return (
                <li
                  key={p.id}
                  className="grid gap-2 py-4 text-sm sm:grid-cols-[minmax(0,1.25fr)_auto_minmax(0,1fr)] sm:items-start sm:gap-x-4"
                >
                  <div className="min-w-0">
                    <div className="font-semibold capitalize text-white">{p.type}</div>
                    <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-zinc-500" title={p.source ?? ""}>
                      {p.source ? `Sorgente: ${p.source}` : "Sorgente: —"}
                    </div>
                  </div>
                  <div className="whitespace-nowrap font-mono text-xs text-zinc-400">
                    {p.sample_date ?? p.reported_at?.slice(0, 10) ?? p.created_at?.slice(0, 10) ?? "—"}
                  </div>
                  <div className="min-w-0 break-words text-xs text-zinc-400">
                    {imp?.filename ? (
                      <>
                        <span className="text-zinc-200">{imp.filename}</span>
                        <span className="text-zinc-500"> · {imp.status ?? "—"}</span>
                        {imp.storage_path ? <span className="block truncate text-zinc-600">{imp.storage_path}</span> : null}
                      </>
                    ) : (
                      <span>
                        Valori strutturati{nFields > 0 ? ` · ${nFields} campi` : ""}
                        {nFields === 0 ? " (payload vuoto o solo import)" : ""}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
        </ul>
      </section>
    </Pro2ModulePageShell>
  );
}
