/**
 * Origine pubblica e redirect Checkout (stessi env di V1; default path Pro 2 → `/pricing`).
 */
export function readStripeAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (raw) {
    const v = raw.replace(/\/$/, "");
    if (v.startsWith("http")) return v;
    return `https://${v}`;
  }
  return "http://localhost:3000";
}

export function stripeCheckoutSuccessUrl(): string {
  const path =
    process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_SUCCESS_PATH?.trim() || "/pricing?billing=success";
  return `${readStripeAppOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function stripeCheckoutCancelUrl(): string {
  const path =
    process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_CANCEL_PATH?.trim() || "/pricing?billing=cancel";
  return `${readStripeAppOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
