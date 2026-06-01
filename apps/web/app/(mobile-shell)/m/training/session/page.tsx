"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { localCalendarDayIso } from "@/lib/datetime/local-calendar-day";

export default function MobileTrainingSessionTodayEntryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/m/training/session/${localCalendarDayIso()}`);
  }, [router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-sm text-gray-400">Reindirizzamento alla giornata operativa locale…</p>
    </div>
  );
}
