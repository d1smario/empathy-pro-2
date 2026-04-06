import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { readStripeSecretKey, readStripeWebhookSecret } from "@/lib/billing/stripe-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Evita 404 “muto” se qualcuno apre l’URL nel browser; Stripe usa solo POST. */
export async function GET() {
  return NextResponse.json(
    { ok: false as const, error: "Metodo non supportato. Stripe invia POST con body raw e header stripe-signature." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

/**
 * Webhook Stripe: verifica firma, log strutturato. Nessuna persistenza DB in Pro 2 (V1: Supabase + handler).
 * Endpoint Dashboard: `https://<host>/api/webhooks/stripe`
 */
export async function POST(req: NextRequest) {
  const webhookSecret = readStripeWebhookSecret();
  const secretKey = readStripeSecretKey();
  if (!webhookSecret || !secretKey) {
    return NextResponse.json({ error: "Stripe webhook non configurato (env mancanti)." }, { status: 503 });
  }

  const stripe = new Stripe(secretKey, { typescript: true });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Header stripe-signature mancante." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verifica firma fallita.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.info("[stripe webhook pro2]", event.type, event.id);

  return NextResponse.json({ received: true as const });
}
