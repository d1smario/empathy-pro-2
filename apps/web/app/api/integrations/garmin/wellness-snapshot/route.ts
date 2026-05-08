import { type NextRequest, NextResponse } from "next/server";

import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import {
  garminWellnessSnapshotAllowedKeys,
  runGarminWellnessSnapshotPull,
  type GarminWellnessSnapshotStream,
} from "@/lib/integrations/garmin-wellness-snapshot-pull";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

function parseStreams(body: unknown): GarminWellnessSnapshotStream[] | null {
  if (!body || typeof body !== "object") return null;
  const streams = (body as { streams?: unknown }).streams;
  if (!Array.isArray(streams)) return null;
  const set = garminWellnessSnapshotAllowedKeys();
  const out: GarminWellnessSnapshotStream[] = [];
  for (const s of streams) {
    const key = typeof s === "string" ? s.trim() : "";
    if (set.has(key)) out.push(key as GarminWellnessSnapshotStream);
  }
  return out.length > 0 ? out : null;
}

function parseHoursBack(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  return Math.floor(raw);
}

/**
 * Pull **diretto** summary Garmin (GET `/rest/dailies` ecc.) nell’intervallo upload UTC — senza Summary Backfill.
 * Salva righe `device_sync_exports` per merge nel pannello giornaliero.
 */
export async function POST(req: NextRequest) {
  try {
    let bodyJson: Record<string, unknown> = {};
    try {
      bodyJson = ((await req.json()) as Record<string, unknown>) ?? {};
    } catch {
      return NextResponse.json({ error: "Body JSON richiesto." }, { status: 400, headers: NO_STORE });
    }

    const athleteId = String(bodyJson.athleteId ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }

    await requireAthleteReadContext(req, athleteId);

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "service_role_unconfigured" }, { status: 503, headers: NO_STORE });
    }

    const streams = parseStreams(bodyJson);
    const hoursBack = parseHoursBack(bodyJson.hoursBack);

    const pulled = await runGarminWellnessSnapshotPull({
      supabase: admin,
      athleteId,
      ...(hoursBack != null ? { hoursBack } : {}),
      ...(streams ? { streams } : {}),
    });

    const inserted = pulled.results.reduce((a, r) => a + r.inserted, 0);
    const fetched = pulled.results.reduce((a, r) => a + r.fetched, 0);
    const skipped = pulled.results.reduce((a, r) => a + r.skipped, 0);
    const allOk = pulled.results.every((r) => r.ok);

    return NextResponse.json(
      {
        ok: allOk,
        message: `Snapshot wellness: scaricati ${fetched} record, salvati ${inserted}, già presenti ${skipped}.`,
        uploadStartTimeInSeconds: pulled.uploadStart,
        uploadEndTimeInSeconds: pulled.uploadEnd,
        results: pulled.results,
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status, headers: NO_STORE });
    }
    const msg = e instanceof Error ? e.message : "wellness_snapshot_failed";
    const status =
      msg === "oauth2_env_missing" || msg === "no_garmin_link"
        ? 400
        : msg === "service_role_unconfigured"
          ? 503
          : 500;
    return NextResponse.json({ error: msg }, { status, headers: NO_STORE });
  }
}
