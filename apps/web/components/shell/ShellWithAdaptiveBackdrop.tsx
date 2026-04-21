"use client";

import { usePathname } from "next/navigation";
import { isGenerativePath } from "@/core/navigation/generative-modules";
import { requiresResolvedAthleteForPath } from "@/lib/shell/requires-resolved-athlete-path";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Pro2AthleteRequiredGate } from "@/components/shell/Pro2AthleteRequiredGate";
import { ProductSidebar } from "@/components/navigation/ProductSidebar";

/**
 * Matrix + orb pieni fuori dai moduli generativi; dentro training/nutrition/… matrix off e area contenuto leggermente velata per focus minimal.
 */
export function ShellWithAdaptiveBackdrop({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const generative = isGenerativePath(pathname);
  const athleteGate = requiresResolvedAthleteForPath(pathname);

  return (
    <BrutalistAppBackdrop matrix={!generative}>
      <div className="flex min-h-screen">
        <ProductSidebar />
        <main
          id="main-content"
          tabIndex={-1}
          className={
            generative
              ? "min-w-0 flex-1 scroll-mt-0 bg-black/50 outline-none backdrop-blur-[2px]"
              : "min-w-0 flex-1 scroll-mt-0 outline-none"
          }
        >
          <Pro2AthleteRequiredGate enabled={athleteGate}>{children}</Pro2AthleteRequiredGate>
        </main>
      </div>
    </BrutalistAppBackdrop>
  );
}
