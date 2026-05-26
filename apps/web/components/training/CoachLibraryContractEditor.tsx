"use client";

import { Minus, Plus, Timer } from "lucide-react";
import { useMemo } from "react";
import { CoachLibraryContractPreview } from "@/components/training/CoachLibraryContractPreview";
import { Pro2Button } from "@/components/ui/empathy";
import { SESSION_DURATION_CHOICES } from "@/lib/training/builder/session-duration-choices";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { effectiveDurationMinutesFromPro2Contract } from "@/lib/training/builder/pro2-session-notes";
import {
  patchLibraryContractBlock,
  scaleLibraryContractTiming,
  setLibraryContractPlannedDuration,
} from "@/lib/training/library/edit-library-contract";

function Stepper({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-white hover:bg-white/10"
          aria-label={`Riduci ${label}`}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[3rem] text-center font-mono text-sm text-white">
          {value}
          {suffix ?? ""}
        </span>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-white hover:bg-white/10"
          aria-label={`Aumenta ${label}`}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function CoachLibraryContractEditor({
  contract,
  title,
  tssFallback,
  durationFallback,
  dirty,
  saveBusy,
  onChange,
  onSave,
  onReset,
  onOpenInBuilder,
}: {
  contract: Pro2BuilderSessionContract;
  title?: string;
  tssFallback?: number;
  durationFallback?: number;
  dirty?: boolean;
  saveBusy?: boolean;
  onChange: (next: Pro2BuilderSessionContract) => void;
  onSave?: () => void;
  onReset?: () => void;
  onOpenInBuilder?: () => void;
}) {
  const durationMin = useMemo(
    () =>
      contract.plannedSessionDurationMinutes ??
      effectiveDurationMinutesFromPro2Contract(contract, durationFallback ?? 60),
    [contract, durationFallback],
  );

  const blocks = contract.blocks ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-fuchsia-500/25 bg-black/40 px-3 py-2.5">
        <label className="flex flex-col gap-1 text-[0.65rem] text-slate-400">
          <span className="flex items-center gap-1 font-bold uppercase tracking-wider text-fuchsia-200/90">
            <Timer className="h-3.5 w-3.5" aria-hidden />
            Durata calendario
          </span>
          <select
            className="min-w-[7.5rem] rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm font-mono text-white"
            value={durationMin}
            onChange={(e) => onChange(setLibraryContractPlannedDuration(contract, Number(e.target.value)))}
          >
            {SESSION_DURATION_CHOICES.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <Pro2Button type="button" variant="secondary" className="!px-2 !py-1 text-[0.65rem]" onClick={() => onChange(scaleLibraryContractTiming(contract, 0.9))}>
          −10% tempo
        </Pro2Button>
        <Pro2Button type="button" variant="secondary" className="!px-2 !py-1 text-[0.65rem]" onClick={() => onChange(scaleLibraryContractTiming(contract, 1.1))}>
          +10% tempo
        </Pro2Button>
        {dirty && onReset ? (
          <button
            type="button"
            className="text-[0.65rem] font-semibold text-slate-400 underline decoration-white/20 hover:text-violet-200"
            onClick={onReset}
          >
            Annulla modifiche
          </button>
        ) : null}
        {onOpenInBuilder ? (
          <Pro2Button type="button" variant="secondary" className="!px-2 !py-1 text-[0.65rem]" onClick={onOpenInBuilder}>
            Apri nel Builder
          </Pro2Button>
        ) : null}
        {onSave ? (
          <Pro2Button
            type="button"
            variant="secondary"
            className="ml-auto !px-2 !py-1 text-[0.65rem]"
            disabled={saveBusy || !dirty}
            onClick={onSave}
          >
            {saveBusy ? "Salvo…" : "Salva template"}
          </Pro2Button>
        ) : null}
      </div>

      {blocks.length > 0 ? (
        <ul className="space-y-2">
          {blocks.map((block, idx) => {
            const ch = block.chart;
            const hasInterval = Boolean(ch && (ch.workSeconds > 0 || ch.recoverSeconds > 0 || (ch.repeats ?? 0) > 1));
            const gymSets = block.gymRx?.sets;
            return (
              <li
                key={block.id || `lib-block-${idx}`}
                className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5"
              >
                <p className="truncate text-xs font-semibold text-white">
                  {idx + 1}. {block.label}
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <Stepper
                    label="Durata blocco (min)"
                    value={Math.max(1, Math.round(block.durationMinutes || 1))}
                    min={1}
                    max={720}
                    step={5}
                    onChange={(n) => onChange(patchLibraryContractBlock(contract, block.id, { durationMinutes: n }))}
                  />
                  {hasInterval && ch ? (
                    <>
                      <Stepper
                        label="Ripetizioni"
                        value={Math.max(1, ch.repeats || 1)}
                        min={1}
                        max={99}
                        step={1}
                        onChange={(n) => onChange(patchLibraryContractBlock(contract, block.id, { repeats: n }))}
                      />
                      <Stepper
                        label="Lavoro"
                        value={Math.max(0, ch.workSeconds || 0)}
                        min={0}
                        max={3600}
                        step={15}
                        suffix="s"
                        onChange={(n) => onChange(patchLibraryContractBlock(contract, block.id, { workSeconds: n }))}
                      />
                      <Stepper
                        label="Recupero"
                        value={Math.max(0, ch.recoverSeconds || 0)}
                        min={0}
                        max={3600}
                        step={15}
                        suffix="s"
                        onChange={(n) => onChange(patchLibraryContractBlock(contract, block.id, { recoverSeconds: n }))}
                      />
                    </>
                  ) : null}
                  {gymSets != null ? (
                    <Stepper
                      label="Serie"
                      value={Math.max(1, gymSets)}
                      min={1}
                      max={20}
                      step={1}
                      onChange={(n) => onChange(patchLibraryContractBlock(contract, block.id, { gymSets: n }))}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Nessun blocco modificabile in questo template.</p>
      )}

      <CoachLibraryContractPreview
        contract={contract}
        title={title}
        tssFallback={tssFallback}
        durationFallback={durationFallback}
        compact
      />
    </div>
  );
}
