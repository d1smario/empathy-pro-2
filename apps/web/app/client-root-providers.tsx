"use client";

import type { ReactNode } from "react";
import { ActiveAthleteProvider } from "@/lib/use-active-athlete";

/**
 * Provider client condivisi dal layout root (sopra a tutte le route).
 */
export function ClientRootProviders({ children }: { children: ReactNode }) {
  return <ActiveAthleteProvider>{children}</ActiveAthleteProvider>;
}
