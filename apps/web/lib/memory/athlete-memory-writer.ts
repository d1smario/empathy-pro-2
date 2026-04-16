import type {
  AthleteEvidenceMemoryItem,
  AthleteHealthMemory,
  AthleteIdentityMemory,
  AthleteKnowledgeMemory,
  AthleteMemory,
  AthleteMemoryPatchSource,
  AthleteNutritionMemory,
  AthleteRealityMemory,
} from "@/lib/empathy/schemas";
import type { AthleteProfile, PhysiologyState, TwinState } from "@/lib/empathy/schemas";

export type AthleteMemoryPatch = {
  identity?: Partial<AthleteIdentityMemory>;
  profile?: AthleteProfile | null;
  physiology?: PhysiologyState | null;
  nutrition?: Partial<AthleteNutritionMemory>;
  health?: Partial<AthleteHealthMemory>;
  twin?: TwinState | null;
  reality?: Partial<AthleteRealityMemory>;
  evidenceItems?: AthleteEvidenceMemoryItem[];
  knowledge?: AthleteKnowledgeMemory;
  source: AthleteMemoryPatchSource;
};

function mergeRecord<T extends Record<string, unknown> | null | undefined>(
  current: T,
  patch: T,
): T {
  if (!current && !patch) return (null as T);
  return {
    ...(current ?? {}),
    ...(patch ?? {}),
  } as T;
}

export function applyAthleteMemoryPatch(
  memory: AthleteMemory,
  patch: AthleteMemoryPatch,
): AthleteMemory {
  return {
    ...memory,
    identity: patch.identity
      ? {
          ...memory.identity,
          ...patch.identity,
          coachUserIds: patch.identity.coachUserIds ?? memory.identity.coachUserIds,
        }
      : memory.identity,
    profile: patch.profile === undefined ? memory.profile : patch.profile,
    physiology: patch.physiology === undefined ? memory.physiology : patch.physiology,
    nutrition: patch.nutrition
      ? {
          ...memory.nutrition,
          ...patch.nutrition,
          profileConfig: mergeRecord(memory.nutrition.profileConfig, patch.nutrition.profileConfig),
          fuelingConfig: mergeRecord(memory.nutrition.fuelingConfig, patch.nutrition.fuelingConfig),
          diary: patch.nutrition.diary ?? memory.nutrition.diary,
        }
      : memory.nutrition,
    health: patch.health
      ? {
          ...memory.health,
          ...patch.health,
          blood: mergeRecord(memory.health.blood, patch.health.blood),
          microbiota: mergeRecord(memory.health.microbiota, patch.health.microbiota),
          epigenetics: mergeRecord(memory.health.epigenetics, patch.health.epigenetics),
          panels: patch.health.panels ?? memory.health.panels,
          systemicModulationSnapshots:
            patch.health.systemicModulationSnapshots ?? memory.health.systemicModulationSnapshots,
        }
      : memory.health,
    twin: patch.twin === undefined ? memory.twin : patch.twin,
    reality: patch.reality
      ? {
          ...memory.reality,
          ...patch.reality,
          recentIngestions: patch.reality.recentIngestions ?? memory.reality.recentIngestions,
        }
      : memory.reality,
    evidenceMemory: patch.evidenceItems
      ? {
          items: patch.evidenceItems,
        }
      : memory.evidenceMemory,
    knowledge: patch.knowledge ?? memory.knowledge,
    audit: {
      computedAt: patch.source.updatedAt,
      sources: [...memory.audit.sources, patch.source],
    },
  };
}
