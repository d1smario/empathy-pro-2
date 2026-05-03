import { type NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAthleteWriteContext,
} from "@/lib/auth/athlete-read-context";
import { wahooDeletePlan, wahooGetPlan, wahooUpdatePlan } from "@/lib/integrations/wahoo-cloud-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

function parseId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await ctx.params;
  const planId = parseId(idRaw);
  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
  if (!athleteId || planId == null) {
    return NextResponse.json({ ok: false as const, error: "Missing athleteId o plan id non valido." }, { status: 400, headers: NO_STORE });
  }
  try {
    await requireAthleteReadContext(req, athleteId);
    const r = await wahooGetPlan(athleteId, planId);
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

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await ctx.params;
  const planId = parseId(idRaw);
  let body: { athleteId?: string; provider_updated_at?: string; filename?: string; plan?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400, headers: NO_STORE });
  }
  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const providerUpdatedAt = typeof body.provider_updated_at === "string" ? body.provider_updated_at.trim() : "";
  if (!athleteId || planId == null || !providerUpdatedAt || body.plan === undefined) {
    return NextResponse.json(
      { ok: false as const, error: "Richiesti athleteId, provider_updated_at, plan." },
      { status: 400, headers: NO_STORE },
    );
  }
  try {
    await requireAthleteWriteContext(req, athleteId);
    const r = await wahooUpdatePlan({
      athleteId,
      planId,
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

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await ctx.params;
  const planId = parseId(idRaw);
  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
  if (!athleteId || planId == null) {
    return NextResponse.json({ ok: false as const, error: "Missing athleteId o plan id non valido." }, { status: 400, headers: NO_STORE });
  }
  try {
    await requireAthleteWriteContext(req, athleteId);
    const r = await wahooDeletePlan(athleteId, planId);
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
