"use client";

import { useEffect, useMemo, useRef } from "react";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import { classifyClientError } from "@/lib/errors/classify-client-error";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const classified = useMemo(() => classifyClientError(error), [error]);
  const autoReloadAttempted = useRef(false);

  useEffect(() => {
    console.error("[empathy:error-boundary]", {
      name: error.name,
      message: error.message,
      digest: error.digest,
      kind: classified.kind,
    });
  }, [error, classified.kind]);

  useEffect(() => {
    if (!classified.suggestHardReload || autoReloadAttempted.current) return;
    if (typeof window === "undefined") return;
    const w = window as Window & { __empathyErrorHardReloadDone?: boolean };
    if (w.__empathyErrorHardReloadDone) return;
    autoReloadAttempted.current = true;
    w.__empathyErrorHardReloadDone = true;
    const t = window.setTimeout(() => {
      window.location.reload();
    }, 400);
    return () => window.clearTimeout(t);
  }, [classified.suggestHardReload]);

  const handleRetry = () => {
    if (classified.suggestHardReload) {
      window.location.reload();
      return;
    }
    reset();
  };

  return (
    <BrutalistAppBackdrop matrix={false}>
      <main
        id="main-content"
        tabIndex={-1}
        className="relative flex min-h-[70vh] scroll-mt-0 flex-col items-center justify-center px-6 py-16 text-center outline-none"
      >
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.35em] text-gray-500">Errore</p>
        <h1 className="mt-3 max-w-md text-3xl font-light tracking-tight text-white sm:text-4xl">
          {classified.titleIt}
        </h1>
        <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 opacity-80" />
        <p className="mt-6 max-w-sm text-sm text-gray-400">{classified.bodyIt}</p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[0.65rem] text-gray-600" aria-hidden>
            ref: {error.digest.slice(0, 12)}
          </p>
        ) : null}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Pro2Button type="button" variant="primary" className="px-8" onClick={handleRetry}>
            {classified.suggestHardReload ? "Ricarica app" : "Riprova"}
          </Pro2Button>
          <Pro2Link href="/" variant="secondary" className="justify-center px-8">
            Home
          </Pro2Link>
          <Pro2Link href="/dashboard" variant="ghost" className="justify-center px-8">
            Dashboard
          </Pro2Link>
        </div>
      </main>
    </BrutalistAppBackdrop>
  );
}
