import "server-only";

import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";

/**
 * Enriches the user PubMed string with a short tail from **existing** athlete knowledge modulations
 * (no free-form LLM). Caller must have already run `requireAthleteReadContext`.
 */
export async function augmentPubmedQueryWithAthleteMemory(baseQ: string, athleteId: string): Promise<string> {
  const trimmed = baseQ.trim();
  if (!trimmed) return trimmed;

  const memory = await resolveAthleteMemorySlice(athleteId, { slice: "dashboard" });
  const tailParts: string[] = [];
  for (const m of memory.knowledge?.activeModulations ?? []) {
    for (const line of m.hardConstraints ?? []) {
      const s = String(line ?? "").trim();
      if (s.length >= 6 && s.length <= 120) tailParts.push(s);
      if (tailParts.length >= 2) break;
    }
    if (tailParts.length >= 2) break;
  }
  if (!tailParts.length) return trimmed;

  const tail = tailParts.join(" ").slice(0, 160);
  return `${trimmed} ${tail}`.slice(0, 400).trim();
}
