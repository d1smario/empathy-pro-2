import type {
  AthleteEvidenceMemoryItem,
  AthleteProfile,
  AthleteMemory,
  ConnectedDevice,
} from "@/lib/empathy/schemas";
import type { NutritionConstraints } from "@/lib/empathy/schemas";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  deriveCandidateKnowledgeBindings,
  mergeKnowledgeBindings,
} from "@/lib/knowledge/knowledge-binding-candidates";
import {
  deriveKnowledgeModulationSnapshots,
  mergeKnowledgeModulations,
} from "@/lib/knowledge/knowledge-modulation-resolver";
import { resolveAthleteKnowledgeMemory } from "@/lib/knowledge/knowledge-memory-resolver";
import {
  mapDeviceSyncExportToIngestionRecord,
  mapTrainingImportJobToIngestionRecord,
  mergeRealityIngestionRecords,
} from "@/lib/reality/ingestion-record-mapper";
import { resolveCanonicalPhysiologyState } from "@/lib/physiology/profile-resolver";
import { resolveCanonicalTwinState } from "@/lib/twin/athlete-state-resolver";
import { coachOrgIdForDb } from "@/lib/coach-org-id";
import { createEmptyAthleteMemory } from "@/lib/memory/athlete-memory-store";
import { applyAthleteMemoryPatch } from "@/lib/memory/athlete-memory-writer";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
}

function coerceConnectedDeviceProvider(value: unknown): ConnectedDevice["provider"] {
  const provider = String(value ?? "").trim().toLowerCase();
  if (
    provider === "garmin" ||
    provider === "garmin_connectiq" ||
    provider === "trainingpeaks" ||
    provider === "strava" ||
    provider === "polar" ||
    provider === "wahoo" ||
    provider === "coros" ||
    provider === "suunto" ||
    provider === "apple_watch" ||
    provider === "zwift" ||
    provider === "hammerhead" ||
    provider === "oura" ||
    provider === "whoop" ||
    provider === "cgm"
  ) {
    return provider;
  }
  return "other";
}

