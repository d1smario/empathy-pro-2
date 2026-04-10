import type {
  MetabolicBottleneckView,
  MultiscaleEdge,
  MultiscaleNode,
  MultiscaleSignalSnapshot,
} from "@empathy/domain-knowledge";

export type MultiscaleBottleneckApiOk = {
  ok: true;
  athleteId: string;
  snapshot: MultiscaleSignalSnapshot;
  bottleneck: MetabolicBottleneckView;
  dominantLevelLabelIt: string;
  subgraph?: { nodes: MultiscaleNode[]; edges: MultiscaleEdge[] };
};
