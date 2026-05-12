/**
 * Ingress Garmin push con body grandi (es. Activity Details ~ fino a ~100 MB doc Garmin).
 * Vercel taglia spesso a ~4.5 MB → 413 prima del route handler.
 *
 * ## Cosa contiene cosa (Health API)
 *
 * - **`activityDetails` (POST qui)** = **JSON** (summary + `samples[]` / serie dove Garmin le espone).
 *   **Non** è il file FIT nativo: non aspettarti bytes `.fit` nel body della push.
 * - **File FIT / TCX / GPX** = risposta binaria di **`GET …/wellness-api/rest/activityFile`** (pull token + `id`
 *   summary). Empathy accoda quei GET dal runner (`garmin_pull_jobs` → `garmin-pull-runner` su **Vercel**) dopo
 *   il pull `activities`, oppure quando la push include `callbackURL` verso `activityFile` (stessa coda).
 *   **Fly non esegue il download del FIT**: questo host risponde 202 e persiste la push; poi (se configurato)
 *   invoca `GARMIN_PULL_TRIGGER_URL` su Vercel perché sia il runner a fare `GET activityFile` e materializzare.
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
 * - `GARMIN_ACTIVITY_DETAILS_VIA_PUSH=true` (default in `fly.garmin-ingest.toml`): non accodare GET `/rest/activityDetails`
 *   dopo persist — Garmin vieta Push+Pull Details insieme; i FIT restano su Vercel (`GET /rest/activityFile`).
 *   Su **Vercel** imposta lo stesso valore se il portale invia Activity Details verso Fly, così il pull runner dopo
 *   `activities` non richiede anche il GET Details.
 * - Opzionale: `GARMIN_PUSH_ACCEPTED_HTTP_STATUS=200` se un checker richiede solo 200 (default **202** come su Vercel).
 *
 * Avvio (da `apps/web`): npm run garmin-ingest
 * Monorepo root: cd apps/web && npm run garmin-ingest
 */

import { createClient } from "@supabase/supabase-js";
import express from "express";

import { persistGarminPushReceipt } from "@/lib/integrations/garmin-push-persist";
import { verifyGarminPushWebhookAuthPlain } from "@/lib/integrations/garmin-push-webhook-auth-plain";
import { readOptionalServiceRoleKey, readSupabasePublicUrl } from "@/lib/supabase-env";

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

/** Solo service role: `garmin_push_receipts` ha RLS senza policy anon. */
function createIngestSupabaseServiceRole() {
  const url = readSupabasePublicUrl();
  const key = readOptionalServiceRoleKey();
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY assente (obbligatoria per persist Fly ingest).");
  }
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

  /**
   * Express error handler dedicato ai path di push Garmin: qualsiasi eccezione lanciata dal
   * body parser (es. payload troppo grande, JSON malformato in fase di parsing del middleware)
   * o da middleware upstream viene convertita in **202 Accepted** con log, come richiesto
   * dal Partner Verification Garmin (no HTTP 500 visibile lato loro).
   */
  app.use(
    `${PUSH_PREFIX}`,
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error(
        "[garmin-ingest] express middleware error (convertito in 202 per Garmin Partner):",
        err instanceof Error ? err.stack ?? err.message : err,
      );
      if (!res.headersSent) {
        const pushAcceptedStatus = process.env.GARMIN_PUSH_ACCEPTED_HTTP_STATUS === "200" ? 200 : 202;
        res.status(pushAcceptedStatus).json({
          ok: true as const,
          accepted: true as const,
          hint: "Errore upstream (body parser / middleware) convertito in 202 — verifica log lato ingest.",
        });
      }
    },
  );

  app.listen(port, () => {
    console.log(
      `[garmin-ingest] listening :${port} body≤${limitMb}MB prefix=${PUSH_PREFIX} publicBase=${process.env.GARMIN_PUSH_PUBLIC_BASE_URL ?? "(forwarded / path only)"}`,
    );
  });
}

async function handleGarminPushPost(req: express.Request, res: express.Response) {
  const kind = endpointKind(req);
  /**
   * Stesso vincolo Partner di `app/api/integrations/garmin/push`: non tenere Garmin in attesa
   * di insert DB + trigger pull (payload grandi → timeout → HTTP 500 lato loro).
   * Qualunque eccezione prima dell’ack viene convertita in 202 con log, così il checker non vede 500.
   */
  const pushAcceptedStatus = process.env.GARMIN_PUSH_ACCEPTED_HTTP_STATUS === "200" ? 200 : 202;

  try {
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

    if (!readOptionalServiceRoleKey()) {
      console.error(
        "[garmin-ingest] SUPABASE_SERVICE_ROLE_KEY assente — push accettata ma non persistita (Garmin Partner: niente 500).",
      );
      res.status(pushAcceptedStatus).json({
        ok: true as const,
        accepted: true as const,
        endpointKind: kind,
        hint:
          "SUPABASE_SERVICE_ROLE_KEY mancante sull’ingest: notifica accettata ma non persistita. Configurare il secret.",
      });
      return;
    }

    res.status(pushAcceptedStatus).json({
      ok: true as const,
      accepted: true as const,
      endpointKind: kind,
      hint:
        "Elaborazione in background dopo risposta. FIT nativo: GET activityFile in coda pull su Vercel, non nel body activityDetails.",
      note: "Webhook amministrativi (deregistration, userPermissions) restano consigliati su Vercel (payload piccoli).",
    });

    void (async () => {
      try {
        const supabase = createIngestSupabaseServiceRole();
        const contentType = headerGet(req, "content-type") ?? null;
        const { id, pullJobsQueued } = await persistGarminPushReceipt({
          endpointKind: kind,
          contentType,
          parsedJson: parsed,
          supabase,
        });
        const pullHint = await triggerPullOnVercel(pullJobsQueued);
        console.log(
          `[garmin-ingest] receipt=${id} endpointKind=${kind} pullJobsQueued=${pullJobsQueued} pullTrigger=${JSON.stringify(pullHint)}`,
        );
      } catch (err) {
        console.error("[garmin-ingest] async persist failed:", err instanceof Error ? err.stack ?? err.message : err);
      }
    })();
  } catch (err) {
    console.error(
      "[garmin-ingest] unexpected pre-ack error (convertito in 202 per Garmin Partner):",
      err instanceof Error ? err.stack ?? err.message : err,
    );
    if (!res.headersSent) {
      res.status(pushAcceptedStatus).json({
        ok: true as const,
        accepted: true as const,
        endpointKind: kind,
        hint: "Errore inatteso prima dell’ack: convertito in 202 per non far vedere HTTP 500 a Garmin Partner.",
      });
    }
  }
}

void main();
