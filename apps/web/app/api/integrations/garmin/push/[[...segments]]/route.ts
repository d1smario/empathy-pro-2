import { type NextRequest, NextResponse } from "next/server";

import { persistGarminPushReceipt } from "@/lib/integrations/garmin-push-persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifica opzionale: imposta `GARMIN_PUSH_WEBHOOK_SECRET` e aggiungi alla URL del portale Garmin
 * `?token=<secret>` oppure header `x-empathy-garmin-secret: <secret>`.
 */
function verifyOptionalWebhookSecret(req: NextRequest): boolean {
  const secret = process.env.GARMIN_PUSH_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const q = req.nextUrl.searchParams.get("token")?.trim();
  if (q === secret) return true;
  const h = req.headers.get("x-empathy-garmin-secret")?.trim();
  return h === secret;
}

function endpointKindFromParams(segments: string[] | undefined): string {
  if (!segments?.length) return "unspecified";
  return segments.join("/").slice(0, 200);
}

/**
 * GET: verifica reachability (utile per test manuale / alcuni flussi partner).
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

/**
 * POST: riceve notifiche push Garmin (metadata + callbackURL per pull).
 * Esempio URL per riga nel portale:
 *   https://<host>/api/integrations/garmin/push/dailies
 *   https://<host>/api/integrations/garmin/push/activities
 */
export async function POST(
  req: NextRequest,
  context: { params: { segments?: string[] } },
) {
  if (!verifyOptionalWebhookSecret(req)) {
    return NextResponse.json({ error: "Webhook secret non valido." }, { status: 401 });
  }

  const kind = endpointKindFromParams(context.params.segments);
  const contentType = req.headers.get("content-type");
  const raw = await req.text();
  let parsed: unknown = { raw: raw.slice(0, 50_000) };
  if (raw.trim().length > 0) {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = { parse_error: true, raw_prefix: raw.slice(0, 2000) };
    }
  }

  try {
    const { id, pullJobsQueued } = await persistGarminPushReceipt({
      endpointKind: kind,
      contentType,
      parsedJson: parsed,
    });
    return NextResponse.json(
      { ok: true as const, id, endpointKind: kind, pullJobsQueued },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Persistenza push fallita.";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
