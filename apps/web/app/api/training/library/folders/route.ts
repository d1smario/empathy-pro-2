import { NextRequest, NextResponse } from "next/server";
import { requireCoachLibraryWriteContext } from "@/lib/auth/coach-library-context";
import { TrainingRouteAuthError } from "@/lib/auth/training-route-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function authError(err: unknown) {
  if (err instanceof TrainingRouteAuthError) {
    return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
  }
  const message = err instanceof Error ? err.message : "library_folders_failed";
  return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
}

export async function GET(req: NextRequest) {
  try {
    const { userId, db } = await requireCoachLibraryWriteContext(req);
    const { data, error } = await db
      .from("coach_workout_library_folders")
      .select("id, name, sort_order, created_at")
      .eq("coach_user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return NextResponse.json(
      {
        ok: true as const,
        folders: (data ?? []).map((f) => ({
          id: String((f as { id: string }).id),
          name: String((f as { name: string }).name),
          sortOrder: Number((f as { sort_order?: number }).sort_order ?? 0),
          createdAt: String((f as { created_at: string }).created_at),
        })),
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    return authError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId, db } = await requireCoachLibraryWriteContext(req);
    const body = (await req.json()) as { name?: string; sortOrder?: number };
    const name = String(body.name ?? "").trim().slice(0, 120);
    if (!name) {
      return NextResponse.json({ ok: false as const, error: "missing_name" }, { status: 400, headers: NO_STORE });
    }
    const sortOrder = Math.max(0, Math.min(9999, Math.round(Number(body.sortOrder ?? 0) || 0)));
    const { data, error } = await db
      .from("coach_workout_library_folders")
      .insert({
        org_id: orgId,
        coach_user_id: userId,
        name,
        sort_order: sortOrder,
      })
      .select("id, name, sort_order, created_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return NextResponse.json(
      {
        ok: true as const,
        folder: {
          id: String((data as { id: string }).id),
          name: String((data as { name: string }).name),
          sortOrder: Number((data as { sort_order?: number }).sort_order ?? 0),
          createdAt: String((data as { created_at: string }).created_at),
        },
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    return authError(err);
  }
}
