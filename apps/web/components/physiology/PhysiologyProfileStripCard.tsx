"use client";

import { formatPhysiologicalProfileStrip, type PhysiologicalProfile } from "@empathy/domain-physiology";
import { useEffect, useState } from "react";
import { useActiveAthlete } from "@/lib/use-active-athlete";

type ApiOk = { ok: true; athleteId: string; profile: PhysiologicalProfile | null };
type ApiErr = { ok: false; error?: string };

export function PhysiologyProfileStripCard() {
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PhysiologicalProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ctxLoading) return;
    if (!athleteId) {
      setProfile(null);
      setErr("Nessun atleta attivo.");
      setLoading(false);
      return;
    }
    let c = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/physiology/profile-latest?athleteId=${encodeURIComponent(athleteId)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as ApiOk | ApiErr;
        if (c) return;
        if (!res.ok || !json.ok) {
          setProfile(null);
          setErr(("error" in json && json.error) || "Lettura non riuscita.");
          return;
        }
        setProfile(json.profile);
      } catch {
        if (!c) setErr("Errore di rete.");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [athleteId, ctxLoading]);

  return (
    <section
      className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/30 p-6 text-left backdrop-blur-md"
      aria-label="Profilo fisiologico"
    >
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-sky-300">Physiology · dati reali</p>
      <h2 className="mt-2 text-lg font-bold text-white">Profilo (ultimo)</h2>

      {ctxLoading || loading ? (
        <div className="mt-4 h-2 w-40 animate-pulse rounded-full bg-white/10" />
      ) : null}

      {!ctxLoading && !loading && err ? (
        <p className="mt-4 text-sm text-amber-300/90" role="alert">
          {err}
        </p>
      ) : null}

      {!ctxLoading && !loading && !err && !profile ? (
        <p className="mt-4 text-sm text-gray-500">Nessuna riga in physiological_profiles per questo atleta.</p>
      ) : null}

      {!ctxLoading && !loading && !err && profile ? (
        <p className="mt-4 text-sm leading-relaxed text-gray-200">{formatPhysiologicalProfileStrip(profile)}</p>
      ) : null}
    </section>
  );
}
