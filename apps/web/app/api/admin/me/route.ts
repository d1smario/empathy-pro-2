import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Stato sessione per sidebar / client (200 anche se non admin). */
export async function GET() {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: true as const, isAdmin: false });
  }
  return NextResponse.json({ ok: true as const, isAdmin: true, email: session.email });
}
