"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import type { AerodynamicsScenarioCompareV1 } from "@empathy/contracts";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import {
  applyAerodynamicsStagingRun,
  fetchAerodynamicsStagingRunDetail,
  rejectAerodynamicsStagingRun,
} from "@/modules/aerodynamics/services/aerodynamics-module-api";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export default function AerodynamicsStagingReviewView({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "confirm" | "reject">(null);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [scenarioCompare, setScenarioCompare] = useState<AerodynamicsScenarioCompareV1 | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState("baseline");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const detail = await fetchAerodynamicsStagingRunDetail(runId);
      if (cancelled) return;
      if (!detail.ok) {
        setError(detail.error ?? "Review non disponibile");
        setLoading(false);
        return;
      }
      setSignedUrl(detail.signedUrl ?? null);
      const compare = detail.scenarioCompare ?? null;
      setScenarioCompare(compare);
      setSelectedScenarioId(compare?.selectedScenarioId ?? "baseline");

      const patches = asRecord(detail.run?.proposed_structured_patches);
      const proposal = asRecord(patches?.aeroGeometryProposal);
      const conf = typeof proposal?.confidence01 === "number" ? Math.round(proposal.confidence01 * 100) : null;
      setSummary(
        `Surrogate model · confidenza CV ${conf ?? "—"}% · provider ${String(proposal?.provider ?? "—")} · ${compare?.candidates.length ?? 0} scenari`,
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  async function onConfirm() {
    setBusy("confirm");
    setError(null);
    const result = await applyAerodynamicsStagingRun(runId, selectedScenarioId);
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? "Conferma fallita");
      return;
    }
    setDone(true);
  }

  async function onReject() {
    setBusy("reject");
    setError(null);
    const result = await rejectAerodynamicsStagingRun(runId);
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? "Rifiuto fallito");
      return;
    }
    setDone(true);
  }

  return (
    <Pro2ModulePageShell
      eyebrow="Aerodynamics · Review CV"
      eyebrowClassName="text-cyan-300"
      title="Validazione proposta geometry"
      description="Scegli lo scenario posizione da promuovere. Il motore deterministico calcola CdA e score."
      headerActions={
        <Pro2Link href="/aerodynamics" variant="secondary" className="justify-center border border-white/15">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Aerodynamics
        </Pro2Link>
      }
    >
      {loading ? <p className="text-sm text-gray-400">Caricamento review...</p> : null}
      {summary ? <p className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">{summary}</p> : null}
      {scenarioCompare?.candidates.length ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm text-gray-200">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Scenario</th>
                <th className="px-3 py-2">CdA m²</th>
                <th className="px-3 py-2">ΔW @ {scenarioCompare.referenceSpeedKph} km/h</th>
                <th className="px-3 py-2">Scegli</th>
              </tr>
            </thead>
            <tbody>
              {scenarioCompare.candidates.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2">{row.cdaM2.toFixed(3)}</td>
                  <td className="px-3 py-2">{row.wattSavingsVsBaseline.toFixed(1)} W</td>
                  <td className="px-3 py-2">
                    <input
                      type="radio"
                      name="scenario"
                      checked={selectedScenarioId === row.id}
                      onChange={() => setSelectedScenarioId(row.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {signedUrl ? (
        <p className="mt-3 text-xs text-gray-400">
          Media:{" "}
          <Link href={signedUrl} target="_blank" className="text-cyan-200 underline">
            apri cattura
          </Link>
        </p>
      ) : null}
      {error ? <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
      {done ? (
        <p className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          Review chiusa. Torna al modulo per vedere test e twin aggiornati.
        </p>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          <Pro2Button onClick={onConfirm} disabled={busy != null || loading} className="justify-center">
            <Check className="mr-2 h-4 w-4" />
            {busy === "confirm" ? "Conferma..." : "Conferma scenario"}
          </Pro2Button>
          <Pro2Button variant="secondary" onClick={onReject} disabled={busy != null || loading} className="justify-center">
            <X className="mr-2 h-4 w-4" />
            {busy === "reject" ? "Rifiuto..." : "Rifiuta"}
          </Pro2Button>
        </div>
      )}
    </Pro2ModulePageShell>
  );
}
