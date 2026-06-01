import { NextRequest, NextResponse } from "next/server";

import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { getBiomechanicsSessionImportById } from "@/lib/biomechanics/biomech-capture-pipeline";
import {
  BIOMECH_CAPTURE_BUCKET,
  createBiomechServiceRoleClient,
} from "@/lib/biomechanics/biomech-capture-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function readMediaPath(session: { payload?: Record<string, unknown> }): string | null {
  const path = session.payload?.mediaStoragePath;
  return typeof path === "string" && path.trim() ? path.trim() : null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionId = params.id?.trim();
    if (!sessionId) {
      return NextResponse.json({ ok: false as const, error: "missing_session_id" }, { status: 400, headers: NO_STORE });
    }

    const athleteId = String(req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteReadContext(req, athleteId);
    const session = await getBiomechanicsSessionImportById(db, { athleteId, sessionId });
    if (!session) {
      return NextResponse.json({ ok: false as const, error: "session_not_found" }, { status: 404, headers: NO_STORE });
    }

    let signedUrl: string | null = null;
    const mediaPath = readMediaPath(session);
    const admin = createBiomechServiceRoleClient();
    if (admin && mediaPath) {
      const sig = await admin.storage.from(BIOMECH_CAPTURE_BUCKET).createSignedUrl(mediaPath, 300);
      if (!sig.error && sig.data) signedUrl = sig.data.signedUrl ?? null;
    }

    return NextResponse.json({ ok: true as const, session, signedUrl }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "biomech_session_get_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
