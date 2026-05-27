import type { AccountBillingCurrency } from "@empathy/contracts";

/** Prezzo catalogo per UI (allineato a Stripe CHF, locale svizzero). */
export function formatPlanPrice(amount: number, currency: AccountBillingCurrency): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
