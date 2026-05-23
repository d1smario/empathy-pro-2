import { NextRequest, NextResponse } from "next/server";
import { requireCoachLibraryWriteContext } from "@/lib/auth/coach-library-context";
import { TrainingRouteAuthError } from "@/lib/auth/training-route-auth";
import {
  denormalizedFieldsFromContract,
  parsePro2BuilderSessionContract,
} from "@/lib/training/library/library-item-from-contract";
import { mapLibraryItemRow, type CoachWorkoutLibraryItemRow } from "@/lib/training/library/coach-workout-library-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function authError(err: unknown) {
  if (err instanceof TrainingRouteAuthError) {
    return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
  }
  const message = err instanceof Error ? err.message : "library_items_failed";
  return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
}

export async function GET(req: NextRequest) {
  try {
    const { userId, db } = await requireCoachLibraryWriteContext(req);
    const folderId = req.nextUrl.searchParams.get("folderId")?.trim() || null;
    const family = req.nextUrl.searchParams.get("family")?.trim() || null;
    const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";

    let query = db
      .from("coach_workout_library_items")
      .select(
        "id, folder_id, title, description, family, discipline, sport_tags, duration_minutes, tss_target, metadata, created_at, updated_at",
      )
      .eq("coach_user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (folderId) query = query.eq("folder_id", folderId);
    if (family && ["aerobic", "strength", "technical", "lifestyle"].includes(family)) {
      query = query.eq("family", family);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let rows = (data ?? []) as CoachWorkoutLibraryItemRow[];
    if (q) {
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.discipline.toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q),
      );
    }

    return NextResponse.json(
      { ok: true as const, items: rows.map((r) => mapLibraryItemRow(r)) },
      { headers: NO_STORE },
    );
  } catch (err) {
    return authError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId, db } = await requireCoachLibraryWriteContext(req);
    const body = (await req.json()) as {
      title?: string;
      description?: string;
      folderId?: string | null;
      contract?: unknown;
      sourcePlannedWorkoutId?: string | null;
      metadata?: Record<string, unknown>;
    };

    const contract = parsePro2BuilderSessionContract(body.contract);
    if (!contract) {
      return NextResponse.json({ ok: false as const, error: "invalid_contract" }, { status: 400, headers: NO_STORE });
    }

    const title = String(body.title ?? contract.sessionName ?? "Seduta").trim().slice(0, 200);
    if (!title) {
      return NextResponse.json({ ok: false as const, error: "missing_title" }, { status: 400, headers: NO_STORE });
    }

    const fields = denormalizedFieldsFromContract(contract);
    const folderId = body.folderId?.trim() || null;
    const description = String(body.description ?? "").trim().slice(0, 2000);
    const metadata =
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {};

    const { data, error } = await db
      .from("coach_workout_library_items")
      .insert({
        org_id: orgId,
        coach_user_id: userId,
        folder_id: folderId,
        title,
        description,
        family: fields.family,
        discipline: fields.discipline,
        sport_tags: fields.sportTags,
        duration_minutes: fields.durationMinutes,
        tss_target: fields.tssTarget,
        contract_json: contract,
        source_planned_workout_id: body.sourcePlannedWorkoutId?.trim() || null,
        metadata,
      })
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    const row = data as CoachWorkoutLibraryItemRow;
    return NextResponse.json({ ok: true as const, item: mapLibraryItemRow(row) }, { headers: NO_STORE });
  } catch (err) {
    return authError(err);
  }
}
