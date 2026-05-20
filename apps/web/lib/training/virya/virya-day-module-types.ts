/** Moduli giornalieri VIRYA (technical / lifestyle) — shape condiviso orchestrator + derive. */

export type TechnicalDayModule = {
  dayIndex: number;
  objectives: string[];
  exerciseType: string;
  intensity: string;
  methodology: string;
};

export type LifestyleDayModule = {
  dayIndex: number;
  objective: string;
  practiceType: string;
  intensityRpe: number;
  breathingCadence: string;
  holdOrFlow: string;
  methodology: string;
};
