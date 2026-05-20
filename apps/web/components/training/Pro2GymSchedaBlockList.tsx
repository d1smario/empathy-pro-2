"use client";

import type { Pro2BuilderBlockContract, Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { GymExerciseMediaThumb } from "@/components/training/GymExerciseMediaThumb";

function gymRxLine(rx: NonNullable<Pro2BuilderBlockContract["gymRx"]>): string {
  const parts: string[] = [];
  if (rx.sets != null) parts.push(`${rx.sets} serie`);
  if (rx.reps?.trim()) parts.push(rx.reps.trim());
  if (rx.pct1Rm != null && rx.pct1Rm > 0) parts.push(`${Math.round(rx.pct1Rm)}% 1RM`);
  if (rx.weightKg != null && rx.weightKg > 0) parts.push(`${rx.weightKg} kg`);
  if (rx.executionStyle?.trim()) parts.push(rx.executionStyle.trim());
  if (rx.contractionEmphasis?.trim()) parts.push(rx.contractionEmphasis.trim());
  if (rx.chainLabel?.trim()) parts.push(rx.chainLabel.trim());
  return parts.join(" · ") || "—";
}

export function Pro2GymSchedaBlockList({
  contract,
  compact = false,
}: {
  contract: Pro2BuilderSessionContract;
  compact?: boolean;
}) {
  const blocks = (contract.blocks ?? []).filter((b) => b.gymRx || b.kind === "gym_exercise" || b.kind === "strength_sets");
  const withCatalog = blocks.filter((b) => Boolean(b.gymRx?.catalogExerciseId));

  if (!blocks.length) {
    return (
      <p className="text-sm text-amber-200/90">
        Nessuna scheda palestra nel contratto (manca <code className="text-amber-100/80">gymRx</code>). Rigenera dal Builder
        o ripubblica il piano VIRYA gym.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {withCatalog.length > 0 ? (
        <p className="font-mono text-[0.65rem] text-fuchsia-200/80">
          {withCatalog.length} esercizi catalogo · {contract.sessionName?.trim() || contract.discipline || "Gym"}
        </p>
      ) : (
        <p className="text-xs text-amber-200/90">
          Seduta gym senza legame catalogo (immagini non disponibili). Ripubblica da VIRYA o rigenera nel Builder.
        </p>
      )}
      <ul className={compact ? "flex flex-col gap-2" : "flex flex-col gap-4"}>
        {blocks.map((block, idx) => (
          <li
            key={block.id || `gym-block-${idx}`}
            className={
              compact
                ? "rounded-xl border border-fuchsia-500/25 bg-fuchsia-950/15 p-3 text-sm text-gray-200"
                : "rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/25 via-violet-950/15 to-black/40 p-4 text-sm text-gray-200 shadow-inner shadow-fuchsia-950/20"
            }
          >
            <div className="flex flex-wrap gap-4">
              <GymExerciseMediaThumb
                catalogExerciseId={block.gymRx?.catalogExerciseId ?? null}
                alt={block.label}
                fallbackLabel={block.label}
                className={
                  compact
                    ? "h-16 w-16 shrink-0 rounded-lg border border-fuchsia-500/25 object-cover"
                    : "h-24 w-24 shrink-0 rounded-xl border border-fuchsia-500/30 object-cover sm:h-28 sm:w-28"
                }
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-white">
                  {idx + 1}. {block.label}
                </p>
                {block.gymRx ? (
                  <>
                    <p className="mt-2 font-mono text-sm text-orange-200/95">{gymRxLine(block.gymRx)}</p>
                    {block.intensityCue ? (
                      <p className="mt-1 text-xs text-violet-200/75">{block.intensityCue}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">{block.intensityCue ?? block.notes ?? block.target ?? "—"}</p>
                )}
                {block.notes && block.gymRx ? (
                  <p className="mt-2 text-[0.65rem] text-slate-500">{block.notes}</p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
