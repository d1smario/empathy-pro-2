/** Prima parte descrizione USDA (più leggibile in UI pasto). */
export function shortFoodLabelFromUsda(description: string, maxLen = 46): string {
  const trimmed = description.trim();
  if (!trimmed) return "Alimento FDC";
  const first = trimmed.split(",")[0]?.trim() ?? trimmed;
  if (first.length <= maxLen) return first;
  return `${first.slice(0, Math.max(8, maxLen - 1))}…`;
}

/**
 * Etichette USDA "header generic" — la sola prima parte non basta a distinguere
 * (es. "Seeds, sesame…" vs "Seeds, sunflower…"). Per questi prefissi usiamo anche la SECONDA
 * parte separata da virgola.
 */
const GENERIC_USDA_HEADERS = new Set([
  "seeds",
  "fish",
  "cheese",
  "milk",
  "yogurt",
  "nuts",
  "beef",
  "pork",
  "chicken",
  "lamb",
  "cereals",
  "vegetables",
  "fruit",
  "fruits",
  "soup",
  "soups",
  "snacks",
  "beans",
  "oil",
  "spices",
  "spice",
  "leavening",
  "egg",
  "eggs",
]);

/**
 * Disambigua etichette USDA generiche unendo prima + seconda parte (es. "Seeds, sesame").
 * Se la prima parte non è in `GENERIC_USDA_HEADERS`, comportamento identico a `shortFoodLabelFromUsda`.
 *
 * Esempi:
 *  - "Seeds, sesame seeds, whole, dried" → "Seeds, sesame"
 *  - "Fish, salmon, Atlantic, farmed, raw" → "Fish, salmon"
 *  - "Cheese, parmesan, grated" → "Cheese, parmesan"
 *  - "Bananas, raw" → "Bananas, raw" (header non generic, fallback al comportamento standard)
 */
export function disambiguatedShortFoodLabel(description: string, maxLen = 38): string {
  const trimmed = description.trim();
  if (!trimmed) return "Alimento FDC";
  const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  const first = parts[0] ?? trimmed;
  const firstLower = first.toLowerCase();
  if (parts.length >= 2 && GENERIC_USDA_HEADERS.has(firstLower)) {
    /** Per il qualificatore (parts[1]) prendiamo la prima/le prime due parole utili. */
    const second = parts[1]!.replace(/\s+(seed|seeds|raw|cooked|dried|fresh|whole|kernel|kernels)\b.*/i, "").trim();
    const combined = second ? `${first}, ${second}` : first;
    if (combined.length <= maxLen) return combined;
    return `${combined.slice(0, Math.max(10, maxLen - 1))}…`;
  }
  if (first.length <= maxLen) return first;
  return `${first.slice(0, Math.max(8, maxLen - 1))}…`;
}
