"use client";

import { useEffect, useState } from "react";
import type { CanonicalAthleteRow } from "@/lib/athletes/canonical-profile";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2Button } from "@/components/ui/empathy";

type RosterOk = {
  ok: true;
  role: "private" | "coach";
  athletes: CanonicalAthleteRow[];
  coachActivation?: "pending" | "suspended" | null;
};
type RosterErr = { ok: false; error?: string };

function formatAthleteLabel(a: CanonicalAthleteRow): string {
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (a.email) return a.email;
  return a.id.slice(0, 8);
}

export function CoachRosterCard() {
  const { athleteId, loading: ctxLoading, setActiveAthleteId } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"private" | "coach">("private");
  const [athletes, setAthletes] = useState<CanonicalAthleteRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [coachActivation, setCoachActivation] = useState<"pending" | "suspended" | null>(null);

  useEffect(() => {
    if (ctxLoading) return;
    let c = false;
    (async () => {
      setLoading(true);
      setErr(null);
      setCoachActivation(null);
      try {
        const res = await fetch("/api/athletes/roster", { cache: "no-store" });
        const json = (await res.json()) as RosterOk | RosterErr;
        if (c) return;
        if (!res.ok || !json.ok) {
          setAthletes([]);
          setErr(("error" in json && json.error) || "Lettura roster non riuscita.");
          return;
        }
        setRole(json.role);
        setAthletes(json.athletes);
        setCoachActivation(json.coachActivation ?? null);
      } catch {
        if (!c) setErr("Errore di rete.");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [ctxLoading]);

  const showLoader = ctxLoading || loading;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
      aria-label="Roster atleti"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500/80 via-fuchsia-500/80 to-rose-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fuchsia-300">Athletes · dati reali</p>
        <h2 className="mt-2 text-xl font-bold text-white">Contesto atleta</h2>
        <p className="mt-2 text-sm text-gray-400">
          Elenco allineato a <code className="text-gray-500">app_user_profiles</code> e{" "}
          <code className="text-gray-500">coach_athletes</code> (server usa <code className="text-gray-500">EMPATHY_COACH_ATHLETES_ORG_ID</code>{" "}
          se valorizzata).
        </p>

        {showLoader ? <div className="mt-6 h-2 w-44 animate-pulse rounded-full bg-white/10" /> : null}

        {!showLoader && coachActivation === "suspended" ? (
          <p className="mt-6 rounded-xl border border-rose-500/35 bg-rose-950/25 px-4 py-3 text-sm text-rose-100/90" role="status">
            Account coach sospeso dall’amministrazione: il roster non è operativo fino a riabilitazione.
          </p>
        ) : null}

        {!showLoader && err ? (
          <p className="mt-6 text-sm text-amber-300/90" role="alert">
            {err}
          </p>
        ) : null}

        {!showLoader && !err && athletes.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500">
            Nessun atleta collegato. {role === "coach" ? "Crea un invito qui sotto o collega il roster in Supabase." : "Completa il profilo da Access / Settings."}
          </p>
        ) : null}

        {!showLoader && !err && athletes.length > 0 ? (
          <ul className="mt-6 space-y-3">
            {athletes.map((a) => {
              const active = athleteId === a.id;
              return (
                <li
                  key={a.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                    active ? "border-fuchsia-500/40 bg-fuchsia-500/10" : "border-white/10 bg-black/20"
                  }`}
                >
                  <div>
                    <p className="font-medium text-white">{formatAthleteLabel(a)}</p>
                    {a.email ? <p className="text-xs text-gray-500">{a.email}</p> : null}
                    {active ? (
                      <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-wider text-fuchsia-300">Attivo</p>
                    ) : null}
                  </div>
                  {!active ? (
                    <Pro2Button
                      type="button"
                      variant="secondary"
                      className="shrink-0"
                      onClick={() => {
                        setActiveAthleteId(a.id);
                      }}
                    >
                      Imposta attivo
                    </Pro2Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
