import { NextRequest, NextResponse } from "next/server";
import { requireCoachLibraryWriteContext } from "@/lib/auth/coach-library-context";
import { TrainingRouteAuthError } from "@/lib/auth/training-route-auth";
import { importEmpathyAerobicStarterPack } from "@/lib/training/library/import-empathy-starter-pack";
import {
  EMPATHY_AEROBIC_STARTER_PACK_ID,
  EMPATHY_AEROBIC_STARTER_PACK_V1,
} from "@/lib/training/library/starter-pack-aerobic";

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

/** Importa catalogo Empathy workout nella libreria coach — idempotente per presetId. */
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId, db } = await requireCoachLibraryWriteContext(req);
    const body = (await req.json().catch(() => ({}))) as { pack?: string };
    const pack = body.pack?.trim() || "catalog_v2";
    if (pack !== "catalog_v2" && pack !== "aerobic_v1") {
      return NextResponse.json({ ok: false as const, error: "unknown_pack" }, { status: 400, headers: NO_STORE });
    }
    if (pack === "aerobic_v1") {
      return NextResponse.json(
        {
          ok: false as const,
          error: "pack_deprecated_use_catalog_v2",
          hint: `Use pack=catalog_v2 (${EMPATHY_AEROBIC_STARTER_PACK_ID})`,
          legacyPack: EMPATHY_AEROBIC_STARTER_PACK_V1,
        },
        { status: 400, headers: NO_STORE },
      );
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