function toConnectedDevices(rows: Array<Record<string, unknown>>): ConnectedDevice[] {
  return rows.map((row) => ({
    provider: coerceConnectedDeviceProvider(row.provider),
    externalId: typeof row.external_id === "string" ? row.external_id : undefined,
    lastSyncAt: typeof row.last_sync_at === "string" ? row.last_sync_at : undefined,
    enabled: row.enabled !== false,
  }));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toAthleteProfile(row: Record<string, unknown>, athleteId: string): AthleteProfile {
  const routineConfig = asRecord(row.routine_config);
  return {
    id: athleteId,
    firstName: typeof row.first_name === "string" ? row.first_name : undefined,
    lastName: typeof row.last_name === "string" ? row.last_name : undefined,
    email: typeof row.email === "string" ? row.email : undefined,
    birthDate: typeof row.birth_date === "string" ? row.birth_date : undefined,
    sex: typeof row.sex === "string" ? (row.sex as AthleteProfile["sex"]) : undefined,
    timezone: typeof row.timezone === "string" ? row.timezone : undefined,
    activityLevel: typeof row.activity_level === "string" ? (row.activity_level as AthleteProfile["activityLevel"]) : undefined,
    heightCm: typeof row.height_cm === "number" ? row.height_cm : undefined,
    weightKg: typeof row.weight_kg === "number" ? row.weight_kg : undefined,
    bodyFatPct: typeof row.body_fat_pct === "number" ? row.body_fat_pct : undefined,
    muscleMassKg: typeof row.muscle_mass_kg === "number" ? row.muscle_mass_kg : undefined,
    restingHrBpm: typeof row.resting_hr_bpm === "number" ? row.resting_hr_bpm : undefined,
    maxHrBpm: typeof row.max_hr_bpm === "number" ? row.max_hr_bpm : undefined,
    thresholdHrBpm: typeof row.threshold_hr_bpm === "number" ? row.threshold_hr_bpm : undefined,
    dietType: typeof row.diet_type === "string" ? (row.diet_type as AthleteProfile["dietType"]) : undefined,
    intolerances: asStringArray(row.intolerances),
    allergies: asStringArray(row.allergies),
    foodPreferences: asStringArray(row.food_preferences),
    foodExclusions: asStringArray(row.food_exclusions),
    supplements: asStringArray(row.supplements),
    preferredMealCount: typeof row.preferred_meal_count === "number" ? row.preferred_meal_count : undefined,
    lifestyleActivityClass:
      typeof routineConfig?.lifestyle_activity_class === "string"
        ? (routineConfig.lifestyle_activity_class as AthleteProfile["lifestyleActivityClass"])
        : undefined,
    routineSummary: typeof row.routine_summary === "string" ? row.routine_summary : undefined,
    routineConfig: routineConfig ?? undefined,
    nutritionConfig: row.nutrition_config && typeof row.nutrition_config === "object" ? (row.nutrition_config as Record<string, unknown>) : undefined,
    supplementConfig: row.supplement_config && typeof row.supplement_config === "object" ? (row.supplement_config as Record<string, unknown>) : undefined,
    trainingAvailability: {
      daysPerWeek: typeof row.training_days_per_week === "number" ? row.training_days_per_week : undefined,
      maxSessionMinutes: typeof row.training_max_session_minutes === "number" ? row.training_max_session_minutes : undefined,
    },
    connectedDevices: [],
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function toNutritionConstraints(athleteId: string, row: Record<string, unknown>): NutritionConstraints {
  return {
    athleteId,
    dietType: typeof row.diet_type === "string" ? row.diet_type : undefined,
    intolerances: asStringArray(row.intolerances),
    allergies: asStringArray(row.allergies),
    excludedFoods: asStringArray(row.food_exclusions),
    excludedSupplements: [],
    preferredFoods: asStringArray(row.food_preferences),
    preferredMealCount: typeof row.preferred_meal_count === "number" ? row.preferred_meal_count : undefined,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function partitionPanelsByType(rows: Array<Record<string, unknown>>) {
  const blood = rows.find((row) => String(row.type ?? "").toLowerCase() === "blood") ?? null;
  const microbiota = rows.find((row) => String(row.type ?? "").toLowerCase() === "microbiota") ?? null;
  const epigenetics =
    rows.find((row) => {
      const type = String(row.type ?? "").toLowerCase();
      return type === "genomics" || type === "epigenetics";
    }) ?? null;

  return {
    blood: blood?.values && typeof blood.values === "object" ? (blood.values as Record<string, unknown>) : null,
    microbiota: microbiota?.values && typeof microbiota.values === "object" ? (microbiota.values as Record<string, unknown>) : null,
    epigenetics: epigenetics?.values && typeof epigenetics.values === "object" ? (epigenetics.values as Record<string, unknown>) : null,
  };
}

function addDaysUtcIso(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function toEvidenceItems(rows: Array<Record<string, unknown>>): AthleteEvidenceMemoryItem[] {
  return rows.map((row) => {
    const payload = asRecord(row.payload);
    return {
      id: typeof row.id === "string" ? row.id : undefined,
      source: typeof row.source === "string" ? row.source : undefined,
      query: typeof row.query === "string" ? row.query : undefined,
      title: typeof row.title === "string" ? row.title : undefined,
      summary: typeof row.summary === "string" ? row.summary : undefined,
      url: typeof row.url === "string" ? row.url : undefined,
      relevanceScore: typeof row.relevance_score === "number" ? row.relevance_score : undefined,
      module: asString(payload?.module),
      domain: asString(payload?.domain),
      adaptationTarget: asString(payload?.adaptationTarget),
      sessionDate: asString(payload?.sessionDate),
      plannedWorkoutId: asString(payload?.plannedWorkoutId),
      mechanismTags: asStringArray(payload?.mechanismTags),
      nutritionTags: asStringArray(payload?.nutritionTags),
      recoveryTags: asStringArray(payload?.recoveryTags),
      evidenceClass: asString(payload?.evidenceClass),
      confidence: asFiniteNumber(payload?.confidence),
      payload: payload ?? null,
      createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    };
  });
}

export async function resolveAthleteMemory(athleteId: string): Promise<AthleteMemory> {
  const supabase = createServerSupabaseClient();
  const diaryWindowEnd = new Date().toISOString().slice(0, 10);
  const diaryWindowStart = addDaysUtcIso(diaryWindowEnd, -44);
  const [profileRes, appUserRes, coachLinksRes, devicesRes, importJobsRes, deviceExportsRes, panelsRes, evidenceRes, physiology, knowledge, diaryRes] = await Promise.all([
    supabase.from("athlete_profiles").select("*").eq("id", athleteId).maybeSingle(),
    supabase.from("app_user_profiles").select("user_id, role").eq("athlete_id", athleteId).limit(1).maybeSingle(),
    supabase
      .from("coach_athletes")
      .select("coach_user_id")
      .eq("athlete_id", athleteId)
      .eq("org_id", coachOrgIdForDb()),
    supabase
      .from("connected_devices")
      .select("provider, external_id, last_sync_at, enabled, created_at")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false }),
    supabase
      .from("training_import_jobs")
      .select(
        "id, mode, source_format, source_vendor, parser_engine, parser_version, status, file_name, imported_workout_id, imported_planned_count, imported_date, quality_status, quality_note, channel_coverage, error_message, payload, created_at, updated_at",
      )
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("device_sync_exports")
      .select("id, athlete_id, provider, payload, status, external_ref, created_at, updated_at")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("biomarker_panels")
      .select("id, athlete_id, type, sample_date, values, flags, source, created_at")
      .eq("athlete_id", athleteId)
      .order("sample_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("knowledge_evidence_hits")
      .select("id, athlete_id, source, query, external_id, title, summary, url, relevance_score, payload, created_at")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(80),
    resolveCanonicalPhysiologyState(athleteId),
    resolveAthleteKnowledgeMemory(athleteId),
    supabase
      .from("food_diary_entries")
      .select(
        "id, athlete_id, entry_date, entry_time, meal_slot, food_label, quantity_g, kcal, carbs_g, protein_g, fat_g, sodium_mg, provenance, reference_source_tag, notes, supplements, created_at",
      )
      .eq("athlete_id", athleteId)
      .gte("entry_date", diaryWindowStart)
      .lte("entry_date", diaryWindowEnd)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (profileRes.error) throw new Error(profileRes.error.message);
  if (appUserRes.error) throw new Error(appUserRes.error.message);
  if (coachLinksRes.error) throw new Error(coachLinksRes.error.message);
  if (devicesRes.error) throw new Error(devicesRes.error.message);
  if (importJobsRes.error) throw new Error(importJobsRes.error.message);
  if (deviceExportsRes.error) throw new Error(deviceExportsRes.error.message);
  if (panelsRes.error) throw new Error(panelsRes.error.message);
  if (evidenceRes.error) throw new Error(evidenceRes.error.message);

  let diaryRows: Array<Record<string, unknown>> = [];
  if (diaryRes.error) {
    const msg = diaryRes.error.message ?? "";
    const code = String((diaryRes.error as { code?: string }).code ?? "");
    if (code !== "42P01" && !msg.includes("does not exist")) {
      throw new Error(diaryRes.error.message);
    }
  } else {
    diaryRows = (diaryRes.data ?? []) as Array<Record<string, unknown>>;
  }

  const now = new Date().toISOString();
  let memory = createEmptyAthleteMemory(athleteId);
  const profileRow = (profileRes.data ?? null) as Record<string, unknown> | null;
  const deviceRows = ((devicesRes.data ?? []) as Array<Record<string, unknown>>) ?? [];
  const importJobRows = ((importJobsRes.data ?? []) as Array<Record<string, unknown>>) ?? [];
  const deviceExportRows = ((deviceExportsRes.data ?? []) as Array<Record<string, unknown>>) ?? [];
  const panelRows = ((panelsRes.data ?? []) as Array<Record<string, unknown>>) ?? [];
  const evidenceRows = ((evidenceRes.data ?? []) as Array<Record<string, unknown>>) ?? [];
  const coachLinks = ((coachLinksRes.data ?? []) as Array<{ coach_user_id?: string | null }>) ?? [];
  const healthBuckets = partitionPanelsByType(panelRows);
  const appUser = (appUserRes.data ?? null) as { user_id?: string | null; role?: string | null } | null;

  memory = applyAthleteMemoryPatch(memory, {
    identity: {
      athleteId,
      ownerUserId: appUser?.user_id ?? null,
      coachUserIds: coachLinks.map((row) => row.coach_user_id).filter((id): id is string => typeof id === "string" && id.length > 0),
      roleMode:
        appUser?.role === "private"
          ? "private"
          : coachLinks.length > 0
            ? "coach_managed"
            : appUser?.user_id
              ? "shared"
              : "unassigned",
    },
    source: {
      domain: "identity",
      source: "supabase.app_user_profiles",
      updatedAt: now,
    },
  });

  if (profileRow) {
    const profile = toAthleteProfile(profileRow, athleteId);
    profile.connectedDevices = toConnectedDevices(deviceRows);
    memory = applyAthleteMemoryPatch(memory, {
      profile,
      nutrition: {
        constraints: toNutritionConstraints(athleteId, profileRow),
        profileConfig: profileRow.nutrition_config && typeof profileRow.nutrition_config === "object"
          ? (profileRow.nutrition_config as Record<string, unknown>)
          : null,
        fuelingConfig: profileRow.supplement_config && typeof profileRow.supplement_config === "object"
          ? (profileRow.supplement_config as Record<string, unknown>)
          : null,
      },
      source: {
        domain: "profile",
        source: "supabase.athlete_profiles",
        sourceId: athleteId,
        updatedAt: now,
      },
    });
  }

  memory = applyAthleteMemoryPatch(memory, {
    nutrition: { diary: diaryRows },
    source: {
      domain: "nutrition",
      source: "supabase.food_diary_entries",
      sourceId: athleteId,
      updatedAt: now,
    },
  });

  memory = applyAthleteMemoryPatch(memory, {
    physiology,
    source: {
      domain: "physiology",
      source: "resolver.canonical_physiology",
      sourceId: athleteId,
      updatedAt: physiology.computedAt,
    },
  });

  const twin = await resolveCanonicalTwinState(athleteId, physiology);

  memory = applyAthleteMemoryPatch(memory, {
    twin,
    source: {
      domain: "twin",
      source: "resolver.canonical_twin",
      sourceId: athleteId,
      updatedAt: twin.asOf,
    },
  });

  memory = applyAthleteMemoryPatch(memory, {
    reality: {
      recentIngestions: mergeRealityIngestionRecords(
        importJobRows.map(mapTrainingImportJobToIngestionRecord),
        deviceExportRows.map(mapDeviceSyncExportToIngestionRecord),
      ).slice(0, 20),
    },
    source: {
      domain: "reality",
      source: "supabase.reality_ingestions",
      sourceId: athleteId,
      updatedAt: now,
    },
  });

  memory = applyAthleteMemoryPatch(memory, {
    health: {
      blood: healthBuckets.blood,
      microbiota: healthBuckets.microbiota,
      epigenetics: healthBuckets.epigenetics,
      panels: panelRows,
    },
    evidenceItems: toEvidenceItems(evidenceRows),
    source: {
      domain: "health",
      source: "supabase.health_evidence",
      sourceId: athleteId,
      updatedAt: now,
    },
  });

  memory = applyAthleteMemoryPatch(memory, {
    knowledge,
    source: {
      domain: "knowledge",
      source: "resolver.athlete_knowledge_memory",
      sourceId: athleteId,
      updatedAt: now,
    },
  });

  memory = applyAthleteMemoryPatch(memory, {
    knowledge: {
      bindings: mergeKnowledgeBindings(
        memory.knowledge?.bindings ?? [],
        deriveCandidateKnowledgeBindings({
          athleteId,
          physiology,
          twin,
          health: memory.health,
        }),
      ),
      activeModulations: mergeKnowledgeModulations(
        memory.knowledge?.activeModulations ?? [],
        deriveKnowledgeModulationSnapshots({
          athleteId,
          bindings: memory.knowledge?.bindings ?? [],
          physiology,
          twin,
        }),
      ),
      recentSessionPackets: memory.knowledge?.recentSessionPackets ?? [],
    },
    source: {
      domain: "knowledge",
      source: "resolver.derived_candidate_bindings",
      sourceId: athleteId,
      updatedAt: now,
    },
  });

  return memory;
}
