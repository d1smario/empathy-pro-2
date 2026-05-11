import { type NextRequest, NextResponse } from "next/server";
import { LOCALE_COOKIE_NAME, loadEnabledLocales } from "@/lib/i18n/resolve-request-locale";
import { coerceLocale, isKnownLocale } from "@/lib/i18n/supported-locales";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/settings/locale-preference
 * Restituisce locale + units correnti + lingue abilitate.
 */
export async function GET() {
  const supabase = createSupabaseCookieClient();
  if (!supabase) {
    return NextResponse.json({ ok: false as const, error: "supabase_unconfigured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ ok: false as const, error: "unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("app_user_profiles")
    .select("preferred_locale, preferred_units")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = (data as { preferred_locale?: string | null; preferred_units?: string | null } | null) ?? null;
  const enabled = await loadEnabledLocales();

  const { data: locRows } = await supabase
    .from("supported_locales")
    .select("code, display_name")
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true });

  const enabledLocaleOptions =
    (locRows ?? []).length > 0
      ? (locRows ?? []).map((row) => ({
          code: String((row as { code?: unknown }).code ?? ""),
          displayName: String((row as { display_name?: unknown }).display_name ?? ""),
        }))
      : enabled.map((code) => ({ code, displayName: code }));

  return NextResponse.json({
    ok: true as const,
    preferredLocale: profile?.preferred_locale ?? "it",
    preferredUnits: profile?.preferred_units === "imperial" ? "imperial" : "metric",
    enabledLocales: enabled,
    enabledLocaleOptions,
  });
}

/**
 * PUT /api/settings/locale-preference
 * Body: { preferredLocale?: string, preferredUnits?: 'metric'|'imperial' }
 * Aggiorna profilo + sincronizza cookie `EMPATHY_LOCALE` per il prossimo SSR.
 */
export async function PUT(req: NextRequest) {
  const supabase = createSupabaseCookieClient();
  if (!supabase) {
    return NextResponse.json({ ok: false as const, error: "supabase_unconfigured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ ok: false as const, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    preferredLocale?: unknown;
    preferredUnits?: unknown;
  };

  const updates: Record<string, string> = {};

  if (typeof body.preferredLocale === "string") {
    const enabled = await loadEnabledLocales();
    const normalized = coerceLocale(body.preferredLocale, "it");
    if (!isKnownLocale(normalized) || !enabled.includes(normalized)) {
      return NextResponse.json({ ok: false as const, error: "locale_not_enabled" }, { status: 400 });
    }
    updates.preferred_locale = normalized;
  }

  if (typeof body.preferredUnits === "string") {
    const u = body.preferredUnits.toLowerCase();
    if (u !== "metric" && u !== "imperial") {
      return NextResponse.json({ ok: false as const, error: "units_invalid" }, { status: 400 });
    }
    updates.preferred_units = u;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false as const, error: "no_changes" }, { status: 400 });
  }

  // Service role: il trigger anti-bypass su `app_user_profiles` (migration 024)
  // non blocca queste due colonne (è dedicato a `is_platform_admin` / `platform_coach_status`).
  const admin = createSupabaseAdminClient();
  const db = admin ?? supabase;
  const { error } = await db.from("app_user_profiles").update(updates).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }

  const res = NextResponse.json({
    ok: true as const,
    preferredLocale: updates.preferred_locale ?? null,
    preferredUnits: updates.preferred_units ?? null,
  });
  if (updates.preferred_locale) {
    res.cookies.set(LOCALE_COOKIE_NAME, updates.preferred_locale, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
