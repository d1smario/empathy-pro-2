/**
 * Mapping catalogo esercizi → scene Spline; wrapper viewer (runtime da aggiungere in apps/web).
 * @see docs/INTEGRATIONS_SPLINE.md
 */
export const INTEGRATION = "@empathy/integrations-spline" as const;

/** Chiave canonica esercizio → URL o id scena (allineare a export Spline). */
export type ExerciseSplineSceneRef = {
  exerciseKey: string;
  sceneUrl: string;
};
