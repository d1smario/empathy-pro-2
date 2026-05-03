import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import {
  buildWahooPlanJsonFromGeneratedSession,
  sessionSupportsWahooStructuredPlan,
  totalSessionMinutes,
} from "@/lib/integrations/wahoo-plan-from-generated-session";
import { wahooCreatePlan, wahooCreateWorkout } from "@/lib/integrations/wahoo-cloud-service";
import { wahooDayCodeFromUtcDate } from "@/lib/integrations/wahoo-daycode";
import type { GeneratedSession } from "@/lib/training/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

function wahooPlanIdFromCreateResponse(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const id = (data as { id?: unknown }).id;
  if (typeof id === "number" && Number.isFinite(id)) return Math.trunc(id);
  return null;
}

function defaultWahooWorkoutTypeId(family: 0 | 1): number {
  if (family === 1) {
    const raw = process.env.WAHOO_DEFAULT_RUN_WORKOUT_TYPE_ID?.trim();
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
    return 40;
  }
  const raw = process.env.WAHOO_DEFAULT_BIKE_WORKOUT_TYPE_ID?.trim();
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return 40;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseGeneratedSession(raw: unknown): GeneratedSession | null {
  if (!isRecord(raw)) return null;
  const sport = typeof raw.sport === "string" ? raw.sport : "";
  const domain = raw.domain;
  const goalLabel = typeof raw.goalLabel === "string" ? raw.goalLabel : "";
  const physiologicalTarget = raw.physiologicalTarget;
  const blocks = raw.blocks;
  if (!sport || !Array.isArray(blocks)) return null;
  const okBlocks = blocks.every(
    (b) =>
      isRecord(b) &&
      typeof b.order === "number" &&
      typeof b.label === "string" &&
      typeof b.durationMinutes === "number",
  );
  if (!okBlocks) return null;
  return raw as GeneratedSession;
}

/**
 * Crea un plan Wahoo plan.json da una sessione builder Pro2 e, opzionalmente, un workout pianificato collegato.
 */
export async function POST(req: NextRequest) {
  let body: {
    athleteId?: string;
    session?: unknown;
    planned_date?: string;
    plan_name?: string;
    description?: string;
    intensity_channel?: "watt" | "hr";
    workout_type_location?: 0 | 1;
    ftp_w?: number | null;
    hr_max?: number | null;
    threshold_hr_bpm?: number | null;
    schedule_workout?: boolean;
    workout_type_id?: number;
    starts_iso?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400, headers: NO_STORE });
  }

  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const plannedDate = typeof body.planned_date === "string" ? body.planned_date.trim().slice(0, 10) : "";
  const session = parseGeneratedSession(body.session);
  if (!athleteId || !session || !/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
    return NextResponse.json(
      { ok: false as const, error: "Richiesti athleteId, planned_date (YYYY-MM-DD), session (GeneratedSession)." },
      { status: 400, headers: NO_STORE },
    );
  }

  if (!sessionSupportsWahooStructuredPlan(session)) {
    return NextResponse.json(
      { ok: false as const, error: "Sessione non compatibile con plan Wahoo (es. dominio gym o blocchi vuoti)." },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    await requireAthleteWriteContext(req, athleteId);
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: e.message }, { status: e.status, headers: NO_STORE });
    }
    throw e;
  }

  const intensityChannel = body.intensity_channel === "hr" ? "hr" : "watt";
  const workoutTypeLocation = body.workout_type_location === 1 ? 1 : 0;
  const planName =
    (typeof body.plan_name === "string" && body.plan_name.trim()) || session.goalLabel?.trim() || "EMPATHY Pro 2";

  let planJson: Record<string, unknown>;
  try {
    planJson = buildWahooPlanJsonFromGeneratedSession({
      session,
      planName,
      description: typeof body.description === "string" ? body.description : undefined,
      intensityChannel,
      workoutTypeLocation,
      ftpW: typeof body.ftp_w === "number" && Number.isFinite(body.ftp_w) ? body.ftp_w : null,
      hrMax: typeof body.hr_max === "number" && Number.isFinite(body.hr_max) ? body.hr_max : null,
      thresholdHrBpm:
        typeof body.threshold_hr_bpm === "number" && Number.isFinite(body.threshold_hr_bpm)
          ? body.threshold_hr_bpm
          : null,
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : "wahoo_plan_build_error";
    const msg =
      code === "wahoo_plan_ftp_required"
        ? "Per export watt serve ftp_w > 0."
        : code === "wahoo_plan_hr_max_required"
          ? "Per corsa o target HR serve hr_max > 0."
          : "Impossibile costruire il plan Wahoo.";
    return NextResponse.json({ ok: false as const, error: msg, code }, { status: 400, headers: NO_STORE });
  }

  const family = planJson.header && isRecord(planJson.header) ? (planJson.header.workout_type_family as 0 | 1) : 0;

  const externalId = `empathy_pro2_${randomUUID()}`;
  const providerUpdatedAt = new Date().toISOString();

  const planRes = await wahooCreatePlan({
    athleteId,
    externalId,
    providerUpdatedAtIso: providerUpdatedAt,
    planFileJson: planJson,
    filename: `${planName.replace(/[^\w\-]+/g, "_").slice(0, 80)}.json`,
  });

  if (!planRes.ok) {
    return NextResponse.json(
      { ok: false as const, error: planRes.error, status: planRes.status, phase: "create_plan" },
      { status: planRes.status, headers: NO_STORE },
    );
  }

  const planId = wahooPlanIdFromCreateResponse(planRes.data);
  const schedule = body.schedule_workout !== false;

  if (!schedule || planId == null) {
    return NextResponse.json(
      {
        ok: true as const,
        plan: planJson,
        wahoo_plan: planRes.data,
        plan_id: planId,
        wahoo_workout: null,
        warning:
          schedule && planId == null ? ("Risposta creazione plan senza id: workout non creato." as const) : undefined,
      },
      { headers: NO_STORE },
    );
  }

  const minutes = totalSessionMinutes(session);
  const workoutTypeId =
    typeof body.workout_type_id === "number" && Number.isFinite(body.workout_type_id) && body.workout_type_id > 0
      ? Math.floor(body.workout_type_id)
      : defaultWahooWorkoutTypeId(family === 1 ? 1 : 0);

  const startsIso =
    typeof body.starts_iso === "string" && body.starts_iso.trim()
      ? body.starts_iso.trim()
      : `${plannedDate}T12:00:00.000Z`;

  const workoutToken = randomUUID();
  const wRes = await wahooCreateWorkout({
    athleteId,
    name: planName.slice(0, 120),
    workoutToken,
    workoutTypeId,
    startsIso,
    minutes,
    dayCode: wahooDayCodeFromUtcDate(plannedDate),
    planId,
  });

  if (!wRes.ok) {
    return NextResponse.json(
      {
        ok: false as const,
        error: wRes.error,
        status: wRes.status,
        phase: "create_workout",
        plan_created: planRes.data,
        plan_id: planId,
      },
      { status: wRes.status, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    {
      ok: true as const,
      plan: planJson,
      plan_id: planId,
      wahoo_plan: planRes.data,
      wahoo_workout: wRes.data,
    },
    { headers: NO_STORE },
  );
}
