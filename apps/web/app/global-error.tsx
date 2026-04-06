"use client";

import { Outfit, JetBrains_Mono } from "next/font/google";
import { useEffect } from "react";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

/**
 * Sostituisce root layout se l’errore avviene lì: serve `<html>` + `<body>` propri.
 * UI minimale e dipendenze ridotte rispetto al layout normale.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="it" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-black font-sans text-white antialiased">
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-h-screen scroll-mt-0 flex-col items-center justify-center px-6 py-16 text-center outline-none"
        >
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.35em] text-gray-500">
            Errore critico
          </p>
          <h1 className="mt-3 max-w-md text-3xl font-light tracking-tight text-white sm:text-4xl">
            Impossibile caricare l&apos;app
          </h1>
          <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 opacity-80" />
          <p className="mt-6 max-w-sm text-sm text-gray-400">
            Ricarica la pagina o torna più tardi.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={reset}
              className="empathy-btn-gradient inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/30"
            >
              Riprova
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 py-3 text-sm font-medium text-gray-300 backdrop-blur-xl transition hover:border-purple-500/40"
            >
              Home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
