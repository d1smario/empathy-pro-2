import { isEmpathyBasePlanId, isEmpathyCoachAddOnId, type EmpathyCoachAddOnId } from "@empathy/contracts";
import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createStripeServerClient } from "@empathy/integrations-stripe";
import { stripeCheckoutCancelUrl, stripeCheckoutSuccessUrl } from "@/lib/billing/stripe-app-url";
import { isAnonymousStripeCheckoutEnabled } from "@/lib/billing/stripe-checkout-availability";
import { readCheckoutTrialDays } from "@/lib/billing/stripe-checkout-trial";
import { readStripeSecretKey } from "@/lib/billing/stripe-secret";
import { createSupabaseCookieClient } from "@/lib/supabase/server";
import {
  formatMissingStripePriceMessage,
  listMissingCheckoutPriceEnvVars,
  stripePriceIdForBasePlan,
  stripePriceIdForCoachAddOn,
  type EmpathyBasePlanId,
} from "@/lib/billing/stripe-price-ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readOptionalCheckoutUser(): Promise<{ userId: string; email: string | null } | null> {
  const supabase = createSupabaseCookieClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { userId: data.user.id, email: data.user.email ?? null };
}

/**
 * Checkout subscription Silver/Gold (+ coach add-on opzionale), allineato agli env V1.
 * Solo con `STRIPE_CHECKOUT_ANON_ENABLED` attivo (`1`, `true` o `yes`) — demo/staging.
 */
export async function POST(req: NextRequest) {
  if (!isAnonymousStripeCheckoutEnabled()) {
    return NextResponse.json(
      {
        error:
          "Checkout anonimo disabilitato. Imposta STRIPE_CHECKOUT_ANON_ENABLED=1 (o true) solo per demo/staging.",
      },
      { status: 403 },
    );
  }

  const key = readStripeSecretKey();
  if (!key) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY non configurata." }, { status: 503 });
  }

  let body: { basePlanId?: unknown; coachAddOnId?: unknown; email?: unknown; withTrial?: unknown };
  try {
    body = (await req.json()) as {
      basePlanId?: unknown;
      coachAddOnId?: unknown;
      email?: unknown;
      withTrial?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }

  if (!isEmpathyBasePlanId(body.basePlanId)) {
    return NextResponse.json({ error: "basePlanId deve essere silver o gold." }, { status: 400 });
  }

  let coachAddOnId: EmpathyCoachAddOnId | null = null;
  if (body.coachAddOnId != null && body.coachAddOnId !== "") {
    if (!isEmpathyCoachAddOnId(body.coachAddOnId)) {
      return NextResponse.json({ error: "coachAddOnId deve essere elite, pro o olimpic." }, { status: 400 });
    }
    coachAddOnId = body.coachAddOnId;
  }

  const missing = listMissingCheckoutPriceEnvVars(body.basePlanId, coachAddOnId);
  if (missing.length > 0) {
    const msg = formatMissingStripePriceMessage(missing);
    return NextResponse.json({ error: msg, missingEnv: missing }, { status: 503 });
  }

  const basePriceId = stripePriceIdForBasePlan(body.basePlanId)!;
  const addonPriceId = coachAddOnId ? stripePriceIdForCoachAddOn(coachAddOnId)! : null;

  const authUser = await readOptionalCheckoutUser();

  let customerEmail: string | undefined;
  if (typeof body.email === "string") {
    const e = body.email.trim();
    if (e && EMAIL_RE.test(e)) customerEmail = e;
  }
  customerEmail ??= authUser?.email ?? undefined;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: basePriceId, quantity: 1 },
  ];
  if (addonPriceId) {
    lineItems.push({ price: addonPriceId, quantity: 1 });
  }

  const trialDaysEnv = readCheckoutTrialDays();
  /** `true` = forza prova se configurata; `false` = abbonamento da subito; assente = compat legacy (prova se env valorizzata). */
  const withTrialReq = body.withTrial;
  if (withTrialReq === true && trialDaysEnv == null) {
    return NextResponse.json({ error: "Prova gratuita non configurata sul server." }, { status: 400 });
  }
  let applyTrial = false;
  if (withTrialReq === true) {
    applyTrial = true;
  } else if (withTrialReq === false) {
    applyTrial = false;
  } else {
    applyTrial = trialDaysEnv != null;
  }

  const metadata = {
    empathy_pro2: "anon_checkout",
    base_plan_id: body.basePlanId,
    coach_addon_id: coachAddOnId ?? "",
    user_id: authUser?.userId ?? "",
  };

  const stripe = createStripeServerClient(key);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: lineItems,
      success_url: stripeCheckoutSuccessUrl(),
      cancel_url: stripeCheckoutCancelUrl(),
      allow_promotion_codes: true,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      client_reference_id: `pro2-anon:${body.basePlanId}${coachAddOnId ? `+${coachAddOnId}` : ""}`,
      metadata,
      subscription_data: {
        metadata,
        ...(applyTrial && trialDaysEnv != null ? { trial_period_days: trialDaysEnv } : {}),
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe non ha restituito URL checkout." }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Errore Stripe sconosciuto.";
    console.error("[billing/checkout-session]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
