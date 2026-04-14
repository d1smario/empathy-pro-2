"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Data locale calendario (non UTC) in formato `YYYY-MM-DD`. */
export function nutritionLocalIsoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function nutritionAddDaysIso(iso: string, deltaDays: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  if (Number.isNaN(dt.getTime())) return null;
  return nutritionLocalIsoDate(dt);
}

type NutritionPlanDatePickerProps = {
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
  /** Giorni indietro rispetto a oggi (default ~2 anni). */
  minOffsetDays?: number;
  /** Giorni avanti rispetto a oggi (default ~3 anni). */
  maxOffsetDays?: number;
};

/**
 * Selettore giorno compatto: `input type="date"` (su mobile apre il picker nativo rotella/calendario)
 * più frecce ±1 giorno e scorciatoia «Oggi». Sostituisce la tendina lunga su lista date fisse.
 */
export function NutritionPlanDatePicker({
  value,
  onChange,
  className,
  minOffsetDays = -800,
  maxOffsetDays = 1200,
}: NutritionPlanDatePickerProps) {
  const today = nutritionLocalIsoDate();
  const min = nutritionAddDaysIso(today, minOffsetDays) ?? value;
  const max = nutritionAddDaysIso(today, maxOffsetDays) ?? value;

  const goPrev = () => {
    const n = nutritionAddDaysIso(value, -1);
    if (n && n >= min) onChange(n);
  };
  const goNext = () => {
    const n = nutritionAddDaysIso(value, 1);
    if (n && n <= max) onChange(n);
  };

  const atMin = value <= min;
  const atMax = value >= max;

  const labelIt = (() => {
    try {
      return new Date(`${value}T12:00:00`).toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return value;
    }
  })();

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-h-[2.75rem] min-w-0 items-center gap-1 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/50 to-black/50 px-1 py-1 shadow-inner">
          <button
            type="button"
            onClick={goPrev}
            disabled={atMin}
            className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-emerald-500/30 bg-black/40 text-emerald-200 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-10"
            aria-label="Giorno precedente"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <input
            type="date"
            value={value}
            min={min}
            max={max}
            onChange={(e) => {
              const v = e.target.value;
              if (v) onChange(v);
            }}
            className={cn(
              "h-11 min-h-[44px] min-w-0 flex-1 cursor-pointer rounded-lg border border-transparent bg-black/20 px-2 sm:h-10 sm:min-h-0",
              "text-center text-sm font-semibold text-white outline-none",
              "focus-visible:ring-2 focus-visible:ring-emerald-400/40",
              "[color-scheme:dark]",
            )}
            aria-label="Scegli giorno, mese e anno"
          />
          <button
            type="button"
            onClick={goNext}
            disabled={atMax}
            className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-emerald-500/30 bg-black/40 text-emerald-200 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-10"
            aria-label="Giorno successivo"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <p className="px-1 text-center text-[0.7rem] capitalize leading-snug text-emerald-200/80 sm:text-xs" aria-hidden>
          {labelIt}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onChange(today)}
        className="h-11 min-h-[44px] shrink-0 touch-manipulation rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 text-xs font-bold uppercase tracking-wider text-emerald-100 hover:bg-emerald-500/20 sm:h-10 sm:min-h-0 sm:self-center sm:px-5"
      >
        Oggi
      </button>
    </div>
  );
}
