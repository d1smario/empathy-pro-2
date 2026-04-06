import type { AdaptationSectorBoxVm } from "@/lib/adaptation/adaptation-sector-box";
import type { NutritionPathwayModulationViewModel, NutritionPathwaySystemLevel } from "@/api/nutrition/contracts";

const LEVEL_ORDER: { key: NutritionPathwaySystemLevel; short: string }[] = [
  { key: "biochemical", short: "Biochimico" },
  { key: "genetic", short: "Genetico" },
  { key: "hormonal", short: "Ormonale" },
  { key: "neurologic", short: "Neuro" },
  { key: "microbiota", short: "Microbiota" },
];

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Striscia settori per giorno nutrizione: stimolo giornata + livelli pathway modulation.
 */
export function buildNutritionAdaptationSectorBoxes(
  mod: NutritionPathwayModulationViewModel | null,
  sessionStimulusLine: string | null,
): AdaptationSectorBoxVm[] {
  const stim = sessionStimulusLine?.trim();
  const stimBox: AdaptationSectorBoxVm = {
    id: "nut_stimulus",
    shortLabel: "Stimolo",
    valueLine: stim ? clip(stim, 40) : "—",
    detailLine:
      stim ??
      "Nessuna sessione pianificata sul giorno selezionato o contract senza descrizione sintetica.",
  };

  if (!mod) {
    return [
      stimBox,
      ...LEVEL_ORDER.map((row) => ({
        id: `nut_empty_${row.key}`,
        shortLabel: row.short,
        valueLine: "—",
        detailLine: "Pathway modulation non calcolabile (manca contesto sessione / fisiologia).",
      })),
    ];
  }

  const levelBoxes = LEVEL_ORDER.map((row) => {
    const lines = mod.multiLevelSummary[row.key] ?? [];
    const primary = lines[0];
    return {
      id: `nut_${row.key}`,
      shortLabel: row.short,
      valueLine: primary ? clip(primary, 40) : "—",
      detailLine: lines.length ? lines.join(" · ") : "Nessun pathway attivo in questo settore per il giorno.",
    };
  });

  return [stimBox, ...levelBoxes];
}
