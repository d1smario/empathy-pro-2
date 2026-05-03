import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { wahooGetWorkoutPlans } from "@/lib/integrations/wahoo-cloud-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

function parseId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** GET /v1/workouts/:id/plans — piani collegati al workout. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await ctx.params;
  const workoutId = parseId(idRaw);
  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
  if (!athleteId || workoutId == null) {
    return NextResponse.json({ ok: false as const, error: "Missing athleteId o workout id non valido." }, { status: 400, headers: NO_STORE });
  }
  try {
    await requireAthleteReadContext(req, athleteId);
    const r = await wahooGetWorkoutPlans(athleteId, workoutId);
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
