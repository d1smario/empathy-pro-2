import { type NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAthleteWriteContext,
} from "@/lib/auth/athlete-read-context";
import {
  allowedIngestStreamKeysForProvider,
  defaultStreamsForProvider,
  isIngestPolicyProvider,
  mergeIngestStreamsWithDefaults,
  parseIngestStreamEnabled,
  type IngestPolicyProvider,
} from "@empathy/contracts";
import {
  buildDeviceIngestPolicyGetPayload,
  listLinkedDeviceIngestProviders,
  normalizePolicyProvider,
} from "@/lib/integrations/ingest-stream-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

const POLICY_TABLE = "athlete_device_ingest_policy";

export async function GET(req: NextRequest) {
  const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
  if (!athleteId) {
    return NextResponse.json({ ok: false as const, error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
  }

  try {
    const { db } = await requireAthleteReadContext(req, athleteId);
    const providers = await buildDeviceIngestPolicyGetPayload(athleteId, db);
    return NextResponse.json({ ok: true as const, athleteId, providers }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: e.message }, { status: e.status, headers: NO_STORE });
    }
    throw e;
  }
}

export async function PATCH(req: NextRequest) {
  let body: { athleteId?: string; provider?: string; streams?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400, headers: NO_STORE });
  }

  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const providerRaw = typeof body.provider === "string" ? body.provider.trim() : "";
  const streamsIn = body.streams && typeof body.streams === "object" && !Array.isArray(body.streams) ? body.streams : null;

  if (!athleteId || !providerRaw || !streamsIn) {
    return NextResponse.json(
      { ok: false as const, error: "Richiesti athleteId, provider e streams (oggetto)." },
      { status: 400, headers: NO_STORE },
    );
  }

  if (!isIngestPolicyProvider(providerRaw)) {
    return NextResponse.json({ ok: false as const, error: "Provider non supportato." }, { status: 400, headers: NO_STORE });
  }

  const provider = providerRaw as IngestPolicyProvider;

  try {
    const { db } = await requireAthleteWriteContext(req, athleteId);
    const linked = await listLinkedDeviceIngestProviders(athleteId);
    if (!linked.includes(provider)) {
      return NextResponse.json(
        { ok: false as const, error: "Provider non collegato per questo atleta." },
        { status: 403, headers: NO_STORE },
      );
    }

    const allowed = new Set(allowedIngestStreamKeysForProvider(provider));
    const partial: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(streamsIn)) {
      if (!allowed.has(k)) {
        return NextResponse.json(
          { ok: false as const, error: `Chiave stream non ammessa per questo provider: ${k}` },
          { status: 400, headers: NO_STORE },
        );
      }
      partial[k] = parseIngestStreamEnabled(v);
    }

    if (Object.keys(partial).length === 0) {
      return NextResponse.json({ ok: false as const, error: "streams vuoto o nessuna chiave valida." }, { status: 400, headers: NO_STORE });
    }

    const defaults = defaultStreamsForProvider(provider);
    const { data: row, error: readErr } = await db
      .from(POLICY_TABLE)
      .select("streams")
      .eq("athlete_id", athleteId)
      .eq("provider", normalizePolicyProvider(provider))
      .maybeSingle();

    if (readErr) {
      return NextResponse.json({ ok: false as const, error: readErr.message }, { status: 500, headers: NO_STORE });
    }

    const merged = mergeIngestStreamsWithDefaults(row?.streams as Record<string, unknown> | undefined, defaults);
    const next = { ...merged, ...partial };

    const { error: writeErr } = await db.from(POLICY_TABLE).upsert(
      {
        athlete_id: athleteId,
        provider: normalizePolicyProvider(provider),
        streams: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "athlete_id,provider" },
    );

    if (writeErr) {
      return NextResponse.json({ ok: false as const, error: writeErr.message }, { status: 500, headers: NO_STORE });
    }

    return NextResponse.json(
      {
        ok: true as const,
        athleteId,
        provider,
        streams: next,
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: e.message }, { status: e.status, headers: NO_STORE });
    }
    throw e;
  }
}
