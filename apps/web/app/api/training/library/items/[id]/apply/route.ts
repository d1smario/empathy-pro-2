import { NextRequest, NextResponse } from "next/server";
import { requireCoachLibraryWriteContext } from "@/lib/auth/coach-library-context";
import { TrainingRouteAuthError, requireTrainingAthleteWriteContext } from "@/lib/auth/training-route-auth";
import { applyCoachLibraryTemplate } from "@/lib/training/library/apply-library-template";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

type RouteParams = { params: Promise<{ id: string }> };

function authError(err: unknown) {
  if (err instanceof TrainingRouteAuthError) {
    return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
  }
  const message = err instanceof Error ? err.message : "library_apply_failed";
  return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      athleteId?: string;
      date?: string;
      applyScaling?: boolean;
      contract?: Pro2BuilderSessionContract;
    };
    const athleteId = String(body.athleteId ?? "").trim();
    const date = String(body.date ?? "").trim().slice(0, 10);
    if (!athleteId || !date) {
      return NextResponse.json({ ok: false as const, error: "missing_athlete_or_date" }, { status: 400, headers: NO_STORE });
    }

    const coachCtx = await requireCoachLibraryWriteContext(req);
    await requireTrainingAthleteWriteContext(req, athleteId);

    const result = await applyCoachLibraryTemplate({
      db: coachCtx.db,
      coachUserId: coachCtx.userId,
      itemId: id.trim(),
      athleteId,
      date,
      applyScaling: body.applyScaling === true,
      contractOverride: body.contract,
    });

    return NextResponse.json(
      {
        ok: true as const,
        athleteId,
        date,
        plannedWorkoutId: result.plannedWorkoutId,
        scalingHints: result.scalingHints,
        loadScalePct: result.loadScalePct,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    return authError(err);
  }
}
