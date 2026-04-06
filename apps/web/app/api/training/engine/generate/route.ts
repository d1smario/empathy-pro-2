import { NextRequest, NextResponse } from "next/server";
import { physiologicalProfileFromDbRow, type PhysiologicalProfileDbRow } from "@empathy/domain-physiology";
import { canAccessAthleteData } from "@/lib/athlete/can-access-athlete-data";
import {
  coerceTechnicalModuleFocus,
  generateTrainingSession,
  inferDomainFromSport,
  TRAINING_EXERCISE_LIBRARY,
  type AdaptationTarget,
  type AthleteMetabolicState,
  type GymContractionEmphasis,
  type GymEquipmentChannel,
  type GymGenerationProfile,
  type SessionGoalRequest,
  type TrainingDomain,
} from "@/lib/training/engine";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Materializzazione sessione canonica (builder engine deterministico).
 * Vyria / piano annuale devono richiamare questo stesso percorso per ogni blocco da materializzare — nessun secondo motore sessione.
 *
 * Fase Pro 2: core `generateTrainingSession` + lettura `physiological_profiles` / `twin_states`.
 * Scaling operativo recovery/bioenergetica (V1) si aggiunge in incremento senza duplicare la selezione esercizi.
 */
function coerceAdaptationTarget(v: string): AdaptationTarget | null {
  const allowed: AdaptationTarget[] = [
    "mitochondrial_density",
    "vo2_max_support",
    "lactate_tolerance",
    "lactate_clearance",
    "max_strength",
    "power_output",
    "hypertrophy_mixed",
    "hypertrophy_myofibrillar",
    "hypertrophy_sarcoplasmic",
    "neuromuscular_adaptation",
    "movement_quality",
    "mobility_capacity",
    "skill_transfer",
    "recovery",
  ];
  return allowed.includes(v as AdaptationTarget) ? (v as AdaptationTarget) : null;
}

const GYM_EQUIPMENT_CHANNELS: GymEquipmentChannel[] = [
  "free_weight",
  "bodyweight",
  "cable",
  "elastic",
  "machine",
];

const GYM_CONTRACTIONS: GymContractionEmphasis[] = ["standard", "eccentric", "isometric", "plyometric"];

function coerceGymProfile(raw: unknown): GymGenerationProfile | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  let equipmentChannels: GymEquipmentChannel[] | undefined;
  const eqRaw = o.equipmentChannels;
  if (Array.isArray(eqRaw)) {
    equipmentChannels = eqRaw
      .map((x) => String(x).trim() as GymEquipmentChannel)
      .filter((x): x is GymEquipmentChannel => GYM_EQUIPMENT_CHANNELS.includes(x));
    if (equipmentChannels.length === 0) equipmentChannels = undefined;
  }
  let contraction: GymContractionEmphasis | undefined;
  const cRaw = o.contraction;
  if (typeof cRaw === "string" && GYM_CONTRACTIONS.includes(cRaw as GymContractionEmphasis)) {
    contraction = cRaw as GymContractionEmphasis;
    if (contraction === "standard") contraction = undefined;
  }
  if (!equipmentChannels && !contraction) return undefined;
  return { equipmentChannels, contraction };
}

