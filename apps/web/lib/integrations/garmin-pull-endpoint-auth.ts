import type { NextRequest } from "next/server";

/**
 * Verifica `Authorization: Bearer …` per job pull Garmin (manuale o cron).
 * Accetta lo stesso token configurato come `GARMIN_PULL_RUN_SECRET` oppure `CRON_SECRET`
 * (su Vercel spesso è definito solo il secondo per il cron).
 */
export function authorizeGarminPullEndpointBearer(req: NextRequest): boolean {
  const auth = req.headers.get("authorization")?.trim();
  if (!auth?.startsWith("Bearer ")) return false;
  const cronSecret = process.env.CRON_SECRET?.trim();
  const pullSecret = process.env.GARMIN_PULL_RUN_SECRET?.trim();
  if (pullSecret && auth === `Bearer ${pullSecret}`) return true;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  return false;
}

/** True se almeno uno dei due secret è configurato (altrimenti l’endpoint non può autorizarre). */
export function garminPullEndpointSecretConfigured(): boolean {
  return Boolean(
    process.env.GARMIN_PULL_RUN_SECRET?.trim() || process.env.CRON_SECRET?.trim(),
  );
}
