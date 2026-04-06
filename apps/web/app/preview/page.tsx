import type { Metadata } from "next";
import Link from "next/link";
import { EmpathyProMarketingDemo } from "@/components/marketing/EmpathyProMarketingDemo";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

export default function PreviewPage() {
  return (
    <main id="main-content" tabIndex={-1} className="relative scroll-mt-0 outline-none">
      <div className="fixed top-4 right-4 z-50">
        <Link
          href="/"
          className="rounded-full border border-fuchsia-500/40 bg-black/60 px-4 py-2 font-mono text-xs text-violet-200 shadow-[0_0_24px_rgba(168,85,247,0.35)] backdrop-blur-md transition hover:border-orange-400/50 hover:text-white"
        >
          ← Home
        </Link>
      </div>
      <EmpathyProMarketingDemo />
    </main>
  );
}
