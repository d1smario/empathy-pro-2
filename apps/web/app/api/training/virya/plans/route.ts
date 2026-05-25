import { NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAthleteWriteContext,
} from "@/lib/auth/athlete-read-context";
import {
  extractViryaTagFromPlannedNotes,
  ilikeContainsViryaTag,
  planNameFromViryaTag,
  VIRYA_NOTES_ILIKE_MARKER,
} from "@/lib/training/virya/virya-planned-notes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

export type ViryaCalendarPlanSummary = {
  tag: string;
  planName: string;
  sessionCount: number;
  dateMin: string;
  dateMax: string;
};

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }
    const { db } = await requireAthleteReadContext(req, athleteId);
    const { data, error } = await db
      .from("planned_workouts")
      .select("id, date, notes")
      .eq("athlete_id", athleteId)
      .ilike("notes", VIRYA_NOTES_ILIKE_MARKER)
      .order("date", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    }
    const byTag = new Map<string, { count: number; dateMin: string; dateMax: string }>();
    for (const row of data ?? []) {
      const tag = extractViryaTagFromPlannedNotes(typeof row.notes === "string" ? row.notes : null);
      if (!tag) continue;
      const date = String(row.date ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const cur = byTag.get(tag);
      if (!cur) {
        byTag.set(tag, { count: 1, dateMin: date, dateMax: date });
      } else {
        cur.count += 1;
        if (date < cur.dateMin) cur.dateMin = date;
        if (date > cur.dateMax) cur.dateMax = date;
      }
    }
    const plans: ViryaCalendarPlanSummary[] = Array.from(byTag.entries())
      .map(([tag, agg]) => ({
        tag,
        planName: planNameFromViryaTag(tag),
        sessionCount: agg.count,
        dateMin: agg.dateMin,
        dateMax: agg.dateMax,
      }))
      .sort((a, b) => b.dateMax.localeCompare(a.dateMax));
    return NextResponse.json({ status: "ok" as const, plans }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "virya-plans GET failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json()) as { athleteId?: string; tag?: string };
    const athleteId = (body.athleteId ?? "").trim();
    const tag = (body.tag ?? "").trim();
    if (!athleteId || !tag || !tag.startsWith("[VIRYA:")) {
      return NextResponse.json({ error: "Missing athleteId or valid VIRYA tag" }, { status: 400, headers: NO_STORE });
    }
    const { db } = await requireAthleteWriteContext(req, athleteId);
    const pattern = ilikeContainsViryaTag(tag);
    const { data: deletedRows, error: delErr } = await db
      .from("planned_workouts")
      .delete()
      .eq("athlete_id", athleteId)
      .ilike("notes", pattern)
      .select("id");
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500, headers: NO_STORE });
    }
    const deletedCount = deletedRows?.length ?? 0;
    const { data: remaining, error: remainErr } = await db
      .from("planned_workouts")
      .select("id")
      .eq("athlete_id", athleteId)
      .ilike("notes", pattern)
      .limit(1);
    if (remainErr) {
      return NextResponse.json({ error: remainErr.message }, { status: 500, headers: NO_STORE });
    }
    if (remaining?.length) {
      return NextResponse.json(
        {
          error:
            "Dopo DELETE restano righe VIRYA con lo stesso tag: verifica RLS o ripubblica da VIRYA con «Sostituisci» disattivo.",
          errorCode: "virya_plan_delete_verify_failed",
          deletedCount,
          remainingCount: remaining.length,
        },
        { status: 409, headers: NO_STORE },
      );
    }
    return NextResponse.json(
      { status: "ok" as const, deletedCount },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "virya-plans DELETE failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
