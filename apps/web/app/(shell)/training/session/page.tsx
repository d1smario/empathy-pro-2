"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { localCalendarDayIso } from "@/lib/datetime/local-calendar-day";

/**
 * `/training/session` → redirect al giorno locale corrente (`/training/session/YYYY-MM-DD`).
 */
export default function TrainingSessionTodayEntryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/training/session/${localCalendarDayIso()}`);
  }, [router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-sm text-gray-400">Reindirizzamento alla giornata operativa locale…</p>
    </div>
  );
}
