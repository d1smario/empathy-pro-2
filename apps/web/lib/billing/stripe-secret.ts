/**
 * Lettura chiavi Stripe da env con trim + BOM (stesso pattern difensivo di V1 su `STRIPE_SECRET_KEY`).
 */

function normalizeStripeEnvValue(raw: string): string {
  let v = raw.trim();
  if (v.charCodeAt(0) === 0xfeff) v = v.slice(1).trim();
  return v;
}

export function readStripeSecretKey(): string | null {
  const raw = process.env.STRIPE_SECRET_KEY;
  if (raw == null) return null;
  const v = normalizeStripeEnvValue(raw);
  return v.length > 0 ? v : null;
}

export function readStripeWebhookSecret(): string | null {
  const raw = process.env.STRIPE_WEBHOOK_SECRET;
  if (raw == null) return null;
  const v = normalizeStripeEnvValue(raw);
  return v.length > 0 ? v : null;
}
