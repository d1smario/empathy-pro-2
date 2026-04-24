import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { readOptionalServiceRoleKey } from "@/lib/supabase-env";

import { ensureFreshGarminAccessTokenForAthlete } from "./garmin-access-token";
import { tryParseGarminApiErrorMessage } from "./garmin-api-error-body";
import { materializeGarminActivitiesFromPullResponse } from "./garmin-activity-materialize";
import { buildGarminSignedGetHeaders } from "./garmin-oauth1-client";

type PullJobRow = {
  id: string;
  callback_url: string;
  user_access_token: string | null;
  athlete_id: string | null;
  endpoint_kind: string;
  stream_key: string | null;
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
 * Esegue fino a `limit` job in stato `pending`: OAuth1 (token push) oppure Bearer OAuth2 se token assente e `athlete_id` risolto.
 * Chiamare da `POST /api/integrations/garmin/pull/run` o `GET /api/integrations/garmin/pull/cron` (Vercel Cron) con segreto.
 */
export async function runGarminPullJobs(limit: number): Promise<{
  processed: number;
  completed: number;
  failed: number;
  errors: string[];
  activitiesUpserted: number;
}> {
  if (!readOptionalServiceRoleKey()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY richiesta per la coda pull Garmin.");
  }

  const supabase = createServerSupabaseClient();
  const { data: jobs, error } = await supabase
    .from("garmin_pull_jobs")
    .select("id, callback_url, user_access_token, athlete_id, endpoint_kind, stream_key")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  const list = (jobs ?? []) as PullJobRow[];

  let completed = 0;
  let failed = 0;
  let activitiesUpserted = 0;
  const errors: string[] = [];

  for (const job of list) {
    const t = nowIso();
    await supabase.from("garmin_pull_jobs").update({ status: "fetching", updated_at: t }).eq("id", job.id);

    try {
      const userTok = job.user_access_token?.trim() ?? "";
      let fetchHeaders: Record<string, string>;
      if (userTok) {
        fetchHeaders = {
          ...buildGarminSignedGetHeaders({ url: job.callback_url, userAccessToken: userTok }),
          Accept: "application/json",
        };
      } else if (job.athlete_id) {
        const tok = await ensureFreshGarminAccessTokenForAthlete(supabase, job.athlete_id);
        if ("error" in tok) {
          throw new Error(`oauth2_pull: ${tok.error}`);
        }
        fetchHeaders = { Authorization: `Bearer ${tok.accessToken}`, Accept: "application/json" };
      } else {
        throw new Error("pull_job_senza_user_access_token né athlete_id");
      }

      const res = await fetch(job.callback_url, {
        method: "GET",
        headers: fetchHeaders,
        cache: "no-store",
        signal: AbortSignal.timeout(90_000),
      });
      const text = await res.text();
      const ct = (res.headers.get("content-type") ?? "").toLowerCase();
      /** Garmin: es. GET `/rest/activityFile` → 200 `application/octet-stream` (FIT/TCX/GPX), non JSON summary. */
      const binaryOk =
        res.ok && (ct.includes("octet-stream") || ct.includes("application/vnd.garmin"));
      const body: unknown = binaryOk
        ? {
            garminWellnessBinaryResponse: true as const,
            contentType: res.headers.get("content-type"),
            byteLength: text.length,
          }
        : await safeJsonBody(text);
      const ok = res.ok;
      if (ok) completed += 1;
      else failed += 1;

      const errDetail = !ok ? tryParseGarminApiErrorMessage(text) ?? text.slice(0, 4000) : null;

      await supabase
        .from("garmin_pull_jobs")
        .update({
          status: ok ? "completed" : "failed",
          updated_at: nowIso(),
          http_status: res.status,
          response_body: body as Record<string, unknown>,
          error_message: errDetail,
        })
        .eq("id", job.id);

      if (ok && job.athlete_id) {
        try {
          const { upserted } = await materializeGarminActivitiesFromPullResponse({
            athleteId: job.athlete_id,
            endpointKind: job.endpoint_kind,
            streamKey: job.stream_key,
            responseBody: body,
          });
          activitiesUpserted += upserted;
        } catch {
          /* materializzazione best-effort */
        }
      }
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

  return { processed: list.length, completed, failed, errors, activitiesUpserted };
}
