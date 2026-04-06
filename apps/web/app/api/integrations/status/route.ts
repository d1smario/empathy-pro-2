import { type NextRequest, NextResponse } from "next/server";
import { getIntegrationPresence } from "@/lib/integrations/integration-status";

export const dynamic = "force-dynamic";

function integrationsStatusAllowed(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  const secret = process.env.INTEGRATIONS_STATUS_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Dev: aperto (solo flag booleani, nessun segreto nel body).
 * Produzione: disabilitato se `INTEGRATIONS_STATUS_SECRET` non è impostato;
 * altrimenti richiede `Authorization: Bearer <INTEGRATIONS_STATUS_SECRET>`.
 * Liveness pubblica: `GET /api/health`.
 */
export async function GET(request: NextRequest) {
  if (!integrationsStatusAllowed(request)) {
    return NextResponse.json({ ok: false as const }, { status: 404 });
  }

  return NextResponse.json({
    ok: true as const,
    integrations: getIntegrationPresence(),
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? "unknown",
    },
  });
}
