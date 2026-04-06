/** DB client factories — pass URL/anon key from env at the app boundary; no secrets in this package. */
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const INTEGRATION = "@empathy/integrations-supabase" as const;

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export function isSupabasePublicConfigured(c: Partial<SupabasePublicConfig>): c is SupabasePublicConfig {
  return Boolean(c.url?.trim() && c.anonKey?.trim());
}

/**
 * Browser / client components: session persistence enabled (default Supabase behaviour).
 */
export function createSupabaseBrowserClient(config: SupabasePublicConfig): SupabaseClient {
  return createClient(config.url, config.anonKey);
}

/**
 * Server jobs without user cookie session (cron, scripts). Prefer `@supabase/ssr` in Route Handlers when auth matters.
 */
export function createSupabaseServiceStyleClient(config: SupabasePublicConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
