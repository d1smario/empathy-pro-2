"use client";

import { useState } from "react";

type PhaseStatus = "done" | "active" | "planned";

const PHASES: Array<{
  id: string;
  title: string;
  summary: string;
  status: PhaseStatus;
}> = [
  {
    id: "p1",
    title: "Fase 1 — Monorepo, shell, routing moduli",
    summary: "Workspaces, App Router, sidebar, placeholder generativi / standard.",
    status: "done",
  },
  {
    id: "p2",
    title: "Fase 2 — Billing Stripe (demo)",
    summary: "checkout-config, checkout-session anonimo opzionale, webhook firma + log.",
    status: "done",
  },
  {
    id: "p3",
    title: "Fase 3 — Diagnostica in Settings",
    summary: "Flag billing e integrazioni senza esporre segreti; comandi terminali sotto.",
    status: "done",
  },
  {
    id: "p4",
    title: "Fase 4 — Auth + contesto atleta (Supabase)",
    summary:
      "Login + gate shell; `useActiveAthlete` allineato a V1 (query `athlete_profiles` / `app_user_profiles` / `coach_athletes`, `POST /api/access/ensure-profile` cookie).",
    status: "done",
  },
  {
    id: "p5",
    title: "Fase 5 — Primo modulo con dati reali",
    summary:
      "Dashboard `athlete-hub`, Profile `athlete-row`, Training / Nutrition / Physiology / Health (API + card), Athletes `roster`, coach roster filtrato in `useActiveAthlete`. Prossimo: dettaglio sessione o Fase 6 knowledge.",
    status: "active",
  },
  {
    id: "p6",
    title: "Fase 6 — Knowledge / traces",
    summary: "Pipeline evidenza e tracce ricerca collegata al twin e ai moduli.",
    status: "planned",
  },
];

function StatusPill({ status }: { status: PhaseStatus }) {
  const label =
    status === "done" ? "Fatto" : status === "active" ? "In corso" : "Pianificato";
  const cls =
    status === "done"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
      : status === "active"
        ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
        : "border-white/10 bg-white/5 text-gray-500";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase ${cls}`}>
      {label}
    </span>
  );
}

/** Blocco comandi: path generico; sostituisci la cartella se il clone è altrove. */
const TERMINAL_SNIPPET = `cd "C:\\Users\\rovam\\OneDrive\\Documenti\\EMPATHY\\empathy-pro-2-cursor"
# Chiudi altri dev server (porte 3000/3020). Opzionale: Stop-Process -Name node -Force
npm run dev:clean
npm install
npm run verify
npm run dev
# Windows: build dev in apps/.empathy-pro2-next-dev (NEXT_DIST_DIR relativo). URL: localhost:3020 o porta in console`;

export function SettingsBuildPhasesCard() {
  const [open, setOpen] = useState(true);

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
      aria-label="Roadmap build Empathy Pro 2"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500/80 via-fuchsia-500/80 to-rose-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fuchsia-300">
              Roadmap · fasi
            </p>
            <p className="mt-2 max-w-xl text-sm text-gray-400">
              Stato ad alto livello dello scaffold Pro 2. Aggiorna le etichette in codice quando chiudi una fase.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-gray-300 hover:border-white/25"
          >
            {open ? "Comprimi" : "Espandi"}
          </button>
        </div>

        {open ? (
          <ol className="mt-8 space-y-4">
            {PHASES.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 sm:px-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={p.status} />
                  <h2 className="text-base font-bold text-white">{p.title}</h2>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{p.summary}</p>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="mt-10 border-t border-white/10 pt-8">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-300">
            Comandi terminal (copia quando torni)
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Adatta il path se la repo non è sotto Documenti. Su OneDrive, se la build fallisce con readlink, cancella{" "}
            <code className="text-gray-400">apps/web/.next</code> prima di <code className="text-gray-400">npm run verify</code>.
          </p>
          <pre className="mt-4 max-h-64 overflow-auto rounded-2xl border border-white/10 bg-black/50 p-4 font-mono text-[0.7rem] leading-relaxed text-gray-300 select-all">
            {TERMINAL_SNIPPET}
          </pre>
        </div>
      </div>
    </section>
  );
}
