export type ViryaSportFamily = "aerobic" | "strength" | "technical" | "lifestyle";

const DEFAULT_GENERIC = "EMPATHY Annual Strategy";

export function isGenericViryaPlanName(name: string): boolean {
  const t = name.trim();
  return !t || t === DEFAULT_GENERIC || t === "Annual";
}

export function suggestedViryaPlanName(family: ViryaSportFamily, discipline: string): string {
  const year = new Date().getFullYear();
  if (family === "strength") return `Gym · ${year}`;
  if (family === "technical") return `Tecnico · ${discipline.trim() || "Sport"} · ${year}`;
  if (family === "lifestyle") return `Lifestyle · ${year}`;
  const d = discipline.trim() || "Endurance";
  return `${d} · ${year}`;
}

export function viryaPlanTag(planName: string): string {
  return `[VIRYA:${planName.trim() || "Annual"}]`;
}
