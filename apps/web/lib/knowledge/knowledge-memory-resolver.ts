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

export async function resolveAthleteKnowledgeMemory(
  athleteId: string,
  options?: { limit?: number },
): Promise<AthleteKnowledgeMemory> {
  const boundedLimit = Math.max(1, Math.min(48, Math.trunc(options?.limit ?? 48) || 48));
  try {
    const [bindings, activeModulations, recentSessionPackets] = await Promise.all([
      listAthleteKnowledgeBindings(athleteId, boundedLimit),
      listKnowledgeModulationSnapshots(athleteId, boundedLimit),
      listSessionKnowledgePackets(athleteId, boundedLimit),
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
