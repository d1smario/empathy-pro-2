/**
 * Ingress Garmin push con body grandi (es. Activity Details ~ fino a ~100 MB doc Garmin).
 * Vercel taglia spesso a ~4.5 MB → 413 prima del route handler.
 *
 * ## Cosa contiene cosa (Health API)
 *
 * - **`activityDetails` (POST qui)** = **JSON** (summary + `samples[]` / serie dove Garmin le espone).
 *   **Non** è il file FIT nativo: non aspettarti bytes `.fit` nel body della push.
 * - **File FIT / TCX / GPX** = risposta binaria di **`GET …/wellness-api/rest/activityFile`** (pull token + `id`
 *   summary). Empathy accoda quei GET dal runner (`garmin_pull_jobs` → `garmin-pull-runner` su Vercel) dopo
 *   il pull `activities`, oppure quando la push include `callbackURL` verso `activityFile` (stessa coda).
 *
 * Deploy questo processo su Fly/Railway/VM con limite HTTP alto; nel portale Garmin imposta **solo**
 * gli stream con payload pesante (tipicamente `activityDetails`) verso l’URL pubblico di questo host:
 *   https://<ingest-host>/api/integrations/garmin/push/activityDetails
 * Altri push (dailies, ping, userPermissions, …) possono restare su Vercel.
 *
 * Env (stesso progetto Supabase di Pro 2):
 * - NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (obbligatori per persist)
 * - Stesse chiavi Garmin OAuth/consumer del portale (`GARMIN_OAUTH2_*`, ecc.)
 * - GARMIN_PUSH_PUBLIC_BASE_URL=https://<ingest-host>  (deve coincidere con l’URL configurato nel portale, senza slash finale)
 * - GARMIN_PULL_TRIGGER_URL=https://empathy-pro-2-web.vercel.app/api/integrations/garmin/pull/run
 * - GARMIN_PULL_RUN_SECRET (uguale a Vercel)
 *
 * Avvio (da `apps/web`): npm run garmin-ingest
 * Monorepo root: cd apps/web && npm run garmin-ingest
 */

import { createClient } from "@supabase/supabase-js";
import express from "express";

import { persistGarminPushReceipt } from "@/lib/integrations/garmin-push-persist";
import { verifyGarminPushWebhookAuthPlain } from "@/lib/integrations/garmin-push-webhook-auth-plain";
import {
  readOptionalServiceRoleKey,
  readSupabaseAnonKey,
  readSupabasePublicUrl,
} from "@/lib/supabase-env";

const PUSH_PREFIX = "/api/integrations/garmin/push";

function endpointKind(req: express.Request): string {
  const pathname = req.originalUrl.split("?")[0];
  if (pathname === PUSH_PREFIX || pathname === `${PUSH_PREFIX}/`) return "unspecified";
  const marker = `${PUSH_PREFIX}/`;
  const idx = pathname.indexOf(marker);
  if (idx >= 0) {
    const rest = pathname.slice(idx + marker.length);
    return rest.split("/").filter(Boolean).join("/").slice(0, 200) || "unspecified";
  }
  return "unspecified";
}

function headerGet(req: express.Request, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

function createIngestSupabase() {
  const url = readSupabasePublicUrl();
  const key = readOptionalServiceRoleKey() ?? readSupabaseAnonKey();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function triggerPullOnVercel(pullJobsQueued: number): Promise<{ ok: boolean; detail?: string }> {
  if (pullJobsQueued <= 0) return { ok: true };
  if (process.env.GARMIN_PUSH_DISABLE_IMMEDIATE_PULL === "1") return { ok: true };

  const rawUrl =
    process.env.GARMIN_PULL_TRIGGER_URL?.trim() ||
    "https://empathy-pro-2-web.vercel.app/api/integrations/garmin/pull/run";
  const secret = process.env.GARMIN_PULL_RUN_SECRET?.trim();
  if (!secret) {
    return {
      ok: false,
      detail: "GARMIN_PULL_RUN_SECRET assente — impossibile avviare il pull su Vercel.",
    };
  }

  const limit = Math.min(25, Math.max(1, pullJobsQueued));
  const res = await fetch(rawUrl.replace(/\/$/, ""), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ limit }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, detail: `pull/run HTTP ${res.status}: ${t.slice(0, 500)}` };
  }
  return { ok: true };
}

