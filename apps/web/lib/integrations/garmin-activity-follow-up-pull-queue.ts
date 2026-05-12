import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  extractGarminPullTokenFromCallbackUrl,
  readUploadWindowFromCallbackUrl,
} from "@/lib/integrations/garmin-activity-follow-up-url";
import {
  garminActivitySummaryNeedsBinaryFollowUp,
  listGarminActivitySummariesFromWellnessBody,
} from "@/lib/integrations/garmin-activity-materialize";
import { garminWellnessAbsoluteUrl } from "@/lib/integrations/garmin-wellness-api";

const MAX_ACTIVITY_FILE_FOLLOW_UPS = 32;

export type GarminPullJobLite = {
  id: string;
  callback_url: string;
  user_access_token: string | null;
  athlete_id: string | null;
  receipt_id: string | null;
  endpoint_kind: string;
  stream_key: string | null;
};

function isSyntheticFollowUpEndpoint(endpointKind: string): boolean {
  return endpointKind.toLowerCase().startsWith("garmin_follow_up");
}

function isGarminActivitiesListPull(job: GarminPullJobLite): boolean {
  if ((job.stream_key ?? "").toLowerCase() === "activities") return true;
  try {
    return new URL(job.callback_url).pathname.toLowerCase().includes("/rest/activities");
  } catch {
    return false;
  }
}

function deriveUploadWindowFromSummaries(rows: Record<string, unknown>[]): { start: number; end: number } | null {
  let minS = Infinity;
  let maxE = -Infinity;
  for (const r of rows) {
    const s = r.startTimeInSeconds;
    const d = r.durationInSeconds ?? r.duration;
    if (typeof s !== "number" || !Number.isFinite(s)) continue;
    const dur = typeof d === "number" && Number.isFinite(d) && d > 0 ? d : 120;
    const e = s + dur;
    if (s < minS) minS = s;
    if (e > maxE) maxE = e;
  }
  if (!Number.isFinite(minS) || !Number.isFinite(maxE) || maxE <= minS) return null;
  return { start: minS, end: maxE };
}

function pickGarminSummaryOrActivityId(r: Record<string, unknown>): string | null {
  const sid = r.summaryId ?? r.summaryID ?? r.activityId ?? r.activityID;
  if (typeof sid === "string" && sid.trim()) return sid.trim();
  if (typeof sid === "number" && Number.isFinite(sid)) return String(Math.trunc(sid));
  return null;
}

function isBinaryPullResponseWrapper(body: unknown): boolean {
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  return Boolean(o?.garminWellnessBinaryResponse === true);
}

async function hasPendingOrFetchingJobWithUrl(supabase: SupabaseClient, callbackUrl: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("garmin_pull_jobs")
    .select("id")
    .eq("callback_url", callbackUrl)
    .in("status", ["pending", "fetching"])
    .limit(1)
    .maybeSingle();
  if (error) return true;
  return Boolean(data?.id);
}

/**
 * Dopo GET `activities` (lista summary), Garmin **non** invia da sola `activityFile` / `activityDetails`.
 * Accodiamo pull espliciti verso wellness-api usando lo stesso `token=` del callback `activities`
 * (pull token Health API) + OAuth1/Bearer come il job parent — vedi `garmin-pull-runner`.
 *
 * **Ingest Fly (`…/push/activityDetails`)**: riceve solo il **JSON** pesante della push; non contiene il FIT.
 * Il FIT resta da **`GET /rest/activityFile`** (job accodati qui o da `callbackURL` nel payload Garmin).
 */
export async function queueGarminActivityEnrichmentAfterActivitiesPull(input: {
  supabase: SupabaseClient;
  job: GarminPullJobLite;
  responseBody: unknown;
}): Promise<{ queuedActivityDetails: boolean; queuedActivityFiles: number }> {
  const { supabase, job, responseBody } = input;
  let queuedActivityDetails = false;
  let queuedActivityFiles = 0;

  if (!job.athlete_id) return { queuedActivityDetails, queuedActivityFiles };
  if (!isGarminActivitiesListPull(job)) return { queuedActivityDetails, queuedActivityFiles };
  if (isSyntheticFollowUpEndpoint(job.endpoint_kind)) return { queuedActivityDetails, queuedActivityFiles };
  if (isBinaryPullResponseWrapper(responseBody)) return { queuedActivityDetails, queuedActivityFiles };

  const pullToken = extractGarminPullTokenFromCallbackUrl(job.callback_url);
  if (!pullToken) return { queuedActivityDetails, queuedActivityFiles };

  const rows = listGarminActivitySummariesFromWellnessBody(responseBody);
  const needsEnrichment = rows.filter((r) => garminActivitySummaryNeedsBinaryFollowUp(r));
  if (needsEnrichment.length === 0) return { queuedActivityDetails, queuedActivityFiles };

  const window =
    readUploadWindowFromCallbackUrl(job.callback_url) ?? deriveUploadWindowFromSummaries(needsEnrichment);
  if (window) {
    const u = new URL(garminWellnessAbsoluteUrl("/rest/activityDetails"));
    u.searchParams.set("token", pullToken);
    u.searchParams.set("uploadStartTimeInSeconds", String(Math.floor(window.start)));
    u.searchParams.set("uploadEndTimeInSeconds", String(Math.ceil(window.end)));
    const detailsUrl = u.toString();
    if (!(await hasPendingOrFetchingJobWithUrl(supabase, detailsUrl))) {
      const { error } = await supabase.from("garmin_pull_jobs").insert({
        receipt_id: job.receipt_id,
        stream_key: "activityDetails",
        endpoint_kind: "garmin_follow_up:activityDetails",
        callback_url: detailsUrl,
        user_access_token: job.user_access_token?.trim() ? job.user_access_token : null,
        query_snapshot: {
          parent_pull_job_id: job.id,
          uploadStartTimeInSeconds: window.start,
          uploadEndTimeInSeconds: window.end,
        },
        status: "pending",
        athlete_id: job.athlete_id,
        garmin_user_id: null,
      });
      if (!error) queuedActivityDetails = true;
    }
  }

  let fileCount = 0;
  for (const r of needsEnrichment) {
    if (fileCount >= MAX_ACTIVITY_FILE_FOLLOW_UPS) break;
    const id = pickGarminSummaryOrActivityId(r);
    if (!id) continue;
    const u = new URL(garminWellnessAbsoluteUrl("/rest/activityFile"));
    u.searchParams.set("token", pullToken);
    u.searchParams.set("id", id);
    const fileUrl = u.toString();
    if (await hasPendingOrFetchingJobWithUrl(supabase, fileUrl)) continue;
    const { error } = await supabase.from("garmin_pull_jobs").insert({
      receipt_id: job.receipt_id,
      stream_key: "activityFile",
      endpoint_kind: "garmin_follow_up:activityFile",
      callback_url: fileUrl,
      user_access_token: job.user_access_token?.trim() ? job.user_access_token : null,
      query_snapshot: { parent_pull_job_id: job.id, summary_or_activity_id: id },
      status: "pending",
      athlete_id: job.athlete_id,
      garmin_user_id: null,
    });
    if (!error) {
      fileCount += 1;
      queuedActivityFiles += 1;
    }
  }

  return { queuedActivityDetails, queuedActivityFiles };
}
