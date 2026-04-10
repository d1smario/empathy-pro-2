import { ONTOLOGY_EDGES, ONTOLOGY_NODES, getMultiscaleNode } from "./ontology-data";
import type { MultiscaleEdge, MultiscaleNode } from "./types";

export function listMultiscaleNodes(): MultiscaleNode[] {
  return ONTOLOGY_NODES;
}

export function listMultiscaleEdges(): MultiscaleEdge[] {
  return ONTOLOGY_EDGES;
}

/** Undirected adjacency for interpretation subgraphs. */
export function buildMultiscaleAdjacency(): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!m.has(a)) m.set(a, new Set());
    if (!m.has(b)) m.set(b, new Set());
    m.get(a)!.add(b);
    m.get(b)!.add(a);
  };
  for (const e of ONTOLOGY_EDGES) {
    add(e.subjectId, e.objectId);
  }
  return m;
}

export function multiscaleEdgesIncidentTo(nodeId: string): MultiscaleEdge[] {
  return ONTOLOGY_EDGES.filter((e) => e.subjectId === nodeId || e.objectId === nodeId);
}

/** Nodes + edges induced by activated set (plus 1-hop neighbours optional). */
export function multiscaleSubgraphForNodes(
  activatedIds: string[],
  options?: { includeOneHop: boolean },
): { nodes: MultiscaleNode[]; edges: MultiscaleEdge[] } {
  const includeOneHop = options?.includeOneHop ?? true;
  const ids = new Set(activatedIds);
  if (includeOneHop) {
    const adj = buildMultiscaleAdjacency();
    for (const id of [...ids]) {
      const nbr = adj.get(id);
      if (nbr) nbr.forEach((x) => ids.add(x));
    }
  }
  const nodes = [...ids].map((id) => getMultiscaleNode(id)).filter((n): n is MultiscaleNode => Boolean(n));
  const edges = ONTOLOGY_EDGES.filter((e) => ids.has(e.subjectId) && ids.has(e.objectId));
  return { nodes, edges };
}
