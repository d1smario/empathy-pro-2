import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Anteprima invito (token in query). Nessun dato sensibile; richiede service role.
 */
export async function GET(request: NextRequest) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false as const, error: "lookup_disabled" }, { status: 503 });
  }

  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ ok: false as const, error: "missing_token" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("coach_invitations")
    .select("expires_at, consumed_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: true as const, status: "not_found" as const });
  }

  const row = data as { expires_at: string; consumed_at: string | null };
  if (row.consumed_at) {
    return NextResponse.json({ ok: true as const, status: "consumed" as const });
  }
  if (new Date(row.expires_at) <= new Date()) {
    return NextResponse.json({ ok: true as const, status: "expired" as const, expiresAt: row.expires_at });
  }

  return NextResponse.json({
    ok: true as const,
    status: "valid" as const,
    expiresAt: row.expires_at,
  });
}
