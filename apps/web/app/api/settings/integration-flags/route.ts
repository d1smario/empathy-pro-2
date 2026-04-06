import { NextResponse } from "next/server";
import { getIntegrationPresence } from "@/lib/integrations/integration-status";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Solo booleani di presenza env (stesso set di `getIntegrationPresence`) — nessun segreto.
 * Per UI Settings; diverso da `GET /api/integrations/status` (gated in produzione).
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true as const,
      integrations: getIntegrationPresence(),
    },
    { headers: NO_STORE },
  );
}
