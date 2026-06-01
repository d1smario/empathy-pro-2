import { createStripeServerClient } from "@empathy/integrations-stripe";
import { NextResponse } from "next/server";
import { loadUserAccessEntitlement } from "@/lib/billing/access-entitlement";
import { readStripeSecretKey } from "@/lib/billing/stripe-secret";
import { syncCheckoutSessionById } from "@/lib/billing/stripe-billing-persist";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sync immediato post-redirect Stripe Checkout → DB entitlement (non attendere solo webhook).
 */
export async function POST(req: Request) {
  const key = readStripeSecretKey();
  if (!key) {
    return NextResponse.json({ ok: false as const, error: "stripe_unconfigured" }, { status: 503 });
  }

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

  const stripe = createStripeServerClient(key);
  const sync = await syncCheckoutSessionById(stripe, sessionId, user.id, user.email ?? null);

  const admin = createSupabaseAdminClient();
  const ent = await loadUserAccessEntitlement(admin ?? sb, user.id);

  return NextResponse.json({
    ok: true as const,
    synced: sync.synced,
    reason: sync.reason ?? null,
    hasAthleteAccess: ent.hasAthleteAccess,
    label: ent.label,
  });
}
