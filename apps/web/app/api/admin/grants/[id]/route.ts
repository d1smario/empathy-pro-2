import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * DELETE /api/admin/grants/[id]
 * Revoca = soft delete: setta `revoked_at = now`, `revoked_by_user_id`, `revoked_reason`.
 * Mantiene la storia (no DELETE fisico).
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const id = (params.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false as const, error: "id mancante." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = (body.reason ?? "").trim() || null;

  const { data, error } = await admin
    .from("subscription_grants")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by_user_id: session.userId,
      revoked_reason: reason,
    })
    .eq("id", id)
    .is("revoked_at", null)
    .select("id, user_id, revoked_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false as const, error: "Grant non trovato o già revocato." }, { status: 404 });
  }

  return NextResponse.json({ ok: true as const, grant: data });
}
