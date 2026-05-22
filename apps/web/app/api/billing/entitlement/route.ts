import { NextResponse } from "next/server";
import { loadUserAccessEntitlement } from "@/lib/billing/access-entitlement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET — stato accesso piattaforma per utente loggato (post-login / access/plan). */
export async function GET() {
  const sb = createSupabaseCookieClient();
  if (!sb) {
    return NextResponse.json({ ok: false as const, error: "supabase_unconfigured" }, { status: 503 });
  }
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false as const, error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const ent = await loadUserAccessEntitlement(admin ?? sb, user.id);

  return NextResponse.json({
    ok: true as const,
    hasAthleteAccess: ent.hasAthleteAccess,
    hasOperatorAccess: ent.hasOperatorAccess,
    source: ent.source,
    validUntil: ent.validUntil,
    label: ent.label,
  });
}
