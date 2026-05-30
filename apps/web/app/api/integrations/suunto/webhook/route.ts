import { createHmac, timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runSuuntoPullForAthlete } from "@/lib/integrations/suunto-pull-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook push Suunto Cloud (notifica nuovo workout).
 * @see https://apizone.suunto.com — Webhook notifications.
 *
 * Sicurezza: il corpo grezzo è firmato HMAC-SHA256 con `SUUNTO_WEBHOOK_SECRET`; la firma arriva nell'header
 * `X-HMAC-SHA256-Signature` (accettiamo hex o base64). Confronto timing-safe.
 *
 * Flusso: verifica firma → risoluzione `username` (claim `user` = external_user_id) → atleta in `vendor_oauth_links`
 * → trigger `runSuuntoPullForAthlete` (best-effort). Convoglia nella pipeline canonica (no logica parallela).
 *
 * Nota: alcune integrazioni Suunto inviano un GET di verifica con `challenge`/`hub.challenge`: lo rimandiamo indietro.
 */

const NO_STORE = { "Cache-Control": "no-store" as const };

function signaturesMatch(rawBody: string, secret: string, provided: string): boolean {
  const candidateHex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const candidateB64 = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const normalizedProvided = provided.trim().replace(/^sha256=/i, "");
  for (const candidate of [candidateHex, candidateB64]) {
    if (candidate.length !== normalizedProvided.length) continue;
    try {
      if (timingSafeEqual(Buffer.from(candidate), Buffer.from(normalizedProvided))) return true;
    } catch {
      // length mismatch in Buffer compare → ignora
    }
  }
  return false;
}

function extractSuuntoUsername(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  const candidates = [obj.username, obj.user, obj.userName, obj.owner];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  // payload annidato (es. { data: { username } })
  const data = obj.data;
  if (data && typeof data === "object") return extractSuuntoUsername(data);
  return null;
}

export async function GET(req: NextRequest) {
  const challenge =
    req.nextUrl.searchParams.get("challenge") ?? req.nextUrl.searchParams.get("hub.challenge");
  if (challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain", ...NO_STORE } });
  }
  return NextResponse.json({ ok: true as const, service: "suunto-webhook" }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const secret = process.env.SUUNTO_WEBHOOK_SECRET?.trim();
  const rawBody = await req.text();

  if (secret) {
    const signature =
      req.headers.get("x-hmac-sha256-signature") ??
      req.headers.get("X-HMAC-SHA256-Signature") ??
      req.headers.get("x-suunto-signature");
    if (!signature || !signaturesMatch(rawBody, secret, signature)) {
      return NextResponse.json({ ok: false as const, error: "invalid_signature" }, { status: 401, headers: NO_STORE });
    }
  }

  let payload: unknown = null;
  try {
    payload = rawBody.trim() ? (JSON.parse(rawBody) as unknown) : null;
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400, headers: NO_STORE });
  }

  const username = extractSuuntoUsername(payload);
  if (!username) {
    // Notifica senza username risolvibile: accusiamo ricezione per non far ritentare all'infinito.
    return NextResponse.json({ ok: true as const, ignored: "no_username" }, { headers: NO_STORE });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false as const, error: "service_role_unconfigured" }, { status: 503, headers: NO_STORE });
  }

  const { data, error } = await admin
    .from("vendor_oauth_links")
    .select("athlete_id")
    .eq("vendor", "suunto")
    .eq("external_user_id", username)
    .maybeSingle();

  if (error || !data?.athlete_id) {
    return NextResponse.json({ ok: true as const, ignored: "athlete_not_found" }, { headers: NO_STORE });
  }

  const athleteId = String(data.athlete_id);
  try {
    const result = await runSuuntoPullForAthlete({ athleteId });
    return NextResponse.json({ ok: true as const, athleteId, ...result }, { headers: NO_STORE });
  } catch (e) {
    // Errore di pull: rispondiamo 200 per evitare retry aggressivi; il cron recupererà.
    return NextResponse.json(
      { ok: true as const, athleteId, pullError: e instanceof Error ? e.message : String(e) },
      { headers: NO_STORE },
    );
  }
}
