const SLOT_DEFAULT_HMS: Record<string, string> = {
  breakfast: "08:15:00",
  lunch: "13:00:00",
  dinner: "20:00:00",
  snack: "16:00:00",
  other: "12:00:00",
};

function pad2(n: number): string {
  return String(Math.max(0, Math.min(59, n))).padStart(2, "0");
}

function pad2h(n: number): string {
  return String(Math.max(0, Math.min(23, n))).padStart(2, "0");
}

/** Normalizza `HH:MM` o `HH:MM:SS` (1-2 cifre ore) → `HH:MM:SS` valido; null se non interpretabile. */
export function normalizeFoodDiaryEntryTimeHms(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{1,2}:\d{1,2}:\d{2}$/.test(t)) {
    const [a, b, c] = t.split(":").map((x) => Number(x));
    if (![a, b, c].every((x) => Number.isFinite(x))) return null;
    return `${pad2h(a!)}:${pad2(b!)}:${pad2(c!)}`;
  }
  if (/^\d{1,2}:\d{1,2}$/.test(t)) {
    const [a, b] = t.split(":").map((x) => Number(x));
    if (![a, b].every((x) => Number.isFinite(x))) return null;
    return `${pad2h(a!)}:${pad2(b!)}:00`;
  }
  return null;
}

/** Ora di default da `meal_slot` (POST diario quando il client non invia orario). */
export function defaultFoodDiaryEntryTimeHmsForMealSlot(mealSlot: string): string {
  const k = mealSlot.trim().toLowerCase();
  return SLOT_DEFAULT_HMS[k] ?? SLOT_DEFAULT_HMS.other;
}

/** `HH:MM` per `<input type="time" />` (stesso default del server). */
export function defaultFoodDiaryEntryTimeHmForMealSlot(mealSlot: string): string {
  return defaultFoodDiaryEntryTimeHmsForMealSlot(mealSlot).slice(0, 5);
}

/**
 * Valore `entry_time` da persistere: rispetta input utente se valido, altrimenti default da slot pasto.
 */
export function resolveFoodDiaryEntryTimeForInsert(raw: string | null | undefined, mealSlot: string): string {
  const n = typeof raw === "string" ? normalizeFoodDiaryEntryTimeHms(raw) : null;
  if (n) return n;
  return defaultFoodDiaryEntryTimeHmsForMealSlot(mealSlot);
}
