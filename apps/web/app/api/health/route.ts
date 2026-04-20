import { NextResponse } from "next/server";
import { EMPATHY_PLATFORM_VERSION } from "@empathy/contracts";
import { readOptionalServiceRoleKey } from "@/lib/supabase-env";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

function publicSupabaseHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

/**
 * Probe pubblico (load balancer / orchestrator). Nessun segreto, nessuna dipendenza esterna.
 * `supabaseServiceRoleConfigured` + `supabaseHost`: confronto locale vs Vercel (stesso DB? letture training con/senza bypass RLS).
 * Dettaglio integrazioni: solo `GET /api/integrations/status` (gated in produzione).
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true as const,
      version: EMPATHY_PLATFORM_VERSION,
      supabaseHost: publicSupabaseHost(),
      supabaseServiceRoleConfigured: readOptionalServiceRoleKey() != null,
    },
    { headers: NO_STORE },
  );
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: NO_STORE });
}
