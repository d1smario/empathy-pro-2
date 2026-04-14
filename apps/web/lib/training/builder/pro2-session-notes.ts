import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";
import { intensityScore } from "@/lib/training/builder/pro2-intensity";
import { BUILDER_SESSION_JSON_TAG, type Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import type { Pro2SessionMultilevelSource } from "@/lib/training/session-multilevel-analysis-strip";
import { estimateTssFromSegments } from "@/lib/training/builder/tss-estimate";

/**
 * Estrae il contratto Pro 2 serializzato in `notes` (stesso tag URI-encoded di V1).
 * Il tipo include campi opzionali V1-compat (`sessionKnowledge`, `structure`) se presenti nel JSON.
 */
export function parsePro2BuilderSessionFromNotes(notes: string | null | undefined): Pro2SessionMultilevelSource | null {
  if (!notes?.trim()) return null;
  for (const line of notes.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith(BUILDER_SESSION_JSON_TAG)) continue;
    const payload = t.slice(BUILDER_SESSION_JSON_TAG.length);
    try {
      const json = JSON.parse(decodeURIComponent(payload)) as unknown;
      const c = json as Pro2BuilderSessionContract;
      const sourceOk = c.source === "builder" || c.source === "virya";
      if (json && typeof json === "object" && c.version === 1 && sourceOk && typeof c.discipline === "string")
        return json as Pro2SessionMultilevelSource;
    } catch {
      continue;
    }
  }
  return null;
}

/** Segmenti per `SessionBlockIntensityChart` da blocchi con `chart` o solo `durationMinutes`. */
export function pro2BuilderContractToChartSegments(contract: Pro2BuilderSessionContract): ChartSegment[] {
  const blocks = contract.blocks ?? [];
  let order = 1;
  const out: ChartSegment[] = [];
  for (const b of blocks) {
    const ch = b.chart;
    let durationSeconds = Math.max(60, Math.round(Math.max(0.25, b.durationMinutes || 1) * 60));
    if (ch) {
      const min = Math.max(0, ch.minutes || 0) + Math.max(0, Math.min(59, ch.seconds || 0)) / 60;
      if (min > 0) durationSeconds = Math.max(60, Math.round(min * 60));
    }
    const intensity = ((ch?.intensity ?? "Z3").trim() || "Z3") as string;
    out.push({
      id: b.id,
      order: order++,
      label: b.label,
      durationSeconds,
      intensityLabel: intensity,
      intensityScore: intensityScore(intensity),
    });
  }
  return out;
}

export function estimatedTssFromPro2Contract(contract: Pro2BuilderSessionContract): number {
  const fromSummary = contract.summary?.tss;
  if (typeof fromSummary === "number" && Number.isFinite(fromSummary) && fromSummary > 0) return Math.round(fromSummary);
  return Math.round(estimateTssFromSegments(pro2BuilderContractToChartSegments(contract)));
}

/** Durata display / calendario: preferisci `summary.durationSec` o somma blocchi, non la colonna DB se è stale. */
export function effectiveDurationMinutesFromPro2Contract(
  contract: Pro2BuilderSessionContract | null | undefined,
  fallbackMinutes: number,
): number {
  if (!contract) return Math.max(1, Math.round(fallbackMinutes));
  const sec = contract.summary?.durationSec;
  if (typeof sec === "number" && Number.isFinite(sec) && sec > 0) {
    return Math.max(1, Math.round(sec / 60));
  }
  const fromBlocks = (contract.blocks ?? []).reduce((s, b) => s + (Number(b.durationMinutes) || 0), 0);
  if (fromBlocks > 0) return Math.max(1, Math.round(fromBlocks));
  return Math.max(1, Math.round(fallbackMinutes));
}

export function effectiveTssDisplayFromPro2Contract(
  contract: Pro2BuilderSessionContract | null | undefined,
  fallbackTss: number,
): number {
  if (!contract) return Math.max(0, Math.round(fallbackTss));
  const t = estimatedTssFromPro2Contract(contract);
  return t > 0 ? t : Math.max(0, Math.round(fallbackTss));
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Allinea durata / TSS / kcal del giorno al **contratto builder in notes** quando le colonne
 * `planned_workouts` sono vuote o stale (stesso problema del calendario training).
 * Usato da Nutrizione (meal plan, solver energetico) per non restare su “giorno a riposo” falso.
 */
export function effectivePlannedWorkoutNutritionMetrics(input: {
  durationMinutesDb?: number | null;
  tssTargetDb?: number | null;
  kcalTargetDb?: number | null;
  builderSession?: Pro2BuilderSessionContract | null;
  /** Scala TSS→kcal come negli altri piani manuali Pro 2 (~9.3 kcal/TSS a 70 kg). */
  weightKg?: number | null;
}): { durationMinutes: number; tss: number; kcal: number } {
  const fallbackDur = Math.max(0, asFiniteNumber(input.durationMinutesDb) ?? 0);
  const duration = effectiveDurationMinutesFromPro2Contract(input.builderSession ?? null, fallbackDur);
  const fallbackTss = Math.max(0, asFiniteNumber(input.tssTargetDb) ?? 0);
  const tss = effectiveTssDisplayFromPro2Contract(input.builderSession ?? null, fallbackTss);
  const dbKcal = Math.max(0, asFiniteNumber(input.kcalTargetDb) ?? 0);
  const summaryKcal = asFiniteNumber(input.builderSession?.summary?.kcal);
  let kcal = dbKcal;
  if (summaryKcal != null && summaryKcal > 0) {
    kcal = Math.round(summaryKcal);
  } else if (kcal <= 0 && tss > 0) {
    const w = input.weightKg != null && input.weightKg > 30 ? input.weightKg : 70;
    kcal = Math.round(tss * 9.3 * (w / 70));
  }
  return { durationMinutes: duration, tss, kcal };
}
