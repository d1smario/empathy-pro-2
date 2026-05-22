import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { grantEndsAtFromMonths } from "@/lib/billing/access-entitlement";
import { buildGrantNoticeCopy, insertUserAccountNotice } from "@/lib/billing/grant-user-notice";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_KINDS = new Set(["testimonial", "promo", "comp", "beta"]);

type GrantRow = {
  id: string;
  user_id: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
  granted_by_email: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
};

/**
 * GET /api/admin/grants?userId=...&onlyActive=1
 * - userId mancante: lista ultimi 100 grant (tutti gli utenti).
 * - userId presente: tutti i grant per quell'utente.
 */
export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const userId = (url.searchParams.get("userId") ?? "").trim();
  const onlyActive = url.searchParams.get("onlyActive") === "1";

  let query = admin
    .from("subscription_grants")
    .select(
      "id, user_id, kind, starts_at, ends_at, note, granted_by_email, revoked_at, revoked_reason, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (userId) query = query.eq("user_id", userId);
  if (onlyActive) {
    const nowIso = new Date().toISOString();
    query = query.is("revoked_at", null).lte("starts_at", nowIso).gt("ends_at", nowIso);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, grants: (data ?? []) as GrantRow[] });
}

/**
 * POST /api/admin/grants
 * Body: { userId, kind, durationMonths, note? }
 * Crea un nuovo grant, starts_at = now, ends_at = now + durationMonths.
 */
export async function POST(req: Request) {
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

  const body = (await req.json().catch(() => ({}))) as {
    userId?: string;
    kind?: string;
    durationMonths?: number;
    note?: string;
  };

  const userId = (body.userId ?? "").trim();
  const kind = (body.kind ?? "").trim();
  const durationMonths = Number(body.durationMonths ?? 0);
  const note = (body.note ?? "").trim() || null;

  if (!userId) {
    return NextResponse.json({ ok: false as const, error: "userId mancante." }, { status: 400 });
  }
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json(
      { ok: false as const, error: "kind non valido (testimonial | promo | comp | beta)." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(durationMonths) || durationMonths < 1 || durationMonths > 36) {
    return NextResponse.json(
      { ok: false as const, error: "durationMonths fuori range (1-36)." },
      { status: 400 },
    );
  }

  // Verifica che l'utente esista (evita FK errori opachi).
  const { data: targetUser, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !targetUser?.user) {
    return NextResponse.json({ ok: false as const, error: "Utente target non trovato." }, { status: 404 });
  }

  const startsAt = new Date().toISOString();
  const endsAt = grantEndsAtFromMonths(durationMonths, startsAt);

  const { data, error } = await admin
    .from("subscription_grants")
    .insert({
      user_id: userId,
      kind,
      starts_at: startsAt,
      ends_at: endsAt,
      note,
      granted_by_user_id: session.userId,
      granted_by_email: session.email,
    })
    .select(
      "id, user_id, kind, starts_at, ends_at, note, granted_by_email, revoked_at, revoked_reason, created_at",
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }

  const grant = data as GrantRow | null;
  let noticeSent = false;
  let noticeError: string | null = null;
  if (grant) {
    const copy = buildGrantNoticeCopy({
      kind,
      durationMonths,
      endsAt,
      note,
    });
    const notice = await insertUserAccountNotice(admin, {
      userId,
      title: copy.title,
      body: copy.body,
      grantId: grant.id,
      kind,
      durationMonths,
    });
    noticeSent = notice.ok;
    noticeError = notice.error ?? null;
  }

  return NextResponse.json({
    ok: true as const,
    grant,
    noticeSent,
    noticeError,
  });
}
