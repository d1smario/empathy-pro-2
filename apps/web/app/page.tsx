import type { Metadata } from "next";
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

/** Home pubblica: pitch Empathy, piani, prova gratuita, ingresso all'app Pro 2.0. */
export default function HomePage({ searchParams }: PageProps) {
  const billingRaw = searchParams?.billing;
  const billing = billingRaw === "success" ? "success" : billingRaw === "cancel" ? "cancel" : undefined;

  return <EmpathyPublicHome billingFlash={billing} variant="landing" />;
}
