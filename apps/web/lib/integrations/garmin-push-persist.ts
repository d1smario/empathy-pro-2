import "server-only";

import { createHash } from "node:crypto";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { readOptionalServiceRoleKey } from "@/lib/supabase-env";

import {
  buildGarminPullRequestUrl,
  extractGarminPullItems,
  extractRootGarminUserId,
} from "./garmin-extract-pull-items";

async function resolveAthleteIdForGarminUser(
  supabase: ReturnType<typeof createServerSupabaseClient>,
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
}): Promise<{ id: string; pullJobsQueued: number }> {
  if (!readOptionalServiceRoleKey()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY richiesta per salvare le notifiche Garmin (bypass RLS).");
  }

  const pullItems = extractGarminPullItems(input.parsedJson, input.endpointKind);

  const fingerprints: string[] = [];
  const payload = redactGarminPushPayload(input.parsedJson, fingerprints);
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("garmin_push_receipts")
    .insert({
      endpoint_kind: input.endpointKind.slice(0, 200),
      content_type: input.contentType?.slice(0, 200) ?? null,
      payload: payload as Record<string, unknown>,
      token_fingerprints: Array.from(new Set(fingerprints)),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Insert Garmin push senza id.");

  const receiptId = data.id as string;
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
      user_access_token: item.userAccessToken,
      query_snapshot: item.querySnapshot,
      status: "pending",
      athlete_id: athleteId,
      garmin_user_id: garminUid ?? null,
    });
    if (jobErr) throw new Error(jobErr.message);
    queued += 1;
  }

  return { id: receiptId, pullJobsQueued: queued };
}
