import "server-only";

/**
 * Corpo errore JSON tipico Wellness/Health API (OpenAPI in apiDocs):
 * `{ "errorMessage": "string" }` per 4xx/5xx documentati.
 */
export function tryParseGarminApiErrorMessage(raw: string): string | undefined {
  const t = raw.trim();
  if (!t.startsWith("{")) return undefined;
  try {
    const o = JSON.parse(t) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return undefined;
    const msg = (o as Record<string, unknown>).errorMessage;
    if (typeof msg === "string" && msg.trim()) return msg.trim().slice(0, 2000);
  } catch {
    /* ignore */
  }
  return undefined;
}
