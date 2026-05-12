import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createNodeSupabaseServicePreferred } from "@/lib/supabase-node-client";
import { readOptionalServiceRoleKey } from "@/lib/supabase-env";

import { materializeGarminActivitiesFromPullResponse } from "@/lib/integrations/garmin-activity-materialize";
import {
  extractFirstGarminUserIdDeep,
  inferGarminActivityStreamKeyFromRoot,
} from "@/lib/integrations/garmin-health-api-notification-schema";
import {
  collectGarminWellnessRecords,
  materializeGarminWellnessFromPullResponse,
} from "@/lib/integrations/garmin-wellness-materialize";
import {
  buildGarminPullRequestUrl,
  extractGarminPullItems,
  extractRootGarminUserId,
} from "./garmin-extract-pull-items";
import { queueGarminActivityEnrichmentAfterInlineActivityPush } from "./garmin-activity-follow-up-pull-queue";

async function resolveAthleteIdForGarminUser(
  supabase: SupabaseClient,
  garminUserId: string | null | undefined,
): Promise<string | null> {
  const id = garminUserId?.trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from("garmin_athlete_links")
    .select("athlete_id")
    .eq("garmin_user_id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { athlete_id?: string };
  return typeof row.athlete_id === "string" ? row.athlete_id : null;
}

function fingerprintToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 24);
}

function formatSupabaseInsertError(e: { message?: string; code?: string; details?: string; hint?: string }): string {
  const parts = [e.message, e.code, e.details, e.hint].filter((x) => typeof x === "string" && x.trim().length > 0);
  return parts.length > 0 ? parts.join(" | ") : "Insert garmin_push_receipts failed (no error fields)";
}

/** Rimuove segreti Garmin dal JSON prima del salvataggio (userAccessToken, ecc.). */
export function redactGarminPushPayload(node: unknown, fingerprints: string[]): unknown {
  if (node === null || node === undefined) return node;
  if (Array.isArray(node)) return node.map((x) => redactGarminPushPayload(x, fingerprints));
  if (typeof node !== "object") return node;
  const o = { ...(node as Record<string, unknown>) };
  for (const key of Object.keys(o)) {
    const v = o[key];
    if (
      (key === "userAccessToken" || key === "user_access_token") &&
      typeof v === "string" &&
      v.length > 0
    ) {
      const fp = fingerprintToken(v);
      fingerprints.push(fp);
      o[key] = `redacted:sha256:${fp}`;
    } else {
      o[key] = redactGarminPushPayload(v, fingerprints);
    }
  }
  return o;
}

export async function persistGarminPushReceipt(input: {
  endpointKind: string;
  contentType: string | null;
  parsedJson: unknown;
  /** Override per worker ingest fuori da Next (es. Fly): usa service role. */
  supabase?: SupabaseClient;
}): Promise<{ id: string; pullJobsQueued: number }> {
  const supabase = input.supabase ?? createNodeSupabaseServicePreferred();
  if (!input.supabase && !readOptionalServiceRoleKey()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY richiesta per salvare le notifiche Garmin (bypass RLS).");
  }

  const pullItems = extractGarminPullItems(input.parsedJson, input.endpointKind);

  const fingerprints: string[] = [];
  const payload = redactGarminPushPayload(input.parsedJson, fingerprints);

  const { data, error } = await supabase
    .from("garmin_push_receipts")
    .insert({
      endpoint_kind: input.endpointKind.slice(0, 200),
      content_type: input.contentType?.slice(0, 200) ?? null,
      payload: payload as Record<string, unknown>,
      token_fingerprints: Array.from(new Set(fingerprints)),
    })
    .select("id");

  if (error) throw new Error(formatSupabaseInsertError(error));

  const row = Array.isArray(data) ? data[0] : data;
  const receiptId =
    row && typeof row === "object" && "id" in row && typeof (row as { id: unknown }).id === "string"
      ? (row as { id: string }).id
      : null;
  if (!receiptId) {
    const kind = Array.isArray(data) ? `array(len=${data.length})` : typeof data;
    throw new Error(
      `Insert Garmin push senza id (data=${kind}). Su Fly serve SUPABASE_SERVICE_ROLE_KEY (anon + RLS su garmin_push_receipts non espone id in RETURNING).`,
    );
  }
  let queued = 0;
  const rootUid = extractRootGarminUserId(input.parsedJson);

  for (const item of pullItems) {
    const finalUrl = buildGarminPullRequestUrl(item);
    const garminUid = item.garminUserId ?? rootUid;
    const athleteId = await resolveAthleteIdForGarminUser(supabase, garminUid);
    const { error: jobErr } = await supabase.from("garmin_pull_jobs").insert({
      receipt_id: receiptId,
      stream_key: item.streamKey.slice(0, 120),
      endpoint_kind: input.endpointKind.slice(0, 200),
      callback_url: finalUrl,
      user_access_token: item.userAccessToken ?? null,
      query_snapshot: item.querySnapshot,
      status: "pending",
      athlete_id: athleteId,
      garmin_user_id: garminUid ?? null,
    });
    if (jobErr) throw new Error(jobErr.message);
    queued += 1;
  }

  /**
   * Push inline (Health API §5.1): nessun `callbackURL` → nessun job pull.
   * Garmin spesso include i record interi nel body (sleeps/dailies/hrv/stress/respiration/…),
   * quindi convogliamo qui la **stessa pipeline canonica** che girerebbe nel pull runner:
   *   - attività (executed_workouts + executed_workout_series)
   *   - wellness (device_sync_exports per dailies/sleeps/hrv/stress/…)
   *
   * Materializzatori idempotenti per `external_id` / `(provider, external_event_id)` →
   * eventuali doppioni con un futuro pull restano dedotti.
   */
  if (queued === 0) {
    const uid = extractFirstGarminUserIdDeep(input.parsedJson) ?? rootUid;
    const athleteId = uid ? await resolveAthleteIdForGarminUser(supabase, uid) : null;
    if (athleteId) {
      try {
        await materializeGarminActivitiesFromPullResponse({
          athleteId,
          endpointKind: input.endpointKind,
          streamKey: inferGarminActivityStreamKeyFromRoot(input.parsedJson),
          responseBody: input.parsedJson,
        });
      } catch {
        /* best-effort: non bloccare il 200 al portale Garmin */
      }

      if (collectGarminWellnessRecords(input.parsedJson).length > 0) {
        try {
          await materializeGarminWellnessFromPullResponse({
            athleteId,
            streamKey: input.endpointKind,
            responseBody: input.parsedJson,
          });
        } catch {
          /* best-effort */
        }
      }

      try {
        const enq = await queueGarminActivityEnrichmentAfterInlineActivityPush({
          supabase,
          receiptId,
          athleteId,
          endpointKind: input.endpointKind,
          parsedJson: input.parsedJson,
        });
        queued +=
          (enq.queuedActivityDetails ? 1 : 0) + enq.queuedActivityFiles;
      } catch {
        /* follow-up best-effort */
      }
    }
  }

  return { id: receiptId, pullJobsQueued: queued };
}
