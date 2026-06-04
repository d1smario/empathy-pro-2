import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";
import { intensityScore } from "@/lib/training/builder/pro2-intensity";
import {
  BUILDER_SESSION_JSON_TAG,
  type Pro2BuilderBlockContract,
  type Pro2BuilderSessionContract,
} from "@/lib/training/builder/pro2-session-contract";
import type { Pro2SessionMultilevelSource } from "@/lib/training/session-multilevel-analysis-strip";
import { pro2BuilderContractToExpandedChartSegments } from "@/lib/training/builder/pro2-contract-chart-segments";
import { estimateTssFromSegments } from "@/lib/training/builder/tss-estimate";
import { resolvePlannedSessionMetrics } from "@/lib/training/physiology/planned-session-metrics";

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

/** Segmenti per `SessionBlockIntensityChart` — espansione lavoro/recupero come export ZWO (non un barra per blocco logico). */
export function pro2BuilderContractToChartSegments(contract: Pro2BuilderSessionContract): ChartSegment[] {
  return pro2BuilderContractToExpandedChartSegments(contract);
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

/** Contratto builder da riga calendario: campo arricchito dal modulo, altrimenti parse da `notes`. */
export function resolveBuilderSessionForPlannedRow(input: {
  builderSession?: Pro2BuilderSessionContract | null;
  notes?: string | null;
}): Pro2BuilderSessionContract | null {
  if (input.builderSession) return input.builderSession;
  return parsePro2BuilderSessionFromNotes(input.notes ?? null);
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
  /** FTP memoria fisiologica atleta attivo — obbligatoria per kcal corrette su meal plan. */
  athleteFtpWatts?: number | null;
}): { durationMinutes: number; tss: number; kcal: number } {
  const m = resolvePlannedSessionMetrics({
    contract: input.builderSession ?? null,
    durationMinutesDb: input.durationMinutesDb,
    tssTargetDb: input.tssTargetDb,
    kcalTargetDb: input.kcalTargetDb,
    athleteFtpWatts: input.athleteFtpWatts,
  });
  return { durationMinutes: m.durationMinutes, tss: m.tss, kcal: m.kcal };
}
