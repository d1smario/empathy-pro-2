import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { parseMemorySliceParam } from "@/lib/memory/parse-memory-slice-param";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    }
    await requireAthleteReadContext(req, athleteId);

    const slice = parseMemorySliceParam(req.nextUrl.searchParams.get("slice"));
    const athleteMemory = await resolveAthleteMemorySlice(athleteId, { slice });
    return NextResponse.json(
      { slice, ...athleteMemory },
      {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
      },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Athlete memory fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
