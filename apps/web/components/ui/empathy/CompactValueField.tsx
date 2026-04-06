"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

type CompactValueFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label: string;
  hint?: string;
  suffix?: string;
  className?: string;
  inputClassName?: string;
};

const inputBase =
  "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm text-white tabular-nums placeholder:text-gray-500 shadow-lg backdrop-blur-xl transition focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-40";

/**
 * Single value entry (number, text, time…) — avoid long forms; one field per row.
 */
export function CompactValueField({
  label,
  hint,
  suffix,
  id,
  className,
  inputClassName,
  ...inputProps
}: CompactValueFieldProps) {
  const uid = useId();
  const fieldId = id ?? uid;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fieldId} className="text-xs font-medium text-gray-400">
        {label}
      </label>
      <div className="flex items-stretch gap-2">
        <input id={fieldId} className={cn(inputBase, "min-w-0 flex-1", inputClassName)} {...inputProps} />
        {suffix ? (
          <span className="flex items-center rounded-xl border border-white/15 bg-white/5 px-3 font-mono text-xs text-gray-400">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? <p className="text-[0.65rem] text-gray-500">{hint}</p> : null}
    </div>
  );
}
