"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import {
  applyBiomechanicsStagingRun,
  fetchBiomechanicsStagingRunDetail,
  rejectBiomechanicsStagingRun,
} from "@/modules/biomechanics/services/biomechanics-module-api";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export default function BiomechanicsStagingReviewView({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "confirm" | "reject">(null);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const detail = await fetchBiomechanicsStagingRunDetail(runId);
      if (cancelled) return;
      if (!detail.ok) {
        setError(detail.error ?? "Review non disponibile");
        setLoading(false);
        return;
      }
      setSignedUrl(detail.signedUrl ?? null);
      const patches = asRecord(detail.run?.proposed_structured_patches);
      const proposal = asRecord(patches?.biomechPoseProposal);
      const angles = Array.isArray(proposal?.jointAngles) ? proposal.jointAngles.length : 0;
      const conf = typeof proposal?.confidence01 === "number" ? Math.round(proposal.confidence01 * 100) : null;
      setSummary(`${angles} campioni angolo · confidenza CV ${conf ?? "—"}% · provider ${String(proposal?.provider ?? "—")}`);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  async function onConfirm() {
    setBusy("confirm");
    setError(null);
    const result = await applyBiomechanicsStagingRun(runId);
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
    const result = await rejectBiomechanicsStagingRun(runId);
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? "Rifiuto fallito");
      return;
    }
    setDone(true);
  }

  return (
    <Pro2ModulePageShell
      eyebrow="Biomechanics · Review CV"
      eyebrowClassName="text-emerald-300"
      title="Validazione proposta pose"
      description="Atleta o coach confermano la proposta CV prima che il motore deterministico scriva la sessione canonica."
      headerActions={
        <Pro2Link href="/biomechanics" variant="secondary" className="justify-center border border-white/15">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Biomechanics
        </Pro2Link>
      }
    >
      {loading ? <p className="text-sm text-gray-400">Caricamento review...</p> : null}
      {summary ? <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{summary}</p> : null}
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
        <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Review chiusa. Torna al modulo per vedere sessioni e twin aggiornati.
        </p>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          <Pro2Button onClick={onConfirm} disabled={busy != null || loading} className="justify-center">
            <Check className="mr-2 h-4 w-4" />
            {busy === "confirm" ? "Conferma..." : "Conferma sessione"}
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
