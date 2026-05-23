import { NextRequest, NextResponse } from "next/server";
import { requireCoachLibraryWriteContext } from "@/lib/auth/coach-library-context";
import { TrainingRouteAuthError } from "@/lib/auth/training-route-auth";
import { importEmpathyAerobicStarterPack } from "@/lib/training/library/import-empathy-starter-pack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function authError(err: unknown) {
  if (err instanceof TrainingRouteAuthError) {
    return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
  }
  const message = err instanceof Error ? err.message : "library_seed_failed";
  return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
}

/** Importa pack Empathy aerobic (20 template) nella libreria del coach — idempotente. */
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId, db } = await requireCoachLibraryWriteContext(req);
    const body = (await req.json().catch(() => ({}))) as { pack?: string };
    if (body.pack && body.pack !== "aerobic_v1") {
      return NextResponse.json({ ok: false as const, error: "unknown_pack" }, { status: 400, headers: NO_STORE });
    }

    const result = await importEmpathyAerobicStarterPack({
      db,
      coachUserId: userId,
      orgId,
    });

    return NextResponse.json({ ok: true as const, ...result }, { headers: NO_STORE });
  } catch (err) {
    return authError(err);
  }
}
