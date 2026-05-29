import { NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAthleteWriteContext,
} from "@/lib/auth/athlete-read-context";
import { DAILY_CHECKIN_SYMPTOMS, isDailyCheckinSymptom } from "@/lib/empathy/schemas";
import { dailyCheckinFromRow } from "@/lib/epi/epi-resolver";

export const runtime = "nodejs";

function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function asScale(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= 1 && r <= 5 ? r : null;
}

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    const date = (req.nextUrl.searchParams.get("date") ?? "").trim() || utcTodayIso();
    const { db } = await requireAthleteReadContext(req, athleteId);

    const [todayRes, historyRes] = await Promise.all([
      db
        .from("athlete_daily_checkins")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("checkin_date", date)
        .maybeSingle(),
      db
        .from("athlete_daily_checkins")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("checkin_date", { ascending: false })
        .limit(14),
    ]);
    if (todayRes.error) return NextResponse.json({ error: todayRes.error.message }, { status: 500 });
    if (historyRes.error) return NextResponse.json({ error: historyRes.error.message }, { status: 500 });

    return NextResponse.json({
      athleteId,
      date,
      checkin: dailyCheckinFromRow(athleteId, (todayRes.data ?? null) as Record<string, unknown> | null),
      history: ((historyRes.data ?? []) as Array<Record<string, unknown>>).map((row) =>
        dailyCheckinFromRow(athleteId, row),
      ),
      symptoms: DAILY_CHECKIN_SYMPTOMS,
    });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unable to read check-in";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      athleteId?: string;
      date?: string;
      energy?: unknown;
      mood?: unknown;
      sleepQuality?: unknown;
      soreness?: unknown;
      stress?: unknown;
      motivation?: unknown;
      illnessFlags?: unknown;
      note?: unknown;
    };
    const athleteId = (body.athleteId ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    const date = (body.date ?? "").trim() || utcTodayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    const { db } = await requireAthleteWriteContext(req, athleteId);

    const illnessFlags = Array.isArray(body.illnessFlags)
      ? Array.from(
          new Set(
            (body.illnessFlags as unknown[])
              .filter((f): f is string => typeof f === "string")
              .filter((f) => isDailyCheckinSymptom(f)),
          ),
        )
      : [];
    const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;

    const { error } = await db.from("athlete_daily_checkins").upsert(
      {
        athlete_id: athleteId,
        checkin_date: date,
        energy: asScale(body.energy),
        mood: asScale(body.mood),
        sleep_quality: asScale(body.sleepQuality),
        soreness: asScale(body.soreness),
        stress: asScale(body.stress),
        motivation: asScale(body.motivation),
        illness_flags: illnessFlags,
        note,
        source: "self_report",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "athlete_id,checkin_date" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, athleteId, date });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unable to save check-in";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
