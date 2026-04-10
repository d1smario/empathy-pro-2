"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, ChevronDown } from "lucide-react";
import { Pro2Button } from "@/components/ui/empathy";

export type LactateWorkoutPickItem = {
  id: string;
  date: string;
  duration_min: number;
  tss: number;
  sport: string;
};

function formatWorkoutLine(w: LactateWorkoutPickItem) {
  return `${new Date(w.date).toLocaleDateString("it-IT")} · ${w.sport} · ${Math.round(w.duration_min)} min · ${Math.round(w.tss)} TSS`;
}

export function LactateWorkoutPickerPro2({
  workouts,
  selectedWorkoutId,
  onSelectWorkoutId,
  variant = "lactate",
}: {
  workouts: LactateWorkoutPickItem[];
  selectedWorkoutId: string;
  onSelectWorkoutId: (id: string) => void;
  /** Stile accent: lactate (ambra) o max oxidate (rosa). */
  variant?: "lactate" | "maxox";
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = workouts.find((w) => w.id === selectedWorkoutId) ?? null;

  const isMox = variant === "maxox";
  const btnClass = isMox
    ? "physiology-pro2-lac-pick-btn physiology-pro2-lac-pick-btn--maxox w-full justify-between gap-3 border border-rose-500/45 bg-gradient-to-r from-rose-500/14 to-fuchsia-900/20 py-3 text-left font-semibold text-rose-50 hover:from-rose-500/20 hover:to-fuchsia-900/28"
    : "physiology-pro2-lac-pick-btn w-full justify-between gap-3 border border-amber-500/40 bg-gradient-to-r from-amber-500/12 to-orange-500/10 py-3 text-left font-semibold text-amber-50 hover:from-amber-500/18 hover:to-orange-500/14";
  const icoClass = isMox ? "h-5 w-5 shrink-0 text-rose-300" : "h-5 w-5 shrink-0 text-amber-300";

  return (
    <div className={`physiology-pro2-lac-pick${isMox ? " physiology-pro2-lac-pick--maxox" : ""}`} ref={panelRef}>
      <Pro2Button type="button" variant="secondary" className={btnClass} onClick={() => setOpen((o) => !o)} disabled={workouts.length === 0}>
        <span className="flex min-w-0 items-center gap-2">
          <CalendarClock className={icoClass} aria-hidden />
          <span className="truncate">
            {workouts.length === 0
              ? "Nessuna sessione importata"
              : selected
                ? formatWorkoutLine(selected)
                : "Seleziona allenamento da analizzare"}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </Pro2Button>
      {open && workouts.length > 0 ? (
        <div className={`physiology-pro2-lac-pick-pop${isMox ? " physiology-pro2-lac-pick-pop--maxox" : ""}`} role="listbox">
          <p className="physiology-pro2-lac-pick-pop-hint">
            {isMox
              ? "Tocca una sessione: potenza, VO₂, RER, lattato e SmO₂ vanno nel motore Max Oxidate (snapshot/aggregati del file). Per un tratto a ritmo stabile preferisci quei numeri o inseriscili a mano."
              : "Tocca una sessione: i segnali vengono applicati al motore lattato."}
          </p>
          <div className={`physiology-pro2-lac-pick-chips${isMox ? " physiology-pro2-lac-pick-chips--maxox" : ""}`}>
            {workouts.map((w) => (
              <button
                key={w.id}
                type="button"
                role="option"
                aria-selected={w.id === selectedWorkoutId}
                className={`physiology-pro2-lac-pick-chip${isMox ? " physiology-pro2-lac-pick-chip--maxox" : ""}${w.id === selectedWorkoutId ? " physiology-pro2-lac-pick-chip--on" : ""}`}
                onClick={() => {
                  onSelectWorkoutId(w.id);
                  setOpen(false);
                }}
              >
                {formatWorkoutLine(w)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
