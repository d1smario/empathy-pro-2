import type { AthleteMemory } from "@/lib/empathy/schemas";

export function createEmptyAthleteMemory(athleteId: string): AthleteMemory {
  return {
    athleteId,
    identity: {
      athleteId,
      ownerUserId: null,
      coachUserIds: [],
      roleMode: "unassigned",
    },
    profile: null,
    physiology: null,
    nutrition: {
      constraints: null,
      profileConfig: null,
      fuelingConfig: null,
      diary: [],
    },
    health: {
      blood: null,
      microbiota: null,
      epigenetics: null,
      panels: [],
    },
    twin: null,
    reality: {
      recentIngestions: [],
    },
    evidenceMemory: {
      items: [],
    },
    knowledge: {
      bindings: [],
      activeModulations: [],
      recentSessionPackets: [],
    },
    audit: {
      computedAt: new Date(0).toISOString(),
      sources: [],
    },
  };
}
