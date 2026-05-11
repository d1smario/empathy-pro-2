import "server-only";

import { cookies, headers } from "next/headers";
import { createSupabaseCookieClient } from "@/lib/supabase/server";
import {
  DEFAULT_LOCALE,
  KNOWN_LOCALES,
  coerceLocale,
  isKnownLocale,
  parseAcceptLanguageToLocale,
  type SupportedLocale,
} from "./supported-locales";

/**
 * Risolutore canonico **server-only** della lingua di richiesta.
 *
 * Priorità deterministica (la prima sorgente che fornisce una locale **abilitata** vince):
 *   1. `app_user_profiles.preferred_locale` per `auth.uid()` (sorgente DB canonica).
 *   2. Cookie `EMPATHY_LOCALE` (selezione esplicita pre-login, es. su `/access`).
 *   3. Header `Accept-Language` (negoziazione browser).
 *   4. `DEFAULT_LOCALE` (`it`).
 *
 * Le lingue ammesse vengono lette **runtime** da `public.supported_locales` con
 * `is_enabled = true`. Se la query fallisce (network/RLS), cade su `[it, en]` come
 * minimo set sicuro (assicura `/pricing` pubblico anche con DB lento).
 *
 * Convoglia (no parallel lines): tutte le route server (layout, page, API) che
 * vogliono la locale corrente passano da qui. Niente altri ramoscelli.
 */

export const LOCALE_COOKIE_NAME = "EMPATHY_LOCALE";

const FALLBACK_ENABLED: readonly SupportedLocale[] = ["it", "en"];

/**
 * Lista lingue attive (DB) con fallback. Letta da Route Handler / Server Component.
 */
export async function loadEnabledLocales(): Promise<readonly SupportedLocale[]> {
  const supabase = createSupabaseCookieClient();
  if (!supabase) return FALLBACK_ENABLED;
  const { data, error } = await supabase
    .from("supported_locales")
    .select("code")
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true });
  if (error || !data) return FALLBACK_ENABLED;
  const codes = data
    .map((row) => (row as { code?: unknown }).code)
    .filter((c): c is string => typeof c === "string")
    .filter(isKnownLocale);
  return codes.length > 0 ? codes : FALLBACK_ENABLED;
}

/** Locale attualmente memorizzata in cookie, normalizzata. */
export function readLocaleCookie(): SupportedLocale | null {
  const raw = cookies().get(LOCALE_COOKIE_NAME)?.value ?? null;
  if (!raw) return null;
  return isKnownLocale(raw) ? raw : coerceLocale(raw, DEFAULT_LOCALE);
}

/** Locale persistita su `app_user_profiles` per la sessione corrente. */
async function readProfileLocale(): Promise<SupportedLocale | null> {
  const supabase = createSupabaseCookieClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const { data } = await supabase
    .from("app_user_profiles")
    .select("preferred_locale")
    .eq("user_id", user.id)
    .maybeSingle();
  const raw = (data as { preferred_locale?: unknown } | null)?.preferred_locale;
  if (typeof raw !== "string") return null;
  return isKnownLocale(raw) ? raw : null;
}

/**
 * Locale corrente effettiva da usare per `t()` / formattazione date.
 * Mai null: cade su `DEFAULT_LOCALE`.
 */
export async function resolveRequestLocale(): Promise<SupportedLocale> {
  const enabled = await loadEnabledLocales();
  const enabledSet = new Set<SupportedLocale>(enabled);

  const profile = await readProfileLocale();
  if (profile && enabledSet.has(profile)) return profile;

  const cookieLoc = readLocaleCookie();
  if (cookieLoc && enabledSet.has(cookieLoc)) return cookieLoc;

  const headerVal = headers().get("accept-language");
  const negotiated = parseAcceptLanguageToLocale(headerVal, enabled);
  if (negotiated) return negotiated;

  return enabledSet.has(DEFAULT_LOCALE) ? DEFAULT_LOCALE : (enabled[0] ?? DEFAULT_LOCALE);
}

/** Re-export utili al chiamante. */
export { KNOWN_LOCALES, DEFAULT_LOCALE };
export type { SupportedLocale };
