import { type NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAthleteWriteContext,
} from "@/lib/auth/athlete-read-context";
import { wahooDeleteWorkout, wahooGetWorkout, wahooUpdateWorkout } from "@/lib/integrations/wahoo-cloud-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

function parseId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await ctx.params;
  const workoutId = parseId(idRaw);
  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
  if (!athleteId || workoutId == null) {
    return NextResponse.json({ ok: false as const, error: "Missing athleteId o workout id non valido." }, { status: 400, headers: NO_STORE });
  }
  try {
    await requireAthleteReadContext(req, athleteId);
    const r = await wahooGetWorkout(athleteId, workoutId);
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

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await ctx.params;
  const workoutId = parseId(idRaw);
  let body: {
    athleteId?: string;
    name?: string;
    workout_token?: string;
    workout_type_id?: number;
    starts?: string;
    day_code?: number;
    minutes?: number;
    plan_id?: number | null;
    route_id?: number | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400, headers: NO_STORE });
  }
  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  if (!athleteId || workoutId == null) {
    return NextResponse.json({ ok: false as const, error: "Missing athleteId o workout id non valido." }, { status: 400, headers: NO_STORE });
  }
  try {
    await requireAthleteWriteContext(req, athleteId);
    const r = await wahooUpdateWorkout({
      athleteId,
      workoutId,
      patch: {
        name: body.name,
        workout_token: body.workout_token,
        workout_type_id: body.workout_type_id,
        starts: body.starts,
        day_code: body.day_code,
        minutes: body.minutes,
        plan_id: body.plan_id,
        route_id: body.route_id,
      },
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

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await ctx.params;
  const workoutId = parseId(idRaw);
  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
  if (!athleteId || workoutId == null) {
    return NextResponse.json({ ok: false as const, error: "Missing athleteId o workout id non valido." }, { status: 400, headers: NO_STORE });
  }
  try {
    await requireAthleteWriteContext(req, athleteId);
    const r = await wahooDeleteWorkout(athleteId, workoutId);
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
