/**
 * Origine pubblica e redirect Checkout (stessi env di V1; default Pro 2 → home `/?billing=*`).
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
    process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_SUCCESS_PATH?.trim() || "/?billing=success#piani";
  return `${readStripeAppOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function stripeCheckoutCancelUrl(): string {
  const path =
    process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_CANCEL_PATH?.trim() || "/?billing=cancel#piani";
  return `${readStripeAppOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