function coerceDomain(v: string | null | undefined): TrainingDomain | null {
  const allowed: TrainingDomain[] = [
    "endurance",
    "gym",
    "crossfit",
    "hyrox",
    "team_sport",
    "combat",
    "mind_body",
  ];
  if (!v) return null;
  return allowed.includes(v as TrainingDomain) ? (v as TrainingDomain) : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const client = createSupabaseCookieClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503, headers: NO_STORE });
  }

  const {
    data: { user },
    error: authErr,
  } = await client.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const body = (await req.json()) as {
    athleteId?: string;
    applyOperationalScaling?: boolean;
    request?: Partial<SessionGoalRequest>;
  };
  const athleteId = String(body.athleteId ?? "").trim();
  if (!athleteId) {
    return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
  }

  const allowed = await canAccessAthleteData(client, user.id, athleteId, null);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }

  const requestRaw = body.request ?? {};
  const adaptationTarget = coerceAdaptationTarget(String(requestRaw.adaptationTarget ?? "").trim());
  if (!adaptationTarget) {
    return NextResponse.json({ error: "Invalid adaptationTarget" }, { status: 400, headers: NO_STORE });
  }

  const phase = (String(requestRaw.phase ?? "base").trim() || "base") as SessionGoalRequest["phase"];
  const sport = String(requestRaw.sport ?? "").trim() || "cycling";
  const goalLabel = String(requestRaw.goalLabel ?? "").trim() || adaptationTarget;
  const sessionMinutes = Math.max(20, Math.min(180, Math.round(Number(requestRaw.sessionMinutes ?? 60) || 60)));
  const tssTargetHintRaw = Number(requestRaw.tssTargetHint ?? 0);
  const tssTargetHint =
    Number.isFinite(tssTargetHintRaw) && tssTargetHintRaw > 0 ? Math.round(tssTargetHintRaw) : undefined;
  const intensityHint = String(requestRaw.intensityHint ?? "").trim() || undefined;
  const objectiveDetail = String(requestRaw.objectiveDetail ?? "").trim() || undefined;
  const gymProfile = coerceGymProfile(requestRaw.gymProfile);
  const domainCoerced = coerceDomain(requestRaw.domain ?? null);
  const technicalModuleFocus = coerceTechnicalModuleFocus(requestRaw.technicalModuleFocus);

  const { data: profileRow, error: profErr } = await client
    .from("physiological_profiles")
    .select(
      "id, athlete_id, ftp_watts, cp_watts, lt1_watts, lt1_heart_rate, lt2_watts, lt2_heart_rate, v_lamax, vo2max_ml_min_kg, economy, baseline_hrv_ms, valid_from, valid_to, updated_at",
    )
    .eq("athlete_id", athleteId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500, headers: NO_STORE });
  }

  const phys = profileRow ? physiologicalProfileFromDbRow(profileRow as PhysiologicalProfileDbRow) : null;

  const { data: twinRow } = await client
    .from("twin_states")
    .select("readiness, fatigue_acute")
    .eq("athlete_id", athleteId)
    .order("as_of", { ascending: false })
    .limit(1)
    .maybeSingle();

  const readinessDb = twinRow ? num((twinRow as { readiness?: unknown }).readiness) : null;
  const fatigueDb = twinRow ? num((twinRow as { fatigue_acute?: unknown }).fatigue_acute) : null;

  const athleteState: AthleteMetabolicState = {
    ftpW: phys?.ftpWatts ?? null,
    vo2maxMlKgMin: phys?.vo2maxMlMinKg ?? null,
    vLamax: phys?.vLamax ?? null,
    lactateThresholdPowerW: phys?.lt2Watts ?? null,
    readinessScore: Math.max(0, Math.min(100, Math.round(readinessDb ?? 68))),
    fatigueScore: Math.max(0, Math.min(100, Math.round(fatigueDb ?? 35))),
  };

  const requestNormalized: SessionGoalRequest = {
    sport,
    domain: domainCoerced ?? inferDomainFromSport(sport),
    goalLabel,
    adaptationTarget,
    sessionMinutes,
    phase: ["base", "build", "peak", "taper"].includes(phase) ? phase : "base",
    tssTargetHint,
    intensityHint,
    objectiveDetail,
    gymProfile,
    ...(technicalModuleFocus ? { technicalModuleFocus } : {}),
  };

  const generated = generateTrainingSession(requestNormalized, athleteState);
  const blockExercises = generated.blocks.map((block) => ({
    order: block.order,
    label: block.label,
    exercises: block.exerciseIds
      .map((id) => TRAINING_EXERCISE_LIBRARY.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => item != null),
  }));

  return NextResponse.json(
    {
      ok: true as const,
      athleteId,
      athleteState,
      session: generated,
      blockExercises,
      source: "pro2_builder_engine_deterministic",
      physiologyPresent: Boolean(phys),
      twinPresent: Boolean(twinRow),
      /** Vyria / planner annuale: usare questo endpoint (o wrapper server) per materializzare ogni sessione. */
      materializationPolicy: "single_session_via_builder_engine_only",
    },
    { headers: NO_STORE },
  );
}
