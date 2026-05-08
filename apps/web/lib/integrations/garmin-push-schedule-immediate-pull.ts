import "server-only";

import { waitUntil } from "@vercel/functions";

import { runGarminPullJobs } from "@/lib/integrations/garmin-pull-runner";

/**
 * Dopo una notifica push con job inseriti in `garmin_pull_jobs`, avvia il worker senza attendere il cron
 * (come nelle app consumer: attività → push → pull entro pochi secondi).
 * Su Vercel `waitUntil` mantiene vivo l’isolato fino al completamento della Promise.
 * Disabilita con `GARMIN_PUSH_DISABLE_IMMEDIATE_PULL=1` se servono solo i tick cron.
 */
export function scheduleGarminImmediatePullAfterPush(pullJobsQueued: number): void {
  if (pullJobsQueued <= 0) return;
  if (process.env.GARMIN_PUSH_DISABLE_IMMEDIATE_PULL === "1") return;

  const limit = Math.min(25, Math.max(1, pullJobsQueued));
  const task = runGarminPullJobs(limit).catch((err) => {
    console.error("[garmin-push] immediate pull failed:", err instanceof Error ? err.message : err);
  });
  waitUntil(task);
}
