"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ProfilePro2KpiGrid,
  profileMetricLabelToAccent,
  profileSectionTitleToAccent,
} from "@/components/profile/ProfilePro2KpiCard";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { ManualIntegrationPullButton } from "@/components/integrations/ManualIntegrationPullButton";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import type { AthleteMemory, PhysiologyState, TwinState } from "@/lib/empathy/schemas";
import { cn } from "@/lib/cn";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { garminOAuthReasonGuidance } from "@/lib/integrations/garmin-oauth-reason-copy";
import {
  GARMIN_SUMMARY_BACKFILL_STREAMS,
  GARMIN_WELLNESS_BATCH_BACKFILL_STREAMS,
  maxRangeSecondsForGarminSummaryBackfillStream,
  type GarminSummaryBackfillStream,
} from "@/lib/integrations/garmin-summary-backfill-streams";
import { createProfilePayload, fetchProfileViewModel, updateProfilePayload } from "@/modules/profile/services/profile-api";
import {
  findSupplementCategory,
  normalizeSupplementCategoryId,
  normalizeSupplementToken,
  normalizeSupplementTokensCsv,
  SUPPLEMENT_BRANDS,
  SUPPLEMENT_CATEGORIES,
} from "@/lib/profile/supplement-category-catalog";
import { resolveSixMealSnackPercentages } from "@/lib/nutrition/diet-meal-slot-budgets";
import { Activity, Dna, Flame, GaugeCircle, Heart, Layers, PencilLine, User } from "lucide-react";

type AthleteProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  birth_date: string | null;
  sex: string | null;
  timezone: string | null;
  activity_level: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  resting_hr_bpm: number | null;
  max_hr_bpm: number | null;
  threshold_hr_bpm: number | null;
  diet_type: string | null;
  intolerances: string[] | null;
  allergies: string[] | null;
  food_preferences: string[] | null;
  food_exclusions: string[] | null;
  supplements: string[] | null;
  routine_summary: string | null;
  lifestyle_activity_class: string | null;
  preferred_meal_count: number | null;
  training_days_per_week: number | null;
  training_max_session_minutes: number | null;
  routine_config: Record<string, unknown> | null;
  nutrition_config: Record<string, unknown> | null;
  supplement_config: Record<string, unknown> | null;
  created_at: string;
};

type PhysiologyRow = {
  athlete_id: string;
  ftp_watts: number | null;
  lt1_watts: number | null;
  lt2_watts: number | null;
  v_lamax: number | null;
  vo2max_ml_min_kg: number | null;
  cp_watts?: number | null;
  fatmax_watts?: number | null;
  w_prime_j?: number | null;
  pcr_capacity_j?: number | null;
  glycolytic_capacity_j?: number | null;
  fit_r2?: number | null;
  fit_confidence?: number | null;
  fit_model?: string | null;
  phenotype?: string | null;
  lactate_oxidized_g?: number | null;
  glucose_from_cori_g?: number | null;
  blood_delivery_pct_of_ingested?: number | null;
  gut_stress_score?: number | null;
  oxidative_bottleneck_index?: number | null;
  redox_stress_index?: number | null;
  baseline_hrv_ms: number | null;
};

function mapAthleteMemoryToProfileRow(memory: AthleteMemory | null | undefined): AthleteProfileRow | null {
  const profile = memory?.profile;
  if (!profile) return null;
  return {
    id: profile.id,
    first_name: profile.firstName ?? null,
    last_name: profile.lastName ?? null,
    email: profile.email ?? null,
    birth_date: profile.birthDate ?? null,
    sex: profile.sex ?? null,
    timezone: profile.timezone ?? null,
    activity_level: profile.activityLevel ?? null,
    height_cm: profile.heightCm ?? null,
    weight_kg: profile.weightKg ?? null,
    body_fat_pct: profile.bodyFatPct ?? null,
    muscle_mass_kg: profile.muscleMassKg ?? null,
    resting_hr_bpm: profile.restingHrBpm ?? null,
    max_hr_bpm: profile.maxHrBpm ?? null,
    threshold_hr_bpm: profile.thresholdHrBpm ?? null,
    diet_type: profile.dietType ?? null,
    intolerances: profile.intolerances ?? null,
    allergies: profile.allergies ?? null,
    food_preferences: profile.foodPreferences ?? null,
    food_exclusions: profile.foodExclusions ?? null,
    supplements: profile.supplements ?? null,
    routine_summary: profile.routineSummary ?? null,
    lifestyle_activity_class: profile.lifestyleActivityClass ?? null,
    preferred_meal_count: profile.preferredMealCount ?? null,
    training_days_per_week: profile.trainingAvailability?.daysPerWeek ?? null,
    training_max_session_minutes: profile.trainingAvailability?.maxSessionMinutes ?? null,
    routine_config: profile.routineConfig ?? null,
    nutrition_config: profile.nutritionConfig ?? null,
    supplement_config: profile.supplementConfig ?? null,
    created_at: profile.createdAt ?? new Date(0).toISOString(),
  };
}

function mapAthleteMemoryToPhysiologyRow(memory: AthleteMemory | null | undefined): PhysiologyRow | null {
  const physiology = memory?.physiology;
  if (!physiology) return null;
  return {
    athlete_id: physiology.athleteId,
    ftp_watts: physiology.physiologicalProfile.ftpWatts ?? null,
    lt1_watts: physiology.physiologicalProfile.lt1Watts ?? null,
    lt2_watts: physiology.physiologicalProfile.lt2Watts ?? null,
    v_lamax: physiology.physiologicalProfile.vLamax ?? null,
    vo2max_ml_min_kg: physiology.physiologicalProfile.vo2maxMlMinKg ?? null,
    cp_watts: physiology.metabolicProfile.cpWatts ?? null,
    fatmax_watts: physiology.metabolicProfile.fatmaxWatts ?? null,
    w_prime_j: physiology.metabolicProfile.wPrimeJ ?? null,
    pcr_capacity_j: physiology.metabolicProfile.pcrCapacityJ ?? null,
    glycolytic_capacity_j: physiology.metabolicProfile.glycolyticCapacityJ ?? null,
    fit_r2: physiology.metabolicProfile.fitR2 ?? null,
    fit_confidence: physiology.metabolicProfile.fitConfidence ?? null,
    fit_model: physiology.metabolicProfile.fitModel ?? null,
    phenotype: physiology.metabolicProfile.phenotype ?? null,
    lactate_oxidized_g: physiology.lactateProfile.lactateOxidizedG ?? null,
    glucose_from_cori_g: physiology.lactateProfile.glucoseFromCoriG ?? null,
    blood_delivery_pct_of_ingested: physiology.lactateProfile.bloodDeliveryPctOfIngested ?? null,
    gut_stress_score: physiology.lactateProfile.gutStressScore ?? null,
    oxidative_bottleneck_index: physiology.performanceProfile.oxidativeBottleneckIndex ?? null,
    redox_stress_index: physiology.performanceProfile.redoxStressIndex ?? null,
    baseline_hrv_ms: physiology.physiologicalProfile.baselineHrvMs ?? null,
  };
}

const dietOptions = [
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "mediterranean",
  "paleo",
  "ketogenic",
  "low-fodmap",
  "carnivore",
  "gluten-free",
];

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type WeekDay = (typeof weekDays)[number];

type RoutineDayConfig = {
  wake_time: string;
  breakfast_time: string;
  snack_time: string;
  lunch_time: string;
  afternoon_snack_time: string;
  dinner_time: string;
  night_time: string;
  day_mode: "training" | "recovery" | "race";
  has_training: boolean;
  training1_start_time: string;
  training1_duration_minutes: number;
  has_training2: boolean;
  training2_start_time: string;
  training2_duration_minutes: number;
  mobility_stretching_pct: number;
};

type DietDayConfig = {
  meal_count_mode: "1" | "2" | "3" | "4" | "5" | "6" | "fasting" | "semi-8-16" | "semi-6-18" | "semi-4-20";
  day_type:
    | "fasting-0"
    | "severe-15-30"
    | "catabolic-50-99"
    | "normocaloric-100"
    | "anabolic-101-130";
  day_type_pct: number;
  caloric_distribution: {
    breakfast: number;
    lunch: number;
    dinner: number;
    snacks: number;
    snack_am?: number;
    snack_pm?: number;
    snack_evening?: number;
  };
  daily_macros: {
    cho_pct: number;
    pro_pct: number;
    fat_pct: number;
  };
  meal_macro_custom: {
    breakfast: { cho_pct: number; pro_pct: number; fat_pct: number };
    lunch: { cho_pct: number; pro_pct: number; fat_pct: number };
    dinner: { cho_pct: number; pro_pct: number; fat_pct: number };
    snacks: { cho_pct: number; pro_pct: number; fat_pct: number };
  };
};

function defaultRoutineDayConfig(): RoutineDayConfig {
  return {
    wake_time: "06:30",
    breakfast_time: "07:00",
    snack_time: "10:30",
    lunch_time: "12:30",
    afternoon_snack_time: "16:30",
    dinner_time: "19:30",
    night_time: "22:30",
    day_mode: "training",
    has_training: true,
    training1_start_time: "07:00",
    training1_duration_minutes: 75,
    has_training2: false,
    training2_start_time: "18:00",
    training2_duration_minutes: 45,
    mobility_stretching_pct: 20,
  };
}

function defaultDietDayConfig(): DietDayConfig {
  return {
    meal_count_mode: "4",
    day_type: "normocaloric-100",
    day_type_pct: 100,
    caloric_distribution: { breakfast: 30, lunch: 35, dinner: 25, snacks: 10 },
    daily_macros: { cho_pct: 50, pro_pct: 25, fat_pct: 25 },
    meal_macro_custom: {
      breakfast: { cho_pct: 55, pro_pct: 20, fat_pct: 25 },
      lunch: { cho_pct: 45, pro_pct: 30, fat_pct: 25 },
      dinner: { cho_pct: 40, pro_pct: 35, fat_pct: 25 },
      snacks: { cho_pct: 60, pro_pct: 20, fat_pct: 20 },
    },
  };
}

function defaultRoutineWeek(): Record<WeekDay, RoutineDayConfig> {
  return Object.fromEntries(weekDays.map((d) => [d, defaultRoutineDayConfig()])) as Record<WeekDay, RoutineDayConfig>;
}

function defaultDietWeek(): Record<WeekDay, DietDayConfig> {
  return Object.fromEntries(weekDays.map((d) => [d, defaultDietDayConfig()])) as Record<WeekDay, DietDayConfig>;
}

function parseCsvList(value: string): string[] | null {
  const items = value.split(",").map((v) => v.trim()).filter(Boolean);
  return items.length ? items : null;
}

function joinUnique(values: string[]): string[] | null {
  const unique = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
  return unique.length ? unique : null;
}

function toggleCsvToken(source: string, token: string): string {
  const list = source.split(",").map((s) => s.trim()).filter(Boolean);
  const has = list.includes(token);
  const next = has ? list.filter((v) => v !== token) : [...list, token];
  return next.join(", ");
}

