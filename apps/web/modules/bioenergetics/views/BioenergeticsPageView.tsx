"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, LineChart, Timer } from "lucide-react";
import type { BioenergeticsDayViewModel } from "@/api/bioenergetics/contracts";
import { GenerativeModuleSubnav } from "@/components/navigation/GenerativeModuleSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import { useActiveAthlete } from "@/lib/use-active-athlete";

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BioenergeticsPageView() {
  const { athleteId, loading: athleteLoading } = useActiveAthlete();
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vm, setVm] = useState<BioenergeticsDayViewModel | null>(null);

  useEffect(() => {
    if (athleteLoading) return;
    if (!athleteId) {
      setVm(null);
      setError("Seleziona un atleta attivo per generare il report bioenergetico.");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({ athleteId, date });
        const res = await fetch(`/api/bioenergetics/day?${q}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: await buildSupabaseAuthHeaders(),
        });
        const json = (await res.json()) as BioenergeticsDayViewModel & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setVm(null);
          setError(json.error ?? "Lettura BioEnergetic Intelligence non riuscita.");
          return;
        }
        setVm(json);
      } catch {
        if (!cancelled) {
          setVm(null);
          setError("Errore di rete durante il caricamento.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, athleteLoading, date]);

  const measuredBadge = useMemo(() => {
    if (!vm) return "—";
    const measuredCount = [vm.provenance.glucose, vm.provenance.lactate].filter((p) => p === "measured").length;
    return `${measuredCount}/2`;
  }, [vm]);

  return (
    <Pro2ModulePageShell
      eyebrow="BioEnergetic Intelligence · Focus"
      eyebrowClassName="text-lime-400"
      title="BioEnergetic Intelligence"
      description="Report fisiologico giornaliero: timeline training/nutrizione/device, provenienza misurato-vs-stimato, pathway supportivi o inibitori."
      headerActions={
        <>
          <Pro2Link href="/nutrition" variant="secondary" className="justify-center border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15">
            Nutrition
          </Pro2Link>
          <Pro2Link href="/training/calendar" variant="ghost" className="justify-center border border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/15">
            Calendar
          </Pro2Link>
        </>
      }
    >
      <div className="scroll-mt-28">
        <GenerativeModuleSubnav />
      </div>

      <section id="gen-domain" className="scroll-mt-28">
        <Pro2SectionCard accent="emerald" title="Range giornata" subtitle="Seleziona giorno report" icon={Timer}>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.currentTarget.value)}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
            <p className="text-xs text-gray-400">Dati certi prioritari; stime solo se canali mancanti.</p>
          </div>
        </Pro2SectionCard>
      </section>

      <section id="gen-body" className="scroll-mt-28 space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-cyan-500/25 bg-black/35 px-4 py-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-cyan-300">Eventi timeline</p>
            <p className="mt-1 text-xl font-semibold text-white">{vm?.timeline.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-lime-500/25 bg-black/35 px-4 py-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-lime-300">Canali misurati</p>
            <p className="mt-1 text-xl font-semibold text-white">{measuredBadge}</p>
          </div>
          <div className="rounded-2xl border border-fuchsia-500/25 bg-black/35 px-4 py-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-fuchsia-300">Pathway state</p>
            <p className="mt-1 text-xl font-semibold capitalize text-white">{vm?.kernel.pathwayState ?? "—"}</p>
          </div>
        </div>

        {error ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</p> : null}
        {athleteLoading || loading ? (
          <div className="space-y-2">
            <div className="h-3 w-full max-w-xl animate-pulse rounded bg-white/10" />
            <div className="h-24 w-full animate-pulse rounded-2xl bg-white/5" />
          </div>
        ) : null}

        {vm ? (
          <Pro2SectionCard accent="cyan" title="Kernel v1" subtitle="Contrasto domanda energetica vs esposizione CHO" icon={Activity}>
            <p className="text-sm text-gray-300">
              Glucose handling {vm.kernel.glucoseHandlingScore} · Insulin demand {vm.kernel.insulinDemandScore} ·
              Oxidation drive {vm.kernel.oxidationDriveScore}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {vm.kernel.keyDrivers.map((d) => (
                <span key={d} className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-gray-300">
                  {d}
                </span>
              ))}
            </div>
          </Pro2SectionCard>
        ) : null}
      </section>

      <section id="gen-cross" className="scroll-mt-28">
        {vm?.interpretationHints?.length ? (
          <Pro2SectionCard accent="violet" title="Interpretation" subtitle="Hint multiscala (non diagnostici)" icon={LineChart}>
            <div className="space-y-2">
              {vm.interpretationHints.map((h) => (
                <div key={h.pathwayId} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-sm font-semibold text-white">{h.title}</p>
                  <p className="text-xs text-gray-400">{h.detail}</p>
                </div>
              ))}
            </div>
          </Pro2SectionCard>
        ) : null}
      </section>

      <section id="gen-focus" className="scroll-mt-28">
        <Pro2SectionCard accent="rose" title="Disclaimers" subtitle="Sicurezza interpretativa" icon={Activity}>
          <ul className="space-y-2 text-sm text-gray-300">
            {(vm?.disclaimers ?? ["Nessuna nota disponibile."]).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Pro2SectionCard>
      </section>
    </Pro2ModulePageShell>
  );
}
