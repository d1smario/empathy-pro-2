import {
  computeMetabolicBottleneckView,
  getMultiscaleNode,
  metabolicLevelLabelIt,
  multiscaleSubgraphForNodes,
  type MetabolicBottleneckView,
} from "@empathy/domain-knowledge";
import type { NutritionPathwaySupportItem, NutritionPathwaySystemLevel } from "@/api/nutrition/contracts";
import type { PhysiologyState } from "@/lib/empathy/schemas/physiology";
import type { TwinState } from "@/lib/empathy/schemas/twin";
import { buildMultiscaleSignalSnapshotFromAthlete } from "@/lib/knowledge/multiscale-signal-from-state";
import { resolveMultiscaleTagsToCofactorStrings } from "@/lib/nutrition/multiscale-nutrient-tag-resolver";

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
}

function systemLevelsForNodeKinds(kinds: Set<string>): NutritionPathwaySystemLevel[] {
  const levels = new Set<NutritionPathwaySystemLevel>();
  if (kinds.has("enzyme") || kinds.has("scale_anchor")) levels.add("biochemical");
  if (kinds.has("gene_cluster")) levels.add("genetic");
  if (kinds.has("endocrine_cascade")) levels.add("hormonal");
  if (kinds.has("neuro_tag")) levels.add("neurologic");
  if (kinds.has("microbiota_function")) levels.add("microbiota");
  if (kinds.has("signalling_axis")) levels.add("biochemical");
  if (!levels.size) levels.add("biochemical");
  return [...levels];
}

export type MultiscalePathwayBridgeResult = {
  cofactorStrings: string[];
  bottleneck: MetabolicBottleneckView;
  activatedNodeIds: string[];
  activatedEnzymeIds: string[];
  subgraphNodeIds: string[];
  pathwayExtension: NutritionPathwaySupportItem | null;
  notes: string[];
};

/**
 * Bridge deterministico ontology multiscala → cofactor pathway / meal plan.
 * Puro, sincrono, zero I/O: usa physiology + twin già risolti in slice nutrition.
 */
export function buildMultiscalePathwayBridge(input: {
  physiology: PhysiologyState | null | undefined;
  twin: TwinState | null | undefined;
}): MultiscalePathwayBridgeResult | null {
  if (!input.physiology) return null;

  const snapshot = buildMultiscaleSignalSnapshotFromAthlete(input.physiology, input.twin);
  const bottleneck = computeMetabolicBottleneckView(snapshot);
  const subgraph = multiscaleSubgraphForNodes(bottleneck.activatedNodeIds, { includeOneHop: true });

  const tagSet = new Set<string>();
  const nodeKinds = new Set<string>();
  for (const node of subgraph.nodes) {
    nodeKinds.add(node.kind);
    node.cofactorNutrientTags?.forEach((t) => tagSet.add(t));
  }

  // Collo L1/L2 o stress glicogeno → enzyme flux (PDH/B1 via ontology)
  const glyLow =
    snapshot.glycogenStatus != null &&
    Number.isFinite(snapshot.glycogenStatus) &&
    snapshot.glycogenStatus < 42;
  const extraEnzymeIds: string[] = [];
  if (bottleneck.dominantBottleneck.level <= 2 || glyLow) {
    for (const enzymeId of ["enzyme.pdh", "enzyme.pfk"] as const) {
      getMultiscaleNode(enzymeId)?.cofactorNutrientTags?.forEach((t) => tagSet.add(t));
      extraEnzymeIds.push(enzymeId);
    }
  }

  const cofactorStrings = resolveMultiscaleTagsToCofactorStrings([...tagSet]);
  const subgraphNodeIds = uniq([...subgraph.nodes.map((n) => n.id), ...extraEnzymeIds]);
  const activatedEnzymeIds = uniq([
    ...extraEnzymeIds,
    ...bottleneck.activatedNodeIds.filter((id) => id.startsWith("enzyme.")),
  ]);
  const notes: string[] = [
    `Multiscala: collo dominante ${metabolicLevelLabelIt(bottleneck.dominantBottleneck.level)} (score ${Math.round(bottleneck.dominantBottleneck.score * 100)}%).`,
    `${bottleneck.activatedNodeIds.length} nodi attivi · ${subgraph.nodes.length} nel sottografo interpretativo.`,
  ];

  if (!cofactorStrings.length) {
    return {
      cofactorStrings: [],
      bottleneck,
      activatedNodeIds: bottleneck.activatedNodeIds,
      activatedEnzymeIds,
      subgraphNodeIds,
      pathwayExtension: null,
      notes,
    };
  }

  const stimulatedBy = uniq([
    ...bottleneck.activatedNodeIds.slice(0, 8),
    ...extraEnzymeIds,
    ...bottleneck.suggestedInterpretationTags.slice(0, 4),
  ]);

  const pathwayExtension: NutritionPathwaySupportItem = {
    id: "multiscale_ontology_cofactor_support",
    pathwayLabel: "Supporto cofattori · ontology multiscala (L1–L6)",
    stimulatedBy,
    substrates: bottleneck.dominantBottleneck.level <= 1 ? ["Timing CHO peri-stimolo / recovery early"] : [],
    cofactors: cofactorStrings,
    inhibitorsToAvoid: [],
    phases: [
      {
        phase: "daily_support",
        windowLabel: "Asse giornaliero · modulatori da nodi attivi",
        halfLifeClass: "circadian",
        actions: [
          "Distribuire cofattori su pasti regolari secondo tolleranza GI.",
          "Non sostituisce integrazione medica né motori fisiologici.",
        ],
      },
    ],
    systemLevels: systemLevelsForNodeKinds(nodeKinds),
    confidence: "engine_derived",
  };

  return {
    cofactorStrings,
    bottleneck,
    activatedNodeIds: bottleneck.activatedNodeIds,
    activatedEnzymeIds,
    subgraphNodeIds,
    pathwayExtension,
    notes,
  };
}
