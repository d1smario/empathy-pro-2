"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Pro2Button } from "@/components/ui/empathy";
import { clearPro2ClientSessionKeys } from "@/lib/app-session";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Footer shell: stato sessione (probe) + uscita. Con Supabase assente: messaggio demo (nessun gate middleware).
 */
export function SidebarSessionActions() {
  const pathname = usePathname() ?? "/dashboard";
  const router = useRouter();
  const t = useTranslations("Session");
  const { loading, signedIn } = useActiveAthlete();
  const [busy, setBusy] = useState(false);

  const configured = useMemo(() => Boolean(createEmpathyBrowserSupabase()), []);

  const signOut = useCallback(async () => {
    setBusy(true);
    const sb = createEmpathyBrowserSupabase();
    if (sb) await sb.auth.signOut();
    clearPro2ClientSessionKeys();
    router.push("/access");
    router.refresh();
    setBusy(false);
  }, [router]);

  if (configured === false) {
    return (
      <p className="px-1 text-[0.65rem] leading-snug text-amber-400/85">
        {t("demoNoSupabase")}
      </p>
    );
  }

  if (loading) {
    return <div className="h-9 animate-pulse rounded-xl bg-white/5" aria-hidden />;
  }

  if (!signedIn) {
    return (
      <Link
        href={`/access?next=${encodeURIComponent(pathname)}`}
        className="flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-gray-300 transition hover:border-purple-500/40 hover:text-white"
      >
        {t("signIn")}
      </Link>
    );
  }

  return (
    <Pro2Button
      type="button"
      variant="secondary"
      disabled={busy}
      onClick={() => void signOut()}
      className="w-full justify-center text-xs"
    >
      {busy ? t("signingOut") : t("signOut")}
    </Pro2Button>
  );
}
