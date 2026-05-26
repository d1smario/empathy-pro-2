"use client";

import { useEffect, useState } from "react";
import { fetchProfileViewModel } from "@/modules/profile/services/profile-api";
import { isUsableAthleteFtpWatts } from "@/lib/training/physiology/resolve-athlete-ftp-watts";

/** FTP dell'atleta attivo da memoria fisiologica (stesso percorso del Builder). */
export function useAthleteFtpWatts(athleteId: string | null | undefined): number | null {
  const [ftpW, setFtpW] = useState<number | null>(null);

  useEffect(() => {
    if (!athleteId) {
      setFtpW(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const vm = await fetchProfileViewModel(athleteId);
        if (cancelled) return;
        const phys =
          vm.physiologyState?.physiologicalProfile ?? vm.athleteMemory?.physiology?.physiologicalProfile ?? null;
        const next = phys?.ftpWatts ?? null;
        setFtpW(isUsableAthleteFtpWatts(next) ? Math.round(next) : null);
      } catch {
        if (!cancelled) setFtpW(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  return ftpW;
}
