"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { isGenerativePath } from "@/core/navigation/generative-modules";
import { getProductNavItemByModule } from "@/core/navigation/module-registry";
import { MOBILE_BOTTOM_NAV } from "@/core/navigation/mobile-module-registry";
import { requiresResolvedAthleteForPath } from "@/lib/shell/requires-resolved-athlete-path";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { ShellMainFrame } from "@/components/shell/ShellMainFrame";
import { MobileTopBar } from "@/components/navigation/MobileTopBar";
import { ProductBottomNav } from "@/components/navigation/ProductBottomNav";
import { MobileModuleDrawer } from "@/components/navigation/MobileModuleDrawer";

function mobileTitleForPath(pathname: string): string {
  const item = MOBILE_BOTTOM_NAV.find((nav) => pathname === nav.href || pathname.startsWith(`${nav.href}/`));
  if (item) {
    const navMeta = getProductNavItemByModule(item.module);
    return navMeta?.label ?? item.label;
  }
  if (pathname.startsWith("/m/settings")) return "Impostazioni";
  if (pathname.startsWith("/m/nutrition/diary")) return "Diario";
  return "Empathy";
}

/** Shell app mobile: top bar + bottom nav; desktop `(shell)` resta invariato. */
export function MobileShellWithAdaptiveBackdrop({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/m/dashboard";
  const generative = isGenerativePath(pathname);
  const athleteGate = requiresResolvedAthleteForPath(pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = useMemo(() => mobileTitleForPath(pathname), [pathname]);

  return (
    <BrutalistAppBackdrop matrix={false}>
      <div className="flex min-h-screen flex-col">
        <MobileTopBar title={title} onOpenDrawer={() => setDrawerOpen(true)} />
        <ShellMainFrame
          generative={generative}
          athleteGate={athleteGate}
          className="min-w-0 flex-1 scroll-mt-0 outline-none pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))]"
        >
          {children}
        </ShellMainFrame>
        <ProductBottomNav />
        <MobileModuleDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </div>
    </BrutalistAppBackdrop>
  );
}
