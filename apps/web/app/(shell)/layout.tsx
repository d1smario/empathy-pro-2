import { ShellWithAdaptiveBackdrop } from "@/components/shell/ShellWithAdaptiveBackdrop";
import { gateAuthenticatedShellAccessOrRedirect } from "@/lib/billing/subscription-paywall";

export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  // Server-side paywall gate: redirect a /pricing se loggato senza entitlement
  // e `EMPATHY_PAYWALL_ENFORCED=true`. No-op per anonimi e con flag spenta.
  await gateAuthenticatedShellAccessOrRedirect();
  return <ShellWithAdaptiveBackdrop>{children}</ShellWithAdaptiveBackdrop>;
}
