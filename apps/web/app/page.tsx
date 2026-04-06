import type { Metadata } from "next";
import Link from "next/link";
import { EMPATHY_PLATFORM_VERSION } from "@empathy/contracts";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";

export const metadata: Metadata = {
  title: "Home",
};

export default function HomePage() {
  return (
    <BrutalistAppBackdrop matrix>
      <main id="main-content" tabIndex={-1} className="relative scroll-mt-0 px-6 py-16 outline-none sm:py-24">
        <div className="relative mx-auto max-w-lg">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-purple-200 backdrop-blur-xl">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
            Empathy OS
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              Pro 2.0
            </span>
          </h1>
          <p className="mt-4 leading-relaxed text-gray-400">
            Monorepo contract-first su{" "}
            <code className="rounded-lg border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-xs text-pink-300">
              @empathy/contracts
            </code>
            .
          </p>
          <code className="mt-8 block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-purple-200 backdrop-blur-xl">
            {EMPATHY_PLATFORM_VERSION}
          </code>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/dashboard"
              className="empathy-btn-gradient inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/30"
            >
              Apri shell app
            </Link>
            <Link
              href="/training/builder"
              className="inline-flex items-center justify-center rounded-full border border-orange-500/35 bg-orange-500/10 px-8 py-3 text-sm font-medium text-orange-100 backdrop-blur-xl transition hover:border-orange-400/50"
            >
              Training builder
            </Link>
            <Link
              href="/preview"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 py-3 text-sm font-medium text-gray-300 backdrop-blur-xl transition hover:border-purple-500/40"
            >
              Marketing /preview
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Se non sei loggato, <code className="text-gray-400">/training/builder</code> ti manda ad Access. Dev: porta predefinita{" "}
            <code className="text-gray-400">3020</code> (vedi console <code className="text-gray-400">npm run dev</code>).
          </p>
          <p className="mt-8 text-center">
            <Link
              href="/pricing"
              className="text-sm text-gray-500 underline-offset-4 transition hover:text-gray-300 hover:underline"
            >
              Pricing
            </Link>
          </p>
        </div>
      </main>
    </BrutalistAppBackdrop>
  );
}
