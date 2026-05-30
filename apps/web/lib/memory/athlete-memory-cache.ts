import type { AthleteMemory } from "@/lib/empathy/schemas";
import type { MemorySlice } from "@/lib/memory/athlete-memory-slice-types";

type CacheEntry = { memory: AthleteMemory; expiresAt: number };

const DEFAULT_TTL_MS = 45_000;
const cache = new Map<string, CacheEntry>();

export function athleteMemoryCacheKey(athleteId: string, slice: MemorySlice): string {
  return `${athleteId}:${slice}`;
}

export function getCachedAthleteMemory(athleteId: string, slice: MemorySlice): AthleteMemory | null {
  const key = athleteMemoryCacheKey(athleteId, slice);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.memory;
}

export function setCachedAthleteMemory(
  athleteId: string,
  slice: MemorySlice,
  memory: AthleteMemory,
  ttlMs = DEFAULT_TTL_MS,
): void {
  cache.set(athleteMemoryCacheKey(athleteId, slice), {
    memory,
    expiresAt: Date.now() + ttlMs,
  });
}

/** Invalidates all slices for one athlete, or the entire in-process cache when `athleteId` is omitted. */
export function invalidateAthleteMemoryCache(athleteId?: string): void {
  if (!athleteId) {
    cache.clear();
    return;
  }
  const prefix = `${athleteId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** Test-only reset. */
export function _resetAthleteMemoryCacheForTests(): void {
  cache.clear();
}
