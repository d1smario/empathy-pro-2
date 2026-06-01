import { NextResponse } from "next/server";
import { ensureBillingEntitlementForAuthUser } from "@/lib/billing/ensure-billing-entitlement";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sync immediato post-redirect Stripe Checkout → DB entitlement (non attendere solo webhook).
 */
export async function POST(req: Request) {
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

  let body: { sessionId?: unknown };
  try {
    body = (await req.json()) as { sessionId?: unknown };
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return NextResponse.json({ ok: false as const, error: "session_id_invalid" }, { status: 400 });
  }

  const ent = await ensureBillingEntitlementForAuthUser(user.id, user.email ?? null, {
    checkoutSessionId: sessionId,
    repairFromStripe: true,
  });

  return NextResponse.json({
    ok: true as const,
    synced: ent.hasAthleteAccess,
    hasAthleteAccess: ent.hasAthleteAccess,
    label: ent.label,
  });
}
