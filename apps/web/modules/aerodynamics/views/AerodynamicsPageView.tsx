"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bike, CheckCircle2, Clock3, Gauge, UploadCloud, Wind } from "lucide-react";
import type {
  AerodynamicsCameraMode,
  AerodynamicsCaptureJobV1,
  AerodynamicsCaptureSource,
  AerodynamicsTestSessionV1,
} from "@empathy/contracts";
import { GenerativeModuleSubnav } from "@/components/navigation/GenerativeModuleSubnav";
import { Pro2AthleteRequiredGate } from "@/components/shell/Pro2AthleteRequiredGate";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import {
  fetchAerodynamicsTests,
  processAerodynamicsCaptureJob,
  uploadAerodynamicsCapture,
} from "@/modules/aerodynamics/services/aerodynamics-module-api";

const CAMERA_OPTIONS: Array<{ value: AerodynamicsCameraMode; label: string }> = [
  { value: "side", label: "Laterale" },
  { value: "front", label: "Frontale" },
  { value: "rear", label: "Posteriore" },
  { value: "multi_view", label: "Multi-view" },
  { value: "three_sixty", label: "360°" },
];

function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

function statusLabel(job: AerodynamicsCaptureJobV1, awaitingReview: boolean): string {
  if (awaitingReview) return "Review geometry";
  switch (job.status) {
    case "pending":
      return "In coda";
    case "processing":
      return "In elaborazione";
    case "completed":
      return "Completato";
    case "failed":
      return "Fallito";
    case "cancelled":
      return "Annullato";
  }
}

function LatestAeroJobCard({
  job,
  awaitingReview,
  stagingRunId,
}: {
  job: AerodynamicsCaptureJobV1 | null;
  awaitingReview: boolean;
  stagingRunId: string | null;
}) {
  if (!job) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-gray-500">Ultimo job</p>
        <p className="mt-2 text-sm text-gray-300">Nessuna cattura aero caricata.</p>
      </div>
    );
  }
  const Icon = job.status === "failed" ? AlertTriangle : awaitingReview || job.status === "completed" ? CheckCircle2 : Clock3;
  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-200" />
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-cyan-200">Ultimo job</p>
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{statusLabel(job, awaitingReview)}</p>
      <p className="mt-1 text-xs text-gray-400">
        {job.source} · {job.cameraMode} · {formatDateTime(job.createdAt)}
      </p>
      {awaitingReview && stagingRunId ? (
        <Link href={`/aerodynamics/staging/${stagingRunId}`} className="mt-3 inline-block text-xs font-semibold text-cyan-200 underline">
          Apri validazione geometry →
        </Link>
      ) : null}
      {job.errorMessage ? <p className="mt-2 text-xs text-rose-200">{job.errorMessage}</p> : null}
    </div>
  );
}

