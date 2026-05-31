import type { AthleteHealthMemory } from "@/lib/empathy/schemas/memory";
import type { NutrientInterrogationSubDomain } from "@/api/nutrition/contracts";

export type HealthPanelModulatorSignal = {
  subDomain: NutrientInterrogationSubDomain;
  source: string;
  summaryIt: string;
  nutrientHints: string[];
};

export type HealthPanelModulatorBridgeResult = {
  signals: HealthPanelModulatorSignal[];
  subDomainsActive: NutrientInterrogationSubDomain[];
  notes: string[];
};

function hasRows(rows: unknown): boolean {
  return Array.isArray(rows) && rows.length > 0;
}

function recordKeys(obj: Record<string, unknown> | null | undefined): string[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.keys(obj).filter((k) => k !== "id" && k !== "athleteId");
}

/**
 * Bridge Health panels (microbiota, epigenetics, hormones, L8 snapshots) → sub-domini interrogazione.
 * Puro, sincrono — consuma slice memory nutrition già caricata.
 */
export function buildHealthPanelModulatorBridge(
  health: AthleteHealthMemory | null | undefined,
): HealthPanelModulatorBridgeResult {
  const signals: HealthPanelModulatorSignal[] = [];
  const notes: string[] = [];

  if (!health) {
    return { signals, subDomainsActive: [], notes };
  }

  const norm = health.normalizedObservations;
  if (hasRows(norm?.microbiota) || recordKeys(health.microbiota ?? undefined).length) {
    signals.push({
      subDomain: "microbiota",
      source: hasRows(norm?.microbiota) ? "normalizedObservations.microbiota" : "health.microbiota",
      summaryIt: "Pannello microbiota collegato — contesto barriera / SCFA / assorbimento.",
      nutrientHints: ["Fibre alimentari", "Omega-3 (EPA/DHA)"],
    });
  }

  if (hasRows(norm?.epigenetic) || recordKeys(health.epigenetics ?? undefined).length) {
    signals.push({
      subDomain: "epigenetics",
      source: hasRows(norm?.epigenetic) ? "normalizedObservations.epigenetic" : "health.epigenetics",
      summaryIt: "Surrogati epigenetici presenti — modulatori metilazione in backlog interpretativo.",
      nutrientHints: ["Folati (B9)", "Vitamina B12", "Vitamina B6"],
    });
  }

  if (hasRows(norm?.hormones)) {
    signals.push({
      subDomain: "neuroendocrine",
      source: "normalizedObservations.hormones",
      summaryIt: "Biomarker ormonali strutturati — asse endocrino per timing e tolleranza.",
      nutrientHints: ["Iodio alimentare", "Selenio", "Magnesio (chinasi)"],
    });
  }

  for (const snap of health.systemicModulationSnapshots ?? []) {
    const axes = snap.axes ?? [];
    if (axes.some((a) => /micro|gut|barrier|scfa/i.test(a))) {
      if (!signals.some((s) => s.subDomain === "microbiota")) {
        signals.push({
          subDomain: "microbiota",
          source: `systemic_modulation:${snap.id}`,
          summaryIt: "Snapshot L8 con asse microbiota/barriera.",
          nutrientHints: ["Fibre alimentari"],
        });
      }
    }
    if (axes.some((a) => /hormon|hpa|thyroid|cortisol/i.test(a))) {
      signals.push({
        subDomain: "neuroendocrine",
        source: `systemic_modulation:${snap.id}`,
        summaryIt: "Snapshot L8 con asse endocrino/stress.",
        nutrientHints: ["Magnesio (chinasi)"],
      });
    }
    if (axes.some((a) => /epigen|methyl/i.test(a))) {
      signals.push({
        subDomain: "epigenetics",
        source: `systemic_modulation:${snap.id}`,
        summaryIt: "Snapshot L8 con asse metilazione/epigenetica.",
        nutrientHints: ["Folati (B9)", "Vitamina B12"],
      });
    }
  }

  const subDomainsActive = [...new Set(signals.map((s) => s.subDomain))];
  if (subDomainsActive.length) {
    notes.push(`Health panels: ${subDomainsActive.join(", ")} attivi per interrogazione.`);
  }

  return { signals, subDomainsActive, notes };
}