function hasDisplayValue(value: string): boolean {
  return value.trim() !== "—";
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function classifyAthleteType(params: {
  ftpPerKg: number | null;
  vLamax: number | null;
  vo2max: number | null;
}): { label: string; tone: "green" | "violet" | "amber" | "neutral" } {
  const { ftpPerKg, vLamax, vo2max } = params;
  if (ftpPerKg == null && vLamax == null && vo2max == null) {
    return { label: "Profilo in definizione", tone: "neutral" };
  }
  if ((vLamax != null && vLamax >= 0.75) || (ftpPerKg != null && ftpPerKg < 3.2 && vo2max != null && vo2max < 52)) {
    return { label: "Sprinter / Anaerobico", tone: "amber" };
  }
  if ((ftpPerKg != null && ftpPerKg >= 4.3) || (vo2max != null && vo2max >= 60)) {
    return { label: "Endurance / Diesel", tone: "green" };
  }
  if ((vLamax != null && vLamax <= 0.45) && (ftpPerKg != null && ftpPerKg >= 3.8)) {
    return { label: "Time-trialist", tone: "violet" };
  }
  return { label: "All-rounder", tone: "neutral" };
}

function athleteTypePillClass(tone: "green" | "violet" | "amber" | "neutral") {
  if (tone === "green") return "border-emerald-500/45 bg-emerald-500/10 text-emerald-100";
  if (tone === "violet") return "border-violet-500/45 bg-violet-500/10 text-violet-100";
  if (tone === "amber") return "border-amber-500/45 bg-amber-500/10 text-amber-100";
  return "border-white/15 bg-white/5 text-gray-300";
}

function editorTabClass(active: boolean, accent: "violet" | "cyan" | "amber" | "rose" | "slate") {
  const base =
    "rounded-xl border px-3 py-2 text-left text-[0.65rem] font-bold uppercase tracking-wider transition sm:px-4";
  const idle: Record<typeof accent, string> = {
    violet: "border-white/10 bg-black/30 text-gray-400 hover:border-violet-500/30",
    cyan: "border-white/10 bg-black/30 text-gray-400 hover:border-cyan-500/30",
    amber: "border-white/10 bg-black/30 text-gray-400 hover:border-amber-500/30",
    rose: "border-white/10 bg-black/30 text-gray-400 hover:border-rose-500/30",
    slate: "border-white/10 bg-black/30 text-gray-400 hover:border-white/25",
  };
  const activeCls: Record<typeof accent, string> = {
    violet: "border-violet-400/55 bg-violet-500/15 text-white shadow-[0_0_20px_rgba(139,92,246,0.15)]",
    cyan: "border-cyan-400/55 bg-cyan-500/15 text-white shadow-[0_0_20px_rgba(34,211,238,0.12)]",
    amber: "border-amber-400/55 bg-amber-500/15 text-white shadow-[0_0_20px_rgba(251,191,36,0.12)]",
    rose: "border-rose-400/55 bg-rose-500/15 text-white shadow-[0_0_20px_rgba(251,113,133,0.12)]",
    slate: "border-white/30 bg-white/10 text-white",
  };
  return cn(base, active ? activeCls[accent] : idle[accent]);
}

function profileToneForEditorSection(section: "personal" | "physical" | "routine" | "nutrition") {
  if (section === "personal") return "violet";
  if (section === "physical") return "cyan";
  if (section === "routine") return "amber";
  return "rose";
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function estimateVo2maxMlMinKg(params: {
  weightKg: number | null;
  ftpWatts: number | null;
  cpWatts: number | null;
  lt2Watts: number | null;
  oxidativeCapacityKcalMin?: number | null;
}) {
  const weightKg = params.weightKg ?? null;
  if (weightKg == null || weightKg <= 0) return null;

  const oxidativeCapacityKcalMin = params.oxidativeCapacityKcalMin ?? null;
  if (oxidativeCapacityKcalMin != null && oxidativeCapacityKcalMin > 0) {
    const oxygenLitersPerMin = oxidativeCapacityKcalMin / 5;
    return round1(clampNumber((oxygenLitersPerMin * 1000) / weightKg, 35, 90));
  }

  const mapCandidates = [
    params.lt2Watts != null && params.lt2Watts > 0 ? params.lt2Watts / 0.78 : null,
    params.cpWatts != null && params.cpWatts > 0 ? params.cpWatts / 0.80 : null,
    params.ftpWatts != null && params.ftpWatts > 0 ? params.ftpWatts / 0.78 : null,
  ].filter((value): value is number => value != null && Number.isFinite(value));

  if (!mapCandidates.length) return null;
  const estimatedMapWatts = mapCandidates.reduce((sum, value) => sum + value, 0) / mapCandidates.length;
  const vo2maxMlMinKg = 7 + 10.8 * (estimatedMapWatts / weightKg);
  return round1(clampNumber(vo2maxMlMinKg, 35, 90));
}

export default function ProfilePage() {
  const { activeAthleteId, role, loading: athleteLoading } = useActiveAthlete();
  const [profiles, setProfiles] = useState<AthleteProfileRow[]>([]);
  const [physioMap, setPhysioMap] = useState<Record<string, PhysiologyRow>>({});
  const [physiologyState, setPhysiologyState] = useState<PhysiologyState | null>(null);
  const [physiologyCoverage, setPhysiologyCoverage] = useState<{
    physiologicalProfile: boolean;
    metabolicRun: boolean;
    lactateRun: boolean;
    performanceRun: boolean;
    biomarkerPanel: boolean;
  } | null>(null);
  const [twinSnapshot, setTwinSnapshot] = useState<TwinState | null>(null);
  const [garminLink, setGarminLink] = useState<{
    linked: boolean;
    garminUserIdMasked?: string;
    oauthScope?: string | null;
    userPermissionsGranted?: string[] | null;
    linkStatusError?: string;
    linkStatusHint?: string;
  } | null>(null);
  const [garminReturn, setGarminReturn] = useState<string | null>(null);
  const [garminReason, setGarminReason] = useState<string | null>(null);
  const [garminDetail, setGarminDetail] = useState<string | null>(null);
  const [garminDisconnecting, setGarminDisconnecting] = useState(false);
  const [garminBackfillStream, setGarminBackfillStream] = useState("activityDetails");
  const [garminBackfillDays, setGarminBackfillDays] = useState(14);
  const [garminBackfillBusy, setGarminBackfillBusy] = useState(false);
  const [garminBackfillNotice, setGarminBackfillNotice] = useState<string | null>(null);
  const garminSingleBackfillMaxDays = useMemo(() => {
    return Math.floor(
      maxRangeSecondsForGarminSummaryBackfillStream(garminBackfillStream as GarminSummaryBackfillStream) / 86_400,
    );
  }, [garminBackfillStream]);
  const garminWellnessBatchMaxDays = useMemo(
    () =>
      Math.floor(
        Math.min(
          ...GARMIN_WELLNESS_BATCH_BACKFILL_STREAMS.map((s) => maxRangeSecondsForGarminSummaryBackfillStream(s)),
        ) / 86_400,
      ),
    [],
  );
  const [whoopLink, setWhoopLink] = useState<{
    linked: boolean;
    whoopUserIdMasked?: string;
    oauthScope?: string | null;
    linkStatusError?: string;
    linkStatusHint?: string;
  } | null>(null);
  const [whoopReturn, setWhoopReturn] = useState<string | null>(null);
  const [whoopReason, setWhoopReason] = useState<string | null>(null);
  const [whoopDetail, setWhoopDetail] = useState<string | null>(null);
  const [whoopPullBusy, setWhoopPullBusy] = useState(false);
  const [whoopPullNotice, setWhoopPullNotice] = useState<string | null>(null);
  const [wahooLink, setWahooLink] = useState<{
    linked: boolean;
    wahooUserIdMasked?: string;
    oauthScope?: string | null;
    linkStatusError?: string;
    linkStatusHint?: string;
  } | null>(null);
  const [wahooReturn, setWahooReturn] = useState<string | null>(null);
  const [wahooReason, setWahooReason] = useState<string | null>(null);
  const [wahooDetail, setWahooDetail] = useState<string | null>(null);
  const [wahooPullBusy, setWahooPullBusy] = useState(false);
  const [wahooPullNotice, setWahooPullNotice] = useState<string | null>(null);
  const [stravaLink, setStravaLink] = useState<{
    linked: boolean;
    stravaAthleteIdMasked?: string;
    oauthScope?: string | null;
    linkStatusError?: string;
    linkStatusHint?: string;
  } | null>(null);
  const [stravaReturn, setStravaReturn] = useState<string | null>(null);
  const [stravaReason, setStravaReason] = useState<string | null>(null);
  const [stravaDetail, setStravaDetail] = useState<string | null>(null);
  const [polarLink, setPolarLink] = useState<{
    linked: boolean;
    polarUserIdMasked?: string;
    oauthScope?: string | null;
    linkStatusError?: string;
    linkStatusHint?: string;
  } | null>(null);
  const [polarReturn, setPolarReturn] = useState<string | null>(null);
  const [polarReason, setPolarReason] = useState<string | null>(null);
  const [polarDetail, setPolarDetail] = useState<string | null>(null);
  const [polarPullBusy, setPolarPullBusy] = useState(false);
  const [polarPullNotice, setPolarPullNotice] = useState<string | null>(null);
  const [suuntoLink, setSuuntoLink] = useState<{
    linked: boolean;
    suuntoUserIdMasked?: string;
    oauthScope?: string | null;
    linkStatusError?: string;
    linkStatusHint?: string;
  } | null>(null);
  const [suuntoReturn, setSuuntoReturn] = useState<string | null>(null);
  const [suuntoPullBusy, setSuuntoPullBusy] = useState(false);
  const [suuntoPullNotice, setSuuntoPullNotice] = useState<string | null>(null);
  const [karooLink, setKarooLink] = useState<{
    linked: boolean;
    oauthScope?: string | null;
    linkStatusError?: string;
    linkStatusHint?: string;
  } | null>(null);
  const [karooReturn, setKarooReturn] = useState<string | null>(null);
  const [karooPullBusy, setKarooPullBusy] = useState(false);
  const [karooPullNotice, setKarooPullNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"personal" | "physical" | "routine" | "nutrition">("personal");
  const [activeNutritionTab, setActiveNutritionTab] = useState<"diet" | "intolerances" | "supplements">("diet");
  const [activeSupplementCategory, setActiveSupplementCategory] = useState("carboidrati");
  const [daysActive, setDaysActive] = useState(0);
  const [dayStreak, setDayStreak] = useState(0);
  const [activeRoutineDay, setActiveRoutineDay] = useState<WeekDay>("Mon");
  const [activeDietDay, setActiveDietDay] = useState<WeekDay>("Mon");
  const [routineWeekPlan, setRoutineWeekPlan] = useState<Record<WeekDay, RoutineDayConfig>>(defaultRoutineWeek());
  const [dietWeekPlan, setDietWeekPlan] = useState<Record<WeekDay, DietDayConfig>>(defaultDietWeek());

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    birth_date: "",
    sex: "",
    timezone: "Europe/Rome",
    activity_level: "advanced",
    height_cm: "",
    weight_kg: "",
    body_fat_pct: "",
    muscle_mass_kg: "",
    resting_hr_bpm: "",
    max_hr_bpm: "",
    threshold_hr_bpm: "",
    training_days_per_week: "",
    training_max_session_minutes: "",
    wake_time: "06:30",
    sleep_time: "22:30",
    breakfast_time: "07:00",
    lunch_time: "12:30",
    dinner_time: "19:30",
    training_slot: "morning",
    second_session: "false",
    race_day: "false",
    training_duration_minutes: "90",
    training1_start_time: "07:00",
    training1_duration_minutes: "75",
    training2_start_time: "18:00",
    training2_duration_minutes: "60",
    meal_strategy: "3-meals",
    caloric_split_breakfast: "25",
    caloric_split_lunch: "35",
    caloric_split_dinner: "30",
    caloric_split_snacks: "10",
    macro_carbs_pct: "50",
    macro_protein_pct: "25",
    macro_fat_pct: "25",
    routine_summary: "",
    lifestyle_activity_class: "moderate",
    diet_type: "omnivore",
    cuisines: "",
    preferred_meal_count: "4",
    prep_time_minutes: "45",
    cooking_skill: "intermediate",
    home_cooked_preference: "true",
    food_preferences: "",
    food_exclusions: "",
    intolerances: "",
    allergies: "",
    supplements: "",
    supplement_brands: "",
  });

  async function load() {
    if (!activeAthleteId) {
      setProfiles([]);
      setPhysioMap({});
      setPhysiologyState(null);
      setPhysiologyCoverage(null);
      setTwinSnapshot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const vm = await fetchProfileViewModel(activeAthleteId);
    if (vm.error) {
      setError(vm.error);
      setProfiles([]);
      setPhysioMap({});
      setPhysiologyState(null);
      setPhysiologyCoverage(null);
      setTwinSnapshot(null);
      setDaysActive(0);
      setDayStreak(0);
      setLoading(false);
      return;
    }
    const memory = vm.athleteMemory ?? null;
    const mappedProfile = mapAthleteMemoryToProfileRow(memory);
    setProfiles(mappedProfile ? [mappedProfile] : vm.profile ? [vm.profile as AthleteProfileRow] : []);
    setDaysActive(vm.activity.daysActive);
    setDayStreak(vm.activity.dayStreak);
    const map: Record<string, PhysiologyRow> = {};
    const mappedPhysio = mapAthleteMemoryToPhysiologyRow(memory);
    if (mappedPhysio) {
      map[mappedPhysio.athlete_id] = mappedPhysio;
    } else if (vm.physiology) {
      const physio = vm.physiology as PhysiologyRow;
      if (physio.athlete_id) map[physio.athlete_id] = physio;
    }
    setPhysioMap(map);
    setPhysiologyState((memory?.physiology as PhysiologyState | null) ?? ((vm.physiologyState as PhysiologyState | null) ?? null));
    setPhysiologyCoverage(vm.physiologyCoverage ?? memory?.physiology?.sources ?? null);
    setTwinSnapshot(vm.athleteMemory?.twin ?? null);
    setLoading(false);
  }

  useEffect(() => {
    if (!athleteLoading) load();
  }, [athleteLoading, activeAthleteId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const reason = q.get("reason");
    const detail = q.get("detail");
    const wahoo = q.get("wahoo");
    const whoop = q.get("whoop");
    const strava = q.get("strava");
    const polar = q.get("polar");
    if (wahoo) {
      setWahooReturn(wahoo);
      if (reason) setWahooReason(reason);
      if (detail) setWahooDetail(detail);
    } else if (whoop) {
      setWhoopReturn(whoop);
      if (reason) setWhoopReason(reason);
      if (detail) setWhoopDetail(detail);
    } else if (polar) {
      setPolarReturn(polar);
      if (reason) setPolarReason(reason);
      if (detail) setPolarDetail(detail);
    } else if (q.get("suunto")) {
      setSuuntoReturn(q.get("suunto"));
    } else if (q.get("karoo")) {
      setKarooReturn(q.get("karoo"));
    } else if (strava) {
      setStravaReturn(strava);
      if (reason) setStravaReason(reason);
      if (detail) setStravaDetail(detail);
    } else {
      const p = q.get("garmin");
      if (p) setGarminReturn(p);
      if (reason) setGarminReason(reason);
      if (detail) setGarminDetail(detail);
    }
  }, []);

  useEffect(() => {
    if (!activeAthleteId) {
      setGarminLink(null);
      setWhoopLink(null);
      setWahooLink(null);
      setStravaLink(null);
      setPolarLink(null);
      setSuuntoLink(null);
      setKarooLink(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [rG, rWhoop, rWahoo, rStrava, rPolar, rSuunto, rKaroo] = await Promise.all([
          fetch(`/api/integrations/garmin/link-status?athleteId=${encodeURIComponent(activeAthleteId)}`, {
            credentials: "include",
          }),
          fetch(`/api/integrations/whoop/link-status?athleteId=${encodeURIComponent(activeAthleteId)}`, {
            credentials: "include",
          }),
          fetch(`/api/integrations/wahoo/link-status?athleteId=${encodeURIComponent(activeAthleteId)}`, {
            credentials: "include",
          }),
          fetch(`/api/integrations/strava/link-status?athleteId=${encodeURIComponent(activeAthleteId)}`, {
            credentials: "include",
          }),
          fetch(`/api/integrations/polar/link-status?athleteId=${encodeURIComponent(activeAthleteId)}`, {
            credentials: "include",
          }),
          fetch(`/api/integrations/suunto/link-status?athleteId=${encodeURIComponent(activeAthleteId)}`, {
            credentials: "include",
          }),
          fetch(`/api/integrations/karoo/link-status?athleteId=${encodeURIComponent(activeAthleteId)}`, {
            credentials: "include",
          }),
        ]);
        const jG = (await rG.json()) as {
          linked?: boolean;
          garminUserIdMasked?: string;
          oauthScope?: string | null;
          userPermissionsGranted?: string[] | null;
          error?: string;
          hint?: string;
        };
        const jWhoop = (await rWhoop.json()) as {
          linked?: boolean;
          whoopUserIdMasked?: string;
          oauthScope?: string | null;
          error?: string;
          hint?: string;
        };
        const jWahoo = (await rWahoo.json()) as {
          linked?: boolean;
          wahooUserIdMasked?: string;
          oauthScope?: string | null;
          error?: string;
          hint?: string;
        };
        const jStrava = (await rStrava.json()) as {
          linked?: boolean;
          stravaAthleteIdMasked?: string;
          oauthScope?: string | null;
          error?: string;
          hint?: string;
        };
        const jPolar = (await rPolar.json()) as {
          linked?: boolean;
          polarUserIdMasked?: string;
          oauthScope?: string | null;
          error?: string;
          hint?: string;
        };
        const jSuunto = (await rSuunto.json()) as {
          linked?: boolean;
          suuntoUserIdMasked?: string;
          oauthScope?: string | null;
          error?: string;
          hint?: string;
        };
        const jKaroo = (await rKaroo.json()) as {
          linked?: boolean;
          oauthScope?: string | null;
          error?: string;
          hint?: string;
        };
        if (cancelled) return;
        if (!rG.ok) {
          setGarminLink({
            linked: false,
            linkStatusError: jG.error ?? `HTTP ${rG.status}`,
            linkStatusHint: typeof jG.hint === "string" ? jG.hint : undefined,
          });
        } else {
          setGarminLink({
            linked: Boolean(jG.linked),
            garminUserIdMasked: jG.garminUserIdMasked,
            oauthScope: jG.oauthScope ?? null,
            userPermissionsGranted: Array.isArray(jG.userPermissionsGranted) ? jG.userPermissionsGranted : null,
          });
        }
        if (!rWhoop.ok) {
          setWhoopLink({
            linked: false,
            linkStatusError: jWhoop.error ?? `HTTP ${rWhoop.status}`,
            linkStatusHint: typeof jWhoop.hint === "string" ? jWhoop.hint : undefined,
          });
        } else {
          setWhoopLink({
            linked: Boolean(jWhoop.linked),
            whoopUserIdMasked: jWhoop.whoopUserIdMasked,
            oauthScope: jWhoop.oauthScope ?? null,
          });
        }
        if (!rWahoo.ok) {
          setWahooLink({
            linked: false,
            linkStatusError: jWahoo.error ?? `HTTP ${rWahoo.status}`,
            linkStatusHint: typeof jWahoo.hint === "string" ? jWahoo.hint : undefined,
          });
        } else {
          setWahooLink({
            linked: Boolean(jWahoo.linked),
            wahooUserIdMasked: jWahoo.wahooUserIdMasked,
            oauthScope: jWahoo.oauthScope ?? null,
          });
        }
        if (!rStrava.ok) {
          setStravaLink({
            linked: false,
            linkStatusError: jStrava.error ?? `HTTP ${rStrava.status}`,
            linkStatusHint: typeof jStrava.hint === "string" ? jStrava.hint : undefined,
          });
        } else {
          setStravaLink({
            linked: Boolean(jStrava.linked),
            stravaAthleteIdMasked: jStrava.stravaAthleteIdMasked,
            oauthScope: jStrava.oauthScope ?? null,
          });
        }
        if (!rPolar.ok) {
          setPolarLink({
            linked: false,
            linkStatusError: jPolar.error ?? `HTTP ${rPolar.status}`,
            linkStatusHint: typeof jPolar.hint === "string" ? jPolar.hint : undefined,
          });
        } else {
          setPolarLink({
            linked: Boolean(jPolar.linked),
            polarUserIdMasked: jPolar.polarUserIdMasked,
            oauthScope: jPolar.oauthScope ?? null,
          });
        }
        if (!rSuunto.ok) {
          setSuuntoLink({
            linked: false,
            linkStatusError: jSuunto.error ?? `HTTP ${rSuunto.status}`,
            linkStatusHint: typeof jSuunto.hint === "string" ? jSuunto.hint : undefined,
          });
        } else {
          setSuuntoLink({
            linked: Boolean(jSuunto.linked),
            suuntoUserIdMasked: jSuunto.suuntoUserIdMasked,
            oauthScope: jSuunto.oauthScope ?? null,
          });
        }
        if (!rKaroo.ok) {
          setKarooLink({
            linked: false,
            linkStatusError: jKaroo.error ?? `HTTP ${rKaroo.status}`,
            linkStatusHint: typeof jKaroo.hint === "string" ? jKaroo.hint : undefined,
          });
        } else {
          setKarooLink({
            linked: Boolean(jKaroo.linked),
            oauthScope: jKaroo.oauthScope ?? null,
          });
        }
      } catch {
        if (!cancelled) {
          setGarminLink({ linked: false });
          setWhoopLink({ linked: false });
          setWahooLink({ linked: false });
          setStravaLink({ linked: false });
          setPolarLink({ linked: false });
          setSuuntoLink({ linked: false });
          setKarooLink({ linked: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAthleteId]);

  async function disconnectGarmin() {
    if (!activeAthleteId || garminDisconnecting) return;
    if (!window.confirm("Scollegare Garmin da questo atleta? I dati non verranno più sincronizzati da Garmin.")) {
      return;
    }
    setGarminDisconnecting(true);
    try {
      const r = await fetch(`/api/integrations/garmin/disconnect?athleteId=${encodeURIComponent(activeAthleteId)}`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; garminPartnerDeregistered?: boolean };
      if (!r.ok) {
        window.alert(j.error ?? "Scollegamento non riuscito.");
        return;
      }
      if (j.garminPartnerDeregistered === false) {
        window.alert(
          "Collegamento rimosso in Empathy; se Garmin non ha accettato la revoca, rimuovi il consenso anche da Garmin Connect.",
        );
      }
      setGarminLink({ linked: false });
    } catch {
      window.alert("Errore di rete durante lo scollegamento.");
    } finally {
      setGarminDisconnecting(false);
    }
  }

  async function runWahooPullNow() {
    if (!activeAthleteId || !wahooLink?.linked || wahooPullBusy) return;
    setWahooPullBusy(true);
    setWahooPullNotice(null);
    try {
      const r = await fetch("/api/integrations/wahoo/pull/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: activeAthleteId }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        inserted?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
      };
      if (j.ok) {
        setWahooPullNotice(
          `Pull workout completato: inseriti ${j.inserted ?? 0}, saltati ${j.skipped ?? 0}.` +
            (Array.isArray(j.errors) && j.errors.length > 0 ? ` Avvisi: ${j.errors.slice(0, 3).join(" · ")}` : ""),
        );
      } else {
        setWahooPullNotice(j.error ?? `Errore HTTP ${r.status}`);
      }
    } catch {
      setWahooPullNotice("Errore di rete.");
    } finally {
      setWahooPullBusy(false);
    }
  }

  async function runWhoopPullNow() {
    if (!activeAthleteId || !whoopLink?.linked || whoopPullBusy) return;
    setWhoopPullBusy(true);
    setWhoopPullNotice(null);
    try {
      const r = await fetch("/api/integrations/whoop/pull/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: activeAthleteId }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        inserted?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
      };
      if (j.ok) {
        setWhoopPullNotice(
          `Pull completato: inseriti ${j.inserted ?? 0}, saltati ${j.skipped ?? 0}.` +
            (Array.isArray(j.errors) && j.errors.length > 0 ? ` Avvisi: ${j.errors.slice(0, 3).join(" · ")}` : ""),
        );
      } else {
        setWhoopPullNotice(j.error ?? `Errore HTTP ${r.status}`);
      }
    } catch {
      setWhoopPullNotice("Errore di rete.");
    } finally {
      setWhoopPullBusy(false);
    }
  }

  async function runPolarPullNow() {
    if (!activeAthleteId || !polarLink?.linked || polarPullBusy) return;
    setPolarPullBusy(true);
    setPolarPullNotice(null);
    try {
      const r = await fetch("/api/integrations/polar/pull/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: activeAthleteId }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        inserted?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
      };
      if (j.ok) {
        setPolarPullNotice(
          `Pull completato: inseriti ${j.inserted ?? 0}, saltati ${j.skipped ?? 0}.` +
            (Array.isArray(j.errors) && j.errors.length > 0 ? ` Avvisi: ${j.errors.slice(0, 3).join(" · ")}` : ""),
        );
      } else {
        setPolarPullNotice(j.error ?? `Errore HTTP ${r.status}`);
      }
    } catch {
      setPolarPullNotice("Errore di rete.");
    } finally {
      setPolarPullBusy(false);
    }
  }

  async function runSuuntoPullNow() {
    if (!activeAthleteId || !suuntoLink?.linked || suuntoPullBusy) return;
    setSuuntoPullBusy(true);
    setSuuntoPullNotice(null);
    try {
      const r = await fetch("/api/integrations/suunto/pull/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: activeAthleteId }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        inserted?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
      };
      if (j.ok) {
        setSuuntoPullNotice(
          `Pull completato: inseriti ${j.inserted ?? 0}, saltati ${j.skipped ?? 0}.` +
            (Array.isArray(j.errors) && j.errors.length > 0 ? ` Avvisi: ${j.errors.slice(0, 3).join(" · ")}` : ""),
        );
      } else {
        setSuuntoPullNotice(j.error ?? `Errore HTTP ${r.status}`);
      }
    } catch {
      setSuuntoPullNotice("Errore di rete.");
    } finally {
      setSuuntoPullBusy(false);
    }
  }

  async function runKarooPullNow() {
    if (!activeAthleteId || !karooLink?.linked || karooPullBusy) return;
    setKarooPullBusy(true);
    setKarooPullNotice(null);
    try {
      const r = await fetch("/api/integrations/karoo/pull/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: activeAthleteId }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        inserted?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
      };
      if (j.ok) {
        setKarooPullNotice(
          `Pull completato: inseriti ${j.inserted ?? 0}, saltati ${j.skipped ?? 0}.` +
            (Array.isArray(j.errors) && j.errors.length > 0 ? ` Avvisi: ${j.errors.slice(0, 3).join(" · ")}` : ""),
        );
      } else {
        setKarooPullNotice(j.error ?? `Errore HTTP ${r.status}`);
      }
    } catch {
      setKarooPullNotice("Errore di rete.");
    } finally {
      setKarooPullBusy(false);
    }
  }

  async function runGarminBackfill() {
    if (!activeAthleteId || !garminLink?.linked || garminBackfillBusy) return;
    setGarminBackfillBusy(true);
    setGarminBackfillNotice(null);
    try {
      const days = Math.min(
        garminSingleBackfillMaxDays,
        Math.max(1, Math.floor(Number(garminBackfillDays) || 14)),
      );
      const r = await fetch("/api/integrations/garmin/backfill", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: activeAthleteId,
          stream: garminBackfillStream,
          days,
        }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        batch?: boolean;
        message?: string;
        error?: string;
        errorMessage?: string | null;
        httpStatus?: number;
        hint?: string;
        results?: Array<{ stream: string; ok: boolean; httpStatus: number; errorMessage?: string | null }>;
      };
      if (j.ok) {
        setGarminBackfillNotice(j.message ?? "Richiesta inviata a Garmin.");
      } else {
        const core = j.errorMessage ?? j.error ?? `Errore HTTP ${j.httpStatus ?? r.status}`;
        setGarminBackfillNotice(j.hint ? `${core} — ${j.hint}` : core);
      }
    } catch {
      setGarminBackfillNotice("Errore di rete.");
    } finally {
      setGarminBackfillBusy(false);
    }
  }

  async function runGarminBackfillWellnessBatch() {
    if (!activeAthleteId || !garminLink?.linked || garminBackfillBusy) return;
    setGarminBackfillBusy(true);
    setGarminBackfillNotice(null);
    try {
      const days = Math.min(
        garminWellnessBatchMaxDays,
        Math.max(1, Math.floor(Number(garminBackfillDays) || 14)),
      );
      const r = await fetch("/api/integrations/garmin/backfill", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: activeAthleteId,
          streams: [...GARMIN_WELLNESS_BATCH_BACKFILL_STREAMS],
          days,
        }),
      });
      const j = (await r.json()) as {
        batch?: boolean;
        allOk?: boolean;
        message?: string;
        error?: string;
        hint?: string;
        hint429?: string;
        results?: Array<{ stream: string; ok: boolean; httpStatus: number; errorMessage?: string | null }>;
      };
      if (j.batch && j.results && j.results.length > 0) {
        const bits = j.results.map((row) =>
          row.ok ? `${row.stream}:${row.httpStatus}` : `${row.stream}:FAIL:${row.httpStatus}`,
        );
        const hints = [j.hint, j.hint429].filter(Boolean).join(" — ");
        const suffix = hints ? ` — ${hints}` : "";
        setGarminBackfillNotice(`${j.message ?? ""} ${bits.join(" · ")}`.trim() + suffix);
      } else if (j.error) {
        setGarminBackfillNotice(j.error);
      } else {
        setGarminBackfillNotice("Risposta imprevista dal server.");
      }
    } catch {
      setGarminBackfillNotice("Errore di rete.");
    } finally {
      setGarminBackfillBusy(false);
    }
  }

  function startEditProfile(p: AthleteProfileRow) {
    const routine = toRecord(p.routine_config);
    const mealTimes = toRecord(routine.meal_times);
    const training1 = toRecord(routine.training_1);
    const training2 = toRecord(routine.training_2);
    const nutrition = toRecord(p.nutrition_config);
    const caloricSplit = toRecord(nutrition.caloric_split);
    const macroSplit = toRecord(nutrition.macro_split);
    const supplementCfg = toRecord(p.supplement_config);
    const selectedBrands = Array.isArray(supplementCfg.selected_brands) ? supplementCfg.selected_brands.map((v) => String(v)) : [];
    const routineWeekRaw = toRecord(routine.week_plan);
    const nutritionWeekRaw = toRecord(nutrition.week_plan);

    const parsedRoutineWeek = defaultRoutineWeek();
    const parsedDietWeek = defaultDietWeek();

    weekDays.forEach((day) => {
      const dayRoutine = toRecord(routineWeekRaw[day]);
      parsedRoutineWeek[day] = {
        ...defaultRoutineDayConfig(),
        ...dayRoutine,
        day_mode: (String(dayRoutine.day_mode ?? "training") as RoutineDayConfig["day_mode"]),
        has_training: String(dayRoutine.has_training ?? true) === "true",
        has_training2: String(dayRoutine.has_training2 ?? false) === "true",
        training1_duration_minutes: Number(dayRoutine.training1_duration_minutes ?? 75),
        training2_duration_minutes: Number(dayRoutine.training2_duration_minutes ?? 45),
        mobility_stretching_pct: Number(dayRoutine.mobility_stretching_pct ?? 20),
      };

      const dayDiet = toRecord(nutritionWeekRaw[day]);
      const cal = toRecord(dayDiet.caloric_distribution);
      const macros = toRecord(dayDiet.daily_macros);
      const mealMacro = toRecord(dayDiet.meal_macro_custom);
      const mealCountMode = String(dayDiet.meal_count_mode ?? "4") as DietDayConfig["meal_count_mode"];
      const breakfast = Number(cal.breakfast ?? 30);
      const lunch = Number(cal.lunch ?? 35);
      const dinner = Number(cal.dinner ?? 25);
      const snacksField = Number(cal.snacks ?? 10);
      const distSeed = {
        breakfast,
        lunch,
        dinner,
        snacks: snacksField,
        ...(typeof cal.snack_am === "number" ? { snack_am: cal.snack_am } : {}),
        ...(typeof cal.snack_pm === "number" ? { snack_pm: cal.snack_pm } : {}),
        ...(typeof cal.snack_evening === "number" ? { snack_evening: cal.snack_evening } : {}),
      };
      const caloricResolved =
        mealCountMode === "6"
          ? (() => {
              const r = resolveSixMealSnackPercentages(distSeed);
              return {
                breakfast,
                lunch,
                dinner,
                snacks: r.snacksTotal,
                snack_am: r.snack_am,
                snack_pm: r.snack_pm,
                snack_evening: r.snack_evening,
              };
            })()
          : { breakfast, lunch, dinner, snacks: snacksField };
      parsedDietWeek[day] = {
        ...defaultDietDayConfig(),
        ...dayDiet,
        day_type: String(dayDiet.day_type ?? "normocaloric-100") as DietDayConfig["day_type"],
        meal_count_mode: mealCountMode,
        day_type_pct: Number(dayDiet.day_type_pct ?? 100),
        caloric_distribution: caloricResolved,
        daily_macros: {
          cho_pct: Number(macros.cho_pct ?? 50),
          pro_pct: Number(macros.pro_pct ?? 25),
          fat_pct: Number(macros.fat_pct ?? 25),
        },
        meal_macro_custom: {
          breakfast: { ...defaultDietDayConfig().meal_macro_custom.breakfast, ...toRecord(mealMacro.breakfast) } as DietDayConfig["meal_macro_custom"]["breakfast"],
          lunch: { ...defaultDietDayConfig().meal_macro_custom.lunch, ...toRecord(mealMacro.lunch) } as DietDayConfig["meal_macro_custom"]["lunch"],
          dinner: { ...defaultDietDayConfig().meal_macro_custom.dinner, ...toRecord(mealMacro.dinner) } as DietDayConfig["meal_macro_custom"]["dinner"],
          snacks: { ...defaultDietDayConfig().meal_macro_custom.snacks, ...toRecord(mealMacro.snacks) } as DietDayConfig["meal_macro_custom"]["snacks"],
        },
      };
    });

    setEditingProfileId(p.id);
    setShowForm(true);
    setActiveSection("personal");
    setRoutineWeekPlan(parsedRoutineWeek);
    setDietWeekPlan(parsedDietWeek);
    setForm((f) => ({
      ...f,
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      email: p.email ?? "",
      birth_date: p.birth_date ?? "",
      sex: p.sex ?? "",
      timezone: p.timezone ?? "Europe/Rome",
      activity_level: p.activity_level ?? "advanced",
      height_cm: p.height_cm != null ? String(p.height_cm) : "",
      weight_kg: p.weight_kg != null ? String(p.weight_kg) : "",
      body_fat_pct: p.body_fat_pct != null ? String(p.body_fat_pct) : "",
      muscle_mass_kg: p.muscle_mass_kg != null ? String(p.muscle_mass_kg) : "",
      resting_hr_bpm: p.resting_hr_bpm != null ? String(p.resting_hr_bpm) : "",
      max_hr_bpm: p.max_hr_bpm != null ? String(p.max_hr_bpm) : "",
      threshold_hr_bpm: p.threshold_hr_bpm != null ? String(p.threshold_hr_bpm) : "",
      training_days_per_week: p.training_days_per_week != null ? String(p.training_days_per_week) : "",
      training_max_session_minutes: p.training_max_session_minutes != null ? String(p.training_max_session_minutes) : "",
      wake_time: String(routine.wake_time ?? "06:30"),
      sleep_time: String(routine.sleep_time ?? "22:30"),
      breakfast_time: String(mealTimes.breakfast ?? "07:00"),
      lunch_time: String(mealTimes.lunch ?? "12:30"),
      dinner_time: String(mealTimes.dinner ?? "19:30"),
      training_slot: String(routine.training_slot ?? "morning"),
      second_session: String(routine.second_session ?? false) === "true" ? "true" : "false",
      race_day: String(routine.race_day ?? false) === "true" ? "true" : "false",
      training_duration_minutes: routine.training_duration_minutes != null ? String(routine.training_duration_minutes) : "90",
      training1_start_time: String(training1.start_time ?? "07:00"),
      training1_duration_minutes: training1.duration_minutes != null ? String(training1.duration_minutes) : "75",
      training2_start_time: String(training2.start_time ?? "18:00"),
      training2_duration_minutes: training2.duration_minutes != null ? String(training2.duration_minutes) : "60",
      meal_strategy: String(nutrition.meal_strategy ?? "3-meals"),
      caloric_split_breakfast: String(caloricSplit.breakfast_pct ?? "25"),
      caloric_split_lunch: String(caloricSplit.lunch_pct ?? "35"),
      caloric_split_dinner: String(caloricSplit.dinner_pct ?? "30"),
      caloric_split_snacks: String(caloricSplit.snacks_pct ?? "10"),
      macro_carbs_pct: String(macroSplit.carbs_pct ?? "50"),
      macro_protein_pct: String(macroSplit.protein_pct ?? "25"),
      macro_fat_pct: String(macroSplit.fat_pct ?? "25"),
      routine_summary: p.routine_summary ?? "",
      lifestyle_activity_class: p.lifestyle_activity_class ?? String(routine.lifestyle_activity_class ?? "moderate"),
      diet_type: p.diet_type ?? "omnivore",
      cuisines: "",
      preferred_meal_count: p.preferred_meal_count != null ? String(p.preferred_meal_count) : "4",
      prep_time_minutes: nutrition.prep_time_minutes != null ? String(nutrition.prep_time_minutes) : "45",
      cooking_skill: String(nutrition.cooking_skill ?? "intermediate"),
      home_cooked_preference: String(nutrition.home_cooked_preference ?? true) === "false" ? "false" : "true",
      food_preferences: (p.food_preferences ?? []).join(", "),
      food_exclusions: (p.food_exclusions ?? []).join(", "),
      intolerances: (p.intolerances ?? []).join(", "),
      allergies: (p.allergies ?? []).join(", "),
      supplements: normalizeSupplementTokensCsv((p.supplements ?? []).join(", ")),
      supplement_brands: selectedBrands.join(", "),
    }));
  }

  function openEditSubsection(
    section: "personal" | "physical" | "routine" | "nutrition",
    nutritionTab?: "diet" | "intolerances" | "supplements",
  ) {
    if (!currentProfile) return;
    startEditProfile(currentProfile);
    setActiveSection(section);
    if (nutritionTab) setActiveNutritionTab(nutritionTab);
    if (nutritionTab === "supplements") {
      setActiveSupplementCategory(normalizeSupplementCategoryId(activeSupplementCategory));
    }
  }

  function updateRoutineDay(day: WeekDay, patch: Partial<RoutineDayConfig>) {
    setRoutineWeekPlan((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
  }

  function updateDietDay(day: WeekDay, patch: Partial<DietDayConfig>) {
    setDietWeekPlan((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const routineConfig = {
      lifestyle_activity_class: form.lifestyle_activity_class,
      wake_time: form.wake_time,
      sleep_time: form.sleep_time,
      meal_times: {
        breakfast: form.breakfast_time,
        lunch: form.lunch_time,
        dinner: form.dinner_time,
      },
      training_slot: form.training_slot,
      second_session: form.second_session === "true",
      race_day: form.race_day === "true",
      training_duration_minutes: parseInt(form.training_duration_minutes, 10) || null,
      training_1: {
        start_time: form.training1_start_time || null,
        duration_minutes: parseInt(form.training1_duration_minutes, 10) || null,
      },
      training_2: {
        start_time: form.training2_start_time || null,
        duration_minutes:
          form.second_session === "true"
            ? (parseInt(form.training2_duration_minutes, 10) || null)
            : null,
      },
      week_plan: routineWeekPlan,
    };

    const nutritionConfig = {
      meal_strategy: form.meal_strategy,
      caloric_split: {
        breakfast_pct: parseInt(form.caloric_split_breakfast, 10) || 0,
        lunch_pct: parseInt(form.caloric_split_lunch, 10) || 0,
        dinner_pct: parseInt(form.caloric_split_dinner, 10) || 0,
        snacks_pct: parseInt(form.caloric_split_snacks, 10) || 0,
      },
      macro_split: {
        carbs_pct: parseInt(form.macro_carbs_pct, 10) || 0,
        protein_pct: parseInt(form.macro_protein_pct, 10) || 0,
        fat_pct: parseInt(form.macro_fat_pct, 10) || 0,
      },
      prep_time_minutes: parseInt(form.prep_time_minutes, 10) || null,
      cooking_skill: form.cooking_skill,
      home_cooked_preference: form.home_cooked_preference === "true",
      week_plan: dietWeekPlan,
    };

    const supplementConfig = {
      selected_tokens: (parseCsvList(normalizeSupplementTokensCsv(form.supplements)) ?? []).map(normalizeSupplementToken),
      selected_brands: parseCsvList(form.supplement_brands) ?? [],
    };

    const payload = {
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      email: form.email || null,
      birth_date: form.birth_date || null,
      sex: form.sex || null,
      timezone: form.timezone || null,
      activity_level: form.activity_level || null,
      height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      body_fat_pct: form.body_fat_pct ? parseFloat(form.body_fat_pct) : null,
      muscle_mass_kg: form.muscle_mass_kg ? parseFloat(form.muscle_mass_kg) : null,
      resting_hr_bpm: form.resting_hr_bpm ? parseInt(form.resting_hr_bpm, 10) : null,
      max_hr_bpm: form.max_hr_bpm ? parseInt(form.max_hr_bpm, 10) : null,
      threshold_hr_bpm: form.threshold_hr_bpm ? parseInt(form.threshold_hr_bpm, 10) : null,
      training_days_per_week: form.training_days_per_week ? parseInt(form.training_days_per_week, 10) : null,
      training_max_session_minutes: form.training_max_session_minutes ? parseInt(form.training_max_session_minutes, 10) : null,
      routine_summary: form.routine_summary || null,
      routine_config: routineConfig,
      nutrition_config: nutritionConfig,
      supplement_config: supplementConfig,
      diet_type: form.diet_type || null,
      preferred_meal_count: form.preferred_meal_count ? parseInt(form.preferred_meal_count, 10) : null,
      food_preferences: joinUnique([
        ...(parseCsvList(form.food_preferences) ?? []),
        ...(parseCsvList(form.cuisines) ?? []),
      ]),
      food_exclusions: parseCsvList(form.food_exclusions),
      intolerances: parseCsvList(form.intolerances),
      allergies: parseCsvList(form.allergies),
      supplements: joinUnique([
        ...(parseCsvList(normalizeSupplementTokensCsv(form.supplements)) ?? []).map(normalizeSupplementToken),
        ...(parseCsvList(form.supplement_brands) ?? []),
      ]),
    };

    try {
      if (editingProfileId) {
        /** Stesso id usato da GET `/api/profile?athleteId=` (memoria atleta); evita mismatch con stato form. */
        const putId = (activeAthleteId ?? "").trim() || editingProfileId;
        await updateProfilePayload(putId, payload);
      } else {
        await createProfilePayload(payload);
      }
      setShowForm(false);
      setEditingProfileId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore salvataggio profilo");
    }
    setSaving(false);
  }

  const currentProfile = profiles[0] ?? null;
  const currentPhysio = currentProfile ? physioMap[currentProfile.id] : null;
  const resolvedFtp =
    currentPhysio?.ftp_watts ??
    physiologyState?.metabolicProfile.ftpWatts ??
    physiologyState?.physiologicalProfile.ftpWatts ??
    null;
  const resolvedLt1 =
    currentPhysio?.lt1_watts ??
    physiologyState?.metabolicProfile.lt1Watts ??
    physiologyState?.physiologicalProfile.lt1Watts ??
    null;
  const resolvedLt2 =
    currentPhysio?.lt2_watts ??
    physiologyState?.metabolicProfile.lt2Watts ??
    physiologyState?.physiologicalProfile.lt2Watts ??
    null;
  const resolvedVLamax =
    currentPhysio?.v_lamax ??
    physiologyState?.metabolicProfile.vLamax ??
    physiologyState?.physiologicalProfile.vLamax ??
    null;
  const resolvedVo2max =
    currentPhysio?.vo2max_ml_min_kg ??
    physiologyState?.performanceProfile.vo2maxMlMinKg ??
    physiologyState?.physiologicalProfile.vo2maxMlMinKg ??
    null;
  const derivedVo2max =
    resolvedVo2max ??
    estimateVo2maxMlMinKg({
      weightKg: currentProfile?.weight_kg ?? null,
      ftpWatts: resolvedFtp,
      cpWatts:
        currentPhysio?.cp_watts ??
        physiologyState?.metabolicProfile.cpWatts ??
        physiologyState?.physiologicalProfile.cpWatts ??
        null,
      lt2Watts: resolvedLt2,
      oxidativeCapacityKcalMin: physiologyState?.performanceProfile.oxidativeCapacityKcalMin ?? null,
    });
  const vo2maxSourceLabel =
    resolvedVo2max != null
      ? "direct physiology memory"
      : physiologyState?.performanceProfile.oxidativeCapacityKcalMin != null
        ? "derived from oxidative capacity"
        : resolvedLt2 != null
          ? "derived from LT2 / weight"
          : (currentPhysio?.cp_watts ?? physiologyState?.metabolicProfile.cpWatts ?? physiologyState?.physiologicalProfile.cpWatts) != null
            ? "derived from critical power / weight"
            : resolvedFtp != null
              ? "derived from FTP / weight"
              : "not available";
  const ftpPerKg =
    resolvedFtp != null && currentProfile?.weight_kg
      ? resolvedFtp / currentProfile.weight_kg
      : null;
  const athleteType = classifyAthleteType({
    ftpPerKg,
    vLamax: resolvedVLamax,
    vo2max: derivedVo2max,
  });
  const physiologySummarySections = useMemo(() => {
    if (!physiologyState) return [];
    return [
      {
        title: "Metabolic profile",
        cards: [
          {
            label: "FTP",
            value: physiologyState.metabolicProfile.ftpWatts != null ? `${Math.round(physiologyState.metabolicProfile.ftpWatts)} W` : "—",
          },
          {
            label: "FatMax",
            value: physiologyState.metabolicProfile.fatmaxWatts != null ? `${Math.round(physiologyState.metabolicProfile.fatmaxWatts)} W` : "—",
          },
          {
            label: "Indice glic. (proxy)",
            value: physiologyState.metabolicProfile.vLamax != null ? physiologyState.metabolicProfile.vLamax.toFixed(2) : "—",
          },
        ],
      },
      {
        title: "Lactate / gut",
        cards: [
          {
            label: "Lactate oxidized",
            value:
              physiologyState.lactateProfile.lactateOxidizedG != null
                ? `${physiologyState.lactateProfile.lactateOxidizedG.toFixed(1)} g`
                : "—",
          },
          {
            label: "Blood delivery",
            value:
              physiologyState.lactateProfile.bloodDeliveryPctOfIngested != null
                ? `${Math.round(physiologyState.lactateProfile.bloodDeliveryPctOfIngested)}%`
                : "—",
          },
          {
            label: "Gut stress",
            value:
              physiologyState.lactateProfile.gutStressScore != null
                ? `${Math.round(physiologyState.lactateProfile.gutStressScore * 100)}/100`
                : "—",
          },
        ],
      },
      {
        title: "Performance",
        cards: [
          {
            label: "VO2max",
            value: derivedVo2max != null ? `${derivedVo2max.toFixed(1)} ml/kg/min` : "—",
          },
          {
            label: "Oxidative bottleneck",
            value:
              physiologyState.performanceProfile.oxidativeBottleneckIndex != null
                ? `${Math.round(physiologyState.performanceProfile.oxidativeBottleneckIndex)}/100`
                : "—",
          },
          {
            label: "Redox stress",
            value:
              physiologyState.performanceProfile.redoxStressIndex != null
                ? `${Math.round(physiologyState.performanceProfile.redoxStressIndex)}/100`
                : "—",
          },
        ],
      },
      {
        title: "Bioenergetis",
        cards: [
          {
            label: "Phase angle",
            value:
              physiologyState.bioenergeticProfile.phaseAngleScore != null
                ? `${physiologyState.bioenergeticProfile.phaseAngleScore}`
                : "—",
          },
          {
            label: "Mitochondrial efficiency",
            value:
              physiologyState.bioenergeticProfile.mitochondrialEfficiency != null
                ? `${Math.round(physiologyState.bioenergeticProfile.mitochondrialEfficiency)}`
                : "—",
          },
          {
            label: "Hydration status",
            value:
              physiologyState.bioenergeticProfile.hydrationStatus != null
                ? `${Math.round(physiologyState.bioenergeticProfile.hydrationStatus)}`
                : "—",
          },
        ],
      },
      {
        title: "Recovery",
        cards: [
          {
            label: "Resting HR",
            value:
              physiologyState.recoveryProfile.restingHrBpm != null
                ? `${Math.round(physiologyState.recoveryProfile.restingHrBpm)} bpm`
                : "—",
          },
          {
            label: "Max HR",
            value:
              physiologyState.recoveryProfile.maxHrBpm != null
                ? `${Math.round(physiologyState.recoveryProfile.maxHrBpm)} bpm`
                : "—",
          },
        ],
      },
    ]
      .map((section) => ({
        ...section,
        cards: section.cards.filter((card) => hasDisplayValue(card.value)).slice(0, 3),
      }))
      .filter((section) => section.cards.length > 0);
  }, [derivedVo2max, physiologyState]);

  const keyMetricItems = currentProfile
    ? [
        { label: "Peso", value: currentProfile.weight_kg != null ? `${currentProfile.weight_kg} kg` : "—" },
        { label: "Altezza", value: currentProfile.height_cm != null ? `${currentProfile.height_cm} cm` : "—" },
        { label: "Body Fat", value: currentProfile.body_fat_pct != null ? `${currentProfile.body_fat_pct}%` : "—" },
        { label: "FTP", value: resolvedFtp != null ? `${Math.round(resolvedFtp)} W` : "—" },
        { label: "FTP/kg", value: ftpPerKg != null ? ftpPerKg.toFixed(2) : "—" },
        {
          label: "LT1 / LT2",
          value: resolvedLt1 != null || resolvedLt2 != null ? `${resolvedLt1 ?? "—"} / ${resolvedLt2 ?? "—"} W` : "—",
        },
        { label: "Indice glic. (proxy)", value: resolvedVLamax != null ? `${resolvedVLamax.toFixed(2)}` : "—" },
        { label: "VO2max", value: derivedVo2max != null ? `${derivedVo2max.toFixed(1)} ml/kg/min` : "—" },
        { label: "FC riposo", value: currentProfile.resting_hr_bpm != null ? `${currentProfile.resting_hr_bpm} bpm` : "—" },
        { label: "FC max", value: currentProfile.max_hr_bpm != null ? `${currentProfile.max_hr_bpm} bpm` : "—" },
      ].map((m) => ({ ...m, accent: profileMetricLabelToAccent(m.label) }))
    : [];

  const twinKpiItems = twinSnapshot
    ? [
        { label: "Readiness", value: twinSnapshot.readiness != null ? `${Math.round(twinSnapshot.readiness)}` : "—", accent: "cyan" as const, icon: Heart },
        {
          label: "Fatigue (acute)",
          value: twinSnapshot.fatigueAcute != null ? twinSnapshot.fatigueAcute.toFixed(2) : "—",
          accent: "orange" as const,
          icon: Flame,
        },
        {
          label: "Fitness (chronic)",
          value: twinSnapshot.fitnessChronic != null ? twinSnapshot.fitnessChronic.toFixed(2) : "—",
          accent: "emerald" as const,
          icon: Activity,
        },
        {
          label: "Internal load",
          value: twinSnapshot.internalLoadIndex != null ? twinSnapshot.internalLoadIndex.toFixed(2) : "—",
          accent: "violet" as const,
          icon: GaugeCircle,
        },
        {
          label: "Recovery debt",
          value: twinSnapshot.recoveryDebt != null ? twinSnapshot.recoveryDebt.toFixed(2) : "—",
          accent: "slate" as const,
          icon: Layers,
        },
        {
          label: "Glycogen",
          value: twinSnapshot.glycogenStatus != null ? twinSnapshot.glycogenStatus.toFixed(2) : "—",
          accent: "cyan" as const,
          icon: Activity,
        },
      ]
    : [];

  return (
    <Pro2ModulePageShell
      eyebrow="Athlete · Profile"
      eyebrowClassName={moduleEyebrowClass("profile")}
      title="Identità e vincoli"
      description={
        <>
          Dati da <code className="text-fuchsia-200/80">GET /api/profile</code> + memoria atleta. FTP{" "}
          <span className="text-orange-200/90">{resolvedFtp != null ? `${Math.round(resolvedFtp)} W` : "—"}</span>
          {" · "}
          classificazione {athleteType.label} · streak attività {dayStreak}g
        </>
      }
      headerActions={
        <>
          {currentProfile ? (
            <Pro2Button
              type="button"
              variant="secondary"
              className="border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
              onClick={() => startEditProfile(currentProfile)}
            >
              Modifica profilo
            </Pro2Button>
          ) : null}
          <Pro2Link
            href="/physiology"
            variant="secondary"
            className="justify-center border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15"
          >
            Physiology
          </Pro2Link>
          <Pro2Link
            href="/training/builder"
            variant="secondary"
            className="justify-center border border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15"
          >
            Builder
          </Pro2Link>
        </>
      }
    >
      <div className="profile-page space-y-10">
        {error ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}</div>
        ) : null}

        {currentProfile ? (
          <>
            <Pro2SectionCard
              accent="fuchsia"
              icon={User}
              title="Identità atleta"
              subtitle={`${currentProfile.activity_level ?? "advanced"}${currentProfile.diet_type ? ` · ${currentProfile.diet_type}` : ""}`}
            >
              <div className="flex flex-wrap items-center gap-5">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-fuchsia-400/40 bg-fuchsia-500/25 text-xl font-black text-white shadow-[0_0_24px_rgba(217,70,239,0.3)]"
                  aria-hidden
                >
                  {(currentProfile.first_name?.[0] ?? currentProfile.last_name?.[0] ?? "U").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {[currentProfile.first_name, currentProfile.last_name].filter(Boolean).join(" ") || "Utente"}
                  </p>
                  <span
                    className={cn(
                      "mt-3 inline-flex rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-wide",
                      athleteTypePillClass(athleteType.tone),
                    )}
                  >
                    {athleteType.label}
                  </span>
                </div>
              </div>
            </Pro2SectionCard>

            <Pro2SectionCard
              accent="orange"
              icon={GaugeCircle}
              title="Metriche chiave"
              subtitle="Profilo tabellare + merge fisiologia (reality > plan)"
            >
              <ProfilePro2KpiGrid items={keyMetricItems} />
              <p className="mt-3 text-[0.8rem] leading-relaxed text-gray-500">
                FTP / indice glicolitico / VO₂max qui sono dall&apos;ultimo dato salvato su Supabase (snapshot Physiology). Per numeri col motore
                attuale, apri Physiology → Metabolic Profile e premi &quot;Salva snapshot&quot;.
              </p>
            </Pro2SectionCard>

            {physiologySummarySections.length ? (
              <Pro2SectionCard
                accent="cyan"
                icon={Activity}
                title="Segnali fisiologici"
                subtitle="Vista compatta da PhysiologyState in athlete memory"
              >
                <div className="space-y-6">
                  {physiologySummarySections.map((section) => (
                    <div key={section.title}>
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{section.title}</p>
                      <p className="text-[0.65rem] text-gray-600">{section.cards.length} segnali</p>
                      <ProfilePro2KpiGrid
                        columnsClassName="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                        items={section.cards.map((card) => ({
                          label: card.label,
                          value: card.value,
                          accent: profileSectionTitleToAccent(section.title),
                          icon: Activity,
                        }))}
                      />
                    </div>
                  ))}
                </div>
              </Pro2SectionCard>
            ) : null}

            {physiologyCoverage ? (
              <Pro2SectionCard
                accent="slate"
                icon={Dna}
                title="Copertura dataset fisiologico"
                subtitle="Cosa è presente in memoria per i motori deterministici"
              >
                <details className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-300">Fonti e derivazioni</summary>
                  <div className="mt-3 space-y-2 text-sm text-gray-400">
                    <p>
                      {`Profilo fisiologico ${physiologyCoverage.physiologicalProfile ? "ok" : "mancante"} · run metabolico ${physiologyCoverage.metabolicRun ? "ok" : "mancante"} · lattato ${physiologyCoverage.lactateRun ? "ok" : "mancante"} · performance ${physiologyCoverage.performanceRun ? "ok" : "mancante"} · bioenergetica ${physiologyCoverage.biomarkerPanel ? "ok" : "mancante"}`}
                    </p>
                    <p>
                      {`VO2max · ${vo2maxSourceLabel}${derivedVo2max != null ? ` · ${derivedVo2max.toFixed(1)} ml/kg/min` : ""}`}
                    </p>
                  </div>
                </details>
              </Pro2SectionCard>
            ) : null}

            {twinSnapshot ? (
              <Pro2SectionCard
                accent="violet"
                icon={Layers}
                title="Digital twin"
                subtitle={
                  twinSnapshot.asOf
                    ? `Aggiornato ${String(twinSnapshot.asOf).slice(0, 10)}`
                    : "Stato unificato atleta"
                }
              >
                <ProfilePro2KpiGrid items={twinKpiItems} />
              </Pro2SectionCard>
            ) : null}

            <div className="flex flex-wrap gap-2 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-950/10 p-2 sm:p-3">
              <button
                type="button"
                className={editorTabClass(activeSection === "personal", "violet")}
                onClick={() => openEditSubsection("personal")}
              >
                Personal
              </button>
              <button
                type="button"
                className={editorTabClass(activeSection === "physical", "cyan")}
                onClick={() => openEditSubsection("physical")}
              >
                Physical
              </button>
              <button
                type="button"
                className={editorTabClass(activeSection === "physical", "cyan")}
                onClick={() => openEditSubsection("physical")}
              >
                Body scan
              </button>
              <button
                type="button"
                className={editorTabClass(activeSection === "routine", "amber")}
                onClick={() => openEditSubsection("routine")}
              >
                Routine
              </button>
              <button
                type="button"
                className={editorTabClass(activeSection === "nutrition" && activeNutritionTab === "diet", "rose")}
                onClick={() => openEditSubsection("nutrition", "diet")}
              >
                Diet
              </button>
              <button
                type="button"
                className={editorTabClass(activeSection === "nutrition" && activeNutritionTab === "intolerances", "rose")}
                onClick={() => openEditSubsection("nutrition", "intolerances")}
              >
                Intolerances
              </button>
              <button
                type="button"
                className={editorTabClass(activeSection === "nutrition" && activeNutritionTab === "supplements", "rose")}
                onClick={() => openEditSubsection("nutrition", "supplements")}
              >
                Integratori
              </button>
              <button type="button" className={editorTabClass(false, "slate")} onClick={() => openEditSubsection("personal")}>
                Devices
              </button>
            </div>
          </>
        ) : null}

      <div>
        <Pro2Button
          type="button"
          variant="secondary"
          className="border border-white/20 bg-white/5 hover:bg-white/10"
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) setEditingProfileId(null);
          }}
        >
          {showForm ? "Annulla editor" : "Nuovo profilo"}
        </Pro2Button>
      </div>

      {showForm && (
        <Pro2SectionCard
          accent="slate"
          icon={PencilLine}
          title="Editor profilo"
          subtitle="Salvataggio tramite API profilo (memoria atleta dominio profile)"
        >
        <form onSubmit={handleSubmit} className={`profile-monitor profile-editor-shell tone-${profileToneForEditorSection(activeSection)}`} style={{ marginBottom: "24px", padding: "20px" }}>
          {activeSection === "personal" && (
            <div>
              <h3 className={`profile-section-band tone-${profileToneForEditorSection("personal")}`}><span className="profile-kpi-dot" />Personal Information</h3>
              <div className="profile-editor-grid">
              <div className="form-group"><label className="form-label">Nome</label><input type="text" className="form-input" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Cognome</label><input type="text" className="form-input" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Data nascita</label><input type="date" className="form-input" value={form.birth_date} onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Genere</label><select className="form-select" value={form.sex} onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}><option value="">—</option><option value="male">Uomo</option><option value="female">Donna</option><option value="other">Altro</option></select></div>
              <div className="form-group"><label className="form-label">Livello attivita</label><select className="form-select" value={form.activity_level} onChange={(e) => setForm((f) => ({ ...f, activity_level: e.target.value }))}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="elite">Elite</option></select></div>
              <div className="form-group"><label className="form-label">Lifestyle</label><select className="form-select" value={form.lifestyle_activity_class} onChange={(e) => setForm((f) => ({ ...f, lifestyle_activity_class: e.target.value }))}><option value="sedentary">Sedentary +15%</option><option value="moderate">Moderate +20%</option><option value="active">Active +30%</option><option value="very_active">Very active +40%</option></select></div>
              <div className="form-group"><label className="form-label">Fuso orario</label><input type="text" className="form-input" value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} /></div>
              </div>
              <div className="profile-subpanel tone-slate" style={{ marginTop: "12px" }}>
                <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />Devices</h4>
                <p className="muted-copy">Qui colleghiamo le API device: Garmin, Strava, Whoop, Oura e altri provider.</p>
                {garminReturn === "connected" ? (
                  <p className="text-sm text-emerald-400/90" style={{ marginTop: 8 }}>
                    Garmin Connect collegato. In automatico abbiamo richiesto uno storico iniziale via Summary Backfill
                    (stream multipli e giorni configurabili lato server con{" "}
                    <code className="text-white/80">GARMIN_POST_CONNECT_BACKFILL_STREAMS</code> e{" "}
                    <code className="text-white/80">GARMIN_POST_CONNECT_BACKFILL_DAYS</code>
                    ); i dati arrivano quando Garmin li elabora, poi il worker pull (cron) li scarica.
                  </p>
                ) : null}
                {garminReturn === "error" ? (
                  <div className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>
                    <p style={{ marginBottom: 8 }}>
                      Collegamento Garmin non riuscito
                      {garminReason ? (
                        <>
                          {" "}
                          (<code className="text-white/70">{garminReason}</code>
                          {garminDetail ? (
                            <>
                              , dettaglio: <code className="text-white/70">{garminDetail}</code>
                            </>
                          ) : null}
                          )
                        </>
                      ) : garminDetail ? (
                        <>
                          : <code className="text-white/70">{garminDetail}</code>
                        </>
                      ) : (
                        <>
                          {" "}
                          (parametri <code className="text-white/80">reason</code> /{" "}
                          <code className="text-white/80">detail</code> nell&apos;URL)
                        </>
                      )}
                      . Riprova o verifica env e redirect URI nel portale Garmin.
                    </p>
                    {(() => {
                      const g = garminOAuthReasonGuidance(garminReason);
                      if (!g) return null;
                      return (
                        <div
                          className="rounded-md border border-rose-500/25 bg-rose-950/20 px-3 py-2 text-white/85"
                          style={{ marginTop: 4 }}
                        >
                          <p className="font-medium text-rose-100/95" style={{ marginBottom: 6 }}>
                            {g.title}
                          </p>
                          <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed">
                            {g.bullets.map((b, i) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
                {garminReturn === "forbidden" ? (
                  <p className="text-sm text-amber-400/90" style={{ marginTop: 8 }}>
                    Accesso negato per questo atleta (profilo coach/atleta o org non allineata). Verifica il collegamento
                    coach–atleta e riprova.
                  </p>
                ) : null}
                {garminReturn === "server_config" ? (
                  <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>
                    OAuth Garmin non configurato sul server: imposta in Vercel{" "}
                    <code className="text-white/80">GARMIN_OAUTH2_CLIENT_ID</code> e{" "}
                    <code className="text-white/80">GARMIN_OAUTH2_REDIRECT_URI</code> (o{" "}
                    <code className="text-white/80">GARMIN_OAUTH2_REDIRECT_URL</code>), poi ridistribuisci.
                  </p>
                ) : null}
                {garminReturn === "missing_athlete" ? (
                  <p className="text-sm text-amber-400/90" style={{ marginTop: 8 }}>
                    Atleta non selezionato. Apri il profilo con un atleta attivo e usa di nuovo &quot;Collega Garmin&quot;.
                  </p>
                ) : null}
                {garminReturn === "pkce" ? (
                  <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>
                    Errore cookie PKCE: imposta <code className="text-white/80">GARMIN_OAUTH_PKCE_SECRET</code> su Vercel
                    (min. 16 caratteri).
                    {garminDetail ? (
                      <>
                        {" "}
                        Dettaglio: <code className="text-white/70">{garminDetail}</code>
                      </>
                    ) : null}
                  </p>
                ) : null}
                {whoopReturn === "ok" ? (
                  <p className="text-sm text-emerald-400/90" style={{ marginTop: 8 }}>
                    WHOOP collegato. Puoi usare &quot;Aggiorna dati WHOOP&quot; qui sotto per scaricare sonno, recovery e
                    workout (ultimi ~14 giorni). Quali stream vengono salvati dipende dalla policy in{" "}
                    <strong className="text-white/90">Impostazioni</strong> → ingest dispositivi.
                  </p>
                ) : null}
                {whoopReturn === "error" ? (
                  <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>
                    Collegamento WHOOP non riuscito
                    {whoopReason ? (
                      <>
                        {" "}
                        (<code className="text-white/70">{whoopReason}</code>
                        {whoopDetail ? (
                          <>
                            , dettaglio: <code className="text-white/70">{whoopDetail}</code>
                          </>
                        ) : null}
                        )
                      </>
                    ) : whoopDetail ? (
                      <>
                        : <code className="text-white/70">{whoopDetail}</code>
                      </>
                    ) : null}
                    . Verifica env WHOOP e redirect URI nel developer dashboard WHOOP.
                  </p>
                ) : null}
                {whoopReturn === "server_config" ? (
                  <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>
                    OAuth WHOOP non configurato sul server:{" "}
                    <code className="text-white/80">WHOOP_OAUTH2_CLIENT_ID</code>,{" "}
                    <code className="text-white/80">WHOOP_OAUTH2_REDIRECT_URI</code>, segreti.
                  </p>
                ) : null}
                {whoopReturn === "denied" || whoopReturn === "missing_athlete" ? (
                  <p className="text-sm text-amber-400/90" style={{ marginTop: 8 }}>
                    {whoopReturn === "missing_athlete"
                      ? "Atleta non indicato nel flusso OAuth WHOOP: apri il profilo con atleta attivo e riprova «Collega WHOOP»."
                      : "Accesso negato per WHOOP (sessione o atleta). Riprova da account autorizzato."}
                  </p>
                ) : null}
                {polarReturn === "ok" ? (
                  <p className="text-sm text-emerald-400/90" style={{ marginTop: 8 }}>
                    Polar collegato. Puoi usare &quot;Aggiorna dati Polar&quot; qui sotto per scaricare allenamenti, sonno e
                    Nightly Recharge. Quali stream vengono salvati dipende dalla policy in{" "}
                    <strong className="text-white/90">Impostazioni</strong> → ingest dispositivi.
                  </p>
                ) : null}
                {polarReturn === "error" ? (
                  <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>
                    Collegamento Polar non riuscito
                    {polarReason ? (
                      <>
                        {" "}
                        (<code className="text-white/70">{polarReason}</code>
                        {polarDetail ? (
                          <>
                            , dettaglio: <code className="text-white/70">{polarDetail}</code>
                          </>
                        ) : null}
                        )
                      </>
                    ) : polarDetail ? (
                      <>
                        : <code className="text-white/70">{polarDetail}</code>
                      </>
                    ) : null}
                    . Se l&apos;errore è <code className="text-white/70">register_user</code> /{" "}
                    <code className="text-white/70">consents_missing</code>, accetta i consensi su account.polar.com e riprova.
                  </p>
                ) : null}
                {polarReturn === "server_config" ? (
                  <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>
                    OAuth Polar non configurato sul server:{" "}
                    <code className="text-white/80">POLAR_OAUTH2_CLIENT_ID</code>,{" "}
                    <code className="text-white/80">POLAR_OAUTH2_CLIENT_SECRET</code>.
                  </p>
                ) : null}
                {polarReturn === "denied" || polarReturn === "missing_athlete" ? (
                  <p className="text-sm text-amber-400/90" style={{ marginTop: 8 }}>
                    {polarReturn === "missing_athlete"
                      ? "Atleta non indicato nel flusso OAuth Polar: apri il profilo con atleta attivo e riprova «Collega Polar»."
                      : "Accesso negato per Polar (sessione o atleta). Riprova da account autorizzato."}
                  </p>
                ) : null}
                {wahooReturn === "ok" ? (
                  <p className="text-sm text-emerald-400/90" style={{ marginTop: 8 }}>
                    Wahoo Cloud collegato. API piani e workout:{" "}
                    <code className="text-white/80">/api/integrations/wahoo/plans</code>,{" "}
                    <code className="text-white/80">/api/integrations/wahoo/workouts</code> (sessione). Ricollega se
                    servono scope <code className="text-white/80">plans_*</code> / <code className="text-white/80">workouts_write</code>.
                  </p>
                ) : null}
                {wahooReturn === "error" ? (
                  <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>
                    Collegamento Wahoo non riuscito
                    {wahooReason ? (
                      <>
                        {" "}
                        (<code className="text-white/70">{wahooReason}</code>
                        {wahooDetail ? (
                          <>
                            , dettaglio: <code className="text-white/70">{wahooDetail}</code>
                          </>
                        ) : null}
                        )
                      </>
                    ) : wahooDetail ? (
                      <>
                        : <code className="text-white/70">{wahooDetail}</code>
                      </>
                    ) : null}
                    .
                  </p>
                ) : null}
                {wahooReturn === "server_config" ? (
                  <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>
                    OAuth Wahoo non configurato sul server:{" "}
                    <code className="text-white/80">WAHOO_OAUTH2_CLIENT_ID</code>,{" "}
                    <code className="text-white/80">WAHOO_OAUTH2_REDIRECT_URI</code>.
                  </p>
                ) : null}
                {stravaReturn === "ok" ? (
                  <p className="text-sm text-emerald-400/90" style={{ marginTop: 8 }}>
                    Strava collegato. Token salvati lato server; usa «Aggiorna attività Strava» qui sotto o in Impostazioni →
                    Mio account · device.
                  </p>
                ) : null}
                {stravaReturn === "error" ? (
                  <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>
                    Collegamento Strava non riuscito
                    {stravaReason ? (
                      <>
                        {" "}
                        (<code className="text-white/70">{stravaReason}</code>
                        {stravaDetail ? (
                          <>
                            , dettaglio: <code className="text-white/70">{stravaDetail}</code>
                          </>
                        ) : null}
                        )
                      </>
                    ) : stravaDetail ? (
                      <>
                        : <code className="text-white/70">{stravaDetail}</code>
                      </>
                    ) : null}
                    . Verifica env Strava e redirect URI nel portale sviluppatori Strava.
                  </p>
                ) : null}
                {stravaReturn === "server_config" ? (
                  <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>
                    OAuth Strava non configurato sul server:{" "}
                    <code className="text-white/80">STRAVA_OAUTH2_CLIENT_ID</code>,{" "}
                    <code className="text-white/80">STRAVA_OAUTH2_CLIENT_SECRET</code>,{" "}
                    <code className="text-white/80">STRAVA_OAUTH2_REDIRECT_URI</code>.
                  </p>
                ) : null}
                {stravaReturn === "denied" || stravaReturn === "missing_athlete" ? (
                  <p className="text-sm text-amber-400/90" style={{ marginTop: 8 }}>
                    {stravaReturn === "missing_athlete"
                      ? "Atleta non indicato nel flusso OAuth Strava: apri il profilo con atleta attivo e riprova «Collega Strava»."
                      : "Accesso negato per Strava (sessione o atleta). Riprova da account autorizzato."}
                  </p>
                ) : null}
                {activeAthleteId && garminLink && whoopLink && wahooLink && stravaLink ? (
                  <div className="flex flex-col gap-2" style={{ marginTop: 12 }}>
                    {garminLink.linkStatusError ? (
                      <p className="text-sm text-amber-400/90">
                        Stato Garmin non disponibile: {garminLink.linkStatusError}
                        {garminLink.linkStatusHint ? (
                          <>
                            {" "}
                            <span className="text-white/75">({garminLink.linkStatusHint})</span>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                    {garminLink.linked ? (
                      <p className="muted-copy text-sm">
                        Garmin collegato (ID API <span className="text-white/80">{garminLink.garminUserIdMasked}</span>
                        ).
                      </p>
                    ) : (
                      <p className="muted-copy text-sm">Nessun account Garmin collegato a questo profilo atleta.</p>
                    )}
                    {garminLink.linked &&
                    (garminLink.oauthScope || (garminLink.userPermissionsGranted && garminLink.userPermissionsGranted.length > 0)) ? (
                      <div
                        className="rounded-md border border-white/12 bg-black/25 px-3 py-2 text-xs text-white/80"
                        style={{ marginTop: 4 }}
                      >
                        <p className="font-medium text-white/90" style={{ marginBottom: 6 }}>
                          Permessi e scope (allineamento portale Garmin)
                        </p>
                        {garminLink.oauthScope ? (
                          <p className="break-all" style={{ marginBottom: 6 }}>
                            <span className="text-white/60">OAuth scope (token):</span>{" "}
                            <code className="text-cyan-100/90">{garminLink.oauthScope}</code>
                          </p>
                        ) : null}
                        {garminLink.userPermissionsGranted && garminLink.userPermissionsGranted.length > 0 ? (
                          <div>
                            <p className="text-white/60" style={{ marginBottom: 4 }}>
                              Health API — permessi concessi (GET /rest/user/permissions):
                            </p>
                            <ul className="max-h-32 list-disc space-y-0.5 overflow-y-auto pl-4 font-mono text-[11px] text-white/75">
                              {garminLink.userPermissionsGranted.map((perm) => (
                                <li key={perm}>{perm}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-white/55">
                            Elenco permessi da Garmin non ancora disponibile o vuoto; dopo il collegamento può
                            popolarsi al prossimo refresh o quando Garmin invia il webhook{" "}
                            <code className="text-white/65">push/userPermissions</code>.
                          </p>
                        )}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/api/integrations/garmin/authorize?athleteId=${encodeURIComponent(activeAthleteId)}`}
                        target="_self"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-fit items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                      >
                        {garminLink.linked ? "Ricollega Garmin Connect" : "Collega Garmin Connect"}
                      </a>
                      {garminLink.linked ? (
                        <Pro2Button
                          type="button"
                          variant="secondary"
                          disabled={garminDisconnecting}
                          className="border border-rose-500/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
                          onClick={() => void disconnectGarmin()}
                        >
                          {garminDisconnecting ? "Scollegamento…" : "Scollega Garmin"}
                        </Pro2Button>
                      ) : null}
                    </div>
                    {garminLink.linked ? (
                      <div
                        className="rounded-lg border border-white/15 bg-black/20 px-3 py-3"
                        style={{ marginTop: 10 }}
                      >
                        <p className="muted-copy text-xs" style={{ marginBottom: 8 }}>
                          Storico Garmin (Summary Backfill): intervallo ultimi N giorni UTC (max{" "}
                          <strong className="text-white/80">{garminSingleBackfillMaxDays}</strong> giorni per richiesta sullo
                          stream selezionato; stream Activity tipo activityDetails/moveiq usano 30 giorni, Health/wellness fino a
                          90). Oltre il limite il server taglia alla finestra più recente. Risposta tipica 202, poi notifiche + pull.
                        </p>
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="form-group" style={{ minWidth: 160 }}>
                            <label className="form-label text-xs">Stream</label>
                            <select
                              className="form-select profile-dark-select text-sm"
                              value={garminBackfillStream}
                              onChange={(e) => {
                                const v = e.target.value;
                                setGarminBackfillStream(v);
                                const cap = Math.floor(
                                  maxRangeSecondsForGarminSummaryBackfillStream(v as GarminSummaryBackfillStream) / 86_400,
                                );
                                setGarminBackfillDays((d) =>
                                  Math.min(Math.max(1, Math.floor(Number(d) || 14)), cap),
                                );
                              }}
                            >
                              {GARMIN_SUMMARY_BACKFILL_STREAMS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group" style={{ width: 100 }}>
                            <label className="form-label text-xs">Giorni</label>
                            <input
                              type="number"
                              min={1}
                              max={garminSingleBackfillMaxDays}
                              className="form-input text-sm"
                              value={garminBackfillDays}
                              onChange={(e) =>
                                setGarminBackfillDays(
                                  Math.min(
                                    garminSingleBackfillMaxDays,
                                    Math.max(1, Math.floor(Number(e.target.value)) || 1),
                                  ),
                                )
                              }
                            />
                          </div>
                          <Pro2Button
                            type="button"
                            variant="secondary"
                            disabled={garminBackfillBusy}
                            className="border border-cyan-500/35 bg-cyan-500/10 text-cyan-50 hover:bg-cyan-500/20"
                            onClick={() => void runGarminBackfill()}
                          >
                            {garminBackfillBusy ? "Invio…" : "Richiedi storico"}
                          </Pro2Button>
                          <Pro2Button
                            type="button"
                            variant="secondary"
                            disabled={garminBackfillBusy}
                            className="border border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-50 hover:bg-fuchsia-500/18"
                            onClick={() => void runGarminBackfillWellnessBatch()}
                          >
                            {garminBackfillBusy ? "Invio…" : "Wellness batch"}
                          </Pro2Button>
                        </div>
                        <p className="muted-copy text-xs" style={{ marginTop: 10, marginBottom: 4 }}>
                          Dati wellness (passi, sonno, stress, HRV): Garmin non espone un “download del giorno” con il solo token
                          OAuth2. Le GET <code className="text-white/65">/rest/dailies</code> ecc. usano il{" "}
                          <strong className="text-white/85">pull token</strong> (<code className="text-white/65">token=</code>)
                          presente nella URL inviata dalla <strong className="text-white/85">notifica Push/Ping</strong>; senza
                          quello il server risponde <code className="text-white/65">InvalidPullTokenException</code>. OAuth2
                          serve per collegare l’utente e per <code className="text-white/65">GET /rest/user/permissions</code> (come
                          indica Garmin). Flusso Empathy: push nel portale Garmin Connect Developer → POST{" "}
                          <code className="text-white/65">/push/…</code> → coda pull → elaborazione quasi subito in background (e
                          cron ogni pochi minuti come riserva). I dati nuovi non richiedono un tasto: sincronizza il dispositivo
                          con Garmin Connect. Le azioni sotto «Richiedi storico» / «Wellness batch» usano invece{" "}
                          <strong className="text-white/85">Summary Backfill</strong> (<code className="text-white/65">
                            GET /rest/backfill/&lt;stream&gt;
                          </code>
                          , solo Bearer): se Garmin risponde <code className="text-white/65">412</code>, è un problema di
                          permessi/programma o finestra storica sul <em>backfill</em>, non del pull automatico con token dalle
                          notifiche.
                        </p>
                        {garminBackfillNotice ? (
                          <p className="text-xs text-white/80" style={{ marginTop: 8 }}>
                            {garminBackfillNotice}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="muted-copy text-xs">
                      Worker pull: dopo ogni notifica push parte un run in background; cron Vercel su{" "}
                      <code className="text-white/70">/api/integrations/garmin/pull/cron</code> (
                      <code className="text-white/70">CRON_SECRET</code>) oppure{" "}
                      <code className="text-white/70">POST …/pull/run</code> con{" "}
                      <code className="text-white/70">GARMIN_PULL_RUN_SECRET</code>. Riferimenti portale:{" "}
                      <a
                        className="text-cyan-200/90 underline underline-offset-2 hover:text-cyan-100"
                        href="https://apis.garmin.com/tools/apiDocs"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        apis.garmin.com/tools/apiDocs
                      </a>
                      .
                    </p>

                    <div
                      className="mt-6 border-t border-white/10 pt-5"
                      style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <h4 className="profile-editor-subtitle" style={{ marginBottom: 8 }}>
                        <span className="profile-kpi-dot" />
                        WHOOP
                      </h4>
                      {whoopLink.linkStatusError ? (
                        <p className="text-sm text-amber-400/90">
                          Stato WHOOP non disponibile: {whoopLink.linkStatusError}
                          {whoopLink.linkStatusHint ? (
                            <>
                              {" "}
                              <span className="text-white/75">({whoopLink.linkStatusHint})</span>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                      {whoopLink.linked ? (
                        <p className="muted-copy text-sm">
                          Account WHOOP collegato (ID{" "}
                          <span className="text-white/80">{whoopLink.whoopUserIdMasked ?? "—"}</span>).
                        </p>
                      ) : (
                        <p className="muted-copy text-sm">
                          Nessun account WHOOP collegato: autorizza l&apos;app per leggere sleep, recovery e workout
                          (scope configurati sul server).
                        </p>
                      )}
                      {whoopLink.linked && whoopLink.oauthScope ? (
                        <p className="mt-2 break-all font-mono text-[11px] text-white/70">
                          <span className="text-white/50">OAuth scope:</span>{" "}
                          <code className="text-cyan-100/90">{whoopLink.oauthScope}</code>
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/integrations/whoop/authorize?athleteId=${encodeURIComponent(activeAthleteId)}`}
                          target="_self"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-fit items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                        >
                          {whoopLink.linked ? "Ricollega WHOOP" : "Collega WHOOP"}
                        </a>
                        {whoopLink.linked ? (
                          <Pro2Button
                            type="button"
                            variant="secondary"
                            disabled={whoopPullBusy}
                            className="border border-violet-500/35 bg-violet-500/10 text-violet-50 hover:bg-violet-500/20"
                            onClick={() => void runWhoopPullNow()}
                          >
                            {whoopPullBusy ? "Pull…" : "Aggiorna dati WHOOP"}
                          </Pro2Button>
                        ) : null}
                      </div>
                      {whoopPullNotice ? (
                        <p className="muted-copy mt-2 text-xs text-white/80">{whoopPullNotice}</p>
                      ) : null}
                      <p className="muted-copy mt-2 text-xs">
                        Aggiornamento automatico: cron Vercel su{" "}
                        <code className="text-white/70">GET /api/integrations/whoop/pull/cron</code> (
                        <code className="text-white/70">CRON_SECRET</code>
                        {" "}o <code className="text-white/70">WHOOP_PULL_RUN_SECRET</code>). Pull manuale:{" "}
                        <code className="text-white/70">POST …/whoop/pull/run</code> con sessione o stesso Bearer.
                      </p>
                    </div>

                    <div
                      className="mt-6 border-t border-white/10 pt-5"
                      style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <h4 className="profile-editor-subtitle" style={{ marginBottom: 8 }}>
                        <span className="profile-kpi-dot" />
                        Polar
                      </h4>
                      {polarLink?.linkStatusError ? (
                        <p className="text-sm text-amber-400/90">
                          Stato Polar non disponibile: {polarLink.linkStatusError}
                          {polarLink.linkStatusHint ? (
                            <>
                              {" "}
                              <span className="text-white/75">({polarLink.linkStatusHint})</span>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                      {polarLink?.linked ? (
                        <p className="muted-copy text-sm">
                          Account Polar collegato (ID{" "}
                          <span className="text-white/80">{polarLink.polarUserIdMasked ?? "—"}</span>).
                        </p>
                      ) : (
                        <p className="muted-copy text-sm">
                          Nessun account Polar collegato: autorizza l&apos;app AccessLink per leggere allenamenti, sonno e
                          Nightly Recharge. Al primo collegamento registriamo l&apos;utente presso il client AccessLink.
                        </p>
                      )}
                      {polarLink?.linked && polarLink.oauthScope ? (
                        <p className="mt-2 break-all font-mono text-[11px] text-white/70">
                          <span className="text-white/50">OAuth scope:</span>{" "}
                          <code className="text-cyan-100/90">{polarLink.oauthScope}</code>
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/integrations/polar/authorize?athleteId=${encodeURIComponent(activeAthleteId)}`}
                          target="_self"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-fit items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                        >
                          {polarLink?.linked ? "Ricollega Polar" : "Collega Polar"}
                        </a>
                        {polarLink?.linked ? (
                          <Pro2Button
                            type="button"
                            variant="secondary"
                            disabled={polarPullBusy}
                            className="border border-violet-500/35 bg-violet-500/10 text-violet-50 hover:bg-violet-500/20"
                            onClick={() => void runPolarPullNow()}
                          >
                            {polarPullBusy ? "Pull…" : "Aggiorna dati Polar"}
                          </Pro2Button>
                        ) : null}
                      </div>
                      {polarPullNotice ? (
                        <p className="muted-copy mt-2 text-xs text-white/80">{polarPullNotice}</p>
                      ) : null}
                      <p className="muted-copy mt-2 text-xs">
                        Aggiornamento automatico: cron Vercel su{" "}
                        <code className="text-white/70">GET /api/integrations/polar/pull/cron</code> (
                        <code className="text-white/70">CRON_SECRET</code>
                        {" "}o <code className="text-white/70">POLAR_PULL_RUN_SECRET</code>). Pull manuale:{" "}
                        <code className="text-white/70">POST …/polar/pull/run</code> con sessione o stesso Bearer.
                      </p>
                    </div>

                    <div
                      className="mt-6 border-t border-white/10 pt-5"
                      style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <h4 className="profile-editor-subtitle" style={{ marginBottom: 8 }}>
                        <span className="profile-kpi-dot" />
                        Suunto
                      </h4>
                      {suuntoReturn === "ok" ? (
                        <p className="text-sm text-emerald-300/90">
                          Suunto collegato. Usa &quot;Aggiorna dati Suunto&quot; per scaricare gli allenamenti.
                        </p>
                      ) : null}
                      {suuntoReturn === "error" ? (
                        <p className="text-sm text-amber-400/90">Collegamento Suunto non riuscito. Riprova.</p>
                      ) : null}
                      {suuntoReturn === "server_config" ? (
                        <p className="text-sm text-amber-400/90">
                          OAuth Suunto non configurato sul server:{" "}
                          <code className="text-white/80">SUUNTO_OAUTH2_CLIENT_ID</code>,{" "}
                          <code className="text-white/80">SUUNTO_OAUTH2_REDIRECT_URI</code>.
                        </p>
                      ) : null}
                      {suuntoLink?.linkStatusError ? (
                        <p className="text-sm text-amber-400/90">
                          Stato Suunto non disponibile: {suuntoLink.linkStatusError}
                          {suuntoLink.linkStatusHint ? (
                            <>
                              {" "}
                              <span className="text-white/75">({suuntoLink.linkStatusHint})</span>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                      {suuntoLink?.linked ? (
                        <p className="muted-copy text-sm">
                          Account Suunto collegato (ID{" "}
                          <span className="text-white/80">{suuntoLink.suuntoUserIdMasked ?? "—"}</span>).
                        </p>
                      ) : (
                        <p className="muted-copy text-sm">
                          Nessun account Suunto collegato: autorizza l&apos;app Suunto Cloud per leggere gli allenamenti
                          (richiede anche la subscription key API lato server).
                        </p>
                      )}
                      {suuntoLink?.linked && suuntoLink.oauthScope ? (
                        <p className="mt-2 break-all font-mono text-[11px] text-white/70">
                          <span className="text-white/50">OAuth scope:</span>{" "}
                          <code className="text-cyan-100/90">{suuntoLink.oauthScope}</code>
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/integrations/suunto/authorize?athleteId=${encodeURIComponent(activeAthleteId)}`}
                          target="_self"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-fit items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                        >
                          {suuntoLink?.linked ? "Ricollega Suunto" : "Collega Suunto"}
                        </a>
                        {suuntoLink?.linked ? (
                          <Pro2Button
                            type="button"
                            variant="secondary"
                            disabled={suuntoPullBusy}
                            className="border border-violet-500/35 bg-violet-500/10 text-violet-50 hover:bg-violet-500/20"
                            onClick={() => void runSuuntoPullNow()}
                          >
                            {suuntoPullBusy ? "Pull…" : "Aggiorna dati Suunto"}
                          </Pro2Button>
                        ) : null}
                      </div>
                      {suuntoPullNotice ? (
                        <p className="muted-copy mt-2 text-xs text-white/80">{suuntoPullNotice}</p>
                      ) : null}
                      <p className="muted-copy mt-2 text-xs">
                        Cron Vercel:{" "}
                        <code className="text-white/70">GET /api/integrations/suunto/pull/cron</code> (
                        <code className="text-white/70">CRON_SECRET</code>
                        {" "}o <code className="text-white/70">SUUNTO_PULL_RUN_SECRET</code>).
                      </p>
                    </div>

                    <div
                      className="mt-6 border-t border-white/10 pt-5"
                      style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <h4 className="profile-editor-subtitle" style={{ marginBottom: 8 }}>
                        <span className="profile-kpi-dot" />
                        Karoo (Hammerhead)
                      </h4>
                      {karooReturn === "ok" ? (
                        <p className="text-sm text-emerald-300/90">
                          Karoo collegato. Usa &quot;Aggiorna dati Karoo&quot; per scaricare le attività.
                        </p>
                      ) : null}
                      {karooReturn === "error" ? (
                        <p className="text-sm text-amber-400/90">Collegamento Karoo non riuscito. Riprova.</p>
                      ) : null}
                      {karooReturn === "server_config" ? (
                        <p className="text-sm text-amber-400/90">
                          OAuth Karoo non configurato sul server:{" "}
                          <code className="text-white/80">KAROO_OAUTH2_CLIENT_ID</code>,{" "}
                          <code className="text-white/80">KAROO_OAUTH2_REDIRECT_URI</code>.
                        </p>
                      ) : null}
                      {karooLink?.linkStatusError ? (
                        <p className="text-sm text-amber-400/90">
                          Stato Karoo non disponibile: {karooLink.linkStatusError}
                          {karooLink.linkStatusHint ? (
                            <>
                              {" "}
                              <span className="text-white/75">({karooLink.linkStatusHint})</span>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                      {karooLink?.linked ? (
                        <p className="muted-copy text-sm">Account Karoo collegato.</p>
                      ) : (
                        <p className="muted-copy text-sm">
                          Nessun account Karoo collegato: autorizza l&apos;app Hammerhead Developer Platform per leggere le
                          attività del ciclocomputer.
                        </p>
                      )}
                      {karooLink?.linked && karooLink.oauthScope ? (
                        <p className="mt-2 break-all font-mono text-[11px] text-white/70">
                          <span className="text-white/50">OAuth scope:</span>{" "}
                          <code className="text-cyan-100/90">{karooLink.oauthScope}</code>
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/integrations/karoo/authorize?athleteId=${encodeURIComponent(activeAthleteId)}`}
                          target="_self"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-fit items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                        >
                          {karooLink?.linked ? "Ricollega Karoo" : "Collega Karoo"}
                        </a>
                        {karooLink?.linked ? (
                          <Pro2Button
                            type="button"
                            variant="secondary"
                            disabled={karooPullBusy}
                            className="border border-violet-500/35 bg-violet-500/10 text-violet-50 hover:bg-violet-500/20"
                            onClick={() => void runKarooPullNow()}
                          >
                            {karooPullBusy ? "Pull…" : "Aggiorna dati Karoo"}
                          </Pro2Button>
                        ) : null}
                      </div>
                      {karooPullNotice ? (
                        <p className="muted-copy mt-2 text-xs text-white/80">{karooPullNotice}</p>
                      ) : null}
                      <p className="muted-copy mt-2 text-xs">
                        Cron Vercel:{" "}
                        <code className="text-white/70">GET /api/integrations/karoo/pull/cron</code> (
                        <code className="text-white/70">CRON_SECRET</code>
                        {" "}o <code className="text-white/70">KAROO_PULL_RUN_SECRET</code>).
                      </p>
                    </div>

                    <div
                      className="mt-6 border-t border-white/10 pt-5"
                      style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <h4 className="profile-editor-subtitle" style={{ marginBottom: 8 }}>
                        <span className="profile-kpi-dot" />
                        Zepp <span className="text-white/50">· in arrivo</span>
                      </h4>
                      <p className="muted-copy text-sm">
                        Integrazione Zepp in preparazione: in attesa delle credenziali partner. Lo slot e gli env
                        (<code className="text-white/70">ZEPP_OAUTH2_*</code>) sono già predisposti; il collegamento sarà
                        attivato quando le API saranno verificate.
                      </p>
                    </div>

                    <div
                      className="mt-6 border-t border-white/10 pt-5"
                      style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <h4 className="profile-editor-subtitle" style={{ marginBottom: 8 }}>
                        <span className="profile-kpi-dot" />
                        Wahoo Cloud
                      </h4>
                      {wahooLink.linkStatusError ? (
                        <p className="text-sm text-amber-400/90">
                          Stato Wahoo non disponibile: {wahooLink.linkStatusError}
                          {wahooLink.linkStatusHint ? (
                            <>
                              {" "}
                              <span className="text-white/75">({wahooLink.linkStatusHint})</span>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                      {wahooLink.linked ? (
                        <p className="muted-copy text-sm">
                          Account Wahoo collegato (ID{" "}
                          <span className="text-white/80">{wahooLink.wahooUserIdMasked ?? "—"}</span>). Piani e
                          trasmissione workout usano le route sotto <code className="text-white/70">/api/integrations/wahoo/*</code>.
                        </p>
                      ) : (
                        <p className="muted-copy text-sm">
                          Nessun account Wahoo collegato. Scope consigliati: lettura/scrittura piani e workout (vedi env{" "}
                          <code className="text-white/70">WAHOO_OAUTH2_SCOPES</code>).
                        </p>
                      )}
                      {wahooLink.linked && wahooLink.oauthScope ? (
                        <p className="mt-2 break-all font-mono text-[11px] text-white/70">
                          <span className="text-white/50">OAuth scope:</span>{" "}
                          <code className="text-cyan-100/90">{wahooLink.oauthScope}</code>
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/integrations/wahoo/authorize?athleteId=${encodeURIComponent(activeAthleteId)}`}
                          target="_self"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-fit items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                        >
                          {wahooLink.linked ? "Ricollega Wahoo" : "Collega Wahoo"}
                        </a>
                        {wahooLink.linked ? (
                          <Pro2Button
                            type="button"
                            variant="secondary"
                            disabled={wahooPullBusy}
                            className="border border-sky-500/35 bg-sky-500/10 text-sky-50 hover:bg-sky-500/20"
                            onClick={() => void runWahooPullNow()}
                          >
                            {wahooPullBusy ? "Pull…" : "Aggiorna workout Wahoo"}
                          </Pro2Button>
                        ) : null}
                      </div>
                      {wahooPullNotice ? (
                        <p className="muted-copy mt-2 text-xs text-white/80">{wahooPullNotice}</p>
                      ) : null}
                      <p className="muted-copy mt-2 text-xs">
                        Cloud API:{" "}
                        <code className="text-white/70">GET/POST /api/integrations/wahoo/plans</code>,{" "}
                        <code className="text-white/70">GET/PUT/DELETE …/plans/[id]</code>,{" "}
                        <code className="text-white/70">GET …/plans/[id]/file?athleteId=…</code>,{" "}
                        <code className="text-white/70">GET/POST …/workouts</code>,{" "}
                        <code className="text-white/70">GET …/workouts/[id]/plans</code>. Riferimento:{" "}
                        <a
                          href="https://cloud-api.wahooligan.com/"
                          className="text-sky-300 underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          cloud-api.wahooligan.com
                        </a>
                        .
                      </p>
                    </div>

                    <div
                      className="mt-6 border-t border-white/10 pt-5"
                      style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <h4 className="profile-editor-subtitle" style={{ marginBottom: 8 }}>
                        <span className="profile-kpi-dot" />
                        Strava
                      </h4>
                      {stravaLink.linkStatusError ? (
                        <p className="text-sm text-amber-400/90">
                          Stato Strava non disponibile: {stravaLink.linkStatusError}
                          {stravaLink.linkStatusHint ? (
                            <>
                              {" "}
                              <span className="text-white/75">({stravaLink.linkStatusHint})</span>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                      {stravaLink.linked ? (
                        <p className="muted-copy text-sm">
                          Account Strava collegato (atleta id{" "}
                          <span className="text-white/80">{stravaLink.stravaAthleteIdMasked ?? "—"}</span>).
                        </p>
                      ) : (
                        <p className="muted-copy text-sm">
                          Nessun account Strava collegato. OAuth:{" "}
                          <code className="text-white/70">STRAVA_OAUTH2_CLIENT_ID</code>,{" "}
                          <code className="text-white/70">STRAVA_OAUTH2_CLIENT_SECRET</code>,{" "}
                          <code className="text-white/70">STRAVA_OAUTH2_REDIRECT_URI</code> (stesso URL registrato su{" "}
                          <a
                            href="https://www.strava.com/settings/api"
                            className="text-orange-300 underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            strava.com/settings/api
                          </a>
                          ); scope opzionale <code className="text-white/70">STRAVA_OAUTH2_SCOPES</code> (default{" "}
                          <code className="text-white/70">read,activity:read</code>).
                        </p>
                      )}
                      {stravaLink.linked && stravaLink.oauthScope ? (
                        <p className="mt-2 break-all font-mono text-[11px] text-white/70">
                          <span className="text-white/50">OAuth scope:</span>{" "}
                          <code className="text-cyan-100/90">{stravaLink.oauthScope}</code>
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/integrations/strava/authorize?athleteId=${encodeURIComponent(activeAthleteId)}`}
                          target="_self"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-fit items-center justify-center rounded-lg border border-orange-500/35 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-50 hover:bg-orange-500/20"
                        >
                          {stravaLink.linked ? "Ricollega Strava" : "Collega Strava"}
                        </a>
                        <ManualIntegrationPullButton
                          athleteId={activeAthleteId}
                          linked={Boolean(stravaLink.linked)}
                          endpoint="/api/integrations/strava/pull/run"
                          label="Aggiorna attività Strava"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {activeSection === "physical" && (
            <div>
              <h3 className={`profile-section-band tone-${profileToneForEditorSection("physical")}`}><span className="profile-kpi-dot" />Physical Measurements</h3>
              <div className="profile-editor-grid">
              <div className="form-group"><label className="form-label">Height (cm)</label><input className="form-input" type="number" value={form.height_cm} onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Weight (kg)</label><input className="form-input" type="number" step="0.1" value={form.weight_kg} onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Body Fat (%)</label><input className="form-input" type="number" step="0.1" value={form.body_fat_pct} onChange={(e) => setForm((f) => ({ ...f, body_fat_pct: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Muscle Mass (kg)</label><input className="form-input" type="number" step="0.1" value={form.muscle_mass_kg} onChange={(e) => setForm((f) => ({ ...f, muscle_mass_kg: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">FC Riposo</label><input className="form-input" type="number" value={form.resting_hr_bpm} onChange={(e) => setForm((f) => ({ ...f, resting_hr_bpm: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">FC Massima</label><input className="form-input" type="number" value={form.max_hr_bpm} onChange={(e) => setForm((f) => ({ ...f, max_hr_bpm: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">FC Soglia</label><input className="form-input" type="number" value={form.threshold_hr_bpm} onChange={(e) => setForm((f) => ({ ...f, threshold_hr_bpm: e.target.value }))} /></div>
              </div>
              <div className="profile-subpanel tone-cyan" style={{ marginTop: "12px" }}>
                <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />Body Scan</h4>
                <p className="muted-copy">
                  Modulo per scansione corpo via camera smartphone: stima volume, peso specifico, body composition,
                  rapporto massa magra/grassa, liquidi corporei e massa ossea stimata.
                </p>
              </div>
            </div>
          )}

          {activeSection === "routine" && (
            <div>
              <h3 className={`profile-section-band tone-${profileToneForEditorSection("routine")}`}><span className="profile-kpi-dot" />Routine - Weekly Planner</h3>
              <div className="profile-day-strip">
                {weekDays.map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={`profile-day-chip ${activeRoutineDay === day ? "active" : ""}`}
                    onClick={() => setActiveRoutineDay(day)}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <div className="profile-subpanel tone-green" style={{ marginBottom: "12px" }}>
                <div className="profile-editor-grid profile-editor-grid-compact">
                  <div className="form-group"><label className="form-label">Sveglia</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].wake_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { wake_time: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Colazione</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].breakfast_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { breakfast_time: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Spuntino</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].snack_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { snack_time: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Pranzo</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].lunch_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { lunch_time: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Merenda</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].afternoon_snack_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { afternoon_snack_time: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Cena</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].dinner_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { dinner_time: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Notte</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].night_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { night_time: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Tipo giorno</label><select className="form-select profile-dark-select" value={routineWeekPlan[activeRoutineDay].day_mode} onChange={(e) => updateRoutineDay(activeRoutineDay, { day_mode: e.target.value as RoutineDayConfig["day_mode"] })}><option value="training">Training</option><option value="recovery">Recovery</option><option value="race">Gara</option></select></div>
                </div>
              </div>
              <div className="profile-subpanel tone-green" style={{ marginBottom: "12px" }}>
                <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />Sessioni allenamento del giorno</h4>
                <div className="profile-editor-grid profile-editor-grid-compact">
                  <div className="form-group"><label className="form-label">Training previsto</label><select className="form-select profile-dark-select" value={String(routineWeekPlan[activeRoutineDay].has_training)} onChange={(e) => updateRoutineDay(activeRoutineDay, { has_training: e.target.value === "true" })}><option value="true">Si</option><option value="false">No</option></select></div>
                  <div className="form-group"><label className="form-label">Training 1 inizio</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].training1_start_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { training1_start_time: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Training 1 durata (min)</label><input className="form-input" type="number" min={0} value={routineWeekPlan[activeRoutineDay].training1_duration_minutes} onChange={(e) => updateRoutineDay(activeRoutineDay, { training1_duration_minutes: Number(e.target.value || 0) })} /></div>
                  <div className="form-group"><label className="form-label">Training 2 previsto</label><select className="form-select profile-dark-select" value={String(routineWeekPlan[activeRoutineDay].has_training2)} onChange={(e) => updateRoutineDay(activeRoutineDay, { has_training2: e.target.value === "true" })}><option value="false">No</option><option value="true">Si</option></select></div>
                  <div className="form-group"><label className="form-label">Training 2 inizio</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].training2_start_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { training2_start_time: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Training 2 durata (min)</label><input className="form-input" type="number" min={0} value={routineWeekPlan[activeRoutineDay].training2_duration_minutes} onChange={(e) => updateRoutineDay(activeRoutineDay, { training2_duration_minutes: Number(e.target.value || 0) })} /></div>
                  <div className="form-group"><label className="form-label">Mobility/Stretching %</label><input className="form-input" type="number" min={0} max={100} value={routineWeekPlan[activeRoutineDay].mobility_stretching_pct} onChange={(e) => updateRoutineDay(activeRoutineDay, { mobility_stretching_pct: Number(e.target.value || 0) })} /></div>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Routine notes</label><textarea className="form-textarea" value={form.routine_summary} onChange={(e) => setForm((f) => ({ ...f, routine_summary: e.target.value }))} /></div>
            </div>
          )}

          {activeSection === "nutrition" && (
            <div>
              <h3 className={`profile-section-band tone-${profileToneForEditorSection("nutrition")}`}><span className="profile-kpi-dot" />Nutrition Systems</h3>
              <div className="page-tabs theme-multi profile-editor-subtabs" style={{ marginBottom: "12px" }}>
                <button type="button" className={`page-tab ${activeNutritionTab === "diet" ? "page-tab-active" : ""}`} onClick={() => setActiveNutritionTab("diet")}>Diet</button>
                <button type="button" className={`page-tab ${activeNutritionTab === "intolerances" ? "page-tab-active" : ""}`} onClick={() => setActiveNutritionTab("intolerances")}>Intolerances</button>
                <button type="button" className={`page-tab ${activeNutritionTab === "supplements" ? "page-tab-active" : ""}`} onClick={() => setActiveNutritionTab("supplements")}>Integratori</button>
              </div>

              {activeNutritionTab === "diet" && (
                <div>
                  <div className="form-group"><label className="form-label">Tipo alimentazione</label><select className="form-select profile-dark-select" value={form.diet_type} onChange={(e) => setForm((f) => ({ ...f, diet_type: e.target.value }))}>{dietOptions.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Cucine preferite</label></div>
                  <div className="profile-chip-grid">
                    {["mediterranea", "asiatica", "thai", "messicana", "nordic"].map((c) => {
                      const selected = form.cuisines.split(",").map((s) => s.trim()).filter(Boolean).includes(c);
                      return (
                        <button key={c} type="button" className={`profile-black-chip ${selected ? "active" : ""}`} onClick={() => setForm((f) => ({ ...f, cuisines: toggleCsvToken(f.cuisines, c) }))}>
                          {c}
                        </button>
                      );
                    })}
                  </div>

                  <div className="profile-day-strip" style={{ marginTop: "12px" }}>
                    {weekDays.map((day) => (
                      <button key={day} type="button" className={`profile-day-chip ${activeDietDay === day ? "active" : ""}`} onClick={() => setActiveDietDay(day)}>{day}</button>
                    ))}
                  </div>

                  <div className="profile-subpanel tone-amber" style={{ marginBottom: "12px" }}>
                    <div className="profile-editor-grid">
                      <div className="form-group"><label className="form-label">Numero pasti / fasting</label><select className="form-select profile-dark-select" value={dietWeekPlan[activeDietDay].meal_count_mode} onChange={(e) => {
                        const meal_count_mode = e.target.value as DietDayConfig["meal_count_mode"];
                        if (meal_count_mode === "6") {
                          const c = dietWeekPlan[activeDietDay].caloric_distribution;
                          const r = resolveSixMealSnackPercentages(c);
                          updateDietDay(activeDietDay, {
                            meal_count_mode,
                            caloric_distribution: {
                              ...c,
                              snack_am: r.snack_am,
                              snack_pm: r.snack_pm,
                              snack_evening: r.snack_evening,
                              snacks: r.snacksTotal,
                            },
                          });
                        } else {
                          updateDietDay(activeDietDay, { meal_count_mode });
                        }
                      }}><option value="1">1 pasto</option><option value="2">2 pasti</option><option value="3">3 pasti</option><option value="4">4 pasti</option><option value="5">5 pasti</option><option value="6">6 pasti</option><option value="fasting">Digiuno</option><option value="semi-8-16">Semi digiuno 8-16</option><option value="semi-6-18">Semi digiuno 6-18</option><option value="semi-4-20">Semi digiuno 4-20</option></select></div>
                      <div className="form-group"><label className="form-label">Tipologia giorno</label><select className="form-select profile-dark-select" value={dietWeekPlan[activeDietDay].day_type} onChange={(e) => updateDietDay(activeDietDay, { day_type: e.target.value as DietDayConfig["day_type"] })}><option value="fasting-0">Digiuno 0% cal</option><option value="severe-15-30">Restrizione severa 15-30%</option><option value="catabolic-50-99">Catabolico 50-99%</option><option value="normocaloric-100">Normocalorica 100%</option><option value="anabolic-101-130">Ipercalorica / anabolico 101-130%</option></select></div>
                      <div className="form-group"><label className="form-label">% calorie rispetto fabbisogno</label><input className="form-input" type="number" min={0} max={130} value={dietWeekPlan[activeDietDay].day_type_pct} onChange={(e) => updateDietDay(activeDietDay, { day_type_pct: Number(e.target.value || 0) })} /></div>
                    </div>
                  </div>

                  <div className="profile-subpanel tone-amber" style={{ marginBottom: "12px" }}>
                    <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />Distribuzione calorica pasti (%)</h4>
                    <div className="profile-editor-grid profile-editor-grid-compact">
                      <div className="form-group"><label className="form-label">Colazione</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].caloric_distribution.breakfast} onChange={(e) => updateDietDay(activeDietDay, { caloric_distribution: { ...dietWeekPlan[activeDietDay].caloric_distribution, breakfast: Number(e.target.value || 0) } })} /></div>
                      <div className="form-group"><label className="form-label">Pranzo</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].caloric_distribution.lunch} onChange={(e) => updateDietDay(activeDietDay, { caloric_distribution: { ...dietWeekPlan[activeDietDay].caloric_distribution, lunch: Number(e.target.value || 0) } })} /></div>
                      <div className="form-group"><label className="form-label">Cena</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].caloric_distribution.dinner} onChange={(e) => updateDietDay(activeDietDay, { caloric_distribution: { ...dietWeekPlan[activeDietDay].caloric_distribution, dinner: Number(e.target.value || 0) } })} /></div>
                      {dietWeekPlan[activeDietDay].meal_count_mode === "6" ? (
                        <>
                          <div className="form-group"><label className="form-label">Spuntino · mattina</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].caloric_distribution.snack_am ?? 10} onChange={(e) => {
                            const snack_am = Number(e.target.value || 0);
                            const snack_pm = dietWeekPlan[activeDietDay].caloric_distribution.snack_pm ?? 10;
                            const snack_evening = dietWeekPlan[activeDietDay].caloric_distribution.snack_evening ?? 10;
                            updateDietDay(activeDietDay, { caloric_distribution: { ...dietWeekPlan[activeDietDay].caloric_distribution, snack_am, snack_pm, snack_evening, snacks: snack_am + snack_pm + snack_evening } });
                          }} /></div>
                          <div className="form-group"><label className="form-label">Spuntino · pomeriggio</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].caloric_distribution.snack_pm ?? 10} onChange={(e) => {
                            const snack_pm = Number(e.target.value || 0);
                            const snack_am = dietWeekPlan[activeDietDay].caloric_distribution.snack_am ?? 10;
                            const snack_evening = dietWeekPlan[activeDietDay].caloric_distribution.snack_evening ?? 10;
                            updateDietDay(activeDietDay, { caloric_distribution: { ...dietWeekPlan[activeDietDay].caloric_distribution, snack_am, snack_pm, snack_evening, snacks: snack_am + snack_pm + snack_evening } });
                          }} /></div>
                          <div className="form-group"><label className="form-label">Spuntino · serale</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].caloric_distribution.snack_evening ?? 10} onChange={(e) => {
                            const snack_evening = Number(e.target.value || 0);
                            const snack_am = dietWeekPlan[activeDietDay].caloric_distribution.snack_am ?? 10;
                            const snack_pm = dietWeekPlan[activeDietDay].caloric_distribution.snack_pm ?? 10;
                            updateDietDay(activeDietDay, { caloric_distribution: { ...dietWeekPlan[activeDietDay].caloric_distribution, snack_am, snack_pm, snack_evening, snacks: snack_am + snack_pm + snack_evening } });
                          }} /></div>
                          <p className="col-span-full text-[11px] text-slate-400">6 pasti: tre spuntini separati (es. 10+10+10 = 30% totale spuntini). Σ giorno: {Math.round(dietWeekPlan[activeDietDay].caloric_distribution.breakfast + dietWeekPlan[activeDietDay].caloric_distribution.lunch + dietWeekPlan[activeDietDay].caloric_distribution.dinner + dietWeekPlan[activeDietDay].caloric_distribution.snacks)}%</p>
                        </>
                      ) : (
                        <div className="form-group"><label className="form-label">Spuntini</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].caloric_distribution.snacks} onChange={(e) => updateDietDay(activeDietDay, { caloric_distribution: { ...dietWeekPlan[activeDietDay].caloric_distribution, snacks: Number(e.target.value || 0) } })} /></div>
                      )}
                    </div>
                  </div>

                  <div className="profile-subpanel tone-amber" style={{ marginBottom: "12px" }}>
                    <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />Macro nutrienti giornalieri (%)</h4>
                    <div className="profile-editor-grid profile-editor-grid-compact">
                      <div className="form-group"><label className="form-label">CHO</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].daily_macros.cho_pct} onChange={(e) => updateDietDay(activeDietDay, { daily_macros: { ...dietWeekPlan[activeDietDay].daily_macros, cho_pct: Number(e.target.value || 0) } })} /></div>
                      <div className="form-group"><label className="form-label">PRO</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].daily_macros.pro_pct} onChange={(e) => updateDietDay(activeDietDay, { daily_macros: { ...dietWeekPlan[activeDietDay].daily_macros, pro_pct: Number(e.target.value || 0) } })} /></div>
                      <div className="form-group"><label className="form-label">FAT</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].daily_macros.fat_pct} onChange={(e) => updateDietDay(activeDietDay, { daily_macros: { ...dietWeekPlan[activeDietDay].daily_macros, fat_pct: Number(e.target.value || 0) } })} /></div>
                    </div>
                  </div>

                  <div className="profile-subpanel tone-amber" style={{ marginBottom: "12px" }}>
                    <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />Custom macro singolo pasto (%)</h4>
                    <div className="profile-meal-macro-grid">
                      {(["breakfast", "lunch", "dinner", "snacks"] as const).map((meal) => (
                        <div key={meal} className="profile-meal-macro-card">
                          <strong>{meal}</strong>
                          <div className="form-group"><label className="form-label">CHO</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].meal_macro_custom[meal].cho_pct} onChange={(e) => updateDietDay(activeDietDay, { meal_macro_custom: { ...dietWeekPlan[activeDietDay].meal_macro_custom, [meal]: { ...dietWeekPlan[activeDietDay].meal_macro_custom[meal], cho_pct: Number(e.target.value || 0) } } })} /></div>
                          <div className="form-group"><label className="form-label">PRO</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].meal_macro_custom[meal].pro_pct} onChange={(e) => updateDietDay(activeDietDay, { meal_macro_custom: { ...dietWeekPlan[activeDietDay].meal_macro_custom, [meal]: { ...dietWeekPlan[activeDietDay].meal_macro_custom[meal], pro_pct: Number(e.target.value || 0) } } })} /></div>
                          <div className="form-group"><label className="form-label">FAT</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].meal_macro_custom[meal].fat_pct} onChange={(e) => updateDietDay(activeDietDay, { meal_macro_custom: { ...dietWeekPlan[activeDietDay].meal_macro_custom, [meal]: { ...dietWeekPlan[activeDietDay].meal_macro_custom[meal], fat_pct: Number(e.target.value || 0) } } })} /></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-group"><label className="form-label">Preferenze alimentari (csv)</label><input className="form-input" type="text" value={form.food_preferences} onChange={(e) => setForm((f) => ({ ...f, food_preferences: e.target.value }))} /></div>
                </div>
              )}

              {activeNutritionTab === "intolerances" && (
                <div>
                  <div className="form-group"><label className="form-label">Intolleranze (csv)</label><input className="form-input" type="text" value={form.intolerances} onChange={(e) => setForm((f) => ({ ...f, intolerances: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">Allergie (csv)</label><input className="form-input" type="text" value={form.allergies} onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">Alimenti esclusi (csv)</label><input className="form-input" type="text" value={form.food_exclusions} onChange={(e) => setForm((f) => ({ ...f, food_exclusions: e.target.value }))} /></div>
                  <div className="alert-warning">Informazioni critiche per suggerimenti alimentari sicuri.</div>
                </div>
              )}

              {activeNutritionTab === "supplements" && (
                <div>
                  <div className="page-tabs theme-multi profile-editor-subtabs" style={{ marginBottom: "10px" }}>
                    {SUPPLEMENT_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`page-tab ${normalizeSupplementCategoryId(activeSupplementCategory) === cat.id ? "page-tab-active" : ""}`}
                        onClick={() => setActiveSupplementCategory(cat.id)}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", marginBottom: "12px" }}>
                    {(findSupplementCategory(activeSupplementCategory)?.items ?? []).map((item) => {
                      const categoryId = normalizeSupplementCategoryId(activeSupplementCategory);
                      const token = `${categoryId}:${item}`;
                      const selected = form.supplements.split(",").map((s) => s.trim()).filter(Boolean).includes(token);
                      return (
                        <button key={item} type="button" className={`profile-black-chip ${selected ? "active" : ""}`} onClick={() => setForm((f) => ({ ...f, supplements: toggleCsvToken(f.supplements, token) }))}>
                          {item}
                        </button>
                      );
                    })}
                  </div>
                  <h4 className="section-title" style={{ fontSize: "14px" }}>Brand preferiti (40)</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", marginBottom: "12px" }}>
                    {SUPPLEMENT_BRANDS.map((brand) => {
                      const selected = form.supplement_brands.split(",").map((s) => s.trim()).filter(Boolean).includes(brand);
                      return (
                        <button key={brand} type="button" className={`profile-black-chip ${selected ? "active" : ""}`} onClick={() => setForm((f) => ({ ...f, supplement_brands: toggleCsvToken(f.supplement_brands, brand) }))}>
                          {brand}
                        </button>
                      );
                    })}
                  </div>
                  <div className="form-group"><label className="form-label">Integratori selezionati (csv)</label><textarea className="form-textarea" value={form.supplements} onChange={(e) => setForm((f) => ({ ...f, supplements: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">Brand selezionati (csv)</label><textarea className="form-textarea" value={form.supplement_brands} onChange={(e) => setForm((f) => ({ ...f, supplement_brands: e.target.value }))} /></div>
                </div>
              )}
            </div>
          )}

          <Pro2Button type="submit" disabled={saving} variant="primary" className="mt-4">
            {saving ? "Salvataggio…" : editingProfileId ? "Aggiorna profilo" : "Salva profilo"}
          </Pro2Button>
        </form>
        </Pro2SectionCard>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Caricamento dati profilo…</p>
      ) : !activeAthleteId ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-gray-400">
          {role === "coach" ? "Nessun atleta attivo. Selezionalo in Athletes." : "Profilo atleta non disponibile per questo account."}
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-100/90">
          {error === "Athlete access denied" ? (
            <span>
              L&apos;atleta attivo non è associato correttamente all&apos;utente corrente. Riesegui il login da <code className="text-amber-200/80">/access</code> per riallineare il profilo, oppure se sei coach seleziona un assistito valido in <code className="text-amber-200/80">/athletes</code>.
            </span>
          ) : (
            <span>
              Nessun profilo disponibile per l&apos;atleta attivo. Se il problema persiste, verifica il collegamento tra <code className="text-amber-200/80">app_user_profiles</code> e <code className="text-amber-200/80">athlete_profiles</code> in Supabase.
            </span>
          )}
        </div>
      ) : null}
      </div>
    </Pro2ModulePageShell>
  );
}

