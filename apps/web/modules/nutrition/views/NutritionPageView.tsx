"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { cn } from "@/lib/cn";
import { NutritionSubnav } from "@/components/nutrition/NutritionSubnav";
import { SessionKnowledgeSummary } from "@/components/nutrition/SessionKnowledgeSummary";
import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type {
  AdaptationGuidance,
  AthleteMemory,
  LifestyleActivityClass,
  NutritionDailyEnergyModel,
  PhysiologyState,
} from "@/lib/empathy/schemas";
import { buildOperationalDynamicsLines } from "@/lib/platform/operational-dynamics-lines";
import {
  computeNutritionDailyEnergyModel,
  normalizeLifestyleActivityClass,
} from "@/lib/nutrition/daily-energy-solver";
import {
  assignPathwayTargetsToMealSlots,
  catalogIdsForSlot,
  collectSearchQueriesForSlot,
  type PathwayMealSlotKey,
} from "@/lib/nutrition/pathway-meal-usda-slots";
import { fetchUsdaFoodsForCatalogIds } from "@/modules/nutrition/services/pathway-meal-usda-client";
import { buildNutritionPathwayModulationViewModel } from "@/lib/nutrition/pathway-modulation-model";
import { buildFunctionalFoodRecommendationsViewModel } from "@/lib/nutrition/functional-food-recommendations";
import { buildEffectiveDayTrainingContext } from "@/lib/training/day-reality-context";
import {
  fetchNutritionModuleContext,
  type NutritionPlannedWorkoutRow,
} from "@/modules/nutrition/services/nutrition-module-api";
import type {
  FunctionalFoodRecommendationsViewModel,
  FunctionalFoodTargetViewModel,
  NutritionMetabolicEfficiencyGenerativeViewModel,
  NutritionPathwayModulationViewModel,
  NutritionPerformanceIntegrationDials,
  UsdaRichFoodItemViewModel,
} from "@/api/nutrition/contracts";
import type {
  TrainingAdaptationLoopViewModel,
  TrainingBioenergeticModulationViewModel,
} from "@/api/training/contracts";
import {
  buildFuelingMediaKeyCandidates,
  FUELING_PRODUCT_CATALOG,
  type FuelingCategory,
  type FuelingFunctionalFocus,
  type FuelingProduct,
} from "@/lib/nutrition/fueling-product-catalog";
import { resolveFuelingPro2MediaUrlFromCandidates } from "@/lib/nutrition/fueling-pro2-media-manifest";
import {
  fetchNutritionMediaRows,
  saveNutritionProfileConfig,
  saveNutritionDeviceExport,
  saveNutritionLookupItem,
} from "@/modules/nutrition/services/nutrition-actions-api";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { FoodDiaryPanel } from "@/modules/nutrition/components/FoodDiaryPanel";
import {
  NutritionMicronutrientGrid,
  mealPlanDayTotalsToMicroLines,
  pathwayNutrientSummaryToMicroLines,
} from "@/modules/nutrition/components/NutritionMicronutrientGrid";
import { buildIntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-request-builder";
import {
  MEAL_SLOT_ORDER,
  type IntelligentMealPlanResponseBody,
  type MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import { buildNutritionAdaptationSectorBoxes } from "@/lib/nutrition/nutrition-adaptation-sector-strip";
import {
  NutritionMealPlanDailyTargets,
  NutritionMealPlanLeadPanels,
  NutritionMealPlanWorkspace,
} from "@/modules/nutrition/views/NutritionMealPlanView";
import type { MealPathwaySlotBundle } from "@/modules/nutrition/types/meal-pathway-slot-bundle";
import { fetchIntelligentMealPlan } from "@/modules/nutrition/services/intelligent-meal-plan-api";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { updateProfilePayload } from "@/modules/profile/services/profile-api";
import type { FoodDiaryComplianceRow } from "@/modules/nutrition/services/food-diary-api";
import {
  aggregateStapleCountsForWeek,
  isoWeekBucketId,
  readMealRotationWeekPayload,
  recordPlanDayStaples,
} from "@/lib/nutrition/meal-rotation-week-cache";

type AthleteNutritionRow = {
  id: string;
  birth_date: string | null;
  sex: string | null;
  diet_type: string | null;
  intolerances: string[] | null;
  allergies: string[] | null;
  food_preferences: string[] | null;
  food_exclusions: string[] | null;
  supplements: string[] | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  lifestyle_activity_class: LifestyleActivityClass | null;
  routine_config: Record<string, unknown> | null;
  nutrition_config: Record<string, unknown> | null;
  supplement_config: Record<string, unknown> | null;
};

type PhysioRow = {
  athlete_id: string;
  ftp_watts: number | null;
  lt1_watts: number | null;
  lt2_watts: number | null;
  v_lamax: number | null;
  vo2max_ml_min_kg: number | null;
  baseline_hrv_ms?: number | null;
};

type TwinStateRow = {
  readiness?: number;
  fatigueAcute?: number;
  glycogenStatus?: number;
  adaptationScore?: number;
  redoxStressIndex?: number;
  inflammationRisk?: number;
};

type RecoverySummaryRow = {
  status: "good" | "moderate" | "poor" | "unknown";
  guidance: string;
  sleepScore: number | null;
  readinessScore: number | null;
  recoveryScore: number | null;
  hrvMs: number | null;
  restingHrBpm: number | null;
  sleepDurationHours: number | null;
  strainScore: number | null;
  sourceDate: string | null;
  provider: string | null;
  importedAt: string | null;
};

type ExecutedRow = {
  id: string;
  date: string;
  duration_minutes: number;
  tss: number;
  kcal?: number | null;
  kj?: number | null;
  trace_summary?: Record<string, unknown> | null;
  lactate_mmoll: number | null;
  glucose_mmol: number | null;
  smo2: number | null;
};

type PlannedRow = NutritionPlannedWorkoutRow & {
  id: string;
  date: string;
  type: string | null;
  duration_minutes: number;
  tss_target: number | null;
  kcal_target: number | null;
  notes: string | null;
};

/** Palette grafico fueling / glicogeno (solo tema Pro 2 dark cyber). */
const FUELING_CHART_THEME_PRO2 = {
  areaTop: "#38bdf8",
  areaBottom: "#2563eb",
  line: "#22d3ee",
  dot: "#f472b6",
  text: "rgba(226,232,240,0.95)",
  axis: "rgba(148,163,184,0.7)",
  zoneGreen: "rgba(34,197,94,0.2)",
  zoneYellow: "rgba(250,204,21,0.2)",
  zoneRed: "rgba(244,63,94,0.18)",
} as const;

type FoodLookupItem = {
  source: "internal" | "openfoodfacts" | "usda";
  fdcId?: number | null;
  label: string;
  brand: string | null;
  kcal_100: number | null;
  carbs_100: number | null;
  protein_100: number | null;
  fat_100: number | null;
  sodium_mg_100: number | null;
};

type GarminFuelingStep = {
  phase: string;
  minute_offset: number;
  icon: string;
  protocol: string;
  cho_g: number;
  hydration_ml: number;
  notes: string;
};

type FuelingSlot = {
  phase: string;
  time: string;
  icon: string;
  plan: string;
  cho: number;
  fluid: number;
  notes: string;
  category: FuelingCategory;
};

type MediaAssetRow = {
  entity_type?: "meal" | "fueling" | "exercise";
  entity_key: string;
  media_kind: "image" | "video" | "gif";
  url: string;
  active: boolean;
  sort_order: number;
};

function mapAthleteMemoryToNutritionProfile(memory: AthleteMemory | null | undefined): AthleteNutritionRow | null {
  const profile = memory?.profile;
  if (!profile) return null;
  return {
    id: profile.id,
    birth_date: profile.birthDate ?? null,
    sex: profile.sex ?? null,
    diet_type: profile.dietType ?? null,
    intolerances: profile.intolerances ?? null,
    allergies: profile.allergies ?? null,
    food_preferences: profile.foodPreferences ?? null,
    food_exclusions: profile.foodExclusions ?? null,
    supplements: profile.supplements ?? null,
    height_cm: profile.heightCm ?? null,
    weight_kg: profile.weightKg ?? null,
    body_fat_pct: profile.bodyFatPct ?? null,
    muscle_mass_kg: profile.muscleMassKg ?? null,
    lifestyle_activity_class: profile.lifestyleActivityClass ?? null,
    routine_config: profile.routineConfig ?? null,
    nutrition_config: profile.nutritionConfig ?? null,
    supplement_config: profile.supplementConfig ?? null,
  };
}

function mapAthleteMemoryToPhysio(memory: AthleteMemory | null | undefined): PhysioRow | null {
  const physiology = memory?.physiology;
  if (!physiology) return null;
  return {
    athlete_id: physiology.athleteId,
    ftp_watts: physiology.physiologicalProfile.ftpWatts ?? null,
    lt1_watts: physiology.physiologicalProfile.lt1Watts ?? null,
    lt2_watts: physiology.physiologicalProfile.lt2Watts ?? null,
    v_lamax: physiology.physiologicalProfile.vLamax ?? null,
    vo2max_ml_min_kg: physiology.physiologicalProfile.vo2maxMlMinKg ?? null,
    baseline_hrv_ms: physiology.physiologicalProfile.baselineHrvMs ?? null,
  };
}

const SPORTS = ["Running", "Ciclismo", "Nuoto", "XC Ski", "Triathlon", "Canoa", "MTB"];

export type NutritionSubRoute = "meal-plan" | "fueling" | "integration" | "predictor" | "diary";

const BRAND_ALIASES: Array<{ label: string; aliases: string[] }> = [
  { label: "Enervit", aliases: ["enervit"] },
  { label: "Maurten", aliases: ["maurten"] },
  { label: "SiS", aliases: ["sis", "science in sport", "scienceinsport"] },
  { label: "+Watt", aliases: ["+watt", "watt", "plus watt"] },
  { label: "Powerbar", aliases: ["powerbar", "power bar"] },
];

function isTrustedFuelingImage(url: string | undefined | null): boolean {
  if (!url) return false;
  const value = url.toLowerCase();
  if (value.includes("unsplash.com") || value.includes("pexels.com") || value.includes("pixabay.com")) return false;
  return (
    value.includes("enervit") ||
    value.includes("maurten") ||
    value.includes("scienceinsport") ||
    value.includes("precisionhydration") ||
    value.includes("namedsport") ||
    value.includes("neversecond") ||
    value.includes("watt.it") ||
    value.includes("powerbar")
  );
}

function buildFuelingPackshot(
  brand: string,
  product: string,
  category: string,
  format?: string,
): string {
  const palette: Record<string, { bg: string; fg: string; accent: string; accentSoft: string }> = {
    Enervit: { bg: "#12090c", fg: "#fff7fa", accent: "#ff355e", accentSoft: "#ffd400" },
    Maurten: { bg: "#0d1014", fg: "#f8fafc", accent: "#c7d2fe", accentSoft: "#60a5fa" },
    SiS: { bg: "#09101d", fg: "#f8fafc", accent: "#38bdf8", accentSoft: "#8b5cf6" },
    "+Watt": { bg: "#14100c", fg: "#fffaf0", accent: "#f59e0b", accentSoft: "#fb7185" },
    Powerbar: { bg: "#140b10", fg: "#fff7ed", accent: "#ef4444", accentSoft: "#fbbf24" },
    "Precision Fuel & Hydration": { bg: "#0d1117", fg: "#f8fafc", accent: "#f97316", accentSoft: "#facc15" },
    "Named Sport": { bg: "#0b1215", fg: "#f1f5f9", accent: "#22c55e", accentSoft: "#38bdf8" },
    Neversecond: { bg: "#111318", fg: "#f8fafc", accent: "#e2e8f0", accentSoft: "#a855f7" },
  };
  const tone = palette[brand] ?? { bg: "#111827", fg: "#f9fafb", accent: "#fb923c", accentSoft: "#60a5fa" };
  const title = product.length > 28 ? `${product.slice(0, 28)}...` : product;
  const formatLabel = (format ?? category).toUpperCase();
  const pack =
    format === "gel"
      ? `<path d='M770 176 h138 l40 86 v290 l-40 78 h-138 l-40 -78 v-290 z' fill='#101317' stroke='${tone.accent}' stroke-width='8' />
         <rect x='760' y='232' width='158' height='236' rx='20' fill='${tone.accent}' />
         <rect x='760' y='468' width='158' height='54' rx='12' fill='${tone.accentSoft}' />`
      : format === "bar"
        ? `<rect x='684' y='270' width='298' height='168' rx='28' fill='#12161d' stroke='${tone.accent}' stroke-width='8' />
           <rect x='712' y='294' width='242' height='64' rx='14' fill='${tone.accent}' />
           <rect x='712' y='370' width='162' height='34' rx='10' fill='${tone.accentSoft}' />`
        : `<rect x='734' y='156' width='182' height='472' rx='36' fill='#0c1016' stroke='${tone.accent}' stroke-width='8' />
           <rect x='758' y='214' width='134' height='244' rx='24' fill='${tone.accent}' />
           <rect x='758' y='476' width='134' height='72' rx='18' fill='${tone.accentSoft}' />
           <ellipse cx='825' cy='156' rx='76' ry='20' fill='#20252d' />`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800' viewBox='0 0 1200 800'>
  <defs>
    <linearGradient id='bg' x1='0' x2='1' y1='0' y2='1'>
      <stop offset='0%' stop-color='${tone.bg}'/>
      <stop offset='100%' stop-color='#111827'/>
    </linearGradient>
    <linearGradient id='glow' x1='0' x2='1'>
      <stop offset='0%' stop-color='${tone.accent}' stop-opacity='0.95'/>
      <stop offset='100%' stop-color='${tone.accentSoft}' stop-opacity='0.95'/>
    </linearGradient>
  </defs>
  <rect width='1200' height='800' rx='48' fill='url(#bg)'/>
  <circle cx='930' cy='160' r='180' fill='${tone.accent}' opacity='0.12'/>
  <circle cx='250' cy='640' r='220' fill='${tone.accentSoft}' opacity='0.08'/>
  <rect x='58' y='58' width='1084' height='684' rx='34' fill='none' stroke='${tone.accent}' stroke-opacity='0.45' stroke-width='3'/>
  <text x='108' y='170' fill='${tone.fg}' font-family='Arial, Helvetica, sans-serif' font-size='56' font-weight='700'>${brand}</text>
  <text x='108' y='228' fill='url(#glow)' font-family='Arial, Helvetica, sans-serif' font-size='28' font-weight='700'>${category.toUpperCase()} · ${formatLabel}</text>
  <text x='108' y='304' fill='${tone.fg}' font-family='Arial, Helvetica, sans-serif' font-size='42' font-weight='700'>${title}</text>
  <text x='108' y='364' fill='#d6dde7' font-family='Arial, Helvetica, sans-serif' font-size='22'>Fueling visual fallback · official click-through preserved</text>
  <rect x='108' y='426' width='262' height='44' rx='999' fill='${tone.accent}' opacity='0.16' stroke='${tone.accent}' stroke-opacity='0.45'/>
  <text x='136' y='455' fill='${tone.fg}' font-family='Arial, Helvetica, sans-serif' font-size='20' font-weight='700'>EMPATHY FUELING ASSET</text>
  ${pack}
  <rect x='666' y='648' width='318' height='28' rx='14' fill='#000000' opacity='0.28'/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function resolveFuelingProductImage(
  product: FuelingProduct | undefined,
  category: FuelingCategory,
  fuelingMediaByKey: Record<string, string>,
) {
  const keyCandidates = buildFuelingMediaKeyCandidates(product, category);
  const pro2Local = resolveFuelingPro2MediaUrlFromCandidates(keyCandidates);
  const mediaCandidate =
    keyCandidates.map((key) => fuelingMediaByKey[key]).find(Boolean)
    ?? pro2Local
    ?? product?.imageUrl;
  const trustedImage = isTrustedFuelingImage(mediaCandidate) ? mediaCandidate : null;
  const logoFallback = product?.logoDomain ? `https://logo.clearbit.com/${product.logoDomain}` : null;
  const brandedPackshotFallback = buildFuelingPackshot(
    product?.brand ?? "Fuel Brand",
    product?.product ?? "Fuel Product",
    category,
    product?.format,
  );
  const displayImage = trustedImage ?? logoFallback ?? brandedPackshotFallback;
  return {
    displayImage,
    isLogoFallback: !trustedImage && displayImage === logoFallback,
  };
}

function parseFuelingMinuteOffset(timeLabel: string): number {
  const match = timeLabel.match(/([+-]?\d+)/);
  return match ? Number(match[1]) : 0;
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return "";
  if (points.length < 3) return `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function n(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  }
  return fallback;
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function round(v: number, digits = 0) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

function fuelingPhaseColor(phase: string): string {
  const p = phase.toLowerCase();
  if (p.includes("pre")) return "#e879f9";
  if (p.includes("post")) return "#4ade80";
  return "#fb923c";
}

function portionHintForMealKcal(mealKcal: number, refKcal = 750): string {
  if (!Number.isFinite(mealKcal) || mealKcal <= 0) return "";
  const f = mealKcal / refKcal;
  if (f > 1.12) return "Porzioni orientate al surplus kcal del giorno.";
  if (f < 0.88) return "Porzioni orientate a giornata più leggera.";
  return "Allinea porzioni al target kcal del pasto.";
}

function nutritionToneForLabel(label: string): "amber" | "cyan" | "green" | "rose" | "slate" {
  const normalized = label.toLowerCase();
  if (normalized.includes("cho") || normalized.includes("glycogen") || normalized.includes("tier")) return "amber";
  if (normalized.includes("fluid") || normalized.includes("hydration") || normalized.includes("power")) return "cyan";
  if (normalized.includes("score") || normalized.includes("coverage") || normalized.includes("protein")) return "green";
  if (normalized.includes("risk") || normalized.includes("esaur") || normalized.includes("redox")) return "rose";
  return "slate";
}

export default function NutritionPageView({ subRoute }: { subRoute: NutritionSubRoute }) {
  const router = useRouter();
  const { athleteId, role, loading: athleteLoading } = useActiveAthlete();
  const [profile, setProfile] = useState<AthleteNutritionRow | null>(null);
  const [physio, setPhysio] = useState<PhysioRow | null>(null);
  const [physiologyState, setPhysiologyState] = useState<PhysiologyState | null>(null);
  const [twinState, setTwinState] = useState<TwinStateRow | null>(null);
  const [recoverySummary, setRecoverySummary] = useState<RecoverySummaryRow | null>(null);
  const [operationalContext, setOperationalContext] = useState<TrainingDayOperationalContext | null>(null);
  const [adaptationLoop, setAdaptationLoop] = useState<TrainingAdaptationLoopViewModel | null>(null);
  const [bioenergeticModulation, setBioenergeticModulation] = useState<TrainingBioenergeticModulationViewModel | null>(null);
  const [researchTraceSummaries, setResearchTraceSummaries] = useState<KnowledgeResearchTraceSummary[]>([]);
  const [metabolicEfficiencyGenerativeModel, setMetabolicEfficiencyGenerativeModel] =
    useState<NutritionMetabolicEfficiencyGenerativeViewModel | null>(null);
  const [nutritionPerformanceIntegration, setNutritionPerformanceIntegration] =
    useState<NutritionPerformanceIntegrationDials | null>(null);
  const [executed, setExecuted] = useState<ExecutedRow[]>([]);
  const [planned, setPlanned] = useState<PlannedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [selectedPlanDate, setSelectedPlanDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [dailyEnergyKcal, setDailyEnergyKcal] = useState(3000);
  const [caloricSplit, setCaloricSplit] = useState({ breakfast: 25, lunch: 35, dinner: 30, snacks: 10 });
  const [macroSplit, setMacroSplit] = useState({ carbs: 50, protein: 25, fat: 25 });
  const [mealTimes, setMealTimes] = useState({
    breakfast: "07:30",
    lunch: "13:00",
    dinner: "20:00",
    snack_am: "10:30",
    snack_pm: "16:30",
  });
  const [mealStrategy, setMealStrategy] = useState("3-meals");

  const [sessionDurationMin, setSessionDurationMin] = useState(120);
  const [sessionIntensityPctFtp, setSessionIntensityPctFtp] = useState(78);
  const [fuelingChoGPerHour, setFuelingChoGPerHour] = useState(75);
  const [fluidMlPerHour, setFluidMlPerHour] = useState(650);
  const [sodiumMgPerHour, setSodiumMgPerHour] = useState(700);
  const [cofactor, setCofactor] = useState("Bicarbonato + Caffeina");

  const [predictorSport, setPredictorSport] = useState("Running");
  const [predictorDistanceKm, setPredictorDistanceKm] = useState(21);
  const [predictorTimeMin, setPredictorTimeMin] = useState(95);
  const [predictorIntensityPctFtp, setPredictorIntensityPctFtp] = useState(84);
  const [predictorUsePlanDay, setPredictorUsePlanDay] = useState(true);
  const [diaryMacroRows, setDiaryMacroRows] = useState<FoodDiaryComplianceRow[]>([]);
  const [foodQuery, setFoodQuery] = useState("");
  const [foodLookupResults, setFoodLookupResults] = useState<FoodLookupItem[]>([]);
  const [foodLookupLoading, setFoodLookupLoading] = useState(false);
  const [foodLookupError, setFoodLookupError] = useState<string | null>(null);
  const [usdaRichByCatalogId, setUsdaRichByCatalogId] = useState<
    Record<string, { loading: boolean; error?: string; foods?: UsdaRichFoodItemViewModel[] }>
  >({});
  const [savingCatalogKey, setSavingCatalogKey] = useState<string | null>(null);
  const [garminExporting, setGarminExporting] = useState(false);
  const [garminMessage, setGarminMessage] = useState<string | null>(null);
  const [fuelingMediaByKey, setFuelingMediaByKey] = useState<Record<string, string>>({});
  const [mealPathwayBySlot, setMealPathwayBySlot] = useState<Partial<Record<string, MealPathwaySlotBundle>>>({});
  const [intelligentMealPlan, setIntelligentMealPlan] = useState<IntelligentMealPlanResponseBody | null>(null);
  const [intelligentMealLoading, setIntelligentMealLoading] = useState(false);
  const [intelligentMealError, setIntelligentMealError] = useState<string | null>(null);
  /** Indici voce originali nascosti nel piano corrente (non persistono nel DB). */
  const [coachMealRemovalKeys, setCoachMealRemovalKeys] = useState<Set<string>>(() => new Set());
  /** Etichette aggiunte per la prossima rigenerazione (vincolo deterministico sul request). */
  const [coachSessionFoodExclusions, setCoachSessionFoodExclusions] = useState<string[]>([]);
  const [profileFoodExcludeBusy, setProfileFoodExcludeBusy] = useState<string | null>(null);

  useEffect(() => {
    setIntelligentMealPlan(null);
    setIntelligentMealError(null);
    setCoachMealRemovalKeys(new Set());
    setCoachSessionFoodExclusions([]);
  }, [selectedPlanDate]);

  const onDiaryComplianceRows = useCallback((rows: FoodDiaryComplianceRow[]) => {
    setDiaryMacroRows(rows);
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!athleteId) {
        setProfile(null);
        setPhysio(null);
        setPhysiologyState(null);
        setRecoverySummary(null);
        setOperationalContext(null);
        setAdaptationLoop(null);
        setBioenergeticModulation(null);
        setResearchTraceSummaries([]);
        setMetabolicEfficiencyGenerativeModel(null);
        setNutritionPerformanceIntegration(null);
        setExecuted([]);
        setPlanned([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const start = new Date();
      const end = new Date();
      end.setDate(start.getDate() + 14);
      const startKey = start.toISOString().slice(0, 10);
      const endKey = end.toISOString().slice(0, 10);
      const moduleData = await fetchNutritionModuleContext({
        athleteId,
        from: startKey,
        to: endKey,
      });
      if (moduleData.error) {
        setError(moduleData.error || "Errore caricamento");
        setResearchTraceSummaries([]);
        setMetabolicEfficiencyGenerativeModel(null);
        setNutritionPerformanceIntegration(null);
        setLoading(false);
        return;
      }

      const memory = moduleData.athleteMemory ?? null;
      const p = mapAthleteMemoryToNutritionProfile(memory) ?? ((moduleData.profile as AthleteNutritionRow | null) ?? null);
      const ph = mapAthleteMemoryToPhysio(memory) ?? ((moduleData.physio as PhysioRow | null) ?? null);
      const physiology = (memory?.physiology as PhysiologyState | null) ?? ((moduleData.physiologyState as PhysiologyState | null) ?? null);
      const twin = (memory?.twin as TwinStateRow | null) ?? ((moduleData.twinState as TwinStateRow | null) ?? null);
      const recovery = (moduleData.recoverySummary as RecoverySummaryRow | null) ?? null;
      const operational = (moduleData.operationalContext as TrainingDayOperationalContext | null) ?? null;
      const loop = (moduleData.adaptationLoop as TrainingAdaptationLoopViewModel | null) ?? null;
      const bio = (moduleData.bioenergeticModulation as TrainingBioenergeticModulationViewModel | null) ?? null;
      const ex = (moduleData.executed as ExecutedRow[]) ?? [];
      const pl = (moduleData.planned as PlannedRow[]) ?? [];

      setProfile(p);
      setPhysio(ph);
      setPhysiologyState(physiology);
      setTwinState(twin);
      setRecoverySummary(recovery);
      setOperationalContext(operational);
      setAdaptationLoop(loop);
      setBioenergeticModulation(bio);
      setResearchTraceSummaries(moduleData.researchTraceSummaries ?? []);
      setMetabolicEfficiencyGenerativeModel(moduleData.metabolicEfficiencyGenerativeModel ?? null);
      setNutritionPerformanceIntegration(moduleData.nutritionPerformanceIntegration ?? null);
      setExecuted(ex);
      setPlanned(pl);
      const todayKey = new Date().toISOString().slice(0, 10);
      const availableDates = Array.from(new Set(pl.map((row) => row.date))).sort();
      const nextDate = availableDates.find((d) => d >= todayKey) ?? availableDates[0] ?? todayKey;
      setSelectedPlanDate(nextDate);
      setLoading(false);
    }
    loadData();
  }, [athleteId]);

  const planDateOptions = useMemo(() => {
    const fromPlanned = planned.map((p) => p.date);
    const today = new Date();
    const rolling = Array.from({ length: 14 }, (_, i) => {
      const x = new Date(today);
      x.setDate(today.getDate() + i);
      return toIsoDate(x);
    });
    const dates = Array.from(new Set([selectedPlanDate, ...rolling, ...fromPlanned])).sort();
    return dates;
  }, [planned, selectedPlanDate]);

  const selectedPlanSessions = useMemo(
    () => planned.filter((p) => p.date === selectedPlanDate),
    [planned, selectedPlanDate],
  );
  const selectedExecutedSessions = useMemo(
    () => executed.filter((session) => session.date.slice(0, 10) === selectedPlanDate),
    [executed, selectedPlanDate],
  );

  const selectedPlanDateLabel = useMemo(
    () => new Date(`${selectedPlanDate}T00:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }),
    [selectedPlanDate],
  );
  const selectedPlanDateShort = useMemo(
    () => new Date(`${selectedPlanDate}T00:00:00`).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" }),
    [selectedPlanDate],
  );
  const effectiveDayContext = useMemo(
    () =>
      buildEffectiveDayTrainingContext({
        planned: selectedPlanSessions.map((session) => ({
          id: session.id,
          title: session.plannedSessionName ?? session.plannedDiscipline ?? session.type ?? "Sessione",
          duration_minutes: session.duration_minutes,
          tss_target: session.tss_target,
          kcal_target: session.kcal_target,
        })),
        executed: selectedExecutedSessions,
      }),
    [selectedPlanSessions, selectedExecutedSessions],
  );

  const nutritionDayModel = useMemo<NutritionDailyEnergyModel | null>(() => {
    if (!athleteId || !profile) return null;
    const routine = record(profile.routine_config);
    return computeNutritionDailyEnergyModel({
      athleteId,
      date: selectedPlanDate,
      birthDate: profile.birth_date,
      sex: profile.sex,
      heightCm: profile.height_cm,
      weightKg: profile.weight_kg,
      bodyFatPct: profile.body_fat_pct,
      muscleMassKg: profile.muscle_mass_kg,
      ftpWatts: physio?.ftp_watts ?? null,
      vo2maxMlMinKg: physio?.vo2max_ml_min_kg ?? null,
      lifestyleActivityClass:
        profile.lifestyle_activity_class ??
        normalizeLifestyleActivityClass(routine.lifestyle_activity_class as string | null | undefined),
      recoveryStatus: recoverySummary?.status ?? "unknown",
      recoverySleepHours: recoverySummary?.sleepDurationHours ?? null,
      recoveryHrvMs: recoverySummary?.hrvMs ?? null,
      recoveryStrainScore: recoverySummary?.strainScore ?? null,
      plannedTraining: effectiveDayContext.sessions.map((session) => ({
        durationMinutes: session.durationMin,
        kcalTarget: session.kcal,
        tssTarget: session.tss,
        avgPowerW: session.avgPowerW,
      })),
      performanceIntegration: nutritionPerformanceIntegration,
    });
  }, [athleteId, selectedPlanDate, profile, physio, effectiveDayContext, recoverySummary, nutritionPerformanceIntegration]);

  const pathwayModulation = useMemo((): NutritionPathwayModulationViewModel | null => {
    if (!athleteId) return null;
    return buildNutritionPathwayModulationViewModel({
      date: selectedPlanDate,
      plannedSessions: selectedPlanSessions.map((p) => ({
        id: p.id,
        label: String(p.plannedSessionName ?? p.plannedDiscipline ?? p.type ?? "Sessione"),
        builderSession: (p.builderSession as Pro2BuilderSessionContract | null) ?? null,
      })),
      physiology: physiologyState,
      twin: twinState,
    });
  }, [athleteId, selectedPlanDate, selectedPlanSessions, physiologyState, twinState]);

  const nutritionStimulusLine = useMemo(() => {
    if (!selectedPlanSessions.length) return null;
    return selectedPlanSessions
      .map((s) => {
        const name = String(s.plannedSessionName ?? s.plannedDiscipline ?? s.type ?? "Sessione");
        const tgt = s.plannedAdaptationTarget ? ` · ${s.plannedAdaptationTarget}` : "";
        return `${name}${tgt}`;
      })
      .join(" + ");
  }, [selectedPlanSessions]);

  const nutritionSectorBoxes = useMemo(
    () => buildNutritionAdaptationSectorBoxes(pathwayModulation, nutritionStimulusLine),
    [pathwayModulation, nutritionStimulusLine],
  );

  /** Tab Integrazione: KPI da pathway + leve operative (allineati ai blocchi condivisi). */
  const integrationDynamicsSummary = useMemo(() => {
    const cards: { label: string; value: string }[] = [];
    if (pathwayModulation) {
      cards.push({ label: "Vie modulate", value: String(pathwayModulation.pathways.length) });
      cards.push({
        label: "Inibitori aggregati",
        value: pathwayModulation.aggregateInhibitors.length ? String(pathwayModulation.aggregateInhibitors.length) : "0",
      });
      const levelHits = (["biochemical", "hormonal", "neurologic", "microbiota", "genetic"] as const).filter(
        (k) => pathwayModulation.multiLevelSummary[k].length > 0,
      ).length;
      cards.push({ label: "Livelli attivi", value: `${levelHits}/5` });
    }
    if (nutritionPerformanceIntegration) {
      cards.push({
        label: "Energia training",
        value: `×${nutritionPerformanceIntegration.trainingEnergyScale.toFixed(2)}`,
      });
      cards.push({
        label: "CHO fueling",
        value: `×${nutritionPerformanceIntegration.fuelingChoScale.toFixed(2)}`,
      });
      cards.push({
        label: "Bias proteico",
        value: `+${nutritionPerformanceIntegration.proteinBiasPctPoints}%`,
      });
      cards.push({
        label: "Idratazione floor",
        value: `×${nutritionPerformanceIntegration.hydrationFloorMultiplier.toFixed(2)}`,
      });
    }
    if (!cards.length) {
      return [{ label: "Modello integrativo", value: "—" }];
    }
    return cards;
  }, [pathwayModulation, nutritionPerformanceIntegration]);

  const functionalFoodRecommendations = useMemo((): FunctionalFoodRecommendationsViewModel =>
    buildFunctionalFoodRecommendationsViewModel(pathwayModulation?.pathways ?? null), [pathwayModulation]);

  const pathwayTargetsByMealSlot = useMemo(
    () =>
      assignPathwayTargetsToMealSlots({
        targets: functionalFoodRecommendations.targets,
        planDate: selectedPlanDate,
        athleteId: athleteId ?? "",
        maxPerSlot: 3,
      }),
    [functionalFoodRecommendations.targets, selectedPlanDate, athleteId],
  );

  useEffect(() => {
    if (!athleteId) return;
    const slots = pathwayTargetsByMealSlot;
    const keys: PathwayMealSlotKey[] = [...MEAL_SLOT_ORDER];
    setMealPathwayBySlot((prev) => {
      const next = { ...prev };
      for (const k of keys) {
        next[k] = {
          loading: true,
          error: null,
          foods: [],
          pathwayTargets: slots[k],
          usdaConfigured: true,
          lookupQueries: collectSearchQueriesForSlot(slots[k]),
        };
      }
      return next;
    });
    let cancelled = false;
    void (async () => {
      const results = await Promise.all(
        keys.map(async (k) => {
          const t = slots[k];
          const ids = catalogIdsForSlot(t);
          const res = await fetchUsdaFoodsForCatalogIds(ids);
          return { k, t, res };
        }),
      );
      if (cancelled) return;
      setMealPathwayBySlot((prev) => {
        const next = { ...prev };
        for (const { k, t, res } of results) {
          next[k] = {
            loading: false,
            error: res.error,
            foods: res.foods,
            pathwayTargets: t,
            usdaConfigured: res.usdaConfigured,
            lookupQueries: collectSearchQueriesForSlot(t),
          };
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, pathwayTargetsByMealSlot]);

  const resolvedMealDailyEnergyKcal = nutritionDayModel?.totals.mealsKcal ?? dailyEnergyKcal;
  const resolvedFuelingChoGPerHour =
    (nutritionDayModel?.fueling.adjustedChoGPerHour ?? 0) > 0
      ? (nutritionDayModel?.fueling.adjustedChoGPerHour ?? fuelingChoGPerHour)
      : fuelingChoGPerHour;
  const effectiveSessionDurationMin =
    effectiveDayContext.mode === "none" ? sessionDurationMin : effectiveDayContext.summary.totalDurationMin;
  const effectiveSessionIntensityPctFtp =
    effectiveDayContext.mode === "none"
      ? sessionIntensityPctFtp
      : effectiveDayContext.summary.estimatedIntensityPctFtp;
  const resolvedEstimatedAvgPowerW =
    nutritionDayModel?.training.estimatedAvgPowerW ??
    (physio?.ftp_watts != null ? round(physio.ftp_watts * (effectiveSessionIntensityPctFtp / 100)) : null);
  const resolvedFuelingTier = nutritionDayModel?.fueling.capabilityTier ?? "base";
  const resolvedFuelingTierBand =
    resolvedFuelingTier === "elite"
      ? "120-130 g/h"
      : resolvedFuelingTier === "high"
        ? "90-110 g/h"
        : "60-90 g/h";
  const predictorEffectiveTimeMin = predictorUsePlanDay ? effectiveSessionDurationMin : predictorTimeMin;
  const predictorEffectiveIntensityPctFtp = predictorUsePlanDay ? effectiveSessionIntensityPctFtp : predictorIntensityPctFtp;
  const fuelingTrainingContext = useMemo(() => {
    return selectedPlanSessions.map((session) => {
      const builder = session.builderSession ?? null;
      const blocks = builder?.blocks ?? [];
      const blockLabels = blocks
        .slice(0, 3)
        .map((block) => block.label)
        .filter(Boolean);
      const intensityCues = Array.from(
        new Set(
          blocks
            .map((block) => (typeof block.intensityCue === "string" ? block.intensityCue.trim() : ""))
            .filter(Boolean),
        ),
      ).slice(0, 2);
      const target = session.plannedAdaptationTarget ?? builder?.adaptationTarget ?? null;
      return {
        id: session.id,
        builderContract: builder,
        title: session.plannedSessionName ?? builder?.sessionName ?? session.plannedDiscipline ?? session.type ?? "Sessione",
        family: session.plannedFamily ?? builder?.family ?? null,
        discipline: session.plannedDiscipline ?? builder?.discipline ?? session.type ?? null,
        target,
        durationMin: Math.max(0, n(session.duration_minutes)),
        tss: Math.max(0, n(session.tss_target)),
        structure: blockLabels[0] ?? builder?.sessionName ?? null,
        blockLabels,
        intensityCues,
        physiologicalIntent: [],
        nutritionSupports: [],
        inhibitorsAndRisks: [],
      };
    });
  }, [selectedPlanSessions]);
  const knowledgeFuelingHints = useMemo(() => {
    const supports = Array.from(
      new Set(fuelingTrainingContext.flatMap((session) => session.nutritionSupports).filter(Boolean)),
    );
    const risks = Array.from(
      new Set(fuelingTrainingContext.flatMap((session) => session.inhibitorsAndRisks).filter(Boolean)),
    );
    const intents = Array.from(
      new Set(fuelingTrainingContext.flatMap((session) => session.physiologicalIntent).filter(Boolean)),
    );
    return { supports, risks, intents };
  }, [fuelingTrainingContext]);

  useEffect(() => {
    async function loadFuelingMedia() {
      const payload = await fetchNutritionMediaRows();
      if (payload.error) return;
      const rows = (payload.rows as MediaAssetRow[]) ?? [];
      const fuelingPrimary: Record<string, string> = {};
      for (const row of rows) {
        if (row.media_kind !== "image") continue;
        if (row.entity_type === "fueling" && !fuelingPrimary[row.entity_key]) {
          fuelingPrimary[row.entity_key] = row.url;
        }
      }
      setFuelingMediaByKey(fuelingPrimary);
    }

    void loadFuelingMedia();
  }, []);

  useEffect(() => {
    if (!profile || hydrated) return;
    const nc = record(profile.nutrition_config);
    const rc = record(profile.routine_config);
    const mealCfg = record(nc.meal_plan);
    const split = record(mealCfg.caloric_split);
    const macro = record(mealCfg.macro_split);
    const times = record(record(rc.meal_times));
    const fuelingCfg = record(nc.fueling);
    const predictorCfg = record(nc.performance_predictor);
    setDailyEnergyKcal(n(mealCfg.daily_kcal, 3000));
    setCaloricSplit({
      breakfast: n(split.breakfast_pct, 25),
      lunch: n(split.lunch_pct, 35),
      dinner: n(split.dinner_pct, 30),
      snacks: n(split.snacks_pct, 10),
    });
    setMacroSplit({
      carbs: n(macro.carbs_pct, 50),
      protein: n(macro.protein_pct, 25),
      fat: n(macro.fat_pct, 25),
    });
    setMealStrategy(String(mealCfg.meal_strategy ?? "3-meals"));
    setMealTimes({
      breakfast: String(times.breakfast ?? "07:30"),
      lunch: String(times.lunch ?? "13:00"),
      dinner: String(times.dinner ?? "20:00"),
      snack_am: String(times.snack_am ?? "10:30"),
      snack_pm: String(times.snack_pm ?? times.snacks ?? "16:30"),
    });

    setSessionDurationMin(n(fuelingCfg.session_duration_min, 120));
    setSessionIntensityPctFtp(n(fuelingCfg.session_intensity_pct_ftp, 78));
    setFuelingChoGPerHour(n(fuelingCfg.cho_g_h, 75));
    setFluidMlPerHour(n(fuelingCfg.fluid_ml_h, 650));
    setSodiumMgPerHour(n(fuelingCfg.sodium_mg_h, 700));
    setCofactor(String(fuelingCfg.cofactor ?? "Bicarbonato + Caffeina"));

    setPredictorSport(String(predictorCfg.sport ?? "Running"));
    setPredictorDistanceKm(n(predictorCfg.distance_km, 21));
    setPredictorTimeMin(n(predictorCfg.event_time_min, 95));
    setPredictorIntensityPctFtp(n(predictorCfg.intensity_pct_ftp, 84));

    setHydrated(true);
  }, [profile, hydrated]);

  const profileSupplements = useMemo(() => {
    const fromSupp = profile?.supplements ?? [];
    const brands = record(profile?.supplement_config).selected_brands;
    const fromBrands = Array.isArray(brands) ? brands.map((x) => String(x)) : [];
    return Array.from(new Set([...fromSupp, ...fromBrands]));
  }, [profile]);

  const preferredBrands = useMemo(() => profileSupplements.slice(0, 6), [profileSupplements]);

  const normalizedPreferredBrands = useMemo(() => {
    const fromProfile = preferredBrands
      .map((raw) => {
        const lower = raw.toLowerCase();
        const found = BRAND_ALIASES.find((b) => b.aliases.some((a) => lower.includes(a)));
        return found?.label ?? null;
      })
      .filter((v): v is string => !!v);
    if (fromProfile.length) return Array.from(new Set(fromProfile));
    return ["Enervit", "SiS", "Maurten", "+Watt", "Powerbar"];
  }, [preferredBrands]);

  const restrictedTokens = useMemo(() => {
    const tokens = [
      ...(profile?.allergies ?? []),
      ...(profile?.intolerances ?? []),
      ...(profile?.food_exclusions ?? []),
    ]
      .map((x) => String(x).toLowerCase().trim())
      .filter(Boolean);
    return Array.from(new Set(tokens));
  }, [profile]);

  const filteredLookupResults = useMemo(() => {
    if (!restrictedTokens.length) return foodLookupResults;
    return foodLookupResults.filter((item) => {
      const hay = `${item.label} ${item.brand ?? ""}`.toLowerCase();
      return !restrictedTokens.some((t) => hay.includes(t));
    });
  }, [foodLookupResults, restrictedTokens]);

  const recent7 = executed.slice(0, 7);
  const avgTss7 = useMemo(() => (recent7.length ? recent7.reduce((s, x) => s + n(x.tss), 0) / recent7.length : 0), [recent7]);
  const lactateAvg = useMemo(() => (recent7.length ? recent7.reduce((s, x) => s + n(x.lactate_mmoll), 0) / recent7.length : 0), [recent7]);
  const glucoseAvg = useMemo(() => (recent7.length ? recent7.reduce((s, x) => s + n(x.glucose_mmol, 5.1), 0) / recent7.length : 0), [recent7]);
  const smo2Avg = useMemo(() => (recent7.length ? recent7.reduce((s, x) => s + n(x.smo2, 56), 0) / recent7.length : 0), [recent7]);

  const dominantStimulus = useMemo(() => {
    const ftp = n(physio?.ftp_watts, 260);
    if (avgTss7 > 95 || lactateAvg > 4.8) return "High-intensity glycolytic";
    if (n(twinState?.redoxStressIndex, 0) > 55) return "Redox / recovery constrained";
    if (n(twinState?.glycogenStatus, 100) < 35) return "Low glycogen availability";
    if (avgTss7 > 70 || ftp > 290) return "Threshold endurance";
    if (smo2Avg < 52) return "Oxygen extraction stress";
    return "Aerobic base / recovery";
  }, [avgTss7, lactateAvg, smo2Avg, physio, twinState]);

  const fuelingPhysiology = useMemo(() => {
    const metabolic = physiologyState?.metabolicProfile;
    const lactate = physiologyState?.lactateProfile;
    const performance = physiologyState?.performanceProfile;
    const gutDeliveryPct = clamp(n(lactate?.bloodDeliveryPctOfIngested, 88), 45, 100);
    const sequestrationPct = clamp(n(lactate?.effectiveSequestrationPct, 0), 0, 35);
    const gutStressPct = clamp(n(lactate?.gutStressScore, 0) * 100, 0, 100);
    const dysbiosisPct = clamp(n(lactate?.microbiotaDysbiosisScore, 0) * 100, 0, 100);
    const coriReturnG = Math.max(0, n(lactate?.glucoseFromCoriG, 0));
    const exogenousOxidizedG = Math.max(0, n(lactate?.exogenousOxidizedG, 0));
    const choSharePct = clamp(n(lactate?.glycolyticSharePct, 65), 45, 96);
    const oxidativeCeilingKcalMin = Math.max(0, n(performance?.oxidativeCapacityKcalMin, 0));
    const redoxPct = clamp(n(performance?.redoxStressIndex, twinState?.redoxStressIndex ?? 0), 0, 100);
    const gutPathwayRisk = String(lactate?.gutPathwayRisk ?? "stable");
    const pcrCapacityJ = Math.max(0, n(metabolic?.pcrCapacityJ, 0));
    const vLamax = n(metabolic?.vLamax, physio?.v_lamax ?? 0);
    return {
      gutDeliveryPct,
      sequestrationPct,
      gutStressPct,
      dysbiosisPct,
      coriReturnG,
      exogenousOxidizedG,
      choSharePct,
      oxidativeCeilingKcalMin,
      redoxPct,
      gutPathwayRisk,
      pcrCapacityJ,
      vLamax,
    };
  }, [physiologyState, twinState, physio]);

  const effectiveMacroSplit = useMemo(() => {
    const bump = nutritionPerformanceIntegration?.proteinBiasPctPoints ?? 0;
    if (!bump) return macroSplit;
    const protein = Math.min(45, macroSplit.protein + bump);
    const fat = Math.max(15, macroSplit.fat - bump);
    return { ...macroSplit, protein, fat };
  }, [macroSplit, nutritionPerformanceIntegration]);

  const mealRows = useMemo(() => {
    const halfSnack = caloricSplit.snacks / 2;
    const rows = [
      { key: "breakfast", label: "Colazione", pct: caloricSplit.breakfast, time: mealTimes.breakfast },
      { key: "lunch", label: "Pranzo", pct: caloricSplit.lunch, time: mealTimes.lunch },
      { key: "dinner", label: "Cena", pct: caloricSplit.dinner, time: mealTimes.dinner },
      { key: "snack_am", label: "Spuntino · mattina (facoltativo)", pct: halfSnack, time: mealTimes.snack_am },
      { key: "snack_pm", label: "Spuntino · pomeriggio (facoltativo)", pct: halfSnack, time: mealTimes.snack_pm },
    ];
    return rows.map((r) => {
      const kcal = (resolvedMealDailyEnergyKcal * r.pct) / 100;
      return {
        ...r,
        kcal: round(kcal),
        carbs: round((kcal * (effectiveMacroSplit.carbs / 100)) / 4),
        protein: round((kcal * (effectiveMacroSplit.protein / 100)) / 4),
        fat: round((kcal * (effectiveMacroSplit.fat / 100)) / 9),
      };
    });
  }, [resolvedMealDailyEnergyKcal, caloricSplit, effectiveMacroSplit, mealTimes]);

  const diaryDayMacroTargets = useMemo(
    () => ({
      carbs: mealRows.reduce((s, m) => s + m.carbs, 0),
      protein: mealRows.reduce((s, m) => s + m.protein, 0),
      fat: mealRows.reduce((s, m) => s + m.fat, 0),
    }),
    [mealRows],
  );

  const mealPlanCards = useMemo(() => {
    return mealRows.map((row) => {
      const icon =
        row.key === "breakfast" ? "🌅" : row.key === "lunch" ? "🥗" : row.key === "dinner" ? "🌙" : row.key === "snack_am" ? "☕" : "🥤";
      return {
        ...row,
        icon,
        portionHint: portionHintForMealKcal(row.kcal),
      };
    });
  }, [mealRows]);

  /** KPI card e barra % kcal allineati al rollup del piano generato (somma item), non solo al target solver. */
  const mealPlanCardsDisplay = useMemo(() => {
    const rollup = intelligentMealPlan?.nutrientRollup;
    if (!rollup?.perSlot?.length) return mealPlanCards;
    return mealPlanCards.map((row) => {
      const sub = rollup.perSlot.find((p) => p.slot === row.key)?.totals;
      if (!sub) return row;
      const kcal = round(sub.kcal);
      return {
        ...row,
        kcal,
        carbs: round(sub.carbsG, 1),
        protein: round(sub.proteinG, 1),
        fat: round(sub.fatG, 1),
        portionHint: portionHintForMealKcal(kcal),
      };
    });
  }, [mealPlanCards, intelligentMealPlan?.nutrientRollup]);

  const mealDisplayByKey = useMemo(() => {
    const m = new Map<MealSlotKey, (typeof mealPlanCardsDisplay)[number]>();
    for (const row of mealPlanCardsDisplay) {
      m.set(row.key as MealSlotKey, row);
    }
    return m;
  }, [mealPlanCardsDisplay]);

  const trainingDayLinesForMealPlan = useMemo(
    () =>
      effectiveDayContext.sessions.map((s) =>
        [
          `${s.title}: ${Math.round(s.durationMin)} min`,
          `TSS ~${Math.round(s.tss)}`,
          s.kcal ? `kcal stim. ${Math.round(s.kcal)}` : null,
          s.source === "executed" ? "eseguito" : "pianificato",
        ]
          .filter(Boolean)
          .join(", "),
      ),
    [effectiveDayContext],
  );

  const mealPlanIntegrationSolverLines = useMemo(() => {
    const p = nutritionDayModel?.performanceIntegration;
    if (!p) return [];
    return [
      `Energia sessione ×${p.trainingEnergyScale.toFixed(2)}`,
      `Quota pasti/training ${Math.round(p.mealTrainingFraction * 100)}%`,
      `CHO intra ×${p.fuelingChoScale.toFixed(2)}`,
      `Proteine pasti +${p.proteinBiasPctPoints}%`,
      `Fluido seduta ×${p.sessionFluidMultiplier.toFixed(2)}`,
      ...p.rationale.slice(0, 8),
    ];
  }, [nutritionDayModel?.performanceIntegration]);

  const intelligentMealPlanRequest = useMemo(() => {
    if (!athleteId || !profile) return null;
    const mergedFoodExclusions = [
      ...new Set(
        [...(profile.food_exclusions ?? []).map((x) => String(x).trim()), ...coachSessionFoodExclusions.map((x) => x.trim())].filter(
          Boolean,
        ),
      ),
    ];
    const base = buildIntelligentMealPlanRequest({
      athleteId,
      planDate: selectedPlanDate,
      profile: {
        diet_type: profile.diet_type,
        intolerances: profile.intolerances,
        allergies: profile.allergies,
        food_exclusions: mergedFoodExclusions.length ? mergedFoodExclusions : profile.food_exclusions,
        food_preferences: profile.food_preferences,
        supplements: profile.supplements,
        routine_config: profile.routine_config,
      },
      mealRows: mealPlanCards.map((m) => ({
        key: m.key,
        label: m.label,
        kcal: m.kcal,
        carbs: m.carbs,
        protein: m.protein,
        fat: m.fat,
        timeLocal: m.time,
      })),
      mealPathwayBySlot,
      contextLines: [
        recoverySummary?.guidance,
        ...(pathwayModulation?.notes ?? []).slice(0, 5),
        ...(nutritionPerformanceIntegration?.rationale ?? []).slice(0, 6),
        metabolicEfficiencyGenerativeModel?.headline,
      ].filter((s): s is string => Boolean(s && String(s).trim())),
      pathwayModulation,
      trainingDayLines: trainingDayLinesForMealPlan,
      integrationLeverLines: mealPlanIntegrationSolverLines,
    });
    const weekId = isoWeekBucketId(selectedPlanDate);
    const payload = readMealRotationWeekPayload(athleteId, weekId);
    const weeklyStapleCounts = aggregateStapleCountsForWeek(payload, selectedPlanDate);
    return {
      ...base,
      ...(Object.keys(weeklyStapleCounts).length ? { weeklyStapleCounts } : {}),
    };
  }, [
    athleteId,
    profile,
    selectedPlanDate,
    mealPlanCards,
    mealPathwayBySlot,
    recoverySummary?.guidance,
    pathwayModulation,
    nutritionPerformanceIntegration?.rationale,
    metabolicEfficiencyGenerativeModel?.headline,
    trainingDayLinesForMealPlan,
    mealPlanIntegrationSolverLines,
    coachSessionFoodExclusions,
  ]);

  const removeCoachMealPlanItem = useCallback((slot: MealSlotKey, index: number, foodLabel: string) => {
    const label = foodLabel.trim();
    const key = `${slot}:${index}`;
    setCoachMealRemovalKeys((prev) => new Set(prev).add(key));
    if (label) {
      setCoachSessionFoodExclusions((prev) => (prev.includes(label) ? prev : [...prev, label]));
    }
  }, []);

  const persistFoodExclusionToProfile = useCallback(
    async (slot: MealSlotKey, index: number, foodLabel: string) => {
      const label = foodLabel.trim();
      if (!athleteId || !profile || !label) return;
      const key = `${slot}:${index}`;
      setProfileFoodExcludeBusy(label);
      setError(null);
      try {
        const next = [...new Set([...(profile.food_exclusions ?? []).map(String), label])];
        await updateProfilePayload(athleteId, { food_exclusions: next });
        setProfile({ ...profile, food_exclusions: next });
        setCoachMealRemovalKeys((prev) => new Set(prev).add(key));
        setCoachSessionFoodExclusions((prev) => (prev.includes(label) ? prev : [...prev, label]));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Esclusione profilo non salvata");
      }
      setProfileFoodExcludeBusy(null);
    },
    [athleteId, profile],
  );

  const handleGenerateIntelligentMealPlan = useCallback(async () => {
    if (!athleteId || !intelligentMealPlanRequest) return;
    setIntelligentMealLoading(true);
    setIntelligentMealError(null);
    const result = await fetchIntelligentMealPlan(athleteId, intelligentMealPlanRequest);
    setIntelligentMealLoading(false);
    if (!result.ok) {
      setIntelligentMealError(result.error);
      return;
    }
    setIntelligentMealPlan(result.body);
    setCoachMealRemovalKeys(new Set());
    const rot = result.body.mealRotationStaples;
    const planD = result.body.solverBasis?.planDate;
    if (rot?.length && planD) {
      recordPlanDayStaples(athleteId, isoWeekBucketId(planD), planD, rot);
    }
  }, [athleteId, intelligentMealPlanRequest]);

  const complianceOverview = useMemo(() => {
    const targetKcal = mealRows.reduce((s, m) => s + m.kcal, 0);
    const targetCarbs = mealRows.reduce((s, m) => s + m.carbs, 0);
    const targetProtein = mealRows.reduce((s, m) => s + m.protein, 0);
    const targetFat = mealRows.reduce((s, m) => s + m.fat, 0);

    const today = new Date().toISOString().slice(0, 10);
    const todayEntries = diaryMacroRows.filter((d) => d.date === today);
    const weekEntries = diaryMacroRows.filter((d) => {
      const stamp = new Date(`${d.date}T00:00:00`).getTime();
      const now = Date.now();
      return now - stamp <= 7 * 24 * 60 * 60 * 1000;
    });

    const sum = (rows: FoodDiaryComplianceRow[]) =>
      rows.reduce(
        (acc, r) => ({
          kcal: acc.kcal + n(r.kcal),
          carbs: acc.carbs + n(r.carbs),
          protein: acc.protein + n(r.protein),
          fat: acc.fat + n(r.fat),
        }),
        { kcal: 0, carbs: 0, protein: 0, fat: 0 },
      );

    const todayTotals = sum(todayEntries);
    const weekTotals = sum(weekEntries);
    const daysCovered = Math.max(1, new Set(weekEntries.map((e) => e.date)).size);
    const weekAvg = {
      kcal: weekTotals.kcal / daysCovered,
      carbs: weekTotals.carbs / daysCovered,
      protein: weekTotals.protein / daysCovered,
      fat: weekTotals.fat / daysCovered,
    };

    const scoreFor = (actual: number, target: number) => {
      if (target <= 0) return 0;
      const dev = Math.abs((actual - target) / target) * 100;
      return Math.max(0, 100 - dev);
    };

    const todayScore = Math.round(
      (scoreFor(todayTotals.kcal, targetKcal) +
        scoreFor(todayTotals.carbs, targetCarbs) +
        scoreFor(todayTotals.protein, targetProtein) +
        scoreFor(todayTotals.fat, targetFat)) /
        4,
    );
    const weekScore = Math.round(
      (scoreFor(weekAvg.kcal, targetKcal) +
        scoreFor(weekAvg.carbs, targetCarbs) +
        scoreFor(weekAvg.protein, targetProtein) +
        scoreFor(weekAvg.fat, targetFat)) /
        4,
    );

    return {
      target: { kcal: targetKcal, carbs: targetCarbs, protein: targetProtein, fat: targetFat },
      today: { ...todayTotals, score: todayScore, entries: todayEntries.length },
      week: { ...weekAvg, score: weekScore, entries: weekEntries.length, daysCovered },
    };
  }, [mealRows, diaryMacroRows]);

  const nutrientSummary = useMemo(() => {
    const foodDb: Record<
      string,
      {
        kcal: number;
        cho: number;
        pro: number;
        fat: number;
        vitC?: number;
        vitD?: number;
        b2?: number;
        b3?: number;
        mg?: number;
        fe?: number;
        omega3?: number;
        leucine?: number;
        carbType?: string;
      }
    > = {
      omelette: { kcal: 290, cho: 3, pro: 24, fat: 20, vitD: 2.2, b2: 0.52, b3: 0.2, mg: 22, fe: 2.7, leucine: 1.9 },
      mela: { kcal: 62, cho: 16, pro: 0.3, fat: 0.2, vitC: 5, b2: 0.03, b3: 0.1, mg: 6, fe: 0.2, carbType: "Fruttosio/Fibra" },
      yogurt: { kcal: 88, cho: 8, pro: 7, fat: 3, vitD: 1.3, b2: 0.34, b3: 0.2, mg: 18, fe: 0.1, leucine: 0.7 },
      cereali: { kcal: 150, cho: 29, pro: 4, fat: 2, b2: 0.09, b3: 1.6, mg: 36, fe: 2.2, carbType: "Amido" },
      riso: { kcal: 430, cho: 94, pro: 8, fat: 1, b2: 0.1, b3: 2, mg: 38, fe: 1.2, carbType: "Amido" },
      salmone: { kcal: 330, cho: 0, pro: 33, fat: 21, vitD: 9, b2: 0.5, b3: 12, mg: 40, fe: 0.9, omega3: 3.2, leucine: 2.7 },
      verdure: { kcal: 70, cho: 13, pro: 4, fat: 1, vitC: 40, b2: 0.15, b3: 1, mg: 48, fe: 1.5, carbType: "Fibra" },
      evo: { kcal: 108, cho: 0, pro: 0, fat: 12, omega3: 0.8 },
      patate: { kcal: 245, cho: 56, pro: 4, fat: 0.3, vitC: 22, b3: 2.2, mg: 40, fe: 0.8, carbType: "Amido" },
      frutta: { kcal: 95, cho: 22, pro: 1, fat: 0.4, vitC: 25, b2: 0.08, b3: 0.4, mg: 18, fe: 0.4, carbType: "Fruttosio/Fibra" },
      proteica: { kcal: 110, cho: 3, pro: 23, fat: 1.5, b2: 0.18, b3: 0.6, mg: 38, fe: 0.5, leucine: 2.2 },
      frutta_secca: { kcal: 120, cho: 4, pro: 4, fat: 10, vitC: 0, b2: 0.13, b3: 1.1, mg: 52, fe: 1.1, omega3: 0.6, carbType: "Fibra" },
    };

    const totals = {
      kcal: 0,
      cho: 0,
      pro: 0,
      fat: 0,
      vitC: 0,
      vitD: 0,
      b2: 0,
      b3: 0,
      mg: 0,
      fe: 0,
      omega3: 0,
      leucine: 0,
      carbTypes: new Set<string>(),
    };

    const mapToken = (item: string) => {
      const lower = item.toLowerCase();
      if (lower.includes("omelette") || lower.includes("egg")) return "omelette";
      if (lower.includes("mela") || lower.includes("apple")) return "mela";
      if (lower.includes("yogurt")) return "yogurt";
      if (lower.includes("cereali") || lower.includes("cereal") || lower.includes("oat")) return "cereali";
      if (lower.includes("riso") || lower.includes("rice")) return "riso";
      if (lower.includes("salmone") || lower.includes("salmon") || lower.includes("pesce") || lower.includes("fish")) return "salmone";
      if (lower.includes("verdure") || lower.includes("salad") || lower.includes("spinach") || lower.includes("broccoli"))
        return "verdure";
      if (lower.includes("olio") || lower.includes("olive oil")) return "evo";
      if (lower.includes("patate") || lower.includes("potato")) return "patate";
      if (lower.includes("frutta secca") || lower.includes("nut") || lower.includes("almond") || lower.includes("walnut"))
        return "frutta_secca";
      if (lower.includes("frutta") || lower.includes("fruit") || lower.includes("banana")) return "frutta";
      if (lower.includes("proteica") || lower.includes("whey") || lower.includes("yogurt greco") || lower.includes("cottage"))
        return "proteica";
      return null;
    };

    const slotKeys: PathwayMealSlotKey[] = [...MEAL_SLOT_ORDER];
    for (const slot of slotKeys) {
      const bundle = mealPathwayBySlot[slot];
      if (!bundle) continue;
      for (const food of (bundle.foods ?? []).slice(0, 6)) {
        const kcal = food.energyKcal100;
        if (kcal != null && Number.isFinite(kcal)) totals.kcal += kcal;
        const p = food.proteinG100;
        const c = food.carbsG100;
        const fa = food.fatG100;
        if (p != null && Number.isFinite(p)) totals.pro += p;
        if (c != null && Number.isFinite(c)) totals.cho += c;
        if (fa != null && Number.isFinite(fa)) totals.fat += fa;
      }
      const microKeys = new Set<string>();
      const textSeeds: string[] = [];
      for (const t of bundle.pathwayTargets ?? []) {
        textSeeds.push(t.displayNameIt, ...t.searchQueries);
      }
      for (const food of bundle.foods ?? []) textSeeds.push(food.description);
      for (const raw of textSeeds) {
        const key = mapToken(raw);
        if (!key || microKeys.has(key)) continue;
        microKeys.add(key);
        const f = foodDb[key];
        totals.vitC += f.vitC ?? 0;
        totals.vitD += f.vitD ?? 0;
        totals.b2 += f.b2 ?? 0;
        totals.b3 += f.b3 ?? 0;
        totals.mg += f.mg ?? 0;
        totals.fe += f.fe ?? 0;
        totals.omega3 += f.omega3 ?? 0;
        totals.leucine += f.leucine ?? 0;
        if (f.carbType) totals.carbTypes.add(f.carbType);
      }
    }

    return {
      kcal: round(totals.kcal),
      cho: round(totals.cho),
      pro: round(totals.pro),
      fat: round(totals.fat),
      vitC: round(totals.vitC, 1),
      vitD: round(totals.vitD, 1),
      b2: round(totals.b2, 2),
      b3: round(totals.b3, 2),
      mg: round(totals.mg),
      fe: round(totals.fe, 2),
      omega3: round(totals.omega3, 2),
      leucine: round(totals.leucine, 2),
      carbTypes: Array.from(totals.carbTypes).join(", "),
    };
  }, [mealPathwayBySlot]);

  const effectiveFluidMlPerHour = useMemo(
    () => round(fluidMlPerHour * (nutritionPerformanceIntegration?.sessionFluidMultiplier ?? 1)),
    [fluidMlPerHour, nutritionPerformanceIntegration],
  );

  const hydrationPlan = useMemo(() => {
    const floorMul = nutritionPerformanceIntegration?.hydrationFloorMultiplier ?? 1;
    const minDailyMl = Math.max(2200, n(profile?.weight_kg, 70) * 33) * floorMul;
    const fluidRate = effectiveFluidMlPerHour > 0 ? effectiveFluidMlPerHour : 650;
    const trainingMl = Math.max(600, Math.round((effectiveSessionDurationMin / 60) * fluidRate));
    return {
      minDailyMl: round(minDailyMl),
      trainingMl,
      sodiumMinMg: Math.round((trainingMl / 500) * 400),
    };
  }, [effectiveSessionDurationMin, profile, nutritionPerformanceIntegration, effectiveFluidMlPerHour]);

  const mealTabMicronutrientProps = useMemo(() => {
    const dayTotals = intelligentMealPlan?.nutrientRollup?.dayTotals;
    if (dayTotals) {
      return mealPlanDayTotalsToMicroLines(dayTotals);
    }
    return pathwayNutrientSummaryToMicroLines(nutrientSummary, hydrationPlan.minDailyMl);
  }, [intelligentMealPlan?.nutrientRollup?.dayTotals, nutrientSummary, hydrationPlan.minDailyMl]);

  const fuelingProtocol = useMemo<FuelingSlot[]>(() => {
    const brandA = profileSupplements[0] ?? "Enervit";
    const brandB = profileSupplements[1] ?? brandA;
    const brandC = profileSupplements[2] ?? brandA;
    const durationHours = Math.max(0.5, effectiveSessionDurationMin / 60);
    const preCho = Math.max(15, round(nutritionDayModel?.fueling.preChoG ?? 20));
    const postCho = Math.max(25, round(nutritionDayModel?.fueling.postChoG ?? 30));
    const intraTotalCho = Math.max(
      round(nutritionDayModel?.fueling.intraChoG ?? 0, 1),
      round(resolvedFuelingChoGPerHour * durationHours, 1),
    );
    const intraStepsCount = Math.max(1, Math.ceil(effectiveSessionDurationMin / 20));
    const perStepFluid = Math.max(120, round((effectiveFluidMlPerHour * durationHours) / intraStepsCount));
    const rawStepCho = intraStepsCount > 0 ? intraTotalCho / intraStepsCount : intraTotalCho;
    const intraSteps = Array.from({ length: intraStepsCount }, (_, i) => {
      const minute = i * 20;
      const isLast = i === intraStepsCount - 1;
      const distributedBefore = round(rawStepCho * i, 1);
      const remaining = Math.max(0, round(intraTotalCho - distributedBefore, 1));
      const stepCho = isLast ? remaining : round(rawStepCho, 1);
      const category: FuelingCategory = i % 3 === 0 ? "drink" : i % 3 === 1 ? "gel" : "chew";
      const formatLabel =
        category === "drink"
          ? `drink mix ${brandA}`
          : category === "gel"
            ? `gel 2:1 ${brandB}`
            : `chew/bar ${brandC}`;
      return {
        phase: "Intra",
        time: minute === 0 ? "0'" : `+${minute}'`,
        icon: "🟦",
        plan: `${stepCho}g CHO via ${formatLabel}`,
        cho: stepCho,
        fluid: perStepFluid,
        notes: `Tier ${resolvedFuelingTierBand} · steady delivery`,
        category,
      } satisfies FuelingSlot;
    });
    return [
      {
        phase: "Pre-workout",
        time: "-30'",
        icon: "🟣",
        plan: `${preCho}g CHO + priming mix (${brandA}) + 300ml acqua`,
        cho: preCho,
        fluid: 300,
        notes: `Priming metabolico · tier ${resolvedFuelingTierBand}`,
        category: "drink",
      },
      ...intraSteps,
      {
        phase: "Post-workout",
        time: "+10'",
        icon: "🟢",
        plan: `${postCho}g CHO + recovery protein blend (${brandC}) + 350ml acqua`,
        cho: postCho,
        fluid: 350,
        notes: "Recovery immediato",
        category: "recovery",
      },
    ];
  }, [
    profileSupplements,
    effectiveSessionDurationMin,
    effectiveFluidMlPerHour,
    nutritionDayModel,
    resolvedFuelingChoGPerHour,
    resolvedFuelingTierBand,
  ]);

  const fuelingProductsBySlot = useMemo(() => {
    return fuelingProtocol.map((slot) => {
      for (const brand of normalizedPreferredBrands) {
        const product = FUELING_PRODUCT_CATALOG.find((p) => p.brand === brand && p.category === slot.category);
        if (product) return product;
      }
      return FUELING_PRODUCT_CATALOG.find((p) => p.category === slot.category) ?? FUELING_PRODUCT_CATALOG[0];
    });
  }, [fuelingProtocol, normalizedPreferredBrands]);

  const fuelingSteps = useMemo(() => {
    return fuelingProtocol.map((slot, idx) => {
      const product = fuelingProductsBySlot[idx];
      const { displayImage, isLogoFallback } = resolveFuelingProductImage(product, slot.category, fuelingMediaByKey);
      return {
        ...slot,
        product,
        displayImage,
        isLogoFallback,
        minuteOffset: parseFuelingMinuteOffset(slot.time),
      };
    });
  }, [fuelingProtocol, fuelingProductsBySlot, fuelingMediaByKey]);

  const fuelingByPhase = useMemo(() => {
    const byPhase: Record<"pre" | "intra" | "post", typeof fuelingSteps> = { pre: [], intra: [], post: [] };
    for (const step of fuelingSteps) {
      const key = step.phase.toLowerCase().includes("pre")
        ? "pre"
        : step.phase.toLowerCase().includes("post")
          ? "post"
          : "intra";
      byPhase[key].push(step);
    }
    byPhase.pre.sort((a, b) => a.minuteOffset - b.minuteOffset);
    byPhase.intra.sort((a, b) => a.minuteOffset - b.minuteOffset);
    byPhase.post.sort((a, b) => a.minuteOffset - b.minuteOffset);
    return byPhase;
  }, [fuelingSteps]);

  const fuelingTimelineSteps = useMemo(() => {
    return [...fuelingByPhase.pre, ...fuelingByPhase.intra, ...fuelingByPhase.post];
  }, [fuelingByPhase]);

  const hydrationTimeline = useMemo(() => {
    const everyMin = 20;
    const bottleMl = 500;
    const rounds = Math.max(1, Math.ceil(effectiveSessionDurationMin / everyMin));
    return Array.from({ length: rounds }, (_, i) => {
      const minute = i * everyMin;
      return {
        minuteLabel: minute === 0 ? "0'" : `+${minute}'`,
        note: `${bottleMl}ml + sali minerali`,
      };
    });
  }, [effectiveSessionDurationMin]);

  const fuelingVisualMetrics = useMemo(() => {
    const totalHydration = fuelingSteps.reduce((sum, s) => sum + s.fluid, 0);
    const totalCho = fuelingSteps.reduce((sum, s) => sum + s.cho, 0);
    const totalKcal = round(totalCho * 4);
    return [
      { label: "CHO/h", value: round(resolvedFuelingChoGPerHour), unit: "g/h", pct: clamp((resolvedFuelingChoGPerHour / 130) * 100, 8, 100), color: "#ff6b00" },
      { label: "Idratazione totale", value: round(totalHydration), unit: "ml", pct: clamp((totalHydration / 3000) * 100, 8, 100), color: "#0ea5e9" },
      { label: "Sodio/h", value: round(sodiumMgPerHour), unit: "mg/h", pct: clamp((sodiumMgPerHour / 1200) * 100, 8, 100), color: "#8b5cf6" },
      { label: "kcal protocollo", value: totalKcal, unit: "kcal", pct: clamp((totalKcal / 1000) * 100, 8, 100), color: "#10b981" },
    ];
  }, [fuelingSteps, resolvedFuelingChoGPerHour, sodiumMgPerHour]);

  const integrationProductCards = useMemo(() => {
    const focusPriority: FuelingFunctionalFocus[] = [
      "preworkout",
      "carbo",
      "electrolyte",
      "protein",
      "recovery",
      "eaa",
      "bcaa",
      "caffeine",
      "creatine",
    ];
    const preferred = normalizedPreferredBrands.length
      ? normalizedPreferredBrands
      : Array.from(new Set(FUELING_PRODUCT_CATALOG.map((item) => item.brand))).slice(0, 6);
    const picked: FuelingProduct[] = [];
    for (const focus of focusPriority) {
      for (const brand of preferred) {
        const product = FUELING_PRODUCT_CATALOG.find(
          (item) => item.brand === brand && item.functionalFocus.includes(focus),
        );
        if (product && !picked.some((entry) => entry.brand === product.brand && entry.product === product.product)) {
          picked.push(product);
          break;
        }
      }
    }
    return picked.slice(0, 9).map((product) => ({
      ...product,
      ...resolveFuelingProductImage(product, product.category, fuelingMediaByKey),
    }));
  }, [fuelingMediaByKey, normalizedPreferredBrands]);

  const integrationStackSummary = useMemo(() => {
    const brandCount = new Set(integrationProductCards.map((product) => product.brand)).size;
    const focusCount = new Set(integrationProductCards.flatMap((product) => product.functionalFocus)).size;
    return [
      { label: "Products", value: `${integrationProductCards.length}` },
      { label: "Brands", value: `${brandCount}` },
      { label: "Focus", value: `${focusCount}` },
    ];
  }, [integrationProductCards]);

  const glycogenDepletion = useMemo(() => {
    const weight = n(profile?.weight_kg, 72);
    const muscleKg = n(profile?.muscle_mass_kg, weight * 0.45);
    const totalGlycogen = round(muscleKg * 12.5 + 95);
    const durationHours = Math.max(0.5, n(effectiveSessionDurationMin, 120) / 60);
    const burnBase = clamp(
      72 + (effectiveSessionIntensityPctFtp - 55) * 1.75 + (fuelingPhysiology.choSharePct - 55) * 1.35 + fuelingPhysiology.vLamax * 18,
      80,
      250,
    );
    const intakeRate = clamp(resolvedFuelingChoGPerHour, 0, 150);
    const absorbedRate = intakeRate * (fuelingPhysiology.gutDeliveryPct / 100);
    const coriRate = fuelingPhysiology.coriReturnG > 0 ? fuelingPhysiology.coriReturnG / durationHours : 0;
    const dt = 1 / 6; // 10'

    let time = 0;
    let remaining = totalGlycogen;
    const points: Array<{ xHour: number; pct: number; grams: number }> = [{ xHour: 0, pct: 100, grams: totalGlycogen }];

    while (time < durationHours) {
      const remainingRatio = remaining / Math.max(1, totalGlycogen);
      const metabolicDownshift = 0.72 + remainingRatio * 0.42;
      const oxidativeProtection =
        fuelingPhysiology.oxidativeCeilingKcalMin > 0
          ? clamp(fuelingPhysiology.oxidativeCeilingKcalMin / 14, 0.82, 1.06)
          : 1;
      const redoxPenalty = 1 + clamp((fuelingPhysiology.redoxPct - 50) / 200, -0.08, 0.18);
      const burnRate = burnBase * metabolicDownshift * redoxPenalty / oxidativeProtection;
      const netRate = Math.max(6, burnRate - absorbedRate - coriRate);
      remaining = Math.max(0, remaining - netRate * dt);
      time = Math.min(durationHours, time + dt);
      const pct = (remaining / Math.max(1, totalGlycogen)) * 100;
      points.push({ xHour: round(time, 2), pct: round(pct, 2), grams: round(remaining, 1) });
    }

    const totalConsume = round(burnBase * durationHours);
    const totalIntake = round(intakeRate * durationHours);
    const totalAbsorbed = round(absorbedRate * durationHours);
    const totalCori = round(coriRate * durationHours);
    const totalNet = Math.max(0, round(totalConsume - totalAbsorbed - totalCori));
    const finalRemaining = points[points.length - 1]?.grams ?? totalGlycogen;
    const finalPct = points[points.length - 1]?.pct ?? 100;
    const finalZone: "green" | "yellow" | "red" = finalPct > 60 ? "green" : finalPct > 30 ? "yellow" : "red";

    return {
      totalGlycogen,
      blocks: [],
      points,
      totalConsume,
      totalIntake,
      totalAbsorbed,
      totalCori,
      totalNet,
      finalRemaining: round(finalRemaining),
      finalPct: round(finalPct, 1),
      finalZone,
      totalHours: round(durationHours, 2),
    };
  }, [effectiveSessionDurationMin, effectiveSessionIntensityPctFtp, profile, resolvedFuelingChoGPerHour, fuelingPhysiology]);

  const fuelingOpsCards = useMemo(
    () => [
      { label: "CHO total", value: `${round(fuelingSteps.reduce((sum, step) => sum + step.cho, 0))} g` },
      { label: "Fluid total", value: `${round(fuelingSteps.reduce((sum, step) => sum + step.fluid, 0))} ml` },
      { label: "Sodium", value: `${round(sodiumMgPerHour)} mg/h` },
      { label: "Gut delivery", value: `${round(fuelingPhysiology.gutDeliveryPct)}%` },
      { label: "Glycogen end", value: `${round(glycogenDepletion.finalRemaining)} g` },
      { label: "Steps", value: `${fuelingTimelineSteps.length}` },
    ],
    [fuelingSteps, sodiumMgPerHour, fuelingPhysiology.gutDeliveryPct, glycogenDepletion.finalRemaining, fuelingTimelineSteps.length],
  );

  const selectedExecutedKj = useMemo(
    () => selectedExecutedSessions.reduce((sum, session) => sum + n(session.kj, 0), 0),
    [selectedExecutedSessions],
  );

  const nutritionStateCards = useMemo<
    Array<{ label: string; value: string; tone: "amber" | "cyan" | "green" | "rose" | "slate" }>
  >(
    () => [
      {
        label: "Bioenergetic",
        value: `${round(bioenergeticModulation?.mitochondrialReadinessScore ?? 55)}/100`,
        tone:
          bioenergeticModulation?.state === "protective"
            ? "rose"
            : bioenergeticModulation?.state === "watch"
              ? "amber"
              : "cyan",
      },
      {
        label: "Adaptation loop",
        value: `${round(adaptationLoop?.adaptationScore ?? 55)}/100`,
        tone:
          adaptationLoop?.status === "regenerate"
            ? "rose"
            : adaptationLoop?.status === "watch"
              ? "amber"
              : "green",
      },
    ],
    [adaptationLoop, bioenergeticModulation],
  );

  const glycogenPlot = useMemo(() => {
    const w = 760;
    const h = 230;
    const padL = 52;
    const padR = 28;
    const padT = 18;
    const padB = 36;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const maxX = Math.max(1, glycogenDepletion.totalHours);
    const toX = (x: number) => padL + (x / maxX) * chartW;
    const toY = (pct: number) => padT + ((100 - pct) / 100) * chartH;
    const plotted = glycogenDepletion.points.map((p) => ({ x: toX(p.xHour), y: toY(p.pct) }));
    const smoothPath = buildSmoothPath(plotted);
    const areaPath = `${smoothPath} L ${toX(glycogenDepletion.totalHours)} ${toY(0)} L ${toX(0)} ${toY(0)} Z`;

    return { w, h, padL, padR, padT, padB, chartW, chartH, toX, toY, smoothPath, areaPath };
  }, [glycogenDepletion]);

  const garminPayload = useMemo(() => {
    const ftp = n(physio?.ftp_watts, 260);
    const steps: GarminFuelingStep[] = fuelingProtocol.map((slot) => {
      const raw = slot.time.replace("'", "").trim();
      const minute_offset = raw.startsWith("+") ? Number(raw.slice(1)) : raw.startsWith("-") ? -Number(raw.slice(1)) : Number(raw);
      return {
        phase: slot.phase,
        minute_offset: Number.isFinite(minute_offset) ? minute_offset : 0,
        icon: slot.icon,
        protocol: slot.plan,
        cho_g: slot.cho,
        hydration_ml: slot.fluid,
        notes: slot.notes,
      };
    });

    const totalCho = steps.reduce((s, x) => s + x.cho_g, 0);
    const totalHydration = steps.reduce((s, x) => s + x.hydration_ml, 0);

    return {
      schema: "empathy.garmin.fueling.v1",
      generated_at: new Date().toISOString(),
      athlete_id: athleteId,
      sport: predictorSport,
      estimated_intensity_pct_ftp: effectiveSessionIntensityPctFtp,
      ftp_watts: ftp,
      estimated_event_duration_min: effectiveSessionDurationMin,
      fueling_targets: {
        cho_g_h: resolvedFuelingChoGPerHour,
        fluid_ml_h: fluidMlPerHour,
        sodium_mg_h: sodiumMgPerHour,
      },
      fueling_tier: resolvedFuelingTier,
      fueling_band: resolvedFuelingTierBand,
      glycogen_projection: {
        total_g: glycogenDepletion.totalGlycogen,
        consume_total_g: glycogenDepletion.totalConsume,
        fueling_total_g: glycogenDepletion.totalIntake,
        absorbed_total_g: glycogenDepletion.totalAbsorbed,
        cori_total_g: glycogenDepletion.totalCori,
        net_total_g: glycogenDepletion.totalNet,
        remaining_g: glycogenDepletion.finalRemaining,
        remaining_pct: glycogenDepletion.finalPct,
        zone: glycogenDepletion.finalZone,
      },
      protocol_summary: {
        steps_count: steps.length,
        cho_total_g: totalCho,
        hydration_total_ml: totalHydration,
      },
      steps,
    };
  }, [
    athleteId,
    fluidMlPerHour,
    resolvedFuelingChoGPerHour,
    fuelingProtocol,
    glycogenDepletion,
    physio,
    predictorSport,
    effectiveSessionDurationMin,
    effectiveSessionIntensityPctFtp,
    resolvedFuelingTier,
    resolvedFuelingTierBand,
    sodiumMgPerHour,
  ]);

  const predictor = useMemo(() => {
    const ftp = n(physio?.ftp_watts, 260);
    const intensity = clamp(predictorEffectiveIntensityPctFtp / 100, 0.45, 1.1);
    const powerW = ftp * intensity;
    const metabolicKcalH = powerW * 3.587;
    const choFrac = clamp(
      intensity >= 0.9 ? 0.92 : intensity >= 0.82 ? 0.82 : intensity >= 0.72 ? 0.68 : intensity >= 0.62 ? 0.55 : 0.45,
      0.4,
      0.96,
    );
    const physiologyChoFrac = clamp(fuelingPhysiology.choSharePct / 100, 0.45, 0.96);
    const choGH = (metabolicKcalH * choFrac) / 4;
    const muscleKg = n(profile?.muscle_mass_kg, n(profile?.weight_kg, 72) * 0.45);
    const involvedFractionMap: Record<string, number> = {
      Running: 0.78,
      Ciclismo: 0.66,
      Nuoto: 0.72,
      "XC Ski": 0.82,
      Triathlon: 0.8,
      Canoa: 0.58,
      MTB: 0.7,
    };
    const involved = involvedFractionMap[predictorSport] ?? 0.68;
    const muscleGlycogen = muscleKg * 12.5 * involved;
    const liverGlycogen = 95;
    const totalGlycogen = muscleGlycogen + liverGlycogen;
    const eventHours = predictorEffectiveTimeMin / 60;
    const fuelingTotal = resolvedFuelingChoGPerHour * eventHours;
    const absorbedFuelingTotal = fuelingTotal * (fuelingPhysiology.gutDeliveryPct / 100);
    const coriTotal = fuelingPhysiology.coriReturnG > 0 ? round(fuelingPhysiology.coriReturnG * Math.max(1, eventHours / glycogenDepletion.totalHours), 1) : 0;
    const modelChoGH = round((metabolicKcalH * physiologyChoFrac) / 4, 1);
    const netDrainPerHour = Math.max(0, modelChoGH - absorbedFuelingTotal / Math.max(1, eventHours) - coriTotal / Math.max(1, eventHours));
    const exhaustionHours = netDrainPerHour > 0 ? totalGlycogen / netDrainPerHour : 999;
    const totalEnergy = metabolicKcalH * eventHours;
    const maxSustainablePct =
      exhaustionHours >= eventHours ? predictorEffectiveIntensityPctFtp : round(Math.max(55, predictorEffectiveIntensityPctFtp * (exhaustionHours / eventHours)));

    return {
      ftp,
      intensity,
      powerW,
      metabolicKcalH,
      choGH: modelChoGH,
      totalGlycogen,
      eventHours,
      totalEnergy,
      fuelingTotal,
      absorbedFuelingTotal,
      coriTotal,
      exhaustionHours,
      maxSustainablePct,
    };
  }, [physio, profile, predictorEffectiveIntensityPctFtp, predictorSport, predictorEffectiveTimeMin, resolvedFuelingChoGPerHour, fuelingPhysiology, glycogenDepletion.totalHours]);

  async function handleSaveNutrition() {
    if (!athleteId) return;
    setSaving(true);
    setError(null);

    const existingRoutine = record(profile?.routine_config);
    const existingNutrition = record(profile?.nutrition_config);

    const payloadNutrition = {
      ...existingNutrition,
      meal_plan: {
        daily_kcal: round(resolvedMealDailyEnergyKcal),
        meal_strategy: mealStrategy,
        caloric_split: {
          breakfast_pct: caloricSplit.breakfast,
          lunch_pct: caloricSplit.lunch,
          dinner_pct: caloricSplit.dinner,
          snacks_pct: caloricSplit.snacks,
        },
        macro_split: {
          carbs_pct: macroSplit.carbs,
          protein_pct: macroSplit.protein,
          fat_pct: macroSplit.fat,
        },
      },
      fueling: {
        session_duration_min: sessionDurationMin,
        session_intensity_pct_ftp: sessionIntensityPctFtp,
        cho_g_h: resolvedFuelingChoGPerHour,
        fluid_ml_h: fluidMlPerHour,
        sodium_mg_h: sodiumMgPerHour,
        cofactor,
      },
      performance_predictor: {
        sport: predictorSport,
        distance_km: predictorDistanceKm,
        event_time_min: predictorTimeMin,
        intensity_pct_ftp: predictorIntensityPctFtp,
      },
      nutriomics_engine: {
        dominant_stimulus: dominantStimulus,
        omics_inputs: ["epigenetica", "microbiota", "blood panels", "intolleranze", "ritmi circadiani", "training analyzer"],
      },
      updated_at: new Date().toISOString(),
    };

    const payloadRoutine = {
      ...existingRoutine,
      meal_times: {
        breakfast: mealTimes.breakfast,
        lunch: mealTimes.lunch,
        dinner: mealTimes.dinner,
        snack_am: mealTimes.snack_am,
        snack_pm: mealTimes.snack_pm,
        snacks: mealTimes.snack_pm,
      },
    };

    try {
      await saveNutritionProfileConfig({
        athleteId,
        nutrition_config: payloadNutrition,
        routine_config: payloadRoutine,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore salvataggio configurazione nutrizione");
    }
    setSaving(false);
  }

  async function runFoodLookupForQuery(rawQuery: string) {
    const q = rawQuery.trim();
    if (!q) return;
    setFoodLookupLoading(true);
    setFoodLookupError(null);
    try {
      const url = `/api/nutrition/food-lookup?q=${encodeURIComponent(q)}&brands=${encodeURIComponent(preferredBrands.join(","))}`;
      const res = await fetch(url, { method: "GET" });
      const payload = (await res.json()) as { items?: FoodLookupItem[]; error?: string };
      if (!res.ok) throw new Error(payload.error || "Lookup error");
      setFoodLookupResults(Array.isArray(payload.items) ? payload.items : []);
      setFoodQuery(q);
    } catch (e) {
      setFoodLookupError(e instanceof Error ? e.message : "Errore lookup alimenti");
      setFoodLookupResults([]);
    } finally {
      setFoodLookupLoading(false);
    }
  }

  async function runFoodLookup() {
    await runFoodLookupForQuery(foodQuery);
  }

  async function runFoodLookupFromPathway(query: string) {
    await runFoodLookupForQuery(query);
    router.push("/nutrition/integration");
  }

  async function fetchUsdaRichForCatalog(catalogId: string) {
    setUsdaRichByCatalogId((prev) => ({ ...prev, [catalogId]: { loading: true } }));
    try {
      const res = await fetch(`/api/nutrition/usda-by-nutrient?catalogId=${encodeURIComponent(catalogId)}`);
      const payload = (await res.json()) as { foods?: UsdaRichFoodItemViewModel[]; error?: string };
      if (!res.ok) {
        setUsdaRichByCatalogId((prev) => ({
          ...prev,
          [catalogId]: {
            loading: false,
            error: payload.error || `Errore USDA (${res.status})`,
            foods: [],
          },
        }));
        return;
      }
      setUsdaRichByCatalogId((prev) => ({
        ...prev,
        [catalogId]: {
          loading: false,
          foods: Array.isArray(payload.foods) ? payload.foods : [],
          error: undefined,
        },
      }));
    } catch (e) {
      setUsdaRichByCatalogId((prev) => ({
        ...prev,
        [catalogId]: {
          loading: false,
          error: e instanceof Error ? e.message : "Errore rete",
          foods: [],
        },
      }));
    }
  }

  async function saveLookupItemToCatalog(item: FoodLookupItem) {
    const key = `${item.source}-${item.brand ?? "na"}-${item.label}`;
    setSavingCatalogKey(key);
    setFoodLookupError(null);
    try {
      await saveNutritionLookupItem({
        source: item.source,
        brand: item.brand,
        product_name: item.label,
        category: "fueling",
        kcal_100g: item.kcal_100,
        cho_100g: item.carbs_100,
        protein_100g: item.protein_100,
        fat_100g: item.fat_100,
        sodium_mg_100g: item.sodium_mg_100,
        metadata: {
          saved_from: "nutrition_fueling_lookup",
          query: foodQuery.trim(),
          saved_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      setFoodLookupError(err instanceof Error ? err.message : "Errore salvataggio catalogo");
    }
    setSavingCatalogKey(null);
  }

  async function exportGarminFuelingPayload() {
    if (!athleteId) return;
    setGarminExporting(true);
    setGarminMessage(null);
    try {
      await saveNutritionDeviceExport({
        athlete_id: athleteId,
        provider: "garmin_connectiq",
        payload: garminPayload,
      });
      setGarminMessage("Payload Garmin creato e salvato nello storico sync.");

      const blob = new Blob([JSON.stringify(garminPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `empathy-garmin-fueling-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setGarminMessage(
        `Export JSON creato, ma salvataggio DB non disponibile: ${err instanceof Error ? err.message : "errore sconosciuto"}`,
      );
    } finally {
      setGarminExporting(false);
    }
  }

  return (
    <Pro2ModulePageShell
      eyebrow="Metabolic Fuel Console"
      eyebrowClassName="text-pink-400"
      title="Nutrition · Nutriomics Engine"
      description={
        <span className="text-slate-400">{role === "coach" ? "Coach mode" : "Private mode"}</span>
      }
    >
      {error && <div className="alert-error">{error}</div>}

      {athleteLoading || loading ? (
        <p className="text-slate-500">Caricamento...</p>
      ) : !athleteId ? (
        <p className="text-slate-500">Nessun atleta attivo. Se sei coach, imposta l&apos;atleta in Athletes.</p>
      ) : (
        <>
          <section className="viz-card builder-panel space-y-4" style={{ marginBottom: "12px" }}>
            <div className="flex flex-col gap-3">
              <div className="min-w-0 flex-1">
                <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Aree nutrition</p>
                <NutritionSubnav />
              </div>
            </div>
            {subRoute === "meal-plan" ? (
              <NutritionMealPlanDailyTargets
                complianceTargets={{
                  kcal: complianceOverview.target.kcal,
                  carbs: complianceOverview.target.carbs,
                  protein: complianceOverview.target.protein,
                  fat: complianceOverview.target.fat,
                }}
                dateLabel={selectedPlanDateLabel}
                hydrationMinDailyMl={hydrationPlan.minDailyMl}
                selectedExecutedKj={selectedExecutedKj}
                sessionLoadKcalEstimate={nutritionDayModel?.training.kcal ?? effectiveDayContext.summary.totalKcal}
                round={round}
              />
            ) : null}
          </section>
          {subRoute === "meal-plan" && athleteId ? (
            <NutritionMealPlanLeadPanels
              researchTraceSummaries={researchTraceSummaries}
              nutritionSectorBoxes={nutritionSectorBoxes}
              pathwayModulation={pathwayModulation}
              functionalFoodRecommendations={functionalFoodRecommendations}
            />
          ) : null}

          {(subRoute === "meal-plan" ||
            subRoute === "fueling" ||
            subRoute === "diary" ||
            subRoute === "predictor") ? (
            <section className="viz-card builder-panel border border-emerald-500/25 bg-black/20 px-4 py-3 sm:px-5">
              <label className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Giorno da visualizzare</span>
                <select
                  className={cn(
                    "w-full rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/50 to-black/50 px-4 py-3",
                    "text-sm font-semibold text-white shadow-inner outline-none transition",
                    "hover:border-emerald-400/55 focus:ring-2 focus:ring-emerald-400/35 sm:max-w-md sm:flex-1",
                  )}
                  aria-label="Seleziona giorno piano pasti"
                  value={selectedPlanDate}
                  onChange={(e) => setSelectedPlanDate(e.target.value)}
                >
                  {planDateOptions.map((d) => (
                    <option key={d} value={d}>
                      {new Date(`${d}T00:00:00`).toLocaleDateString("it-IT", {
                        weekday: "long",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          ) : null}

          {subRoute === "meal-plan" && athleteId ? (
            <NutritionMealPlanWorkspace
              athleteId={athleteId}
              role={role}
              mealDisplayByKey={mealDisplayByKey}
              mealPathwayBySlot={mealPathwayBySlot}
              pathwayModulation={pathwayModulation}
              intelligentMealPlan={intelligentMealPlan}
              intelligentMealLoading={intelligentMealLoading}
              intelligentMealError={intelligentMealError}
              canRequestIntelligentPlan={Boolean(intelligentMealPlanRequest)}
              onGenerateIntelligentMealPlan={handleGenerateIntelligentMealPlan}
              onResetIntelligentMealPlan={() => {
                setIntelligentMealPlan(null);
                setCoachMealRemovalKeys(new Set());
                setCoachSessionFoodExclusions([]);
              }}
              coachMealRemovalKeys={coachMealRemovalKeys}
              coachSessionFoodExclusions={coachSessionFoodExclusions}
              onCoachShowAllItems={() => setCoachMealRemovalKeys(new Set())}
              onCoachClearSessionExclusions={() => setCoachSessionFoodExclusions([])}
              removeCoachMealPlanItem={removeCoachMealPlanItem}
              persistFoodExclusionToProfile={persistFoodExclusionToProfile}
              profileFoodExcludeBusy={profileFoodExcludeBusy}
              mealTabMicronutrientProps={mealTabMicronutrientProps}
              nutritionStateCards={nutritionStateCards}
              saving={saving}
              onSaveNutrition={handleSaveNutrition}
            />
          ) : null}

          {subRoute === "fueling" ? (
          <section id="nutrition-fueling" className="scroll-mt-28 mb-10 space-y-4">
            <header className="nutrition-fueling-hero px-4 py-3">
              <h2 className="text-lg font-bold text-white drop-shadow-[0_0_12px_rgba(217,70,239,0.35)]">Fueling</h2>
              <p className="mt-1 text-sm text-slate-300">
                Pre, intra e post — CHO, fluidi e timeline sul contesto giorno.
              </p>
            </header>
            <section className="viz-card builder-panel" style={{ marginBottom: "12px" }}>
              <div className="nutrition-section-head">
                <h3 className="viz-title">Fueling Plan · pre / intra / post</h3>
              </div>
              <div className="nutrition-detail-rail" style={{ marginBottom: "10px" }}>
                <span><strong>Giorno:</strong> {selectedPlanDateShort}</span>
                <span><strong>Durata contesto:</strong> {round(effectiveSessionDurationMin)} min</span>
                <span><strong>Intensita stimata:</strong> {round(effectiveSessionIntensityPctFtp)}% FTP</span>
                <span><strong>Tier fueling:</strong> {resolvedFuelingTierBand}</span>
                {resolvedEstimatedAvgPowerW != null && <span><strong>Potenza media stimata:</strong> {round(resolvedEstimatedAvgPowerW)} W</span>}
                <span><strong>CHO delivery:</strong> {round(fuelingPhysiology.gutDeliveryPct)}%</span>
                <span><strong>Cori return:</strong> {round(fuelingPhysiology.coriReturnG)} g</span>
                <span><strong>Redox:</strong> {round(fuelingPhysiology.redoxPct)}/100</span>
                {effectiveDayContext.summary.hasPlannedSession || effectiveDayContext.summary.hasExecutedSession ? (
                  <span>
                    <strong>{effectiveDayContext.mode === "executed" ? "TSS actual" : "TSS target"}:</strong> {round(effectiveDayContext.summary.totalTss)}
                  </span>
                ) : null}
              </div>
              <div className="kpi-grid" style={{ marginBottom: "10px" }}>
                {fuelingOpsCards.map((card) => (
                  <div key={card.label} className={`kpi-card signal-board-card tone-${nutritionToneForLabel(card.label)}`}>
                    <div className="kpi-card-label">
                      <span className="signal-board-dot" />
                      {card.label}
                    </div>
                    <div className="kpi-card-value">{card.value}</div>
                  </div>
                ))}
              </div>
              {recoverySummary?.status === "poor" || recoverySummary?.status === "moderate" ? (
                <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                  <summary>Recovery notes</summary>
                  <div className="alert-warning" style={{ marginBottom: 0 }}>
                    {recoverySummary.status === "poor"
                      ? "Recovery bassa: privilegia fueling piu' semplice e progressivo, controlla tolleranza GI e evita aggressivita' inutile nella giornata."
                      : "Recovery intermedia: mantieni attenzione a densita' del fueling, idratazione e finestra post-workout."}
                  </div>
                </details>
              ) : null}
              {fuelingTrainingContext.length ? (
                <section
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  {fuelingTrainingContext.map((session) => (
                    <article
                      key={session.id}
                      style={{
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 10,
                        padding: 12,
                        background: "rgba(9, 11, 16, 0.72)",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                        <strong>{session.title}</strong>
                        <span style={{ opacity: 0.72, fontSize: 12 }}>{session.family ?? "session"}</span>
                      </div>
                      <div style={{ color: "var(--empathy-text-muted)", fontSize: 12 }}>
                        {session.discipline ?? "training"} · {session.durationMin} min · {session.tss} TSS
                      </div>
                      {session.target ? (
                        <div style={{ fontSize: 12 }}>
                          <strong>Target:</strong> {session.target}
                        </div>
                      ) : null}
                      {session.intensityCues.length ? (
                        <div style={{ fontSize: 12 }}>
                          <strong>Intensity:</strong> {session.intensityCues.join(" · ")}
                        </div>
                      ) : null}
                      {session.blockLabels.length ? (
                        <div style={{ fontSize: 12 }}>
                          <strong>Blocks:</strong> {session.blockLabels.join(" · ")}
                        </div>
                      ) : null}
                      {session.physiologicalIntent.length ? (
                        <div style={{ fontSize: 12 }}>
                          <strong>Intent:</strong> {session.physiologicalIntent.join(" · ")}
                        </div>
                      ) : null}
                      {session.nutritionSupports.length ? (
                        <div style={{ fontSize: 12 }}>
                          <strong>Supports:</strong> {session.nutritionSupports.join(" · ")}
                        </div>
                      ) : null}
                      {session.inhibitorsAndRisks.length ? (
                        <div style={{ fontSize: 12 }}>
                          <strong>Risks:</strong> {session.inhibitorsAndRisks.join(" · ")}
                        </div>
                      ) : null}
                      <SessionKnowledgeSummary contract={session.builderContract} compact />
                    </article>
                  ))}
                </section>
              ) : null}
              {knowledgeFuelingHints.intents.length || knowledgeFuelingHints.supports.length || knowledgeFuelingHints.risks.length ? (
                <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                  <summary>Knowledge-driven fueling context</summary>
                  <div style={{ display: "grid", gap: 8 }}>
                    {knowledgeFuelingHints.intents.length ? (
                      <div className="session-sub-copy">
                        Intento fisiologico · {knowledgeFuelingHints.intents.join(" · ")}
                      </div>
                    ) : null}
                    {knowledgeFuelingHints.supports.length ? (
                      <div className="session-sub-copy">
                        Supporti prioritari · {knowledgeFuelingHints.supports.join(" · ")}
                      </div>
                    ) : null}
                    {knowledgeFuelingHints.risks.length ? (
                      <div className="muted-copy">
                        Vincoli e rischi · {knowledgeFuelingHints.risks.join(" · ")}
                      </div>
                    ) : null}
                  </div>
                </details>
              ) : null}
              <div className="fueling-vertical-timeline">
                {fuelingTimelineSteps.map((step, idx) => (
                  <article key={`step-${step.phase}-${step.time}-${idx}`} className="fueling-vstep">
                    {(() => {
                      const phaseColor = fuelingPhaseColor(step.phase);
                      return (
                        <>
                    <div className="fueling-vrail">
                      <span className="fueling-vdot" style={{ background: `${phaseColor}22`, border: `1px solid ${phaseColor}`, color: phaseColor }}>
                        {idx + 1}
                      </span>
                      {idx < fuelingTimelineSteps.length - 1 && <span className="fueling-vline" style={{ background: `${phaseColor}66` }} />}
                    </div>
                    <div className="fueling-vcard">
                      <a
                        href={step.product?.productUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="fueling-step-media-link flex items-center justify-center"
                        aria-label={step.product?.product ?? "Prodotto fueling"}
                      >
                        <div className="fueling-step-fallback flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/10 to-orange-500/5">
                          <Package className="h-9 w-9 text-fuchsia-300/90" strokeWidth={1.75} aria-hidden />
                        </div>
                      </a>
                      <div className="fueling-step-body">
                        <span
                          className="fueling-step-time"
                          style={{
                            color: phaseColor,
                            border: `1px solid ${phaseColor}`,
                            background: `${phaseColor}22`,
                            borderRadius: "999px",
                            padding: "2px 8px",
                            display: "inline-block",
                          }}
                        >
                          {step.phase} · {step.time}
                        </span>
                        <strong>{step.product?.product ?? "Fuel product"}</strong>
                        <small>{step.product?.brand ?? "Brand"}</small>
                        <div className="fueling-step-chip-row">
                          <span>CHO {step.cho}g</span>
                          <span>Fluid {step.fluid}ml</span>
                          {step.product?.format ? <span>{step.product.format}</span> : null}
                          {step.product?.functionalFocus?.[0] ? <span>{step.product.functionalFocus[0]}</span> : null}
                        </div>
                        <div className="fueling-step-actions">
                          <a
                            href={step.product?.productUrl ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="fueling-step-link"
                          >
                            Product link
                          </a>
                        </div>
                      </div>
                    </div>
                        </>
                      );
                    })()}
                  </article>
                ))}
              </div>

              <details className="collapsible-card">
                <summary>Hydration protocol</summary>
                <section className="fueling-hydration-strip" style={{ marginBottom: 0 }}>
                  <div className="fueling-hydration-grid">
                    {hydrationTimeline.map((h) => (
                      <div key={`hydration-${h.minuteLabel}`} className="fueling-hydration-chip">
                        <strong>{h.minuteLabel}</strong>
                        <span>{h.note}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </details>

              <section className="fueling-visual-report">
                <h4>Fueling Visual Report</h4>
                <div className="fueling-metric-grid">
                  {fuelingVisualMetrics.map((metric) => (
                    <article key={metric.label} className="fueling-metric-card">
                      <div className="fueling-metric-head">
                        <label>{metric.label}</label>
                        <strong>{metric.value} {metric.unit}</strong>
                      </div>
                      <div className="fueling-metric-bar">
                        <div className="fueling-metric-fill" style={{ width: `${metric.pct}%`, background: metric.color }} />
                      </div>
                    </article>
                  ))}
                </div>
                <div className="fueling-glyco-future">
                  <h5>Glycogen depletion</h5>
                  <div className="nutrition-detail-rail" style={{ marginBottom: "8px" }}>
                    <span><strong>Intake raw:</strong> {glycogenDepletion.totalIntake} g</span>
                    <span><strong>Assorbiti:</strong> {glycogenDepletion.totalAbsorbed} g</span>
                    <span><strong>Cori:</strong> {glycogenDepletion.totalCori} g</span>
                    <span><strong>Gut risk:</strong> {fuelingPhysiology.gutPathwayRisk}</span>
                  </div>
                  <svg viewBox={`0 0 ${glycogenPlot.w} ${glycogenPlot.h}`} className="fueling-glyco-svg">
                    <defs>
                      <linearGradient id="glycoArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={FUELING_CHART_THEME_PRO2.areaTop} stopOpacity="0.45" />
                        <stop offset="100%" stopColor={FUELING_CHART_THEME_PRO2.areaBottom} stopOpacity="0.04" />
                      </linearGradient>
                    </defs>
                    <rect x={glycogenPlot.padL} y={glycogenPlot.padT} width={glycogenPlot.chartW} height={glycogenPlot.chartH} fill="rgba(255,255,255,0.02)" rx="8" />
                    <rect x={glycogenPlot.padL} y={glycogenPlot.toY(100)} width={glycogenPlot.chartW} height={glycogenPlot.toY(60) - glycogenPlot.toY(100)} fill={FUELING_CHART_THEME_PRO2.zoneGreen} />
                    <rect x={glycogenPlot.padL} y={glycogenPlot.toY(60)} width={glycogenPlot.chartW} height={glycogenPlot.toY(30) - glycogenPlot.toY(60)} fill={FUELING_CHART_THEME_PRO2.zoneYellow} />
                    <rect x={glycogenPlot.padL} y={glycogenPlot.toY(30)} width={glycogenPlot.chartW} height={glycogenPlot.toY(0) - glycogenPlot.toY(30)} fill={FUELING_CHART_THEME_PRO2.zoneRed} />
                    <path
                      d={glycogenPlot.areaPath}
                      fill="url(#glycoArea)"
                    />
                    <path fill="none" stroke={FUELING_CHART_THEME_PRO2.line} strokeWidth="3" d={glycogenPlot.smoothPath} />
                    {glycogenDepletion.points.map((p) => (
                      <circle key={`g-${p.xHour}-${p.pct}`} cx={glycogenPlot.toX(p.xHour)} cy={glycogenPlot.toY(p.pct)} r="4" fill={FUELING_CHART_THEME_PRO2.dot} />
                    ))}
                    <line x1={glycogenPlot.padL} y1={glycogenPlot.toY(60)} x2={glycogenPlot.w - glycogenPlot.padR} y2={glycogenPlot.toY(60)} stroke="rgba(103,232,249,0.5)" strokeDasharray="4 6" />
                    <line x1={glycogenPlot.padL} y1={glycogenPlot.toY(30)} x2={glycogenPlot.w - glycogenPlot.padR} y2={glycogenPlot.toY(30)} stroke="rgba(248,113,113,0.55)" strokeDasharray="4 6" />
                    <line x1={glycogenPlot.padL} y1={glycogenPlot.padT} x2={glycogenPlot.padL} y2={glycogenPlot.h - glycogenPlot.padB} stroke={FUELING_CHART_THEME_PRO2.axis} />
                    <line x1={glycogenPlot.padL} y1={glycogenPlot.h - glycogenPlot.padB} x2={glycogenPlot.w - glycogenPlot.padR} y2={glycogenPlot.h - glycogenPlot.padB} stroke={FUELING_CHART_THEME_PRO2.axis} />
                    {[100, 80, 60, 40, 30, 20, 0].map((pct) => (
                      <text key={`y-${pct}`} x={8} y={glycogenPlot.toY(pct) + 4} fill={FUELING_CHART_THEME_PRO2.text} fontSize="10">
                        {pct}% · {round((glycogenDepletion.totalGlycogen * pct) / 100)}g
                      </text>
                    ))}
                    {Array.from({ length: Math.floor(glycogenDepletion.totalHours) + 1 }, (_, i) => i).map((hTick) => (
                      <text key={`x-${hTick}`} x={glycogenPlot.toX(hTick) - 8} y={glycogenPlot.h - 8} fill={FUELING_CHART_THEME_PRO2.text} fontSize="10">
                        {hTick}h
                      </text>
                    ))}
                    <text x={glycogenPlot.w - 188} y={16} fill={FUELING_CHART_THEME_PRO2.text} fontSize="10">Y: glicogeno disponibile (g / %)</text>
                    <text x={glycogenPlot.w - 118} y={glycogenPlot.h - 8} fill={FUELING_CHART_THEME_PRO2.text} fontSize="10">X: tempo</text>
                  </svg>
                </div>
              </section>
            </section>
          </section>
          ) : null}

          {subRoute === "integration" ? (
          <section id="nutrition-integration" className="scroll-mt-28 mb-10 space-y-4">
            <header className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3">
              <h2 className="text-lg font-bold text-white">Integrazione</h2>
              <p className="mt-1 text-sm text-gray-400">Modello pathway, KPI, USDA e prodotti — stessi segnali del modulo.</p>
            </header>
            <section className="viz-card builder-panel" style={{ marginBottom: "12px" }}>
              <h3 className="viz-title">Integration Stack</h3>
              <p className="nutrition-muted" style={{ fontSize: "0.85rem", marginBottom: "10px" }}>
                KPI e tabella sotto sono agganciati al <strong>modello vie metaboliche</strong> e alle{" "}
                <strong>leve operative</strong> (stessi segnali dei pannelli condivisi in alto). Timing = classi qualitative
                di emivita, non PK individuali.
              </p>
              <h4 className="nutrition-section-band" style={{ fontSize: "0.9rem", marginBottom: "8px" }}>
                Stato integrativo (pathway + solver)
              </h4>
              <div className="kpi-grid" style={{ marginBottom: "14px" }}>
                {integrationDynamicsSummary.map((card) => (
                  <div key={card.label} className={`kpi-card signal-board-card tone-${nutritionToneForLabel(card.label)}`}>
                    <div className="kpi-card-label">
                      <span className="signal-board-dot" />
                      {card.label}
                    </div>
                    <div className="kpi-card-value">{card.value}</div>
                  </div>
                ))}
              </div>
              <h4 className="nutrition-section-band" style={{ fontSize: "0.9rem", marginBottom: "8px" }}>
                Catalogo integratori (brand / focus)
              </h4>
              <div className="kpi-grid" style={{ marginBottom: "10px" }}>
                {integrationStackSummary.map((card) => (
                  <div key={card.label} className={`kpi-card signal-board-card tone-${nutritionToneForLabel(card.label)}`}>
                    <div className="kpi-card-label">
                      <span className="signal-board-dot" />
                      {card.label}
                    </div>
                    <div className="kpi-card-value">{card.value}</div>
                  </div>
                ))}
              </div>
              {nutritionPerformanceIntegration?.rationale.length ? (
                <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                  <summary>Leve operative (rationale solver)</summary>
                  <ul style={{ margin: "8px 0 0", paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
                    {nutritionPerformanceIntegration.rationale.map((line) => (
                      <li key={line} style={{ marginBottom: "4px" }}>
                        {line}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {nutritionPerformanceIntegration?.diaryInsight ? (
                <p className="muted-copy" style={{ fontSize: 12, marginBottom: 10, lineHeight: 1.45 }}>
                  Diario reale (finestra {nutritionPerformanceIntegration.diaryInsight.windowDays} giorni,{" "}
                  {nutritionPerformanceIntegration.diaryInsight.loggedDays} con voci): energia media ~{" "}
                  {nutritionPerformanceIntegration.diaryInsight.avgDailyKcal ?? "—"} kcal
                  {nutritionPerformanceIntegration.diaryInsight.estimatedMaintenanceKcal != null
                    ? ` vs fabbisogno stimato ~${nutritionPerformanceIntegration.diaryInsight.estimatedMaintenanceKcal} kcal`
                    : ""}
                  {nutritionPerformanceIntegration.diaryInsight.energyAdequacyRatio != null
                    ? ` (${Math.round(nutritionPerformanceIntegration.diaryInsight.energyAdequacyRatio * 100)}% del target)`
                    : ""}
                  . Usato per modulare le leve training↔nutrizione (non sostituisce i motori fisiologici).
                </p>
              ) : null}
              <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                <summary>+ Vie metaboliche · substrati, cofattori, inibitori, timing</summary>
                <div className="table-shell" style={{ marginTop: "10px" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Via / stimolo</th>
                        <th>Fonte segnale</th>
                        <th>Strategia (substrati)</th>
                        <th>Supporto integrativo &amp; attenuazioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pathwayModulation?.pathways.length ? (
                        pathwayModulation.pathways.map((pw) => (
                          <tr key={pw.id}>
                            <td>
                              <strong>{pw.pathwayLabel}</strong>
                              <div className="nutrition-muted" style={{ fontSize: "0.75rem", marginTop: "4px" }}>
                                {pw.stimulatedBy.length ? pw.stimulatedBy.join(", ") : "—"}
                              </div>
                            </td>
                            <td>{pw.confidence}</td>
                            <td>{pw.substrates.join("; ")}</td>
                            <td>
                              <span style={{ display: "block", marginBottom: "4px" }}>
                                <strong>Cofattori:</strong> {pw.cofactors.join("; ") || "—"}
                              </span>
                              {pw.inhibitorsToAvoid.length ? (
                                <span style={{ fontSize: "0.82rem" }}>
                                  <strong>Attenuare:</strong> {pw.inhibitorsToAvoid.join("; ")}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4}>
                            Nessuna via calcolata per <strong>{selectedPlanDateLabel}</strong>: aggiungi una seduta pianificata
                            o verifica twin/fisiologia. I template engine (glicogeno, redox, gut) compaiono quando ci sono
                            stimoli o segnali.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {pathwayModulation?.pathways.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                    <div className="nutrition-muted" style={{ fontSize: "0.78rem", marginBottom: "4px" }}>
                      Timing operativo (fasi · classi emivita)
                    </div>
                    {pathwayModulation.pathways.map((pw) => (
                      <div
                        key={`${pw.id}-timing`}
                        style={{ fontSize: "0.82rem", borderLeft: "2px solid rgba(14,165,233,0.4)", paddingLeft: "10px" }}
                      >
                        <strong>{pw.pathwayLabel}</strong>
                        <ul style={{ margin: "6px 0 0", paddingLeft: "1rem" }}>
                          {pw.phases.map((ph) => (
                            <li key={`${pw.id}-${ph.phase}-${ph.windowLabel}`} style={{ marginBottom: "4px" }}>
                              <strong>
                                {ph.phase === "pre_acute"
                                  ? "Pre acuto"
                                  : ph.phase === "peri_workout"
                                    ? "Peri-seduta"
                                    : ph.phase === "early_recovery"
                                      ? "Recovery precoce"
                                      : ph.phase === "late_recovery"
                                        ? "Recovery tardiva"
                                        : "Supporto giornaliero"}
                              </strong>
                              {" · "}
                              {ph.windowLabel} <span className="nutrition-muted">({ph.halfLifeClass})</span> — {ph.actions.join(" ")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </details>
              <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                <summary>Alimenti funzionali (vitamine, aminoacidi, cofattori) → OFF / USDA branded / FDC per nutriente</summary>
                <p className="nutrition-muted" style={{ fontSize: "0.8rem", marginTop: "8px", marginBottom: "10px" }}>
                  Per ogni <strong>molecola / nutriente</strong> collegato alle vie attive: esempi curati, ricerca prodotti nel tab Pasti
                  (OpenFoodFacts + USDA branded + interni), e — con variabile server <span className="nutrition-muted">USDA_API_KEY</span> — elenco{" "}
                  <strong>Foundation / SR Legacy</strong> dalla FoodData Central filtrato per nutriente FDC e ordinato per densità (poi scegli e
                  incrocia con il profilo).
                </p>
                {functionalFoodRecommendations.targets.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {functionalFoodRecommendations.targets.map((t) => (
                      <div
                        key={t.nutrientId}
                        style={{
                          border: "1px solid rgba(148,163,184,0.25)",
                          borderRadius: "8px",
                          padding: "10px 12px",
                          fontSize: "0.84rem",
                        }}
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
                          <strong>{t.displayNameIt}</strong>
                          <span className="nutrition-ui-chip">
                            {t.kind === "vitamin"
                              ? "Vitamina"
                              : t.kind === "mineral"
                                ? "Minerale"
                                : t.kind === "amino_acid"
                                  ? "Aminoacido"
                                  : t.kind === "fatty_acid"
                                    ? "Acido grasso"
                                    : "Altro"}
                          </span>
                        </div>
                        <p className="nutrition-muted" style={{ margin: "0 0 8px", fontSize: "0.8rem" }}>
                          {t.rationaleIt}
                        </p>
                        <div className="nutrition-muted" style={{ fontSize: "0.75rem", marginBottom: "8px" }}>
                          Vie: {t.pathwayLabel}
                        </div>
                        <div style={{ marginBottom: "8px" }}>
                          <strong style={{ fontSize: "0.8rem" }}>Esempi alimentari</strong>
                          <ul style={{ margin: "4px 0 0", paddingLeft: "1.1rem" }}>
                            {t.curatedExamples.map((ex) => (
                              <li key={`${t.nutrientId}-${ex.name}`} style={{ marginBottom: "4px" }}>
                                <strong>{ex.name}</strong> — {ex.why}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {t.searchQueries.map((sq) => (
                            <button
                              key={`${t.nutrientId}-${sq}`}
                              type="button"
                              className="nutrition-ui-chip"
                              style={{ cursor: "pointer" }}
                              disabled={foodLookupLoading}
                              onClick={() => void runFoodLookupFromPathway(sq)}
                            >
                              Cerca: {sq}
                            </button>
                          ))}
                        </div>
                        {t.usdaRichSearch ? (
                          <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed rgba(148,163,184,0.35)" }}>
                            <button
                              type="button"
                              className="nutrition-ui-chip"
                              style={{ cursor: "pointer", fontWeight: 600 }}
                              disabled={usdaRichByCatalogId[t.nutrientId]?.loading === true}
                              onClick={() => void fetchUsdaRichForCatalog(t.nutrientId)}
                            >
                              {usdaRichByCatalogId[t.nutrientId]?.loading
                                ? "USDA: caricamento…"
                                : `USDA (Foundation/SR): ricchi in ${t.usdaRichSearch.nutrientShortLabel}`}
                            </button>
                            {usdaRichByCatalogId[t.nutrientId]?.error ? (
                              <p className="nutrition-muted" style={{ fontSize: "0.78rem", marginTop: "8px", marginBottom: 0 }}>
                                {usdaRichByCatalogId[t.nutrientId]?.error}
                              </p>
                            ) : null}
                            {usdaRichByCatalogId[t.nutrientId]?.foods?.length ? (
                              <div style={{ marginTop: "10px", overflowX: "auto" }}>
                                <table className="nutrition-muted" style={{ fontSize: "0.75rem", width: "100%", borderCollapse: "collapse" }}>
                                  <thead>
                                    <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(148,163,184,0.3)" }}>
                                      <th style={{ padding: "4px 6px" }}>Alimento (USDA)</th>
                                      <th style={{ padding: "4px 6px" }}>Target /100 g</th>
                                      <th style={{ padding: "4px 6px" }}>P/C/F</th>
                                      <th style={{ padding: "4px 6px" }} />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {usdaRichByCatalogId[t.nutrientId]!.foods!.map((row) => (
                                      <tr key={row.fdcId} style={{ borderBottom: "1px solid rgba(148,163,184,0.12)" }}>
                                        <td style={{ padding: "6px", verticalAlign: "top" }}>
                                          <span style={{ color: "var(--foreground, inherit)" }}>{row.description}</span>
                                          <div style={{ fontSize: "0.68rem", opacity: 0.85 }}>{row.dataType}</div>
                                        </td>
                                        <td style={{ padding: "6px", whiteSpace: "nowrap" }}>
                                          {row.targetAmountPer100g != null
                                            ? `${row.targetAmountPer100g} ${row.targetUnitName ?? ""}`.trim()
                                            : "—"}
                                        </td>
                                        <td style={{ padding: "6px", whiteSpace: "nowrap", fontSize: "0.7rem" }}>
                                          {row.proteinG100 != null || row.carbsG100 != null || row.fatG100 != null
                                            ? `${row.proteinG100 ?? "—"}P / ${row.carbsG100 ?? "—"}C / ${row.fatG100 ?? "—"}F`
                                            : "—"}
                                        </td>
                                        <td style={{ padding: "6px" }}>
                                          <a
                                            href={`https://fdc.nal.usda.gov/fdc-app.html#/food-details/${row.fdcId}/nutrients`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ fontSize: "0.72rem" }}
                                          >
                                            FDC
                                          </a>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="nutrition-muted" style={{ fontSize: "0.85rem" }}>
                    Nessun target alimentare ancora: servono vie metaboliche attive (seduta + segnali). Le query compariranno qui.
                  </p>
                )}
                <ul className="nutrition-muted" style={{ fontSize: "0.72rem", marginTop: "10px", marginBottom: 0 }}>
                  {functionalFoodRecommendations.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </details>
              <div className="nutrition-detail-rail" style={{ marginTop: "10px", marginBottom: "10px" }}>
                <span>
                  <strong>Brand</strong> · {profileSupplements.length ? profileSupplements.join(" · ") : "default set"}
                </span>
              </div>
              {integrationProductCards.length ? (
                <div className="nutrition-product-grid">
                  {integrationProductCards.map((product) => (
                    <article key={`${product.brand}-${product.product}`} className="nutrition-product-card">
                      <a
                        href={product.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="nutrition-product-media-link flex min-h-[140px] items-center justify-center bg-white/5"
                      >
                        <Package className="h-12 w-12 text-violet-200/75" strokeWidth={1.6} aria-hidden />
                      </a>
                      <div className="nutrition-product-body">
                        <div className="nutrition-product-brand">{product.brand}</div>
                        <strong>{product.product}</strong>
                        <div className="nutrition-product-meta">
                          <span>{product.format}</span>
                          <span>{product.category}</span>
                          {product.functionalFocus.slice(0, 2).map((focus) => (
                            <span key={`${product.brand}-${product.product}-${focus}`}>{focus}</span>
                          ))}
                        </div>
                        <div className="nutrition-product-meta">
                          {product.timing.map((timing) => (
                            <span key={`${product.brand}-${product.product}-${timing}`}>{timing}</span>
                          ))}
                        </div>
                        <a
                          href={product.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="nutrition-product-link"
                        >
                          Open producer
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          </section>
          ) : null}

          {subRoute === "predictor" ? (
          <section id="nutrition-predictor" className="scroll-mt-28 mb-10 space-y-4">
            <header className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
              <h2 className="text-lg font-bold text-white">Predictor</h2>
              <p className="mt-1 text-sm text-gray-400">Stima consumo energetico, CHO e rischio deplezione glicogeno.</p>
            </header>
            <section className="viz-card builder-panel" style={{ marginBottom: "12px" }}>
              <h3 className="viz-title">Performance Predictor · consumo e rischio esaurimento energetico</h3>
              <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={`nutrition-ui-chip ${predictorUsePlanDay ? "active" : ""}`}
                  onClick={() => setPredictorUsePlanDay((v) => !v)}
                >
                  {predictorUsePlanDay ? "Contesto giorno attivo" : "Modalita manuale"}
                </button>
                {predictorUsePlanDay && (
                  <span className="nutrition-ui-chip active">
                    {selectedPlanDateShort} · {round(effectiveSessionDurationMin)} min · {round(effectiveSessionIntensityPctFtp)}% FTP
                  </span>
                )}
              </div>
              <div className="form-grid-two">
                <div className="form-group">
                  <label className="form-label">Sport</label>
                  <select className="form-select" value={predictorSport} onChange={(e) => setPredictorSport(e.target.value)}>
                    {SPORTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Distanza (km)</label><input className="form-input" type="number" value={predictorDistanceKm} onChange={(e) => setPredictorDistanceKm(n(e.target.value, 0))} /></div>
                <div className="form-group">
                  <label className="form-label">Tempo previsto (min)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={predictorUsePlanDay ? round(effectiveSessionDurationMin) : predictorTimeMin}
                    disabled={predictorUsePlanDay}
                    onChange={(e) => setPredictorTimeMin(n(e.target.value, 0))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Intensita % FTP</label>
                  <input
                    className="form-input"
                    type="number"
                    value={predictorUsePlanDay ? round(effectiveSessionIntensityPctFtp) : predictorIntensityPctFtp}
                    disabled={predictorUsePlanDay}
                    onChange={(e) => setPredictorIntensityPctFtp(n(e.target.value, 0))}
                  />
                </div>
              </div>
              <div className="kpi-grid" style={{ marginBottom: "10px" }}>
                <div className={`kpi-card signal-board-card tone-${nutritionToneForLabel("Power stimata")}`}><div className="kpi-card-label"><span className="signal-board-dot" />Power stimata</div><div className="kpi-card-value">{round(predictor.powerW)} W</div></div>
                <div className={`kpi-card signal-board-card tone-${nutritionToneForLabel("Consumo energetico")}`}><div className="kpi-card-label"><span className="signal-board-dot" />Consumo energetico</div><div className="kpi-card-value">{round(predictor.metabolicKcalH)} kcal/h</div></div>
                <div className={`kpi-card signal-board-card tone-${nutritionToneForLabel("CHO richiesta")}`}><div className="kpi-card-label"><span className="signal-board-dot" />CHO richiesta</div><div className="kpi-card-value">{round(predictor.choGH)} g/h</div></div>
                <div className={`kpi-card signal-board-card tone-${nutritionToneForLabel("Serbatoio glicogeno")}`}><div className="kpi-card-label"><span className="signal-board-dot" />Serbatoio glicogeno</div><div className="kpi-card-value">{round(predictor.totalGlycogen)} g</div></div>
                <div className={`kpi-card signal-board-card tone-${nutritionToneForLabel("Esaurimento stimato")}`}><div className="kpi-card-label"><span className="signal-board-dot" />Esaurimento stimato</div><div className="kpi-card-value">{predictor.exhaustionHours > 100 ? "No risk" : `${round(predictor.exhaustionHours, 1)} h`}</div></div>
                <div className={`kpi-card signal-board-card tone-${nutritionToneForLabel("% FTP sostenibile")}`}><div className="kpi-card-label"><span className="signal-board-dot" />% FTP sostenibile</div><div className="kpi-card-value">{predictor.maxSustainablePct}%</div></div>
              </div>
              <details className="collapsible-card">
                <summary>Predictor notes</summary>
                <div className="alert-warning" style={{ marginBottom: 0 }}>
                  Energia evento: {round(predictor.totalEnergy)} kcal · Fueling totale suggerito: {round(predictor.fuelingTotal)} g CHO · tier {resolvedFuelingTierBand}.
                  {predictor.exhaustionHours < predictor.eventHours
                    ? ` Rischio esaurimento prima del termine: riduci ritmo verso ${predictor.maxSustainablePct}% FTP o aumenta fueling.`
                    : " Ritmo sostenibile con il fueling impostato."}
                </div>
              </details>
            </section>
          </section>
          ) : null}

          {subRoute === "diary" ? (
          <section id="nutrition-diary" className="scroll-mt-28 mb-10 space-y-4">
            <header className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
              <h2 className="text-lg font-bold text-white">Diario alimentare</h2>
              <p className="mt-1 text-sm text-gray-400">Ingesta reale vs target — catalogo USDA e aderenza.</p>
            </header>
            <FoodDiaryPanel
              athleteId={athleteId}
              onComplianceRowsChange={onDiaryComplianceRows}
              planDateForSolverTargets={selectedPlanDate}
              planDateAnchor={selectedPlanDate}
              diaryEnergyTargetKcal={resolvedMealDailyEnergyKcal}
              diaryMacroTargetCarbsG={diaryDayMacroTargets.carbs}
              diaryMacroTargetProteinG={diaryDayMacroTargets.protein}
              diaryMacroTargetFatG={diaryDayMacroTargets.fat}
              fallbackDailyEnergyKcal={dailyEnergyKcal}
              weightKg={profile?.weight_kg ?? null}
              metabolicEfficiencyIndex={metabolicEfficiencyGenerativeModel?.metabolicEfficiencyIndex ?? null}
            />
          </section>
          ) : null}
        </>
      )}
    </Pro2ModulePageShell>
  );
}

