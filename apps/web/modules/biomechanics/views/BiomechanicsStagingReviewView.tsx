"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import type { BiomechanicsJointAngleSample, BiomechanicsLandmark3D } from "@empathy/contracts";
import { computeBiomechanicsEfficiencyScores } from "@empathy/domain-biomechanics";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import { parseBiomechPoseProposal, type BiomechanicsReportData } from "@/lib/biomechanics/biomech-report-utils";
import { resolveOverlayLandmarks } from "@/lib/biomechanics/biomech-skeleton-overlay";
import type { BiomechanicsCameraPlane } from "@empathy/contracts";
import { BiomechanicsReportPanels } from "@/modules/biomechanics/components/BiomechanicsReportPanels";
import {
  applyBiomechanicsStagingRun,
  fetchBiomechanicsStagingRunDetail,
  rejectBiomechanicsStagingRun,
  saveBiomechanicsStagingPoseCorrection,
} from "@/modules/biomechanics/services/biomechanics-module-api";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function withDerivedScores(
  base: BiomechanicsReportData,
  landmarks: BiomechanicsLandmark3D[],
  jointAngles: BiomechanicsJointAngleSample[],
): BiomechanicsReportData {
  const efficiencyScores = computeBiomechanicsEfficiencyScores({
    jointAngles,
    movementPatterns: base.movementPatterns,
    riskScores: base.riskScores,
  });
  return { ...base, landmarks, jointAngles, efficiencyScores };
}

function parseCameraPlaneFromBundle(bundle: Record<string, unknown> | null): BiomechanicsCameraPlane {
  const plane = bundle?.cameraPlane;
  if (plane === "side" || plane === "front" || plane === "rear" || plane === "oblique" || plane === "multi_view") {
    return plane;
  }
  const db = bundle?.cameraPlaneDb;
  if (db === "sagittal") return "side";
  if (db === "frontal") return "front";
  if (db === "oblique") return "oblique";
  if (db === "multiview") return "multi_view";
  return "side";
}

export default function BiomechanicsStagingReviewView({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "confirm" | "reject" | "save">(null);
  const [done, setDone] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [cameraPlane, setCameraPlane] = useState<BiomechanicsCameraPlane>("side");
  const [reportData, setReportData] = useState<BiomechanicsReportData | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{
    landmarks: BiomechanicsLandmark3D[];
    jointAngles: BiomechanicsJointAngleSample[];
  } | null>(null);

  const flushPoseSave = useCallback(async () => {
    const pending = pendingSaveRef.current;
    if (!pending) return true;
    setBusy("save");
    const result = await saveBiomechanicsStagingPoseCorrection({
      runId,
      landmarks: pending.landmarks,
      jointAngles: pending.jointAngles,
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? "Salvataggio correzione fallito");
      return false;
    }
    pendingSaveRef.current = null;
    setSaveHint("Correzione punti salvata");
    return true;
  }, [runId]);

  const schedulePoseSave = useCallback(
    (landmarks: BiomechanicsLandmark3D[], jointAngles: BiomechanicsJointAngleSample[]) => {
      pendingSaveRef.current = { landmarks, jointAngles };
      setSaveHint("Salvataggio correzione...");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void flushPoseSave();
      }, 600);
    },
    [flushPoseSave],
  );

  const handlePoseAdjust = useCallback(
    (landmarks: BiomechanicsLandmark3D[], jointAngles: BiomechanicsJointAngleSample[]) => {
      setReportData((prev) => (prev ? withDerivedScores(prev, landmarks, jointAngles) : prev));
      schedulePoseSave(landmarks, jointAngles);
    },
    [schedulePoseSave],
  );

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
      const bundle = asRecord(detail.run?.candidate_bundle);
      setCameraPlane(parseCameraPlaneFromBundle(bundle));
      const patches = asRecord(detail.run?.proposed_structured_patches);
      const parsed = parseBiomechPoseProposal(patches);
      if (parsed) {
        const landmarks = resolveOverlayLandmarks(parsed.landmarks);
        const jointAngles = parsed.jointAngles ?? [];
        setReportData(withDerivedScores(parsed, landmarks, jointAngles));
      } else {
        setReportData(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [runId]);

  async function onConfirm() {
    setBusy("confirm");
    setError(null);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const saved = await flushPoseSave();
    if (!saved) {
      setBusy(null);
      return;
    }
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

  const angleCount = reportData?.jointAngles?.length ?? 0;

  return (
    <Pro2ModulePageShell
      eyebrow="Biomechanics · Review CV"
      eyebrowClassName="text-emerald-300"
      title="Validazione proposta pose"
      description="Allinea i punti sul video, verifica angoli e KPI, poi conferma la sessione."
      headerActions={
        <Pro2Link href="/biomechanics" variant="secondary" className="justify-center border border-white/15">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Biomechanics
        </Pro2Link>
      }
    >
      {loading ? <p className="text-sm text-gray-400">Caricamento review...</p> : null}
      {!loading && reportData ? (
        <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {angleCount} campioni angolo · trascina i punti rosa per correggere la CV
          {saveHint ? ` · ${saveHint}` : ""}
        </p>
      ) : null}
      {signedUrl ? (
        <p className="mt-3 text-xs text-gray-400 print:hidden">
          Media:{" "}
          <Link href={signedUrl} target="_blank" className="text-cyan-200 underline">
            apri cattura a schermo intero
          </Link>
        </p>
      ) : null}
      {reportData ? (
        <div className="mt-5">
          <BiomechanicsReportPanels
            data={reportData}
            mode="preview"
            videoUrl={signedUrl}
            editable={!done}
            cameraPlane={cameraPlane}
            onPoseAdjust={handlePoseAdjust}
          />
        </div>
      ) : !loading ? (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Proposta CV senza angoli strutturati — controlla il sidecar o ri-elabora il job.
        </p>
      ) : null}
      {error ? <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
      {done ? (
        <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Review chiusa. Torna al modulo per vedere sessioni e twin aggiornati.
        </p>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          <Pro2Button onClick={onConfirm} disabled={busy != null || loading} className="justify-center">
            <Check className="mr-2 h-4 w-4" />
            {busy === "confirm" ? "Conferma..." : busy === "save" ? "Salvataggio..." : "Conferma sessione"}
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
