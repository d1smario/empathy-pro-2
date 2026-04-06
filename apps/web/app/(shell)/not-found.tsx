import type { Metadata } from "next";
import { Pro2Link } from "@/components/ui/empathy";

export const metadata: Metadata = {
  title: "Non trovato",
};

/**
 * 404 dentro la shell: sidebar resta, solo area principale (es. segmento modulo sconosciuto).
 */
export default function ShellNotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.35em] text-gray-500">404</p>
      <h1 className="mt-3 max-w-md text-3xl font-light tracking-tight text-white sm:text-4xl">
        Pagina non trovata
      </h1>
      <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 opacity-80" />
      <p className="mt-6 max-w-sm text-sm text-gray-400">
        Questo percorso non è nel registry moduli.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Pro2Link href="/dashboard" variant="primary" className="justify-center px-8">
          Dashboard
        </Pro2Link>
        <Pro2Link href="/" variant="ghost" className="justify-center px-8">
          Home
        </Pro2Link>
      </div>
    </div>
  );
}
