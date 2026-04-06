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
