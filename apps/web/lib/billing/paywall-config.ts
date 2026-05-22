/** Paywall commerciale Pro 2 — default attivo salvo opt-out esplicito. */

export function isPaywallEnforced(): boolean {
  const raw = (process.env.EMPATHY_PAYWALL_ENFORCED ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "no";
}

/** Gate abbonamento atleta dopo registrazione (Stripe Checkout + trial). */
export function isPostSignupCheckoutRequired(): boolean {
  const raw = (process.env.EMPATHY_POST_SIGNUP_CHECKOUT_REQUIRED ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "no";
}

export const ACCESS_PLAN_PATH = "/access/plan";
