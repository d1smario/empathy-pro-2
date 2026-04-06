"use client";

import { useActiveAthlete } from "@/lib/use-active-athlete";

function maskId(id: string | null): string {
  if (!id) return "—";
  if (id.length <= 12) return "•••";
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2.5 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="font-mono text-xs text-gray-300">{value}</span>
    </div>
  );
}

/**
 * Stato atleta attivo (locale, stessa chiave V1). Nessun schema generativo qui — solo contesto operativo.
 */
export function SettingsAthleteContextDiagnostics() {
  const { loading, signedIn, userId, athleteId, role, athletes } = useActiveAthlete();

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
      aria-label="Contesto atleta attivo"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500/80 via-pink-500/80 to-purple-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-300">
          Athlete · contesto (Pro 2)
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Stesso flusso dati di V1 (liste da Supabase, bootstrap <code className="text-gray-500">/api/access/ensure-profile</code>
          ). Chiave locale coach: <code className="text-pink-300">empathy_active_athlete_id</code>. Merge duplicati email
          server-side resta su V1 (<code className="text-gray-500">/api/athletes/repair</code>, service role).
        </p>

        {loading ? (
          <div className="mt-6 space-y-2">
            <div className="h-2 w-44 animate-pulse rounded-full bg-white/10" />
            <div className="h-2 w-52 animate-pulse rounded-full bg-white/10" />
          </div>
        ) : (
          <div className="mt-6 font-mono text-xs">
            <Row label="Sessione" value={signedIn ? "attiva" : "assente"} />
            <Row label="User id (mascherato)" value={maskId(userId)} />
            <Row label="Ruolo" value={role} />
            <Row label="Atleta attivo (risolto)" value={maskId(athleteId)} />
            <Row label="Profili visibili (lista)" value={String(athletes.length)} />
          </div>
        )}
      </div>
    </section>
  );
}
