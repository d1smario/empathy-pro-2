import { NextResponse } from "next/server";
import { loadPlatformReport } from "@/lib/admin/load-platform-report";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/platform-report
 * Panoramica piattaforma: KPI, coach→atleti, adozione moduli (proxy rollup 058/059).
 */
export async function GET() {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  try {
    const report = await loadPlatformReport(admin);
    return NextResponse.json({ ok: true as const, report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore report piattaforma.";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
