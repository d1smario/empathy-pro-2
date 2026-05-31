/**
 * Athlete profile: anagrafica, obiettivi, dieta, intolleranze, device.
 */

import type { IsoDate } from "./common";
import type { LifestyleActivityClass } from "./nutrition";

export type DietType =
  | "omnivore"
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "other";

export type AthleteProfile = {
  id: string;
  /** Anagrafica */
  firstName?: string;
  lastName?: string;
  email?: string;
  birthDate?: IsoDate;
  sex?: "male" | "female" | "other";
  timezone?: string;
  activityLevel?: "beginner" | "intermediate" | "advanced" | "elite";
  /** Antropometria */
  heightCm?: number;
  weightKg?: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  restingHrBpm?: number;
  maxHrBpm?: number;
  thresholdHrBpm?: number;
  /** Obiettivi */
  goals?: string[];
  /** Dieta e preferenze */
  dietType?: DietType;
  /** Intolleranze / allergie (hard constraints) */
  intolerances?: string[]; // e.g. ["lactose", "gluten"]
  allergies?: string[];
  /** Preferenze alimentari (soft) */
  foodPreferences?: string[];
  foodExclusions?: string[];
  supplements?: string[];
  preferredMealCount?: number;
  lifestyleActivityClass?: LifestyleActivityClass;
  routineSummary?: string;
  routineConfig?: Record<string, unknown>;
  nutritionConfig?: Record<string, unknown>;
  supplementConfig?: Record<string, unknown>;
  /** Disponibilità allenamento (es. giorni/settimana, ore) */
  trainingAvailability?: {
    daysPerWeek?: number;
    preferredDays?: number[]; // 0=Sunday
    maxSessionMinutes?: number;
  };
  /** Device connessi (per sync) */
  connectedDevices?: ConnectedDevice[];
  createdAt?: string;
  updatedAt?: string;
};

export type ConnectedDevice = {
  provider:
    | "garmin"
    | "garmin_connectiq"
    | "trainingpeaks"
    | "strava"
    | "polar"
    | "wahoo"
    | "coros"
    | "suunto"
    | "apple_watch"
    | "zwift"
    | "hammerhead"
    | "oura"
    | "whoop"
    | "cgm"
    | "other";
  externalId?: string;
  lastSyncAt?: string;
  enabled: boolean;
};
