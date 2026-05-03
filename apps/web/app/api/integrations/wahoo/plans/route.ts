import { type NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAthleteWriteContext,
} from "@/lib/auth/athlete-read-context";
import { wahooCreatePlan, wahooListPlans } from "@/lib/integrations/wahoo-cloud-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

/** GET /v1/plans — elenco piani libreria utente (scope `plans_read`). */
export async function GET(req: NextRequest) {
  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
  const externalId = req.nextUrl.searchParams.get("external_id")?.trim() || undefined;
  if (!athleteId) {
    return NextResponse.json({ ok: false as const, error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
  }
  try {
    await requireAthleteReadContext(req, athleteId);
    const r = await wahooListPlans(athleteId, externalId);
    if (!r.ok) {
      return NextResponse.json({ ok: false as const, error: r.error, status: r.status }, { status: r.status, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true as const, data: r.data }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: e.message }, { status: e.status, headers: NO_STORE });
    }
    throw e;
  }
}

/** POST — crea plan (`plans_write`): body JSON con `plan` (oggetto file), `external_id`, `provider_updated_at`. */
export async function POST(req: NextRequest) {
  let body: {
    athleteId?: string;
    external_id?: string;
    provider_updated_at?: string;
    filename?: string;
    plan?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400, headers: NO_STORE });
  }
  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const externalId = typeof body.external_id === "string" ? body.external_id.trim() : "";
  const providerUpdatedAt = typeof body.provider_updated_at === "string" ? body.provider_updated_at.trim() : "";
  if (!athleteId || !externalId || !providerUpdatedAt || body.plan === undefined) {
    return NextResponse.json(
      { ok: false as const, error: "Richiesti athleteId, external_id, provider_updated_at, plan (oggetto JSON)." },
      { status: 400, headers: NO_STORE },
    );
  }
  try {
    await requireAthleteWriteContext(req, athleteId);
    const r = await wahooCreatePlan({
      athleteId,
      externalId,
      providerUpdatedAtIso: providerUpdatedAt,
      planFileJson: body.plan,
      filename: typeof body.filename === "string" ? body.filename.trim() : undefined,
    });
    if (!r.ok) {
      return NextResponse.json({ ok: false as const, error: r.error, status: r.status }, { status: r.status, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true as const, data: r.data }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: e.message }, { status: e.status, headers: NO_STORE });
    }
    throw e;
  }
}
