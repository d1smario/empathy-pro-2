import type { ObservationContextRef, ObservationIngestTags } from "@/lib/empathy/schemas";

function refFingerprint(ref: ObservationContextRef): string {
  switch (ref.kind) {
    case "executed_workout":
      return `executed_workout:${ref.executedWorkoutId}`;
    case "planned_workout":
      return `planned_workout:${ref.plannedWorkoutId}`;
    case "sleep_period":
      return `sleep_period:${ref.start}:${ref.end}`;
    case "calendar_day":
      return `calendar_day:${ref.date}`;
    case "free_interval":
      return `free_interval:${ref.start}:${ref.end}`;
    default:
      return JSON.stringify(ref);
  }
}

/** Unisce domini (dedup), preferisce `modalities`/`contextRefs` da patch se definiti. */
export function mergeObservationIngestTags(
  base: ObservationIngestTags,
  patch: Partial<ObservationIngestTags>,
): ObservationIngestTags {
  const domains = Array.from(new Set([...base.domains, ...(patch.domains ?? [])]));
  const modalities =
    patch.modalities !== undefined ? (patch.modalities?.length ? Array.from(new Set(patch.modalities)) : null) : base.modalities ?? null;

  const mergedRefs: ObservationContextRef[] = [...(base.contextRefs ?? []), ...(patch.contextRefs ?? [])];
  const seen = new Set<string>();
  const contextRefs = mergedRefs.filter((r) => {
    const fp = refFingerprint(r);
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });

  return {
    domains,
    modalities: modalities && modalities.length > 0 ? modalities : null,
    contextRefs: contextRefs.length > 0 ? contextRefs : null,
  };
}
