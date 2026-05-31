import {
  getMultiscaleNode,
  metabolicLevelLabelIt,
  MULTISCALE_ONTOLOGY_VERSION,
} from "@empathy/domain-knowledge";
import type {
  NutrientInterrogationItem,
  NutrientInterrogationSubDomain,
  NutrientInterrogationViewModel,
} from "@/api/nutrition/contracts";
import type { HealthLabPathwayBridgeResult } from "@/lib/nutrition/health-lab-pathway-bridge";
import type { HealthPanelModulatorBridgeResult } from "@/lib/nutrition/health-panel-modulator-bridge";
import type { MultiscalePathwayBridgeResult } from "@/lib/nutrition/multiscale-pathway-bridge";
import type { ActiveNutrientTarget } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";
import { preferredSlotsLabelIt } from "@/lib/nutrition/pathway-absorption-hints";
import type { NutritionPathwayModulationViewModel } from "@/api/nutrition/contracts";

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function nodesForNutrient(
  nutrientId: string,
  subgraphNodeIds: string[],
): NutrientInterrogationItem["activatedNodes"] {
  const out: NutrientInterrogationItem["activatedNodes"] = [];
  for (const id of subgraphNodeIds) {
    const node = getMultiscaleNode(id);
    if (!node) continue;
    const tags = node.cofactorNutrientTags ?? [];
    const linked =
      tags.some((t) => nutrientTagMatchesTarget(nutrientId, t)) ||
      (nutrientId === "thiamineB1_mg" && id === "enzyme.pdh");
    if (linked) {
      out.push({ id: node.id, labelIt: node.labelIt, kind: node.kind });
    }
  }
  return out.slice(0, 6);
}

function nutrientTagMatchesTarget(nutrientId: string, tag: string): boolean {
  if (nutrientId === "thiamineB1_mg" && (tag === "thiamine" || tag === "b_vitamins")) return true;
  if (nutrientId === "niacinB3_mg" && tag === "b_vitamins") return true;
  if (nutrientId === "riboflavinB2_mg" && tag === "b_vitamins") return true;
  if (nutrientId === "mg_mg" && tag === "magnesium") return true;
  if (nutrientId === "fe_mg" && tag === "iron") return true;
  if (nutrientId === "vitC_mg" && tag === "vitamin_c") return true;
  if (nutrientId === "zn_mg" && tag === "zinc") return true;
  if (nutrientId === "omega3G" && tag === "omega3_context") return true;
  if (nutrientId === "folate_mcg" && tag === "folate_context") return true;
  if (nutrientId === "vitB12_mcg" && tag === "b12_context") return true;
  if (nutrientId === "se_mcg" && tag === "selenium") return true;
  return false;
}

function geneSymbolsForNodes(nodeIds: string[]): string[] {
  const symbols = new Set<string>();
  for (const id of nodeIds) {
    getMultiscaleNode(id)?.symbols?.forEach((s) => symbols.add(s));
  }
  return [...symbols].slice(0, 8);
}

function signallingAxesForNodes(nodeIds: string[]): string[] {
  return nodeIds
    .map((id) => getMultiscaleNode(id))
    .filter((n) => n?.kind === "signalling_axis")
    .map((n) => n!.labelIt)
    .slice(0, 4);
}

export type BuildNutrientInterrogationInput = {
  activeTargets: ActiveNutrientTarget[];
  multiscaleBridge: MultiscalePathwayBridgeResult | null;
  healthLabBridge?: HealthLabPathwayBridgeResult | null;
  healthPanelModulators?: HealthPanelModulatorBridgeResult | null;
  pathwayModulation?: NutritionPathwayModulationViewModel | null;
};

/**
 * Drill-down per nutriente attivo: geni, assi, modulatori Health, sub-domini.
 * Interpretation layer — non modifica solver kcal/macro.
 */
export function buildNutrientInterrogationViewModel(
  input: BuildNutrientInterrogationInput,
): NutrientInterrogationViewModel | null {
  if (!input.activeTargets.length) return null;

  const multiscale = input.multiscaleBridge;
  const panel = input.healthPanelModulators;
  const lab = input.healthLabBridge;

  const items: NutrientInterrogationItem[] = input.activeTargets.map((target) => {
    const activatedNodes = multiscale
      ? nodesForNutrient(target.nutrientId, multiscale.subgraphNodeIds)
      : [];
    const nodeIds = activatedNodes.map((n) => n.id);
    const subDomains = new Set<NutrientInterrogationSubDomain>(["enzyme_flux"]);

    if (nodeIds.some((id) => getMultiscaleNode(id)?.kind === "gene_cluster")) {
      subDomains.add("nutrigenomics");
    }
    if (nodeIds.some((id) => getMultiscaleNode(id)?.kind === "endocrine_cascade" || id.startsWith("cascade."))) {
      subDomains.add("neuroendocrine");
    }
    if (nodeIds.some((id) => id.startsWith("microbiota."))) {
      subDomains.add("microbiota");
    }

    for (const sig of panel?.signals ?? []) {
      if (sig.nutrientHints.some((h) => h.toLowerCase().includes(target.labelIt.split(" ")[0]!.toLowerCase()))) {
        subDomains.add(sig.subDomain);
      }
    }

    const healthLabSignals =
      lab?.markerSignals
        .filter((m) => {
          if (target.nutrientId === "fe_mg" && (m.marker === "ferritina" || m.marker === "emoglobina")) return true;
          if (target.nutrientId === "vitD_mcg" && m.marker === "vit_d") return true;
          if (target.nutrientId === "vitB12_mcg" && m.marker === "b12") return true;
          if (target.nutrientId === "folate_mcg" && (m.marker === "b12" || m.marker === "homocysteine")) return true;
          if (target.nutrientId === "vitB6_mg" && m.marker === "homocysteine") return true;
          if (target.nutrientId === "vitC_mg" && m.marker === "crp_mg_l") return true;
          return false;
        })
        .map((m) => `${m.marker}:${m.status}:${m.value}`) ?? [];

    if (healthLabSignals.length) subDomains.add("health_lab");

    const rationaleParts: string[] = [];
    if (activatedNodes.length) {
      rationaleParts.push(
        `Nodi ontology: ${activatedNodes.map((n) => n.labelIt).slice(0, 3).join(" · ")}.`,
      );
    }
    if (target.sourceText) rationaleParts.push(`Provenienza: ${target.sourceText.slice(0, 100)}.`);

    return {
      nutrientId: target.nutrientId,
      labelIt: target.labelIt,
      activatedNodes,
      geneSymbols: geneSymbolsForNodes(nodeIds),
      signallingAxes: signallingAxesForNodes(nodeIds),
      healthLabSignals,
      preferredSlotsIt: preferredSlotsLabelIt(target.nutrientId, input.pathwayModulation),
      subDomains: [...subDomains],
      rationaleIt: rationaleParts.join(" ") || "Target attivo da pathway modulation.",
    };
  });

  const notes: string[] = [];
  if (multiscale) {
    notes.push(
      `Collo dominante: ${metabolicLevelLabelIt(multiscale.bottleneck.dominantBottleneck.level)}.`,
    );
    notes.push(...multiscale.notes.slice(0, 2));
  }
  if (panel?.notes.length) notes.push(...panel.notes.slice(0, 2));

  return {
    schemaVersion: 1,
    ontologyVersion: MULTISCALE_ONTOLOGY_VERSION,
    dominantBottleneckLevelIt: multiscale
      ? metabolicLevelLabelIt(multiscale.bottleneck.dominantBottleneck.level)
      : "—",
    items,
    notes: uniq(notes),
  };
}
