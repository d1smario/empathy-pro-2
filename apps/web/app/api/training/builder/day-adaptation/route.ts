import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { resolveOperationalSignalsBundle } from "@/lib/dashboard/resolve-operational-signals-bundle";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";
import { resolveLatestRecoverySummary } from "@/lib/reality/recovery-summary";
import {
  resolveDailyBuilderLoadAdaptation,
  scalePlannedWorkoutTargets,
} from "@/lib/training/builder/daily-builder-load-adaptation";
import { isViryaPlannedWorkout } from "@/lib/training/virya/virya-planned-notes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

export async function GET(req: NextRequest) {
  const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
  const date = (req.nextUrl.searchParams.get("date") ?? "").trim().slice(0, 10);
  const replacePlannedId = (req.nextUrl.searchParams.get("replacePlannedId") ?? "").trim() || null;

  if (!athleteId) {
    return NextResponse.json({ ok: false as const, error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false as const, error: "Invalid date" }, { status: 400, headers: NO_STORE });
  }

  try {
    const { db } = await requireAthleteReadContext(req, athleteId);
    const [athleteMemory, recoverySummary, plannedRes] = await Promise.all([
      resolveAthleteMemorySlice(athleteId, { slice: "training" }),
      resolveLatestRecoverySummary(athleteId).catch(() => null),
      db
        .from("planned_workouts")
        .select("id, date, type, duration_minutes, tss_target, notes")
        .eq("athlete_id", athleteId)
        .eq("date", date)
        .order("created_at", { ascending: true }),
    ]);

    if (plannedRes.error) {
      return NextResponse.json({ ok: false as const, error: plannedRes.error.message }, { status: 500, headers: NO_STORE });
    }

    const bundle = await resolveOperationalSignalsBundle({
      athleteId,
      athleteMemory,
      recoverySummary,
    });

    const loadAdaptation = resolveDailyBuilderLoadAdaptation({
      adaptationGuidance: bundle.adaptationGuidance,
      operationalContext: bundle.operationalContext!,
      bioenergeticModulation: bundle.bioenergeticModulation,
      adaptationLoop: bundle.adaptationLoop,
      recoveryStatus: recoverySummary?.status ?? null,
    });

    const plannedRows = (plannedRes.data ?? []) as Array<{
      id: string;
      date: string;
      type: string;
      duration_minutes: number | null;
      tss_target: number | null;
      notes: string | null;
    }>;

    const nonViryaRows = plannedRows.filter((r) => !isViryaPlannedWorkout(r.notes));
    const targetRow =
      (replacePlannedId ? plannedRows.find((r) => r.id === replacePlannedId) : null) ??
      nonViryaRows[0] ??
      plannedRows[0] ??
      null;

    const baselineDuration = Math.max(0, Number(targetRow?.duration_minutes ?? 60) || 60);
    const baselineTss = Math.max(0, Number(targetRow?.tss_target ?? 0) || 0);
    const scaled =
      targetRow && baselineTss > 0
        ? scalePlannedWorkoutTargets({
            durationMinutes: baselineDuration,
            tssTarget: baselineTss,
            loadAdaptation,
          })
        : {
            durationMinutes: Math.max(20, Math.round(baselineDuration * loadAdaptation.loadScale)),
            tssTarget: baselineTss > 0 ? Math.max(1, Math.round(baselineTss * loadAdaptation.loadScale)) : 0,
          };

    return NextResponse.json(
      {
        ok: true as const,
        athleteId,
        date,
        loadAdaptation,
        adaptationGuidance: bundle.adaptationGuidance,
        adaptationLoop: {
          status: bundle.adaptationLoop.status,
          nextAction: bundle.adaptationLoop.nextAction,
          divergenceScore: bundle.adaptationLoop.divergenceScore,
          guidance: bundle.adaptationLoop.guidance,
        },
        targetPlanned: targetRow
          ? {
              id: targetRow.id,
              type: targetRow.type,
              baselineDurationMinutes: baselineDuration,
              baselineTssTarget: baselineTss,
              adaptedDurationMinutes: scaled.durationMinutes,
              adaptedTssTarget: scaled.tssTarget,
            }
          : null,
        plannedCount: plannedRows.length,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "day-adaptation failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
