import { NextRequest, NextResponse } from "next/server";
import { requireCoachLibraryWriteContext } from "@/lib/auth/coach-library-context";
import { TrainingRouteAuthError } from "@/lib/auth/training-route-auth";
import { mapLibraryItemRow, type CoachWorkoutLibraryItemRow } from "@/lib/training/library/coach-workout-library-types";
import {
  denormalizedFieldsFromContract,
  parseAndPreparePro2BuilderSessionContract,
  parsePro2BuilderSessionContract,
} from "@/lib/training/library/library-item-from-contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

type RouteParams = { params: Promise<{ id: string }> };

function authError(err: unknown) {
  if (err instanceof TrainingRouteAuthError) {
    return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
  }
  const message = err instanceof Error ? err.message : "library_item_failed";
  return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { userId, db } = await requireCoachLibraryWriteContext(_req);
    const { data, error } = await db
      .from("coach_workout_library_items")
      .select("*")
      .eq("id", id.trim())
      .eq("coach_user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json({ ok: false as const, error: "not_found" }, { status: 404, headers: NO_STORE });
    }
    const contract = parsePro2BuilderSessionContract((data as CoachWorkoutLibraryItemRow).contract_json);
    if (!contract) {
      return NextResponse.json({ ok: false as const, error: "invalid_contract" }, { status: 500, headers: NO_STORE });
    }
    return NextResponse.json(
      {
        ok: true as const,
        item: mapLibraryItemRow(data as CoachWorkoutLibraryItemRow),
        contract,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    return authError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { userId, db } = await requireCoachLibraryWriteContext(req);
    const body = (await req.json()) as {
      title?: string;
      description?: string;
      folderId?: string | null;
      metadata?: Record<string, unknown>;
      contract?: unknown;
    };

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.title != null) patch.title = String(body.title).trim().slice(0, 200);
    if (body.description != null) patch.description = String(body.description).trim().slice(0, 2000);
    if (body.folderId !== undefined) patch.folder_id = body.folderId?.trim() || null;
    if (body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)) {
      patch.metadata = body.metadata;
    }
    if (body.contract !== undefined) {
      const contract = parseAndPreparePro2BuilderSessionContract(body.contract);
      if (!contract) {
        return NextResponse.json({ ok: false as const, error: "invalid_contract" }, { status: 400, headers: NO_STORE });
      }
      const fields = denormalizedFieldsFromContract(contract);
      patch.contract_json = contract;
      patch.family = fields.family;
      patch.discipline = fields.discipline;
      patch.sport_tags = fields.sportTags;
      patch.duration_minutes = fields.durationMinutes;
      patch.tss_target = fields.tssTarget;
    }

    const { data, error } = await db
      .from("coach_workout_library_items")
      .update(patch)
      .eq("id", id.trim())
      .eq("coach_user_id", userId)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json({ ok: false as const, error: "not_found" }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json(
      { ok: true as const, item: mapLibraryItemRow(data as CoachWorkoutLibraryItemRow) },
      { headers: NO_STORE },
    );
  } catch (err) {
    return authError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { userId, db } = await requireCoachLibraryWriteContext(req);
    const { error, count } = await db
      .from("coach_workout_library_items")
      .delete({ count: "exact" })
      .eq("id", id.trim())
      .eq("coach_user_id", userId);
    if (error) throw new Error(error.message);
    if (!count) {
      return NextResponse.json({ ok: false as const, error: "not_found" }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true as const }, { headers: NO_STORE });
  } catch (err) {
    return authError(err);
  }
}
