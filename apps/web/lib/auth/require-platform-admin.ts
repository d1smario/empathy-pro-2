import "server-only";

import { resolvePlatformAdminAccess } from "@/lib/platform-admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export type PlatformAdminSession = {
  userId: string;
  email: string;
};

/**
 * Sessione Supabase cookie + admin: allowlist deploy **e** `is_platform_admin` in DB.
 */
export async function requirePlatformAdminSession(): Promise<PlatformAdminSession | null> {
  const supabase = createSupabaseCookieClient();
  if (!supabase) return null;

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) return null;

  const email = user.email?.trim() ?? "";
  if (!email) return null;

  const { data: profile, error: profErr } = await supabase
    .from("app_user_profiles")
    .select("is_platform_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) return null;

  const profileIsAdmin = (profile as { is_platform_admin?: boolean } | null)?.is_platform_admin === true;
  if (!resolvePlatformAdminAccess({ email, profileIsAdmin })) return null;

  return { userId: user.id, email };
}
