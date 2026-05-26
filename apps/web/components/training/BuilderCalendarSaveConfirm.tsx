"use client";

import { Pro2Link } from "@/components/ui/empathy/Pro2Link";

/** Conferma salvataggio builder → `planned_workouts` con link al giorno corretto in calendario. */
export function BuilderCalendarSaveConfirm({
  date,
  plannedWorkoutId,
  className = "mt-3 text-sm text-emerald-300/90",
}: {
  date: string;
  plannedWorkoutId: string | null;
  className?: string;
}) {
  if (!plannedWorkoutId) return null;
  const day = date.slice(0, 10);
  return (
    <p className={className}>
      Seduta salvata in calendario per il <span className="font-mono text-emerald-200">{day}</span>
      {plannedWorkoutId !== "ok" ? ` · id ${plannedWorkoutId.slice(0, 8)}…` : ""}. Apertura calendario…{" "}
      <Pro2Link
        href={`/training/calendar?date=${encodeURIComponent(day)}`}
        variant="ghost"
        className="!inline-flex border border-emerald-500/40 px-2 py-0.5 text-xs"
      >
        Vai al {day}
      </Pro2Link>
    </p>
  );
}
