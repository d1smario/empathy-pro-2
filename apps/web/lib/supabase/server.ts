import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/integrations/integration-status";

/**
 * Client Supabase con cookie (Route Handler / Server Component).
 * Richiede middleware di refresh (`lib/supabase/update-session.ts`) per sessioni stabili.
 */
export function createSupabaseCookieClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  const cookieStore = cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component: impossibile settare cookie qui
        }
      },
    },
  });
}
