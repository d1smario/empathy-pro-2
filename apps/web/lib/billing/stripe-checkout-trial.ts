/** Trial opzionale per checkout anonimo (V1 catalog: 15g — allinea con `STRIPE_CHECKOUT_TRIAL_DAYS`). */
export function readCheckoutTrialDays(): number | undefined {
  const raw = process.env.STRIPE_CHECKOUT_TRIAL_DAYS?.trim();
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 365) return undefined;
  return n;
}
