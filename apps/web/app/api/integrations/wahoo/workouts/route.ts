import { type NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAthleteWriteContext,
} from "@/lib/auth/athlete-read-context";
import { wahooCreateWorkout, wahooListWorkouts } from "@/lib/integrations/wahoo-cloud-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

/** GET /v1/workouts — paginazione `page`, `per_page`. */
export async function GET(req: NextRequest) {
  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
  const pageRaw = req.nextUrl.searchParams.get("page");
  const perPageRaw = req.nextUrl.searchParams.get("per_page");
  const page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;
  const perPage = perPageRaw ? Number.parseInt(perPageRaw, 10) : 30;
  if (!athleteId) {
    return NextResponse.json({ ok: false as const, error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
  }
  try {
    await requireAthleteReadContext(req, athleteId);
    const r = await wahooListWorkouts(
      athleteId,
      Number.isFinite(page) ? page : 1,
      Number.isFinite(perPage) ? Math.min(100, Math.max(1, perPage)) : 30,
    );
    if (!r.ok) {
      return NextResponse.json({ ok: false as const, error: r.error, status: r.status }, { status: r.status, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true as const, data: r.data }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: e.message }, { status: e.status, headers: NO_STORE });
    }
    throw e;
  }
}

/** POST /v1/workouts — crea workout pianificato (`workouts_write`). */
export async function POST(req: NextRequest) {
  let body: {
    athleteId?: string;
    name?: string;
    workout_token?: string;
    workout_type_id?: number;
    starts?: string;
    minutes?: number;
    day_code?: number;
    plan_id?: number;
    route_id?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400, headers: NO_STORE });
  }
  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const workoutToken = typeof body.workout_token === "string" ? body.workout_token.trim() : "";
  const starts = typeof body.starts === "string" ? body.starts.trim() : "";
  const workoutTypeId =
    typeof body.workout_type_id === "number" && Number.isFinite(body.workout_type_id)
      ? Math.floor(body.workout_type_id)
      : NaN;
  const minutes =
    typeof body.minutes === "number" && Number.isFinite(body.minutes) ? Math.floor(body.minutes) : NaN;
  if (!athleteId || !name || !workoutToken || !starts || !Number.isFinite(workoutTypeId) || !Number.isFinite(minutes)) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Richiesti athleteId, name, workout_token, workout_type_id, starts (ISO), minutes.",
      },
      { status: 400, headers: NO_STORE },
    );
  }
  try {
    await requireAthleteWriteContext(req, athleteId);
    const r = await wahooCreateWorkout({
      athleteId,
      name,
      workoutToken,
      workoutTypeId,
      startsIso: starts,
      minutes,
      dayCode: typeof body.day_code === "number" && Number.isFinite(body.day_code) ? Math.floor(body.day_code) : undefined,
      planId: typeof body.plan_id === "number" && Number.isFinite(body.plan_id) ? Math.floor(body.plan_id) : undefined,
      routeId: typeof body.route_id === "number" && Number.isFinite(body.route_id) ? Math.floor(body.route_id) : undefined,
    });
    if (!r.ok) {
      return NextResponse.json({ ok: false as const, error: r.error, status: r.status }, { status: r.status, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true as const, data: r.data }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: e.message }, { status: e.status, headers: NO_STORE });
    }
    throw e;
  }
}
