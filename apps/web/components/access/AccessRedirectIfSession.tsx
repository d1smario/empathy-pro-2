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
      if (data.session) router.replace(nextPath);
    })();
    return () => {
      cancelled = true;
    };
  }, [nextPath, router]);

  return null;
}
