/** Marker in `planned_workouts.notes` per sedute pubblicate da VIRYA su Calendar. */
export const VIRYA_NOTES_ILIKE_MARKER = "%\\[VIRYA:%";

export function extractViryaTagFromPlannedNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = notes.match(/\[VIRYA:([^\]]+)\]/);
  return m ? `[VIRYA:${m[1]}]` : null;
}

export function planNameFromViryaTag(tag: string): string {
  const m = tag.match(/\[VIRYA:([^\]]+)\]/);
  return (m?.[1] ?? "Annual").trim() || "Annual";
}

/** Pattern ILIKE sicuro per tag completo (es. `[VIRYA:EMPATHY Annual Strategy]`). */
export function ilikeContainsViryaTag(tag: string): string {
  const escaped = tag
    .split("")
    .map((c) => {
      if (c === "\\") return "\\\\";
      if (c === "%" || c === "_") return `\\${c}`;
      if (c === "[") return "\\[";
      return c;
    })
    .join("");
  return `%${escaped}%`;
}

export function isViryaPlannedWorkout(notes: string | null | undefined): boolean {
  return extractViryaTagFromPlannedNotes(notes) != null;
}