function AeroTestList({ tests }: { tests: AerodynamicsTestSessionV1[] }) {
  if (!tests.length) {
    return (
      <p className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
        Nessun test aero confermato. Elabora un job, valida la proposta CV, poi conferma per CdA canonico.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {tests.slice(0, 5).map((test) => (
        <div key={test.id} className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
          <p className="text-sm font-semibold text-white">
            CdA {Number.isFinite(test.cdaEstimate.cdaM2) ? test.cdaEstimate.cdaM2.toFixed(3) : "—"} m²
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {formatDateTime(test.recordedAt)} · {test.source} · confidence {(test.cdaEstimate.confidence01 * 100).toFixed(0)}%
          </p>
        </div>
      ))}
    </div>
  );
}

export default function AerodynamicsPageView() {
  const { athleteId, loading: athleteLoading } = useActiveAthlete();
  const [cameraMode, setCameraMode] = useState<AerodynamicsCameraMode>("side");
  const [file, setFile] = useState<File | null>(null);
  const [tests, setTests] = useState<AerodynamicsTestSessionV1[]>([]);
  const [captureJobs, setCaptureJobs] = useState<AerodynamicsCaptureJobV1[]>([]);
  const [pendingStaging, setPendingStaging] = useState<Array<{ id: string; jobId: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewStagingRunId, setReviewStagingRunId] = useState<string | null>(null);

  const latestJob = captureJobs[0] ?? null;
  const latestJobStaging = pendingStaging.find((row) => row.jobId === latestJob?.id) ?? pendingStaging[0] ?? null;
  const latestJobAwaitingReview = Boolean(latestJob && latestJobStaging);
  const source: AerodynamicsCaptureSource = file?.type.startsWith("image/") ? "image" : "smartphone_video";
  const latestCda = tests[0]?.cdaEstimate.cdaM2;

  const refresh = useCallback(async () => {
    if (!athleteId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAerodynamicsTests(athleteId);
      setTests(result.tests);
      setCaptureJobs(result.captureJobs);
      setPendingStaging(result.pendingStaging.map((row) => ({ id: row.id, jobId: row.jobId })));
      if (result.error) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aerodynamics non disponibile.");
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    if (athleteLoading || !athleteId) return;
    void refresh();
  }, [athleteId, athleteLoading, refresh]);

  const captureCountLabel = useMemo(() => {
    const active = captureJobs.filter((job) => job.status === "pending" || job.status === "processing").length;
    return `${captureJobs.length} job · ${active} attivi`;
  }, [captureJobs]);

  async function onProcessJob(jobId: string): Promise<string | null> {
    if (!athleteId || processingJobId) return null;
    setProcessingJobId(jobId);
    setError(null);
    setMessage(null);
    try {
      const out = await processAerodynamicsCaptureJob({ athleteId, jobId });
      if (!out.ok) {
        setError(out.message || out.error || "Elaborazione fallita.");
        return null;
      }
      return out.stagingRunId ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Elaborazione fallita.");
      return null;
    } finally {
      setProcessingJobId(null);
    }
  }

  async function onUpload() {
    if (!athleteId || !file || uploading) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const out = await uploadAerodynamicsCapture({
        athleteId,
        file,
        source,
        cameraMode,
      });
      setMessage("Upload completato — elaborazione geometry...");
      setFile(null);
      const stagingRunId = await onProcessJob(out.job.id);
      await refresh();
      if (stagingRunId) {
        setReviewStagingRunId(stagingRunId);
        setMessage("Proposta geometry pronta — conferma in review per CdA canonico.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload Aerodynamics fallito.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Pro2AthleteRequiredGate enabled>
      <Pro2ModulePageShell
        eyebrow="Aerodynamics Engine · Capture"
        eyebrowClassName="text-cyan-300"
        title="Aerodynamics"
        description="Cattura media → CV geometry → review atleta/coach → motore deterministico → twin aero."
        headerActions={
          <>
            <Pro2Link href="/training" variant="secondary" className="justify-center border border-orange-500/35 bg-orange-500/10">
              Training
            </Pro2Link>
            <Pro2Link href="/biomechanics" variant="ghost" className="justify-center border border-emerald-500/35 bg-emerald-500/10">
              Biomechanics
            </Pro2Link>
          </>
        }
      >
        <div className="scroll-mt-28">
          <GenerativeModuleSubnav />
        </div>

        <section id="gen-domain" className="scroll-mt-28">
          <Pro2SectionCard
            accent="cyan"
            icon={Wind}
            title="Aero capture line"
            subtitle="Upload firmato su Storage privato, poi job canonico in aero_capture_jobs."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <LatestAeroJobCard
                job={latestJob}
                awaitingReview={latestJobAwaitingReview}
                stagingRunId={latestJobStaging?.id ?? null}
              />
              <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.06] p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-orange-200">Archivio capture</p>
                <p className="mt-2 text-lg font-semibold text-white">{captureCountLabel}</p>
                <p className="mt-1 text-xs text-gray-400">Job più recenti, scoped su atleta attivo.</p>
              </div>
              <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.06] p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-fuchsia-200">CdA corrente</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {typeof latestCda === "number" ? `${latestCda.toFixed(3)} m²` : "—"}
                </p>
                <p className="mt-1 text-xs text-gray-400">Solo da test session validata.</p>
              </div>
            </div>
            {pendingStaging.length ? (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {pendingStaging.length} review geometry in attesa —{" "}
                <Link href={`/aerodynamics/staging/${pendingStaging[0]!.id}`} className="underline">
                  apri validazione
                </Link>
              </div>
            ) : null}
            {latestJob?.status === "pending" && !latestJobAwaitingReview ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Pro2Button
                  variant="secondary"
                  onClick={() => void onProcessJob(latestJob.id).then(async (stagingRunId) => {
                    await refresh();
                    if (stagingRunId) {
                      setReviewStagingRunId(stagingRunId);
                      setMessage("Proposta geometry pronta — conferma in review per CdA canonico.");
                    }
                  })}
                  disabled={processingJobId != null}
                  className="justify-center"
                >
                  {processingJobId === latestJob.id ? "Elaborazione CV..." : "Elabora ultimo job"}
                </Pro2Button>
              </div>
            ) : null}
          </Pro2SectionCard>
        </section>

        <section id="gen-body" className="scroll-mt-28">
          <Pro2SectionCard
            accent="orange"
            icon={UploadCloud}
            title="Nuova cattura aero"
            subtitle="File supportati: MP4, MOV, JPEG, PNG, WEBP. La pagina crea solo il job: ricostruzione 3D e CdA sono step pipeline."
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-2 text-sm text-gray-300">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Camera</span>
                <select
                  value={cameraMode}
                  onChange={(e) => setCameraMode(e.currentTarget.value as AerodynamicsCameraMode)}
                  className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-white"
                >
                  {CAMERA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-gray-300">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Input</p>
                <p className="mt-2">Ciclista + bici: posizione, casco, ruote, cockpit, borracce.</p>
              </div>
              <label className="space-y-2 text-sm text-gray-300 lg:min-w-72">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Media</span>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
                  className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-cyan-100"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Pro2Button onClick={onUpload} disabled={!file || uploading || processingJobId != null || !athleteId} className="justify-center">
                {uploading || processingJobId ? "Upload ed elaborazione..." : "Carica ed elabora"}
              </Pro2Button>
              {file ? <p className="text-xs text-gray-400">{file.name} · {(file.size / 1_000_000).toFixed(1)} MB</p> : null}
            </div>
            {message ? (
              <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {message}
                {(reviewStagingRunId ?? latestJobStaging?.id) ? (
                  <>
                    {" "}
                    <Link href={`/aerodynamics/staging/${reviewStagingRunId ?? latestJobStaging?.id}`} className="font-semibold underline">
                      Apri review →
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}
            {error ? <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
          </Pro2SectionCard>
        </section>

        <section id="gen-cross" className="scroll-mt-28">
          <Pro2SectionCard
            accent="violet"
            icon={Gauge}
            title="Test sessions"
            subtitle="CdA, drag e saving compaiono solo dopo test validato e domain engine."
          >
            {loading ? <p className="text-sm text-gray-400">Caricamento archivio Aerodynamics...</p> : <AeroTestList tests={tests} />}
          </Pro2SectionCard>
        </section>

        <section id="gen-focus" className="scroll-mt-28">
          <Pro2SectionCard
            accent="amber"
            icon={Bike}
            title="Guardrail aero"
            subtitle="Scenario matrix surrogate (AiRO-like) + validazione umana prima del twin."
          >
            <p className="text-sm leading-relaxed text-gray-300">
              CV propone geometry; il motore genera scenari posizione bounded. Confermi uno scenario →{" "}
              <code className="text-gray-100">@empathy/domain-aerodynamics</code> calcola CdA, watt e time savings.
              Badge: <span className="text-cyan-200">Surrogate model</span>.
            </p>
          </Pro2SectionCard>
        </section>
      </Pro2ModulePageShell>
    </Pro2AthleteRequiredGate>
  );
}
