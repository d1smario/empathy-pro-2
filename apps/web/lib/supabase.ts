import { createClient } from "@supabase/supabase-js";
import { readSupabaseAnonKey, readSupabasePublicUrl } from "./supabase-env";

const supabaseUrl = readSupabasePublicUrl();
const supabaseAnonKey = readSupabaseAnonKey();

/** Client anon browser / condiviso con moduli che richiedono la stessa shape di V1. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
