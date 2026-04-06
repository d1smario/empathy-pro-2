/**
 * Link pubblico Stripe (Payment Link / checkout hosted). Solo `NEXT_PUBLIC_*` — nessun segreto.
 * Billing completo come V1 (`nextjs-empathy-pro`): `STRIPE_SECRET_KEY` + `STRIPE_PRICE_*` + session API.
 * Validazione leggera: solo URL `https:` validi.
 */
export function getStripePaymentLink(): string | null {
  const raw = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
