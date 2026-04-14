import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { RequestAuthError, requireRequestUser } from "@/lib/auth/request-auth";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { writeAthleteMemoryDomainPatch } from "@/lib/memory/athlete-memory-domain-writer";

export const runtime = "nodejs";

function computeActivityStats(dates: string[]) {
  const uniq = Array.from(new Set(dates));
  const daysActive = uniq.length;
  let dayStreak = 0;
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date();
  for (let i = 0; i < 60; i += 1) {
    const d = new Date(today.getTime() - i * dayMs).toISOString().slice(0, 10);
    if (uniq.includes(d)) dayStreak += 1;
    else break;
  }
  return { daysActive, dayStreak };
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickTraceMetric(trace: unknown, keys: string[]): number | null {
  if (!trace || typeof trace !== "object") return null;
  const rec = trace as Record<string, unknown>;
  for (const key of keys) {
    const maybe = asNumber(rec[key]);
    if (maybe != null) return maybe;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    const { db } = await requireAthleteReadContext(req, athleteId);

    const [athleteMemory, executedRes] = await Promise.all([
      resolveAthleteMemory(athleteId),
      db
        .from("executed_workouts")
        .select("date, trace_summary, duration_minutes, tss, kj, kcal")
        .eq("athlete_id", athleteId)
        .order("date", { ascending: false })
        .limit(120),
    ]);

    const error = executedRes.error?.message ?? null;
    const executedRows =
      ((executedRes.data ?? []) as Array<{
        date: string;
        trace_summary: Record<string, unknown> | null;
        duration_minutes: number | null;
        tss: number | null;
        kj: number | null;
        kcal: number | null;
      }>) ?? [];
    const stats = computeActivityStats(executedRows.map((r) => r.date));
    const profileSource = athleteMemory.profile;
    const profileData: Record<string, unknown> = profileSource
      ? {
          id: profileSource.id,
          first_name: profileSource.firstName ?? null,
          last_name: profileSource.lastName ?? null,
          email: profileSource.email ?? null,
          birth_date: profileSource.birthDate ?? null,
          sex: profileSource.sex ?? null,
          timezone: profileSource.timezone ?? null,
          activity_level: profileSource.activityLevel ?? null,
          height_cm: profileSource.heightCm ?? null,
          weight_kg: profileSource.weightKg ?? null,
          body_fat_pct: profileSource.bodyFatPct ?? null,
          muscle_mass_kg: profileSource.muscleMassKg ?? null,
          resting_hr_bpm: profileSource.restingHrBpm ?? null,
          max_hr_bpm: profileSource.maxHrBpm ?? null,
          threshold_hr_bpm: profileSource.thresholdHrBpm ?? null,
          diet_type: profileSource.dietType ?? null,
          intolerances: profileSource.intolerances ?? null,
          allergies: profileSource.allergies ?? null,
          food_preferences: profileSource.foodPreferences ?? null,
          food_exclusions: profileSource.foodExclusions ?? null,
          supplements: profileSource.supplements ?? null,
          routine_summary: profileSource.routineSummary ?? null,
          lifestyle_activity_class: profileSource.lifestyleActivityClass ?? null,
          preferred_meal_count: profileSource.preferredMealCount ?? null,
          training_days_per_week: profileSource.trainingAvailability?.daysPerWeek ?? null,
          training_max_session_minutes: profileSource.trainingAvailability?.maxSessionMinutes ?? null,
          routine_config: profileSource.routineConfig ?? null,
          nutrition_config: profileSource.nutritionConfig ?? null,
          supplement_config: profileSource.supplementConfig ?? null,
          created_at: profileSource.createdAt ?? null,
          updated_at: profileSource.updatedAt ?? null,
        }
      : {};
    const physiologyState = athleteMemory.physiology;

    const maxHrFromTrace =
      executedRows
        .map((row) => pickTraceMetric(row.trace_summary, ["hr_max_bpm", "max_hr", "heart_rate_max", "hr_max"]))
        .filter((v): v is number => v != null)
        .reduce((max, cur) => (cur > max ? cur : max), 0) || null;

    const avgHrFromTraceCandidates = executedRows
      .map((row) => pickTraceMetric(row.trace_summary, ["hr_avg_bpm", "avg_hr", "heart_rate_avg", "hr_avg"]))
      .filter((v): v is number => v != null);
    const restingHrFromTrace =
      avgHrFromTraceCandidates.length > 0 ? Math.round(Math.min(...avgHrFromTraceCandidates) * 0.78) : null;

    const fallbackWeight = asNumber(profileData.weight_kg);
    const fallbackBodyFat = asNumber(profileData.body_fat_pct);
    const fallbackHeight = asNumber(profileData.height_cm);

    const mergedProfile: Record<string, unknown> = {
      ...profileData,
      weight_kg: fallbackWeight,
      body_fat_pct: fallbackBodyFat,
      height_cm: fallbackHeight,
      resting_hr_bpm: asNumber(profileData.resting_hr_bpm) ?? restingHrFromTrace,
      max_hr_bpm: asNumber(profileData.max_hr_bpm) ?? maxHrFromTrace,
    };

    const mergedPhysiology: Record<string, unknown> = {
      athlete_id: athleteId,
      ftp_watts: physiologyState?.physiologicalProfile.ftpWatts ?? null,
      lt1_watts: physiologyState?.physiologicalProfile.lt1Watts ?? null,
      lt2_watts: physiologyState?.physiologicalProfile.lt2Watts ?? null,
      v_lamax: physiologyState?.physiologicalProfile.vLamax ?? null,
      vo2max_ml_min_kg: physiologyState?.physiologicalProfile.vo2maxMlMinKg ?? null,
      cp_watts: physiologyState?.metabolicProfile.cpWatts ?? null,
      fatmax_watts: physiologyState?.metabolicProfile.fatmaxWatts ?? null,
      w_prime_j: physiologyState?.metabolicProfile.wPrimeJ ?? null,
      pcr_capacity_j: physiologyState?.metabolicProfile.pcrCapacityJ ?? null,
      glycolytic_capacity_j: physiologyState?.metabolicProfile.glycolyticCapacityJ ?? null,
      fit_r2: physiologyState?.metabolicProfile.fitR2 ?? null,
      fit_confidence: physiologyState?.metabolicProfile.fitConfidence ?? null,
      fit_model: physiologyState?.metabolicProfile.fitModel ?? null,
      phenotype: physiologyState?.metabolicProfile.phenotype ?? null,
      lactate_oxidized_g: physiologyState?.lactateProfile.lactateOxidizedG ?? null,
      glucose_from_cori_g: physiologyState?.lactateProfile.glucoseFromCoriG ?? null,
      blood_delivery_pct_of_ingested: physiologyState?.lactateProfile.bloodDeliveryPctOfIngested ?? null,
      gut_stress_score: physiologyState?.lactateProfile.gutStressScore ?? null,
      oxidative_bottleneck_index: physiologyState?.performanceProfile.oxidativeBottleneckIndex ?? null,
      redox_stress_index: physiologyState?.performanceProfile.redoxStressIndex ?? null,
      baseline_hrv_ms: physiologyState?.physiologicalProfile.baselineHrvMs ?? null,
    };

    return NextResponse.json({
      athleteId,
      profile: Object.keys(mergedProfile).length > 0 ? mergedProfile : null,
      physiology: Object.values(mergedPhysiology).some((v) => v != null) ? mergedPhysiology : null,
      physiologyState,
      physiologyCoverage: physiologyState?.sources ?? null,
      athleteMemory,
      activity: stats,
      error,
    });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Profile API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRequestUser(req);
    const body = (await req.json()) as { payload?: Record<string, unknown> };
    if (!body.payload) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }
    const result = await writeAthleteMemoryDomainPatch({
      domain: "profile",
      action: "upsert",
      payload: body.payload,
    });
    return NextResponse.json({
      id: result.athleteId ?? null,
      status: result.status,
      athleteMemory: result.athleteMemory,
    });
  } catch (err) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Profile create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { athleteId?: string; payload?: Record<string, unknown> };
    const athleteId = (body.athleteId ?? "").trim();
    if (!athleteId || !body.payload) {
      return NextResponse.json({ error: "Missing athleteId or payload" }, { status: 400 });
    }
    await requireAthleteWriteContext(req, athleteId);
    const result = await writeAthleteMemoryDomainPatch({
      domain: "profile",
      action: "update",
      athleteId,
      payload: body.payload,
    });
    return NextResponse.json({
      athleteId,
      status: result.status,
      athleteMemory: result.athleteMemory,
    });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Profile update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
