import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { readOptionalServiceRoleKey } from "@/lib/supabase-env";

import { buildGarminSignedGetHeaders } from "./garmin-oauth1-client";

type PullJobRow = {
  id: string;
  callback_url: string;
  user_access_token: string;
};

function nowIso() {
  return new Date().toISOString();
}

async function safeJsonBody(text: string): Promise<unknown> {
  const slice = text.slice(0, 900_000);
  try {
    return JSON.parse(slice) as unknown;
  } catch {
    return { _nonJson: true, raw: slice };
  }
}

/**
 * Esegue fino a `limit` job in stato `pending` (firma OAuth1 + GET callbackURL).
 * Chiamare da `POST /api/integrations/garmin/pull/run` con segreto.
 */
export async function runGarminPullJobs(limit: number): Promise<{
  processed: number;
  completed: number;
  failed: number;
  errors: string[];
}> {
  if (!readOptionalServiceRoleKey()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY richiesta per la coda pull Garmin.");
  }

  const supabase = createServerSupabaseClient();
  const { data: jobs, error } = await supabase
    .from("garmin_pull_jobs")
    .select("id, callback_url, user_access_token")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  const list = (jobs ?? []) as PullJobRow[];

  let completed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const job of list) {
    const t = nowIso();
    await supabase.from("garmin_pull_jobs").update({ status: "fetching", updated_at: t }).eq("id", job.id);

    try {
      const headers = buildGarminSignedGetHeaders({
        url: job.callback_url,
        userAccessToken: job.user_access_token,
      });
      const res = await fetch(job.callback_url, {
        method: "GET",
        headers: { ...headers, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(90_000),
      });
      const text = await res.text();
      const body = await safeJsonBody(text);
      const ok = res.ok;
      if (ok) completed += 1;
      else failed += 1;

      await supabase
        .from("garmin_pull_jobs")
        .update({
          status: ok ? "completed" : "failed",
          updated_at: nowIso(),
          http_status: res.status,
          response_body: body as Record<string, unknown>,
          error_message: ok ? null : text.slice(0, 4000),
        })
        .eq("id", job.id);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : "Pull fallito.";
      errors.push(`${job.id}: ${msg}`);
      await supabase
        .from("garmin_pull_jobs")
        .update({
          status: "failed",
          updated_at: nowIso(),
          error_message: msg.slice(0, 4000),
        })
        .eq("id", job.id);
    }
  }

  return { processed: list.length, completed, failed, errors };
}
