import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseAnonKey, readSupabasePublicUrl } from "./supabase-env";

let cached: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!cached) {
    cached = createClient(readSupabasePublicUrl(), readSupabaseAnonKey());
  }
  return cached;
}

/**
 * Client anon legacy (nessun cookie SSR). Inizializzazione lazy: non fallisce a import se mancano le env
 * (build Vercel / prerender); l’uso reale richiede comunque `NEXT_PUBLIC_SUPABASE_*`.
 * Preferire `createEmpathyBrowserSupabase` per sessione allineata al server.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
