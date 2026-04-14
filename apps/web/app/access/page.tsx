import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccessAuthPanel } from "@/components/access/AccessAuthPanel";
import { AccessRedirectIfSession } from "@/components/access/AccessRedirectIfSession";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { safeAppInternalPath } from "@/core/routing/guards";
import { getSupabasePublicConfig } from "@/lib/integrations/integration-status";
import { Pro2Link } from "@/components/ui/empathy";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Access",
};

/**
 * Rotta anonima; con Supabase + sessione attiva reindirizza a `next` sicuro.
 * Magic link: interpretazione ingresso → sessione cookie; generativo resta downstream dei moduli.
 */
export default async function AccessPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const err = typeof searchParams?.error === "string" ? searchParams.error : null;
  const nextRaw = typeof searchParams?.next === "string" ? searchParams.next : null;
  const safeNext = safeAppInternalPath(nextRaw, "/dashboard");

  if (getSupabasePublicConfig()) {
    const sb = createSupabaseCookieClient();
    if (sb) {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (user) redirect(safeNext);
    }
  }

  return (
    <BrutalistAppBackdrop matrix>
      <AccessRedirectIfSession nextPath={safeNext} />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen scroll-mt-0 flex-col items-center justify-center gap-8 px-6 py-16 outline-none"
      >
        <div className="text-center">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.35em] text-gray-500">Access</p>
          <p className="mt-4 text-2xl font-black tracking-[0.12em] text-white sm:text-3xl">EMPATHY</p>
          <h1 className="mt-2 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
            Pro 2.0
          </h1>
          <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 opacity-80" />
        </div>
        {err === "auth" ? (
          <p className="max-w-sm text-center text-sm text-amber-300/90" role="alert">
            Accesso non completato (link scaduto o non valido). Riprova con un nuovo link.
          </p>
        ) : null}
        {err === "config" ? (
          <p className="max-w-sm text-center text-sm text-amber-300/90" role="alert">
            Supabase non configurato sul server.
          </p>
        ) : null}
        <AccessAuthPanel redirectAfterLogin={safeNext} />
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Pro2Link href={safeNext} variant="primary" className="justify-center">
            Vai al prodotto
          </Pro2Link>
          <Pro2Link href="/#piani" variant="secondary" className="justify-center">
            Piani e abbonamento
          </Pro2Link>
          <Pro2Link href="/" variant="ghost" className="justify-center">
            Home
          </Pro2Link>
        </div>
      </main>
    </BrutalistAppBackdrop>
  );
}
