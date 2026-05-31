export type MemorySlice = "full" | "training" | "nutrition" | "dashboard" | "bioenergetics" | "biomechanics" | "aerodynamics";

export type ResolveAthleteMemorySliceOptions = {
  slice?: MemorySlice;
  skipCache?: boolean;
};

export type MemorySliceQueryFlags = {
  realityIngest: boolean;
  healthPanels: boolean;
  evidenceHits: boolean;
  coachAppTraces: boolean;
  systemicModulation: boolean;
  healthObservations: boolean;
  healthSystemGraph: boolean;
  bioenergeticsResponses: boolean;
  knowledge: boolean;
  foodDiary: boolean;
  nutritionConstraints: boolean;
  trainingArchetypeTraces: boolean;
  biomechAero: boolean;
  includeIngestPayload: boolean;
};

export function getMemorySliceQueryFlags(slice: MemorySlice): MemorySliceQueryFlags {
  switch (slice) {
    case "training":
      return {
        realityIngest: true,
        healthPanels: false,
        evidenceHits: false,
        coachAppTraces: false,
        systemicModulation: false,
        healthObservations: false,
        healthSystemGraph: false,
        bioenergeticsResponses: false,
        knowledge: true,
        foodDiary: false,
        nutritionConstraints: false,
        trainingArchetypeTraces: true,
        biomechAero: false,
        includeIngestPayload: false,
      };
    case "nutrition":
      return {
        realityIngest: false,
        healthPanels: true,
        evidenceHits: false,
        coachAppTraces: false,
        systemicModulation: false,
        healthObservations: false,
        healthSystemGraph: false,
        bioenergeticsResponses: false,
        knowledge: true,
        foodDiary: true,
        nutritionConstraints: true,
        trainingArchetypeTraces: false,
        biomechAero: false,
        includeIngestPayload: false,
      };
    case "dashboard":
      return {
        realityIngest: false,
        healthPanels: false,
        evidenceHits: true,
        coachAppTraces: true,
        systemicModulation: true,
        healthObservations: false,
        healthSystemGraph: false,
        bioenergeticsResponses: true,
        knowledge: true,
        foodDiary: false,
        nutritionConstraints: false,
        trainingArchetypeTraces: false,
        biomechAero: false,
        includeIngestPayload: false,
      };
    case "bioenergetics":
      return {
        realityIngest: false,
        healthPanels: true,
        evidenceHits: false,
        coachAppTraces: false,
        systemicModulation: false,
        healthObservations: false,
        healthSystemGraph: false,
        bioenergeticsResponses: true,
        knowledge: false,
        foodDiary: true,
        nutritionConstraints: true,
        trainingArchetypeTraces: false,
        biomechAero: false,
        includeIngestPayload: false,
      };
    case "biomechanics":
      return {
        realityIngest: false,
        healthPanels: false,
        evidenceHits: false,
        coachAppTraces: false,
        systemicModulation: false,
        healthObservations: false,
        healthSystemGraph: false,
        bioenergeticsResponses: false,
        knowledge: false,
        foodDiary: false,
        nutritionConstraints: false,
        trainingArchetypeTraces: false,
        biomechAero: true,
        includeIngestPayload: false,
      };
    case "aerodynamics":
      return {
        realityIngest: false,
        healthPanels: false,
        evidenceHits: false,
        coachAppTraces: false,
        systemicModulation: false,
        healthObservations: false,
        healthSystemGraph: false,
        bioenergeticsResponses: false,
        knowledge: false,
        foodDiary: false,
        nutritionConstraints: false,
        trainingArchetypeTraces: false,
        biomechAero: true,
        includeIngestPayload: false,
      };
    case "full":
    default:
      return {
        realityIngest: true,
        healthPanels: true,
        evidenceHits: true,
        coachAppTraces: true,
        systemicModulation: true,
        healthObservations: true,
        healthSystemGraph: true,
        bioenergeticsResponses: true,
        knowledge: true,
        foodDiary: true,
        nutritionConstraints: true,
        trainingArchetypeTraces: true,
        biomechAero: true,
        includeIngestPayload: true,
      };
  }
}
