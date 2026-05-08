import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    const { db } = await requireAthleteReadContext(req, athleteId);
    const { data, error } = await db
      .from("nutrition_constraints")
      .select("athlete_id, adaptation_adherence_opt_in, updated_at")
      .eq("athlete_id", athleteId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      athleteId,
      adaptationAdherenceOptIn: data?.adaptation_adherence_opt_in === true,
      updatedAt: data?.updated_at ?? null,
    });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unable to read nutrition adherence config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { athleteId?: string; adaptationAdherenceOptIn?: boolean };
    const athleteId = (body.athleteId ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    const { db } = await requireAthleteWriteContext(req, athleteId);
    const optIn = body.adaptationAdherenceOptIn === true;
    const { error } = await db.from("nutrition_constraints").upsert(
      {
        athlete_id: athleteId,
        adaptation_adherence_opt_in: optIn,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "athlete_id" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, athleteId, adaptationAdherenceOptIn: optIn });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unable to update nutrition adherence config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
