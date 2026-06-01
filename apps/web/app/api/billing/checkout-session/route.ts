import { isEmpathyBasePlanId, isEmpathyCoachAddOnId, type EmpathyCoachAddOnId } from "@empathy/contracts";
import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createStripeServerClient } from "@empathy/integrations-stripe";
import { loadUserAccessEntitlement } from "@/lib/billing/access-entitlement";
import {
  stripeCheckoutCancelUrl,
  stripeCheckoutCancelUrlAuthenticated,
  stripeCheckoutSuccessUrl,
  stripeCheckoutSuccessUrlAuthenticated,
} from "@/lib/billing/stripe-app-url";
import { isStripeHostedCheckoutEnabled } from "@/lib/billing/stripe-checkout-availability";
import { isPostSignupCheckoutRequired } from "@/lib/billing/paywall-config";
import { readCheckoutTrialDays } from "@/lib/billing/stripe-checkout-trial";
import { readStripeSecretKey, readStripeSecretKeyKind } from "@/lib/billing/stripe-secret";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

async function readStripeCustomerIdForUser(userId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const id = (data as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  return typeof id === "string" && id.trim() !== "" ? id.trim() : null;
}

async function stripeCustomerHasActiveSubscription(
  stripe: ReturnType<typeof createStripeServerClient>,
  customerId: string,
): Promise<boolean> {
  const [active, trialing] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
    stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 }),
  ]);
  return active.data.length > 0 || trialing.data.length > 0;
}

/**
 * Checkout subscription Silver/Gold (+ coach add-on opzionale), allineato agli env V1.
 * Richiede `STRIPE_CHECKOUT_ANON_ENABLED=1` oppure paywall commerciale attivo (default).
 */
export async function POST(req: NextRequest) {
  if (!isStripeHostedCheckoutEnabled()) {
    return NextResponse.json(
      {
        error:
          "Checkout Stripe non abilitato. Configura STRIPE_SECRET_KEY, STRIPE_PRICE_* e STRIPE_CHECKOUT_ANON_ENABLED=1 (o paywall attivo).",
      },
      { status: 403 },
    );
  }

  const authUser = await readOptionalCheckoutUser();
  if (isPostSignupCheckoutRequired() && !authUser) {
    return NextResponse.json(
      { error: "Accedi o registrati prima di avviare il checkout abbonamento." },
      { status: 401 },
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
  let stripeCustomerId: string | null = null;

  if (authUser) {
    const admin = createSupabaseAdminClient();
    const db = admin ?? createSupabaseCookieClient();
    if (db) {
      const entitlement = await loadUserAccessEntitlement(db, authUser.userId);
      if (entitlement.hasAthleteAccess) {
        return NextResponse.json(
          {
            alreadySubscribed: true as const,
            redirectUrl: "/access/plan?billing=success",
          },
          { status: 409 },
        );
      }
    }

    stripeCustomerId = await readStripeCustomerIdForUser(authUser.userId);
    if (stripeCustomerId && (await stripeCustomerHasActiveSubscription(stripe, stripeCustomerId))) {
      return NextResponse.json(
        {
          alreadySubscribed: true as const,
          redirectUrl: "/access/plan?billing=success",
        },
        { status: 409 },
      );
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: lineItems,
      success_url: authUser ? stripeCheckoutSuccessUrlAuthenticated() : stripeCheckoutSuccessUrl(),
      cancel_url: authUser ? stripeCheckoutCancelUrlAuthenticated() : stripeCheckoutCancelUrl(),
      allow_promotion_codes: true,
      payment_method_collection: "always",
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : customerEmail
          ? { customer_email: customerEmail }
          : {}),
      client_reference_id: `pro2:${body.basePlanId}${coachAddOnId ? `+${coachAddOnId}` : ""}`,
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
    const keyKind = readStripeSecretKeyKind();
    const noSuchPrice = /no such price/i.test(message);
    return NextResponse.json(
      {
        error: message,
        stripeKeyKind: keyKind,
        ...(noSuchPrice
          ? {
              hint:
                "Gli STRIPE_PRICE_* devono esistere nello stesso account e modalità Stripe della STRIPE_SECRET_KEY (sk_live_ con prezzi creati in Live; sk_test_ con prezzi in Test). Su Vercel controlla che i valori non abbiano virgolette extra.",
              attemptedBasePriceId: basePriceId,
              ...(addonPriceId ? { attemptedCoachPriceId: addonPriceId } : {}),
            }
          : {}),
      },
      { status: 502 },
    );
  }
}
