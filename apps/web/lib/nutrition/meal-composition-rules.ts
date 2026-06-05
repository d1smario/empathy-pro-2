import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";

/** Ruoli ammessi per voce pasto (generazione deterministica). */
export type MealFoodRole =
  | "cho_complex"
  | "cho_simple"
  | "protein_primary"
  | "protein_secondary"
  | "fat"
  | "veg_condiment"
  | "composite_dish"
  | "beverage";

export const MAIN_MEAL_SLOTS: ReadonlySet<MealSlotKey> = new Set(["lunch", "dinner"]);

export const LIGHT_MEAL_SLOTS: ReadonlySet<MealSlotKey> = new Set([
  "breakfast",
  "snack_am",
  "snack_pm",
  "snack_evening",
]);

export const FRUIT_CANONICAL_KEYS: ReadonlySet<string> = new Set([
  "banana",
  "mixed_fruit",
  "orange_raw",
  "kiwi_raw",
  "strawberries_raw",
  "jam_fruit",
]);

export const VEG_CANONICAL_KEYS: ReadonlySet<string> = new Set([
  "mixed_veg",
  "spinach_raw",
  "broccoli_raw",
  "zucchini_raw",
  "bell_pepper_red",
  "carrot_raw",
  "tomato_raw",
  "asparagus_raw",
  "arugula_raw",
  "lettuce_romaine",
]);

export const SLOT_ITEM_CAPS: Record<MealSlotKey, number> = {
  breakfast: 8,
  snack_am: 7,
  snack_pm: 7,
  snack_evening: 7,
  lunch: 9,
  dinner: 9,
};

export const LIGHT_ROLE_CAPS: Record<MealFoodRole, number> = {
  cho_complex: 1,
  cho_simple: 2,
  protein_primary: 1,
  protein_secondary: 1,
  fat: 2,
  veg_condiment: 0,
  composite_dish: 0,
  beverage: 1,
};

export const MAIN_ROLE_CAPS: Record<MealFoodRole, number> = {
  cho_complex: 2,
  cho_simple: 0,
  protein_primary: 1,
  protein_secondary: 1,
  fat: 2,
  veg_condiment: 3,
  composite_dish: 1,
  beverage: 0,
};

/** Rotazione settimana: target 2, eccezione 3 se pool stretto. */
export const ROTATION_TARGET_WEEK_USES = 2;
export const ROTATION_MAX_WEEK_USES = 3;

export function isMainMealSlot(slot: MealSlotKey): boolean {
  return MAIN_MEAL_SLOTS.has(slot);
}

export function isLightMealSlot(slot: MealSlotKey): boolean {
  return LIGHT_MEAL_SLOTS.has(slot);
}

export function isFruitCanonicalKey(key: string | null | undefined): boolean {
  return typeof key === "string" && FRUIT_CANONICAL_KEYS.has(key);
}

export function isVegCanonicalKey(key: string | null | undefined): boolean {
  return typeof key === "string" && VEG_CANONICAL_KEYS.has(key);
}

export function roleCapsForSlot(slot: MealSlotKey): Record<MealFoodRole, number> {
  return isMainMealSlot(slot) ? MAIN_ROLE_CAPS : LIGHT_ROLE_CAPS;
}
