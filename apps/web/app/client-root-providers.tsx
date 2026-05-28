"use client";

import type { ReactNode } from "react";
import { ActiveAthleteProvider } from "@/lib/use-active-athlete";
import { PWAUpdateController } from "@/components/PWAUpdateController";

/**
 * Provider client condivisi dal layout root (sopra a tutte le route).
 *
 * `PWAUpdateController` gestisce l'aggiornamento immediato del Service Worker:
 * dopo un deploy il nuovo SW prende il controllo subito (no "vedo ancora le
 * vecchie sessioni"). Vedi `apps/web/components/PWAUpdateController.tsx`.
 */
export function ClientRootProviders({ children }: { children: ReactNode }) {
  return (
    <ActiveAthleteProvider>
      <PWAUpdateController />
      {children}
    </ActiveAthleteProvider>
  );
}
