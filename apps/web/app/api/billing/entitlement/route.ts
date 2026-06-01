import { NextRequest, NextResponse } from "next/server";
import { ensureBillingEntitlementForAuthUser } from "@/lib/billing/ensure-billing-entitlement";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET — entitlement utente loggato.
 * Query `repair=1` (default quando manca accesso): sync da Stripe prima di rispondere.
 */
export async function GET(req: NextRequest) {
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

  const sessionId = req.nextUrl.searchParams.get("session_id")?.trim() || null;
  const repairParam = req.nextUrl.searchParams.get("repair");
  const repairFromStripe = repairParam !== "0";

  const ent = await ensureBillingEntitlementForAuthUser(user.id, user.email ?? null, {
    checkoutSessionId: sessionId,
    repairFromStripe,
  });

  return NextResponse.json({
    ok: true as const,
    hasAthleteAccess: ent.hasAthleteAccess,
    hasOperatorAccess: ent.hasOperatorAccess,
    source: ent.source,
    validUntil: ent.validUntil,
    label: ent.label,
  });
}
