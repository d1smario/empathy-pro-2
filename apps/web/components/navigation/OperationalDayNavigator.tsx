"use client";

import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Pro2Button } from "@/components/ui/empathy";
import { addCalendarDaysIso, localCalendarDayIso } from "@/lib/datetime/local-calendar-day";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

type OperationalDayNavigatorProps = {
  /** Data corrente della vista (YYYY-MM-DD). */
  dateIso: string;
  /** Prefisso route senza slash finale, es. `/training/session` o `/physiology/daily`. */
  hrefPrefix: string;
};

/**
 * Cambio giorno operativo: ieri/domani, salto a oggi, input data nativo (locale browser).
 */
export function OperationalDayNavigator({ dateIso, hrefPrefix }: OperationalDayNavigatorProps) {
  const router = useRouter();
  const safe = ISO.test(dateIso) ? dateIso.slice(0, 10) : localCalendarDayIso();
  const todayIso = localCalendarDayIso();
  const prev = addCalendarDaysIso(safe, -1);
  const next = addCalendarDaysIso(safe, 1);

  const push = (iso: string) => {
    router.push(`${hrefPrefix}/${iso}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/12 bg-black/35 px-3 py-3 sm:gap-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pro2Button
          type="button"
          variant="secondary"
          className="border border-white/15 bg-white/5 px-2 py-1.5 text-xs sm:px-3"
          aria-label="Giorno precedente"
          onClick={() => push(prev)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Pro2Button>
        <Pro2Button
          type="button"
          variant="secondary"
          className="border border-white/15 bg-white/5 px-2 py-1.5 text-xs sm:px-3"
          aria-label="Giorno successivo"
          onClick={() => push(next)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Pro2Button>
      </div>

      <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[14rem]">
        <span className="font-mono text-[0.58rem] font-semibold uppercase tracking-wider text-gray-500">Data</span>
        <input
          type="date"
          value={safe}
          max="2099-12-31"
          min="2000-01-01"
          className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 font-mono text-sm text-white outline-none focus:border-fuchsia-500/45 focus:ring-1 focus:ring-fuchsia-500/30"
          onChange={(e) => {
            const v = e.target.value;
            if (ISO.test(v)) push(v);
          }}
        />
      </label>

      {safe !== todayIso ? (
        <Pro2Button
          type="button"
          variant="secondary"
          className="border border-fuchsia-500/35 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-50 hover:bg-fuchsia-500/20"
          onClick={() => push(localCalendarDayIso())}
        >
          <CalendarClock className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          Oggi
        </Pro2Button>
      ) : null}

      <p className="w-full basis-full font-mono text-[0.65rem] text-gray-500 sm:basis-auto sm:w-auto">
        Navigazione aggiorna l&apos;URL · stessi dati del calendario per{" "}
        <span className="text-gray-400">{safe}</span>
      </p>
    </div>
  );
}
