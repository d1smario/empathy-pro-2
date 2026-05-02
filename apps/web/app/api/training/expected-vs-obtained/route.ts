import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { fetchCoachApplicationTraces } from "@/lib/memory/coach-application-traces";
import {
  attachLoopClosureHints,
  computeExpectedVsObtainedDeltas,
  persistExpectedVsObtainedDeltas,
  type ExpectedObtainedDelta,
} from "@/lib/training/expected-vs-obtained-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number): string {
  const base = new Date(`${dateIso}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return toDateOnly(base);
}

function defaultWindow(req: NextRequest) {
  const today = toDateOnly(new Date());
  return {
    from: (req.nextUrl.searchParams.get("from") ?? addDays(today, -7)).trim(),
    to: (req.nextUrl.searchParams.get("to") ?? today).trim(),
  };
}

function shouldPersist(req: NextRequest): boolean {
  const raw = (req.nextUrl.searchParams.get("persist") ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function deltasNeedingStaging(deltas: ExpectedObtainedDelta[]) {
  return deltas.filter((delta) => delta.status === "adapt" || delta.status === "recover");
}

function mergeCoachTracesIntoHints(deltas: ExpectedObtainedDelta[], coachTraces: Array<Record<string, unknown>>): ExpectedObtainedDelta[] {
  if (!coachTraces.length) return deltas;
  return deltas.map((delta) => {
    const hint = { ...(delta.adaptationHint ?? {}) };
    (hint as Record<string, unknown>).recent_coach_application_traces = coachTraces;
    return { ...delta, adaptationHint: hint };
  });
}

async function fetchRecentCoachTraces(
  db: Awaited<ReturnType<typeof requireAthleteReadContext>>["db"],
  athleteId: string,
): Promise<Array<Record<string, unknown>>> {
  try {
    return await fetchCoachApplicationTraces(db, athleteId, 8);
  } catch {
    /* tabella assente / schema cache / errore lettura: hint coach opzionale */
    return [];
  }
}

async function openAdaptationStagingRuns(input: {
  db: Awaited<ReturnType<typeof requireAthleteWriteContext>>["db"];
  athleteId: string;
  deltas: ExpectedObtainedDelta[];
  coachTraceRows?: Array<Record<string, unknown>>;
}) {
  const actionable = deltasNeedingStaging(input.deltas);
  if (!actionable.length) return 0;
  const coachTraceRefs = (input.coachTraceRows ?? [])
    .map((row) => {
      const id = typeof row.id === "string" ? row.id.trim() : "";
      return id ? { table: "athlete_coach_application_traces" as const, id } : null;
    })
    .filter((ref): ref is { table: "athlete_coach_application_traces"; id: string } => Boolean(ref));

  const { error } = await input.db.from("interpretation_staging_runs").insert(
    actionable.map((delta) => ({
      athlete_id: input.athleteId,
      domain: "cross_module",
      status: "pending_validation",
      trigger_source: "expected_vs_obtained",
      source_refs: [
        ...delta.plannedWorkoutIds.map((id) => ({ table: "planned_workouts", id })),
        ...delta.executedWorkoutIds.map((id) => ({ table: "executed_workouts", id })),
        ...coachTraceRefs,
        { table: "training_expected_obtained_deltas", id: `${input.athleteId}:${delta.date}` },
      ],
      candidate_bundle: {
        date: delta.date,
        status: delta.status,
        delta: delta.delta,
        readiness: delta.readiness,
        adaptation_hint: delta.adaptationHint,
        expected_load: delta.expectedLoad,
        obtained_load: delta.obtainedLoad,
        internal_response: delta.internalResponse,
      },
      proposed_structured_patches: [
        {
          target: "training",
          action: delta.adaptationHint.training_adjustment,
          reason: delta.adaptationHint.reasons,
        },
        {
          target: "nutrition",
          action: delta.adaptationHint.nutrition_adjustment,
          reason: "energy_and_internal_load_alignment",
        },
      ],
      confidence: delta.status === "recover" ? 0.82 : 0.74,
    })),
  );
  if (error) throw new Error(error.message);
  return actionable.length;
}

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    const { from, to } = defaultWindow(req);
    const { db } = await requireAthleteReadContext(req, athleteId);
    const raw = await computeExpectedVsObtainedDeltas({ db, athleteId, from, to });
    const withLoop = await attachLoopClosureHints({ db, athleteId, deltas: raw });
    const coachTraces = await fetchRecentCoachTraces(db, athleteId);
    const deltas = mergeCoachTracesIntoHints(withLoop, coachTraces);
    return NextResponse.json({ ok: true as const, athleteId, from, to, deltas }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "expected_vs_obtained_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { athleteId?: string; from?: string; to?: string; openStaging?: boolean };
    const athleteId = String(body.athleteId ?? req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    const defaults = defaultWindow(req);
    const from = String(body.from ?? defaults.from).trim();
    const to = String(body.to ?? defaults.to).trim();
    const { db } = await requireAthleteWriteContext(req, athleteId);
    const raw = await computeExpectedVsObtainedDeltas({ db, athleteId, from, to });
    const withLoop = await attachLoopClosureHints({ db, athleteId, deltas: raw });
    const coachTraces = await fetchRecentCoachTraces(db, athleteId);
    const deltas = mergeCoachTracesIntoHints(withLoop, coachTraces);
    const persisted = await persistExpectedVsObtainedDeltas({ db, deltas });
    const stagingOpened =
      body.openStaging === false && !shouldPersist(req)
        ? 0
        : await openAdaptationStagingRuns({ db, athleteId, deltas, coachTraceRows: coachTraces });

    return NextResponse.json(
      { ok: true as const, athleteId, from, to, persisted, stagingOpened, deltas },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "expected_vs_obtained_persist_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
