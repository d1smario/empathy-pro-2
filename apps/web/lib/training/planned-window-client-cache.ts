/**
 * Dedupe breve delle GET planned-window (calendario + dettaglio giorno) per evitare
 * richieste duplicate sulla stessa finestra mentre React monta più effect.
 */

const TTL_MS = 8_000;
const cache = new Map<string, { at: number; json: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export function plannedWindowCacheKey(url: string): string {
  return url;
}

export type PlannedWindowCachedResult<T> = {
  ok: boolean;
  status: number;
  json: T;
};

export async function fetchPlannedWindowCached<T>(
  url: string,
  init: RequestInit,
): Promise<PlannedWindowCachedResult<T>> {
  const key = plannedWindowCacheKey(url);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return hit.json as PlannedWindowCachedResult<T>;
  }
  const running = inflight.get(key);
  if (running) return running as Promise<PlannedWindowCachedResult<T>>;

  const run = (async () => {
    const res = await fetch(url, init);
    const json = (await res.json()) as T;
    const out: PlannedWindowCachedResult<T> = { ok: res.ok, status: res.status, json };
    if (res.ok) {
      cache.set(key, { at: Date.now(), json: out });
    }
    return out;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, run);
  return run;
}

export function invalidatePlannedWindowCacheForAthlete(athleteId: string): void {
  for (const key of cache.keys()) {
    if (key.includes(`athleteId=${encodeURIComponent(athleteId)}`)) {
      cache.delete(key);
    }
  }
}
