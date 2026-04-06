/** Prima parte descrizione USDA (più leggibile in UI pasto). */
export function shortFoodLabelFromUsda(description: string, maxLen = 46): string {
  const trimmed = description.trim();
  if (!trimmed) return "Alimento FDC";
  const first = trimmed.split(",")[0]?.trim() ?? trimmed;
  if (first.length <= maxLen) return first;
  return `${first.slice(0, Math.max(8, maxLen - 1))}…`;
}
