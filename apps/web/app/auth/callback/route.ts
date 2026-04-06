import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { safeAppInternalPath } from "@/core/routing/guards";
import { getSupabasePublicConfig } from "@/lib/integrations/integration-status";

export const dynamic = "force-dynamic";

function redirectOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost && process.env.NODE_ENV === "production") {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

/**
 * OAuth / magic link: scambia `code` per sessione e imposta cookie (Supabase SSR).
 */
export async function GET(request: NextRequest) {
  const origin = redirectOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeAppInternalPath(searchParams.get("next"), "/dashboard");

  const config = getSupabasePublicConfig();
  if (!config) {
    return NextResponse.redirect(`${origin}/access?error=config`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/access?error=auth`);
  }

  const cookieStore = cookies();
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Route handler edge cases: cookie write may fail in some contexts
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/access?error=auth`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
