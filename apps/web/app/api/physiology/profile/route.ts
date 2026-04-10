import { NextRequest, NextResponse } from "next/server";
import { RequestAuthError, requireRequestAthleteAccess } from "@/lib/auth/request-auth";
import { resolveCanonicalPhysiologyState } from "@/lib/physiology/profile-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    }

    await requireRequestAthleteAccess(req, athleteId);

    const payload = await resolveCanonicalPhysiologyState(athleteId);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
    });
  } catch (err) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Physiology profile fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
