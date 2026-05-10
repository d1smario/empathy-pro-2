/**
 * Recovery one-shot: riprocessa `garmin_push_receipts` esistenti chiamando i materializzatori
 * canonici (attività + wellness) come avrebbe fatto il push handler dopo il fix in
 * `garmin-push-persist.ts` (push inline → wellness materialize).
 *
 * Tipico uso (PowerShell):
 *   cd apps/web
 *   npx tsx scripts/garmin-reprocess-receipts.ts <athlete_uuid> [hoursBack=72]
 *
 * Idempotente: i materializer fanno upsert su `(provider, external_event_id)` (wellness)
 * e `external_id` (executed_workouts). Sicuro relanciarlo.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(p: string): void {
  if (!existsSync(p)) return;
  const text = readFileSync(p, "utf8");
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env) || process.env[k] === "") process.env[k] = v;
  }
}

loadEnv(resolve(__dirname, "..", ".env.local"));
loadEnv(resolve(__dirname, "..", "..", "..", ".env.local"));

import { materializeGarminActivitiesFromPullResponse } from "@/lib/integrations/garmin-activity-materialize";
import {
  collectGarminWellnessRecords,
  materializeGarminWellnessFromPullResponse,
} from "@/lib/integrations/garmin-wellness-materialize";
import { inferGarminActivityStreamKeyFromRoot } from "@/lib/integrations/garmin-health-api-notification-schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const athleteId = (process.argv[2] || "").trim();
const hoursBack = Number(process.argv[3] || "72");

if (!UUID_RE.test(athleteId)) {
  console.error("Uso: npx tsx scripts/garmin-reprocess-receipts.ts <athlete_uuid> [hoursBack=72]");
  process.exitCode = 1;
}

function buildClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Mancano NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function main() {
  const supabase = buildClient();

  const { data: links } = await supabase
    .from("garmin_athlete_links")
    .select("garmin_user_id")
    .eq("athlete_id", athleteId);
  const garminIds = new Set<string>();
  for (const l of (links ?? []) as Array<{ garmin_user_id: string }>) {
    if (l.garmin_user_id) garminIds.add(l.garmin_user_id);
  }
  console.log(`Athlete ${athleteId} → garmin_user_ids: ${[...garminIds].join(", ") || "(nessuno)"}`);
  if (garminIds.size === 0) {
    console.error("Nessun link Garmin per questo atleta.");
    return;
  }

  const sinceIso = new Date(Date.now() - hoursBack * 3600_000).toISOString();
  const { data: receipts } = await supabase
    .from("garmin_push_receipts")
    .select("id, endpoint_kind, payload, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(500);

  const list = (receipts ?? []) as Array<{
    id: string;
    endpoint_kind: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
  console.log(`Receipts ultimi ${hoursBack}h: ${list.length}`);

  let activitiesUpserted = 0;
  let wellnessExportsUpserted = 0;
  let processed = 0;
  let skippedNotForAthlete = 0;

  for (const r of list) {
    const payload = r.payload && typeof r.payload === "object" ? r.payload : {};

    let belongs = false;
    const stack: unknown[] = [payload];
    while (stack.length && !belongs) {
      const node = stack.pop();
      if (!node || typeof node !== "object") continue;
      if (Array.isArray(node)) {
        for (const x of node) stack.push(x);
        continue;
      }
      const o = node as Record<string, unknown>;
      const uid = (o.userId ?? o.user_id ?? o.userUUID ?? o.userUuid) as unknown;
      if (typeof uid === "string" && garminIds.has(uid)) {
        belongs = true;
        break;
      }
      for (const v of Object.values(o)) stack.push(v);
    }
    if (!belongs) {
      skippedNotForAthlete += 1;
      continue;
    }

    processed += 1;

    try {
      const { upserted } = await materializeGarminActivitiesFromPullResponse({
        athleteId,
        endpointKind: r.endpoint_kind,
        streamKey: inferGarminActivityStreamKeyFromRoot(payload),
        responseBody: payload,
      });
      activitiesUpserted += upserted;
    } catch (err) {
      console.warn(`[${r.id.slice(0, 8)} ${r.endpoint_kind}] activities: ${err instanceof Error ? err.message : err}`);
    }

    if (collectGarminWellnessRecords(payload).length > 0) {
      try {
        const { persisted } = await materializeGarminWellnessFromPullResponse({
          athleteId,
          streamKey: r.endpoint_kind,
          responseBody: payload,
        });
        wellnessExportsUpserted += persisted;
        console.log(
          `[${r.id.slice(0, 8)} ${r.endpoint_kind}] wellness +${persisted} (${r.created_at})`,
        );
      } catch (err) {
        console.warn(`[${r.id.slice(0, 8)} ${r.endpoint_kind}] wellness: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log("--- DONE ---");
  console.log(`processed (per atleta): ${processed}`);
  console.log(`skipped (altro atleta): ${skippedNotForAthlete}`);
  console.log(`activities upserted: ${activitiesUpserted}`);
  console.log(`wellness device_sync_exports upserted: ${wellnessExportsUpserted}`);
}

void main().catch((err) => {
  console.error("FATAL:", err?.message ?? err);
  process.exitCode = 1;
});
