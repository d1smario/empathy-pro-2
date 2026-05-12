import { type NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";

import { runGarminPartnerAdminEffects } from "@/lib/integrations/garmin-admin-webhooks";
import { verifyGarminPushWebhookAuth } from "@/lib/integrations/garmin-push-webhook-auth";
import { persistGarminPushReceipt } from "@/lib/integrations/garmin-push-persist";
import { scheduleGarminImmediatePullAfterPush } from "@/lib/integrations/garmin-push-schedule-immediate-pull";
import { readOptionalServiceRoleKey } from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vedi `verifyGarminPushWebhookAuth`: token Empathy opzionale **oppure** identità app Garmin
 * (`garmin-client-id` / `oauth_consumer_key` = stesso Client ID del portale), così il portale
 * non deve appendere `?token=` agli URL fissi (evita 401 su es. CONSUMER_PERMISSIONS).
 */

function endpointKindFromParams(segments: string[] | undefined): string {
  if (!segments?.length) return "unspecified";
  return segments.join("/").slice(0, 200);
}

/**
 * Partner Verification Garmin: nel portale servono anche (oltre agli stream dati):
 * - Deregistration → `.../push/deregistration` (rimuove link atleta in DB se `userId` nel body)
 * - User permissions change → `.../push/userPermissions` (aggiorna `garmin_athlete_links.user_permissions` da payload o GET `/rest/user/permissions`)
 * - Ping → `.../push/ping` se richiesto dal test (“almeno 1 altro endpoint” oltre ai due sopra)
 * Con `GARMIN_PUSH_WEBHOOK_SECRET`: aggiungi `?token=` **oppure** lascia che Garmin invii il client id (vedi `garmin-push-webhook-auth.ts`).
 */

/**
 * GET: reachability (test manuale / verifiche che non inviano ancora POST con body).
 * Non richiede `?token=`: reachability Garmin. Il POST usa `verifyGarminPushWebhookAuth`.
 */
export async function GET(
  _req: NextRequest,
  context: { params: { segments?: string[] } },
) {
  const kind = endpointKindFromParams(context.params.segments);
  return NextResponse.json({
    ok: true as const,
    service: "empathy-pro2-garmin-push",
    endpointKind: kind,
    hint: "Garmin invia POST con JSON (dailies, activities, …). Configura nel portale un URL HTTPS per tipo.",
  });
}

/** Reachability: alcuni check usano HEAD (senza body). */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

/** Config Garmin / supporto: alcuni checker accettano solo 200; default 202 = “accepted, processing async”. */
function pushAcceptedHttpStatus(): 200 | 202 {
  return process.env.GARMIN_PUSH_ACCEPTED_HTTP_STATUS === "200" ? 200 : 202;
}

/**
 * POST: riceve notifiche push Garmin (metadata + callbackURL per pull).
 *
 * **413 Payload Too Large**: Garmin Partner Verification segnala che Activity Details può richiedere body molto grandi (doc Garmin: verifica fino a 10 MB / activity details fino a ~100 MB).
 * Su **Vercel Serverless** il limite tipico richiesta è **~4.5 MB**: sopra quella soglia il runtime può rispondere **413 prima** che questo handler legga il body.
 * Se Partner Verification fallisce per 413: ingress dedicato (reverse proxy / VM / cloud con `client_max_body_size` alto) oppure piano Vercel che permetta payload maggiori — contattare support Vercel/Garmin.
 *
 * **Risposta rapida (richiesta Garmin Partner — Elena K., 2026-05-11):** dopo auth + parse JSON, la persistenza
 * (`garmin_push_receipts` / `garmin_pull_jobs`), gli effetti admin e il pull immediato girano in **`waitUntil`**.
 * Il client riceve subito **202 Accepted**. Inoltre il top-level try/catch converte **qualunque** errore
 * pre-ack in 202 con log — Garmin **non deve mai** vedere HTTP 500 qui (l’investigazione avviene su log Vercel).
 *
 * Dopo l’inserimento in coda, `scheduleGarminImmediatePullAfterPush` avvia `runGarminPullJobs` in background.
 *
 * Esempio URL per riga nel portale:
 *   https://<host>/api/integrations/garmin/push/dailies
 *   https://<host>/api/integrations/garmin/push/activities
 *
 * **activityDetails** (body molto grande, **solo JSON** — non il FIT): su Vercel spesso 413; usa ingest dedicato
 * (`npm run garmin-ingest` su Fly/VM) e nel portale punta solo quello stream a
 * `https://<ingest-host>/api/integrations/garmin/push/activityDetails` con `GARMIN_PUSH_PUBLIC_BASE_URL` sull’ingest.
 * Il **FIT** arriva da **`GET /rest/activityFile`** (coda `garmin_pull_jobs` / **runner su Vercel**), non dal body `activityDetails`
 * né tramite stream HTTP sul Fly ingest (Fly accoda e sveglia `pull/run` su Vercel per quel download).
 *
 * **Push vs GET Activity Details (Garmin Partner):** se i Details arrivano via push (tipicamente Fly), su **Vercel**
 * imposta `GARMIN_ACTIVITY_DETAILS_VIA_PUSH=true` così il pull runner dopo `GET /rest/activities` non accoda anche
 * `GET /rest/activityDetails`. Fly ingest ha lo stesso default in `fly.garmin-ingest.toml` per `persistGarminPushReceipt`.
 */
export async function POST(
  req: NextRequest,
  context: { params: { segments?: string[] } },
) {
  const kind = endpointKindFromParams(context.params.segments);
  const acceptedStatus = pushAcceptedHttpStatus();

  /**
   * Garmin Partner ha esplicitamente chiesto di **non** rispondere HTTP 500: persist + pull devono
   * essere asincroni. Qualunque eccezione **prima** del `waitUntil` (body troppo grande, header
   * malformati, env mancante, ecc.) viene loggata e convertita in **202 Accepted**, così il
   * checker non vede mai 500. La pipeline interna ha già try/catch propri.
   */
  try {
    const contentType = req.headers.get("content-type");
    let raw = "";
    try {
      raw = await req.text();
    } catch (err) {
      console.error(
        "[garmin-push] body read failed (probabile payload > limite runtime):",
        err instanceof Error ? err.message : err,
      );
      return NextResponse.json(
        {
          ok: true as const,
          accepted: true as const,
          endpointKind: kind,
          hint:
            "Body non leggibile dal runtime (probabile > limite Vercel ~4.5 MB per Activity Details). Vedi commento route per ingest dedicato.",
        },
        { status: acceptedStatus },
      );
    }

    if (!verifyGarminPushWebhookAuth(req, raw)) {
      return NextResponse.json(
        {
          error:
            "Push non autorizzato. Con GARMIN_PUSH_WEBHOOK_SECRET: ?token= / x-empathy-garmin-secret, oppure firma OAuth1 HMAC-SHA1 valida (consumer key+secret come in Vercel), oppure garmin-client-id. Se la firma fallisce per URL, imposta GARMIN_PUSH_PUBLIC_BASE_URL=https://<host> (senza slash finale).",
        },
        { status: 401 },
      );
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
        "[garmin-push] SUPABASE_SERVICE_ROLE_KEY assente — push accettata ma non persistita (Garmin Partner: niente 500).",
      );
      return NextResponse.json(
        {
          ok: true as const,
          accepted: true as const,
          endpointKind: kind,
          hint:
            "SUPABASE_SERVICE_ROLE_KEY mancante su Vercel: notifica accettata ma non persistita. Configurare il secret.",
        },
        { status: acceptedStatus },
      );
    }

    const pipeline = (async () => {
      try {
        const admin = await runGarminPartnerAdminEffects({ endpointKind: kind, parsedJson: parsed });
        const { id, pullJobsQueued } = await persistGarminPushReceipt({
          endpointKind: kind,
          contentType,
          parsedJson: parsed,
        });
        scheduleGarminImmediatePullAfterPush(pullJobsQueued);
        console.log(
          `[garmin-push] receipt=${id} endpointKind=${kind} pullJobsQueued=${pullJobsQueued} dereg=${admin.deregistrationRemoved} permSync=${admin.userPermissionsSynced}`,
        );
      } catch (err) {
        console.error(
          "[garmin-push] async persist failed:",
          err instanceof Error ? err.stack ?? err.message : err,
        );
      }
    })();

    waitUntil(pipeline);

    return NextResponse.json(
      {
        ok: true as const,
        accepted: true as const,
        endpointKind: kind,
        hint:
          "Elaborazione in background (waitUntil). Per Activity Details con body molto grande usare ingest dedicato; vedi commento in route.",
      },
      { status: acceptedStatus },
    );
  } catch (err) {
    console.error(
      "[garmin-push] unexpected pre-ack error (convertito in 202 per Garmin Partner):",
      err instanceof Error ? err.stack ?? err.message : err,
    );
    return NextResponse.json(
      {
        ok: true as const,
        accepted: true as const,
        endpointKind: kind,
        hint: "Errore inatteso prima dell’ack: convertito in 202 per non far vedere HTTP 500 a Garmin Partner.",
      },
      { status: acceptedStatus },
    );
  }
}
