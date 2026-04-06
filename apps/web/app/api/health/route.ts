import { NextResponse } from "next/server";
import { EMPATHY_PLATFORM_VERSION } from "@empathy/contracts";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Probe pubblico (load balancer / orchestrator). Nessun segreto, nessuna dipendenza esterna.
 * Dettaglio integrazioni: solo `GET /api/integrations/status` (gated in produzione).
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true as const,
      version: EMPATHY_PLATFORM_VERSION,
    },
    { headers: NO_STORE },
  );
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: NO_STORE });
}
