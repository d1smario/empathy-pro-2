"use client";

import { cn } from "@/lib/cn";

export type ModeSelectOption = { value: string; label: string };

type ModeSelectProps = {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: ModeSelectOption[];
  className?: string;
  disabled?: boolean;
};

const selectClass =
  "w-full min-w-[10rem] appearance-none rounded-xl border border-white/15 bg-white/5 py-2.5 pl-3 pr-9 font-sans text-sm text-white shadow-lg backdrop-blur-xl transition hover:border-pink-500/40 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-40";

/**
 * Discrete mode/context choice — use instead of many radio rows or multi-select grids.
 */
export function ModeSelect({ id, label, value, onChange, options, className, disabled }: ModeSelectProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-gray-500">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <select
          id={id}
          className={selectClass}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-neutral-900 text-white">
              {o.label}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute inset-y-0 right-0 flex w-9 items-center justify-center text-pink-400"
          aria-hidden
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  );
}
