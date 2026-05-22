import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type NoticeRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  const sb = createSupabaseCookieClient();
  if (!sb) {
    return NextResponse.json({ ok: false as const, error: "supabase_unconfigured" }, { status: 503 });
  }
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false as const, error: "unauthorized" }, { status: 401 });
  }

  const onlyUnread = req.nextUrl.searchParams.get("unread") === "1";
  let query = sb
    .from("user_account_notices")
    .select("id, kind, title, body, metadata, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (onlyUnread) query = query.is("read_at", null);

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ ok: true as const, notices: [] as NoticeRow[] });
    }
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, notices: (data ?? []) as NoticeRow[] });
}

export async function PATCH(req: NextRequest) {
  const sb = createSupabaseCookieClient();
  if (!sb) {
    return NextResponse.json({ ok: false as const, error: "supabase_unconfigured" }, { status: 503 });
  }
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false as const, error: "unauthorized" }, { status: 401 });
  }

  let body: { noticeId?: string; markAllRead?: boolean };
  try {
    body = (await req.json()) as { noticeId?: string; markAllRead?: boolean };
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  const now = new Date().toISOString();
  if (body.markAllRead) {
    const { error } = await sb
      .from("user_account_notices")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) {
      return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true as const });
  }

  const noticeId = (body.noticeId ?? "").trim();
  if (!noticeId) {
    return NextResponse.json({ ok: false as const, error: "noticeId_missing" }, { status: 400 });
  }

  const { error } = await sb
    .from("user_account_notices")
    .update({ read_at: now })
    .eq("user_id", user.id)
    .eq("id", noticeId);

  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const });
}
