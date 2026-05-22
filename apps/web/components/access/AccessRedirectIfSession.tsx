"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Se la sessione Supabase esiste già nel browser ma la RSC non l’ha vista (timing/cookie),
 * evita di mostrare di nuovo il form magic link.
 */
export function AccessRedirectIfSession({ nextPath }: { nextPath: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) return;
      try {
        const entRes = await fetch("/api/billing/entitlement", { cache: "no-store" });
        const ent = (await entRes.json()) as {
          ok?: boolean;
          hasAthleteAccess?: boolean;
          hasOperatorAccess?: boolean;
        };
        if (entRes.ok && ent.ok) {
          if (ent.hasOperatorAccess && !ent.hasAthleteAccess) {
            router.replace("/athletes");
            return;
          }
          if (ent.hasAthleteAccess) {
            router.replace(nextPath);
            return;
          }
        }
      } catch {
        /* entitlement check failed — server RSC gate will apply on navigation */
      }
      router.replace("/access/plan");
    })();
    return () => {
      cancelled = true;
    };
  }, [nextPath, router]);

  return null;
}