function parseLimitMb(): number {
  const raw = process.env.GARMIN_INGEST_BODY_LIMIT_MB?.trim();
  const n = raw ? Number(raw) : 96;
  if (!Number.isFinite(n)) return 96;
  return Math.min(256, Math.max(8, Math.floor(n)));
}

async function main() {
  const port = Number(process.env.GARMIN_INGEST_PORT?.trim()) || 8790;
  const limitMb = parseLimitMb();

  const app = express();
  app.disable("x-powered-by");

  const textParser = express.text({
    limit: `${limitMb}mb`,
    type: () => true,
  });

  const jsonReachability = (req: express.Request, res: express.Response) => {
    const kind = endpointKind(req);
    res.json({
      ok: true as const,
      service: "empathy-pro2-garmin-ingest",
      endpointKind: kind,
      hint: "Garmin invia POST con JSON. Activity Details: punta il portale verso questo host + GARMIN_PUSH_PUBLIC_BASE_URL uguale all’URL pubblico. FIT nativo: GET activityFile (coda pull su Vercel), non il JSON activityDetails.",
    });
  };

  app.get(PUSH_PREFIX, jsonReachability);
  app.get(`${PUSH_PREFIX}/`, jsonReachability);
  app.get(`${PUSH_PREFIX}/*`, jsonReachability);

  app.head(PUSH_PREFIX, (_req, res) => {
    res.sendStatus(200);
  });
  app.head(`${PUSH_PREFIX}/`, (_req, res) => {
    res.sendStatus(200);
  });
  app.head(`${PUSH_PREFIX}/*`, (_req, res) => {
    res.sendStatus(200);
  });

  app.post(PUSH_PREFIX, textParser, handleGarminPushPost);
  app.post(`${PUSH_PREFIX}/`, textParser, handleGarminPushPost);
  app.post(`${PUSH_PREFIX}/*`, textParser, handleGarminPushPost);

  app.listen(port, () => {
    console.log(
      `[garmin-ingest] listening :${port} body≤${limitMb}MB prefix=${PUSH_PREFIX} publicBase=${process.env.GARMIN_PUSH_PUBLIC_BASE_URL ?? "(forwarded / path only)"}`,
    );
  });
}

async function handleGarminPushPost(req: express.Request, res: express.Response) {
  const kind = endpointKind(req);
  const raw = typeof req.body === "string" ? req.body : "";
  const fakeHost = req.headers.host || "localhost";
  const url = new URL(req.originalUrl, `http://${fakeHost}`);

  if (
    !verifyGarminPushWebhookAuthPlain({
      pathWithSearch: url.pathname + url.search,
      forwardedProto: headerGet(req, "x-forwarded-proto"),
      forwardedHost: headerGet(req, "x-forwarded-host"),
      rawBody: raw,
      queryToken: url.searchParams.get("token"),
      headerGet: (name) => headerGet(req, name) ?? null,
    })
  ) {
    res.status(401).json({
      error:
        "Push non autorizzato. Con GARMIN_PUSH_WEBHOOK_SECRET: ?token= / x-empathy-garmin-secret, OAuth1, o garmin-client-id. Per firma OAuth: GARMIN_PUSH_PUBLIC_BASE_URL deve essere l’URL pubblico di questo ingest (come nel portale).",
    });
    return;
  }

  let parsed: unknown = { raw: raw.slice(0, 50_000) };
  if (raw.trim().length > 0) {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = { parse_error: true, raw_prefix: raw.slice(0, 2000) };
    }
  }

  try {
    const supabase = createIngestSupabase();
    const contentType = headerGet(req, "content-type") ?? null;
    const { id, pullJobsQueued } = await persistGarminPushReceipt({
      endpointKind: kind,
      contentType,
      parsedJson: parsed,
      supabase,
    });

    const pullHint = await triggerPullOnVercel(pullJobsQueued);

    const activityDataHint =
      kind.toLowerCase() === "activitydetails"
        ? "activityDetails=JSON (serie/campioni). FIT/TCX/GPX=GET activityFile in coda pull (non nel body di questa push)."
        : null;

    res.status(200).json({
      ok: true as const,
      id,
      endpointKind: kind,
      pullJobsQueued,
      pullTrigger: pullHint,
      note: "Webhook amministrativi (deregistration, userPermissions) restano consigliati su Vercel (payload piccoli).",
      ...(activityDataHint ? { activityDataHint } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Persistenza push fallita.";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    res.status(status).json({ ok: false as const, error: message });
  }
}

void main();
