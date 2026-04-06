import { NextResponse } from "next/server";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Stato sessione lato server (cookie). Nessuna email; `userId` solo se loggato.
 */
export async function GET() {
  const client = createSupabaseCookieClient();
  if (!client) {
    return NextResponse.json(
      { ok: true as const, configured: false, signedIn: false, userId: null as string | null },
      { headers: NO_STORE },
    );
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    return NextResponse.json(
      {
        ok: true as const,
        configured: true,
        signedIn: false,
        userId: null as string | null,
        authError: true as const,
      },
      { headers: NO_STORE },
    );
  }

  return NextResponse.json(
    {
      ok: true as const,
      configured: true,
      signedIn: Boolean(user),
      userId: user?.id ?? null,
    },
    { headers: NO_STORE },
  );
}
