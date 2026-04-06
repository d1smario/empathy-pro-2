import type { AthleteKnowledgeMemory } from "@/lib/empathy/schemas";
import { isMissingKnowledgeFoundationError } from "@/lib/knowledge/knowledge-foundation";
import {
  listAthleteKnowledgeBindings,
  listKnowledgeModulationSnapshots,
  listSessionKnowledgePackets,
} from "@/lib/knowledge/knowledge-library-store";

export function createEmptyAthleteKnowledgeMemory(): AthleteKnowledgeMemory {
  return {
    bindings: [],
    activeModulations: [],
    recentSessionPackets: [],
  };
}

export async function resolveAthleteKnowledgeMemory(athleteId: string): Promise<AthleteKnowledgeMemory> {
  try {
    const [bindings, activeModulations, recentSessionPackets] = await Promise.all([
      listAthleteKnowledgeBindings(athleteId),
      listKnowledgeModulationSnapshots(athleteId),
      listSessionKnowledgePackets(athleteId),
    ]);

    return {
      bindings,
      activeModulations,
      recentSessionPackets,
    };
  } catch (error) {
    if (isMissingKnowledgeFoundationError(error)) {
      return createEmptyAthleteKnowledgeMemory();
    }
    throw error;
  }
}
