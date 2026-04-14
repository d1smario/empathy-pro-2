import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmpathyPublicHome } from "@/components/marketing/EmpathyPublicHome";

export const metadata: Metadata = {
  title: "Empathy Pro 2.0 — Piattaforma atleta",
  description:
    "Performance e physiology adaptation: timing, stimoli, nutrizione. Piani, prova gratuita e accesso all'app Pro 2.0.",
  robots: { index: true, follow: true },
};

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Se il redirect OAuth Garmin punta per errore alla root (`/?code=...&state=...`),
 * inoltra al callback canonico così il token viene salvato.
 */
function garminOAuthMisroutedToHome(sp: PageProps["searchParams"]): string | null {
  if (!sp) return null;
  const code = firstParam(sp.code);
  const state = firstParam(sp.state);
  if (!code || !state) return null;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) q.append(key, item);
    } else {
      q.append(key, value);
    }
  }
  return `/api/integrations/garmin/callback?${q.toString()}`;
}

/** Home pubblica: pitch Empathy, piani, prova gratuita, ingresso all'app Pro 2.0. */
export default function HomePage({ searchParams }: PageProps) {
  const forward = garminOAuthMisroutedToHome(searchParams);
  if (forward) {
    redirect(forward);
  }

  const billingRaw = searchParams?.billing;
  const billing = billingRaw === "success" ? "success" : billingRaw === "cancel" ? "cancel" : undefined;

  return <EmpathyPublicHome billingFlash={billing} variant="landing" />;
}
