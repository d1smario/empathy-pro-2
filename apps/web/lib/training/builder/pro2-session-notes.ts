import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";
import { intensityScore } from "@/lib/training/builder/pro2-intensity";
import {
  BUILDER_SESSION_JSON_TAG,
  type Pro2BuilderBlockContract,
  type Pro2BuilderSessionContract,
} from "@/lib/training/builder/pro2-session-contract";
import type { Pro2SessionMultilevelSource } from "@/lib/training/session-multilevel-analysis-strip";
import { estimateTssFromSegments } from "@/lib/training/builder/tss-estimate";

/**
 * Estrae il contratto Pro 2 serializzato in `notes` (stesso tag URI-encoded di V1).
 * Il tipo include campi opzionali V1-compat (`sessionKnowledge`, `structure`) se presenti nel JSON.
 */
function collectBuilderJsonSegments(line: string): string[] {
  const t = line.trim();
  if (!t) return [];
  /** Virya (legacy) univa testo + JSON con ` | ` su una sola riga: ogni segmento può essere una riga JSON canonica. */
  return t
    .split(/\s*\|\s*/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith(BUILDER_SESSION_JSON_TAG));
}

export function parsePro2BuilderSessionFromNotes(notes: string | null | undefined): Pro2SessionMultilevelSource | null {
  if (!notes?.trim()) return null;
  const candidates: string[] = [];
  for (const line of notes.split(/\r?\n/)) {
    candidates.push(...collectBuilderJsonSegments(line));
  }
  for (const t of candidates) {
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

/**
 * Zona per UI / TSS da un blocco contratto: corregge JSON legacy (es. warm-up con `chart.intensity` = Z4)
 * usando l’etichetta blocco + prima zona canonica in `intensityCue`.
 */
export function intensityLabelForContractBlock(b: Pro2BuilderBlockContract): string {
  const lbl = (b.label ?? "").toLowerCase();
  if (/\bwarm-up\b|riscaldamento|\bwarm\b/i.test(lbl) && !/cool/.test(lbl)) return "Z1";
  if (/\bcool-down\b|defaticamento|\bcool\b/i.test(lbl)) return "Z2";

  const ch0 = (b.chart?.intensity ?? "").trim();
  if (ch0) {
    const canon = ch0.match(/\b(Z[1-7]|LT1|LT2|FatMax)\b/i);
    if (canon) return /^fatmax$/i.test(canon[1]!) ? "FatMax" : canon[1]!.toUpperCase();
  }
  const cue = (b.intensityCue ?? "").trim();
  const m = cue.match(/\b(Z[1-7]|LT1|LT2|FatMax)\b/i);
  if (m) return /^fatmax$/i.test(m[1]!) ? "FatMax" : m[1]!.toUpperCase();
  return "Z3";
}

/** Segmenti per `SessionBlockIntensityChart` da blocchi con `chart` o solo `durationMinutes`. */
export function pro2BuilderContractToChartSegments(contract: Pro2BuilderSessionContract): ChartSegment[] {
  const blocks = contract.blocks ?? [];
  let order = 1;
  const out: ChartSegment[] = [];
  for (const b of blocks) {
    const ch = b.chart;
    const dm = Number(b.durationMinutes);
    let durationSeconds: number;
    if (Number.isFinite(dm) && dm > 0) {
      durationSeconds = Math.max(30, Math.round(dm * 60));
    } else if (ch) {
      const min = Math.max(0, ch.minutes || 0) + Math.max(0, Math.min(59, ch.seconds || 0)) / 60;
      durationSeconds = min > 0 ? Math.max(30, Math.round(min * 60)) : Math.max(60, Math.round(Math.max(0.25, 1) * 60));
    } else {
      durationSeconds = Math.max(60, Math.round(Math.max(0.25, b.durationMinutes || 1) * 60));
    }
    const intensity = intensityLabelForContractBlock(b);
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
  const blocks = contract.blocks ?? [];
  if (blocks.length > 0) {
    const segs = pro2BuilderContractToChartSegments(contract);
    if (segs.length > 0) {
      const fromSegments = estimateTssFromSegments(segs);
      if (fromSegments > 0) return Math.round(fromSegments);
    }
  }
  const fromSummary = contract.summary?.tss;
  if (typeof fromSummary === "number" && Number.isFinite(fromSummary) && fromSummary > 0) return Math.round(fromSummary);
  return 0;
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
