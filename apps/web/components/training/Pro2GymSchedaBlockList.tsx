"use client";

import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { GymExerciseMediaThumb } from "@/components/training/GymExerciseMediaThumb";

export function Pro2GymSchedaBlockList({
  contract,
  compact = false,
}: {
  contract: Pro2BuilderSessionContract;
  compact?: boolean;
}) {
  const blocks = (contract.blocks ?? []).filter((b) => b.gymRx || b.kind === "gym_exercise" || b.kind === "strength_sets");
  if (!blocks.length) {
    return (
      <p className="text-sm text-amber-200/90">
        Nessuna scheda palestra nel contratto (manca <code className="text-amber-100/80">gymRx</code>). Rigenera dal Builder
        o ripubblica il piano VIRYA gym.
      </p>
    );
  }
  return (
    <ul className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      {blocks.map((block, idx) => (
        <li
          key={block.id || `gym-block-${idx}`}
          className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-950/15 p-3 text-sm text-gray-200"
        >
          <div className="flex flex-wrap gap-3">
            {block.gymRx?.catalogExerciseId ? (
              <GymExerciseMediaThumb
                catalogExerciseId={block.gymRx.catalogExerciseId}
                alt={block.label}
                fallbackLabel={block.label}
                className={
                  compact
                    ? "h-14 w-14 shrink-0 rounded-lg border border-fuchsia-500/25 object-cover"
                    : "h-20 w-20 shrink-0 rounded-lg border border-fuchsia-500/25 object-cover"
                }
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white">
                {idx + 1}. {block.label}
              </p>
              {block.gymRx ? (
                <p className="mt-1.5 font-mono text-xs text-orange-200/90">
                  {block.gymRx.sets != null ? `${block.gymRx.sets}×` : ""}
                  {block.gymRx.reps ? ` ${block.gymRx.reps}` : ""}
                  {block.gymRx.weightKg != null && block.gymRx.weightKg > 0 ? ` · ${block.gymRx.weightKg} kg` : ""}
                  {block.gymRx.executionStyle ? ` · ${block.gymRx.executionStyle}` : ""}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">{block.intensityCue ?? block.notes ?? "—"}</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
