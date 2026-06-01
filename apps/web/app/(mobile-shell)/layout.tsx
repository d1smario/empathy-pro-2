import { MobileShellWithAdaptiveBackdrop } from "@/components/shell/MobileShellWithAdaptiveBackdrop";
import { gateAuthenticatedShellAccessOrRedirect } from "@/lib/billing/subscription-paywall";

export const dynamic = "force-dynamic";

export default async function MobileShellLayout({ children }: { children: React.ReactNode }) {
  await gateAuthenticatedShellAccessOrRedirect();
  return <MobileShellWithAdaptiveBackdrop>{children}</MobileShellWithAdaptiveBackdrop>;
}
