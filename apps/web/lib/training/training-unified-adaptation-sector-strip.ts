import type { AdaptationSectorBoxVm, AdaptationSectorPillVm } from "@/lib/adaptation/adaptation-sector-box";
import type {
  SessionAnalysisFacetCategory,
  SessionMultilevelAnalysisStripViewModel,
  SessionMultilevelStripSlotViewModel,
  TrainingTwinContextStripViewModel,
} from "@/api/training/contracts";

const LEVEL_ORDER: { key: "biochemical" | "genetic" | "hormonal" | "neurologic" | "microbiota"; short: string; cats: SessionAnalysisFacetCategory[] }[] = [
  { key: "biochemical", short: "Biochimico", cats: ["bioenergetics", "oxygen_hypoxia", "glycolysis", "muscle_cellular"] },
  { key: "genetic", short: "Genetico", cats: ["genetic_regulation"] },
  { key: "hormonal", short: "Ormonale", cats: ["endocrine_stress", "endocrine_growth"] },
  { key: "neurologic", short: "Neuro", cats: ["neuro_adrenergic"] },
  { key: "microbiota", short: "Microbiota", cats: ["microbiota_gut"] },
];

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function slotMap(slots: SessionMultilevelStripSlotViewModel[]): Map<SessionAnalysisFacetCategory, SessionMultilevelStripSlotViewModel> {
  return new Map(slots.map((s) => [s.category, s]));
}

function activeSlots(m: Map<SessionAnalysisFacetCategory, SessionMultilevelStripSlotViewModel>, cats: SessionAnalysisFacetCategory[]) {
  return cats
    .map((c) => m.get(c))
    .filter((s): s is SessionMultilevelStripSlotViewModel => Boolean(s && s.valueLineIt && s.valueLineIt !== "—"));
}

function forwardPillsFromSlots(slots: SessionMultilevelStripSlotViewModel[], prefix: string): AdaptationSectorPillVm[] {
  const out: AdaptationSectorPillVm[] = [];
  for (let i = 0; i < Math.min(2, slots.length); i += 1) {
    const s = slots[i]!;
    const text = clip(`${s.shortLabelIt}: ${s.valueLineIt}`, 58);
    out.push({ id: `${prefix}_fwd_${s.facetId}`, text, direction: "forward" });
  }
  return out;
}

function twinReverseForTraining(
  level: "stimulus" | "biochemical" | "genetic" | "hormonal" | "neurologic" | "microbiota",
  twin: TrainingTwinContextStripViewModel | null,
): AdaptationSectorPillVm[] {
  if (!twin) return [];
  const out: AdaptationSectorPillVm[] = [];
  const push = (id: string, text: string) => {
    out.push({ id, text: clip(text, 58), direction: "reverse" });
  };
  const r = twin.readiness;
  const g = twin.glycogenStatus;
  const f = twin.fatigueAcute;
  const a = twin.adaptationScore;

  if (level === "stimulus") {
    if (typeof r === "number" && r < 46) push("tr_rev_stim_read", "Readiness bassa: scala prudenza sullo stimolo pianificato.");
    else if (typeof f === "number" && f >= 72) push("tr_rev_stim_fat", "Fatigue acuta alta: il twin suggerisce protezione sul carico.");
  }
  if (level === "biochemical") {
    if (typeof g === "number" && g < 44) push("tr_rev_bio_gly", "Glicogeno twin basso: via substrato più sensibile a CHO timing.");
  }
  if (level === "hormonal" || level === "neurologic") {
    if (typeof f === "number" && f >= 65) push(`tr_rev_${level}_fat`, "Asse stress/recupero: fatigue elevata modula risposta ormonale attesa.");
    if (typeof r === "number" && r < 50 && level === "neurologic") push("tr_rev_neu_read", "Drive autonomico: readiness bassa vs stimolo simpatico.");
  }
  if (level === "genetic") {
    if (typeof a === "number" && a >= 70) push("tr_rev_gen_adapt", "Adattamento consolidato: contesto favorevole a segnali di regolazione.");
  }
  if (level === "microbiota") {
    if (typeof g === "number" && g < 40) push("tr_rev_micro_fuel", "Stress fueling cumulato: coerenza gastro prima di peri-intensa.");
  }
  return out.slice(0, 2);
}

/**
 * Sei settori allineati a nutrizione/bioenergetica: aggrega facet sessione deterministici + pillole twin (contesto).
 */
export function buildTrainingUnifiedAdaptationSectorBoxes(
  vm: SessionMultilevelAnalysisStripViewModel | null,
  twin: TrainingTwinContextStripViewModel | null,
  sessionStimulusLine: string | null,
): AdaptationSectorBoxVm[] {
  const stim = sessionStimulusLine?.trim();
  const slots = vm?.stripSlots ?? [];
  const m = slotMap(slots);

  const stimForward: AdaptationSectorPillVm[] = vm
    ? vm.facets.slice(0, 2).map((f, i) => ({
        id: `tr_stim_facet_${i}`,
        text: clip(`${f.categoryLabelIt}: ${f.pillLabelIt}`, 58),
        direction: "forward" as const,
      }))
    : [];
  const stimPills = [...stimForward, ...twinReverseForTraining("stimulus", twin)];
  const stimBox: AdaptationSectorBoxVm = {
    id: "tr_stimulus",
    shortLabel: "Stimolo",
    valueLine: stim ? clip(stim, 40) : "—",
    detailLine:
      stim ??
      "Nessun contratto builder sulla giornata: stimolo operativo non strutturato per facet multilivello.",
    ...(stimPills.length ? { pills: stimPills } : {}),
  };

  if (!vm) {
    return [
      stimBox,
      ...LEVEL_ORDER.map((row) => ({
        id: `tr_empty_${row.key}`,
        shortLabel: row.short,
        valueLine: "—",
        detailLine: "Facet sessione non disponibili (manca contratto builder).",
        pills: twinReverseForTraining(row.key, twin),
      })),
    ];
  }

  const levelBoxes = LEVEL_ORDER.map((row) => {
    const act = activeSlots(m, row.cats);
    const primary = act[0];
    const valueLine = primary ? clip(act.map((x) => x.valueLineIt).join(" · "), 40) : "—";
    const detailLine = act.length
      ? act.map((x) => `${x.shortLabelIt}: ${x.detailHintIt}`).join("\n\n")
      : "Nessun segnale strutturato per questo settore su questa sessione.";
    const pills = [...forwardPillsFromSlots(act, `tr_${row.key}`), ...twinReverseForTraining(row.key, twin)];
    return {
      id: `tr_${row.key}`,
      shortLabel: row.short,
      valueLine,
      detailLine,
      ...(pills.length ? { pills } : {}),
    };
  });

  return [stimBox, ...levelBoxes];
}
