import { type NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAthleteWriteContext,
} from "@/lib/auth/athlete-read-context";
import {
  ALL_DATA_SOURCE_DOMAINS,
  type DataSourceDomain,
  type DataSourceProvider,
  isDataSourceDomain,
  isDataSourceProvider,
  loadDataSourcePreferenceMap,
} from "@/lib/integrations/data-source-preference";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };
const TABLE = "athlete_data_source_preference";

/**
 * GET /api/settings/data-source-preference?athleteId=…
 *   → { ok: true, athleteId, preferences: { wellness_sleep?: 'whoop'|…, … } }
 *
 * PUT /api/settings/data-source-preference
 *   body: { athleteId, domain, primary_provider | null }
 *   - primary_provider null/empty → cancella la preferenza per quel dominio
 *   - altrimenti upsert (athlete_id, domain) → primary_provider
 *
 * Nessuna preferenza salvata = lettura "tutti i provider" (comportamento storico).
 */
export async function GET(req: NextRequest) {
  const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
  if (!athleteId) {
    return NextResponse.json({ ok: false as const, error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
  }
  try {
    const { db } = await requireAthleteReadContext(req, athleteId);
    const preferences = await loadDataSourcePreferenceMap(db, athleteId);
    return NextResponse.json(
      {
        ok: true as const,
        athleteId,
        domains: ALL_DATA_SOURCE_DOMAINS,
        preferences,
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

export async function PUT(req: NextRequest) {
  let body: { athleteId?: string; domain?: string; primary_provider?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400, headers: NO_STORE });
  }

  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const domainRaw = typeof body.domain === "string" ? body.domain.trim() : "";
  const providerRaw = typeof body.primary_provider === "string" ? body.primary_provider.trim() : null;

  if (!athleteId || !isDataSourceDomain(domainRaw)) {
    return NextResponse.json(
      { ok: false as const, error: "Richiesti athleteId e domain valido." },
      { status: 400, headers: NO_STORE },
    );
  }
  const domain: DataSourceDomain = domainRaw;

  try {
    const { db } = await requireAthleteWriteContext(req, athleteId);

    if (!providerRaw) {
      const { error: delErr } = await db
        .from(TABLE)
        .delete()
        .eq("athlete_id", athleteId)
        .eq("domain", domain);
      if (delErr) {
        return NextResponse.json({ ok: false as const, error: delErr.message }, { status: 500, headers: NO_STORE });
      }
      return NextResponse.json(
        { ok: true as const, athleteId, domain, primary_provider: null },
        { headers: NO_STORE },
      );
    }

    if (!isDataSourceProvider(providerRaw)) {
      return NextResponse.json(
        { ok: false as const, error: "Provider non supportato." },
        { status: 400, headers: NO_STORE },
      );
    }
    const provider: DataSourceProvider = providerRaw;

    const { error: writeErr } = await db.from(TABLE).upsert(
      {
        athlete_id: athleteId,
        domain,
        primary_provider: provider,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "athlete_id,domain" },
    );

    if (writeErr) {
      return NextResponse.json({ ok: false as const, error: writeErr.message }, { status: 500, headers: NO_STORE });
    }

    return NextResponse.json(
      { ok: true as const, athleteId, domain, primary_provider: provider },
      { headers: NO_STORE },
    );
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: e.message }, { status: e.status, headers: NO_STORE });
    }
    throw e;
  }
}
