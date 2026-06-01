"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isMobileBrowserClient } from "@/lib/shell/mobile-detect";

/** Su telefono dentro shell desktop: link rapido per tornare all'app `/m/*`. */
export function MobileAppRecoveryBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(isMobileBrowserClient());
  }, []);

  if (!visible) return null;

  return (
    <div
      className="sticky top-0 z-50 border-b border-fuchsia-500/30 bg-zinc-950/95 px-4 py-2.5 backdrop-blur-md"
      role="status"
    >
      <p className="text-center text-xs text-gray-200">
        Stai usando la versione desktop su telefono.{" "}
        <Link
          href="/m/dashboard?app=1"
          className="font-semibold text-fuchsia-300 underline underline-offset-2 hover:text-fuchsia-200"
        >
          Apri app mobile
        </Link>
      </p>
    </div>
  );
}
