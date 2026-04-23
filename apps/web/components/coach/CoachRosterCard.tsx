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
          setErr(("error" in json && json.error) || "Impossibile caricare l’elenco.");
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
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-xl sm:p-6"
      aria-label="Atleti"
    >
      <div className="relative">
        <h2 className="text-lg font-bold text-white">Atleti</h2>
        <p className="mt-1 text-sm text-gray-500">Scegli con chi stai lavorando.</p>

        {showLoader ? <div className="mt-6 h-2 w-40 animate-pulse rounded-full bg-white/10" /> : null}

        {!showLoader && coachActivation === "suspended" ? (
          <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-sm text-rose-100" role="status">
            Account coach sospeso: roster non disponibile.
          </p>
        ) : null}

        {!showLoader && err ? (
          <p className="mt-4 text-sm text-amber-200/90" role="alert">
            {err}
          </p>
        ) : null}

        {!showLoader && !err && athletes.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            {role === "coach" ? "Nessun atleta collegato. Usa «Invita atleta» qui sotto." : "Nessun profilo da mostrare."}
          </p>
        ) : null}

        {!showLoader && !err && athletes.length > 0 ? (
          <ul className="mt-5 space-y-2">
            {athletes.map((a) => {
              const active = athleteId === a.id;
              return (
                <li
                  key={a.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                    active ? "border-fuchsia-500/50 bg-fuchsia-500/10" : "border-white/10 bg-black/25"
                  }`}
                >
                  <div>
                    <p className="font-medium text-white">{formatAthleteLabel(a)}</p>
                    {a.email ? <p className="text-xs text-gray-500">{a.email}</p> : null}
                    {active ? <p className="mt-1 text-xs font-medium text-fuchsia-200">Selezionato</p> : null}
                  </div>
                  {!active ? (
                    <Pro2Button
                      type="button"
                      variant="secondary"
                      className="shrink-0 text-sm"
                      onClick={() => {
                        setActiveAthleteId(a.id);
                      }}
                    >
                      Seleziona
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
