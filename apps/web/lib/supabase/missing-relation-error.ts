/**
 * Postgres / PostgREST quando una relazione non esiste o non è ancora nello schema cache
 * (migrazione non applicata, reload API in corso).
 */
export function isMissingRelationError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  const code = String((error as { code?: string }).code ?? "");
  if (code === "42P01") return true;
  if (msg.includes("does not exist")) return true;
  if (msg.includes("schema cache") && msg.includes("could not find")) return true;
  if (msg.includes("could not find the table")) return true;
  return false;
}
