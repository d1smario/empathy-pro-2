"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Camera, CheckCircle2, Clock3, UploadCloud } from "lucide-react";
import type {
  BiomechanicsCameraPlane,
  BiomechanicsCaptureJobV1,
  BiomechanicsCaptureSource,
  BiomechanicsDiscipline,
  BiomechanicsSessionImportV1,
} from "@empathy/contracts";
import { GenerativeModuleSubnav } from "@/components/navigation/GenerativeModuleSubnav";
import { Pro2AthleteRequiredGate } from "@/components/shell/Pro2AthleteRequiredGate";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import {
  fetchBiomechanicsSessions,
  importBiomechanicsOpenCapSession,
  processBiomechanicsCaptureJob,
  uploadBiomechanicsCapture,
} from "@/modules/biomechanics/services/biomechanics-module-api";

const DISCIPLINE_OPTIONS: Array<{ value: BiomechanicsDiscipline; label: string }> = [
  { value: "cycling", label: "Cycling" },
  { value: "running", label: "Running" },
  { value: "walking", label: "Walking" },
  { value: "gym", label: "Gym" },
  { value: "movement_screening", label: "Movement screening" },
];

const CAMERA_OPTIONS: Array<{ value: BiomechanicsCameraPlane; label: string }> = [
  { value: "side", label: "Laterale" },
  { value: "front", label: "Frontale" },
  { value: "rear", label: "Posteriore" },
  { value: "oblique", label: "Obliqua" },
  { value: "multi_view", label: "Multi-view" },
];

function statusLabel(job: BiomechanicsCaptureJobV1, awaitingReview: boolean): string {
  if (awaitingReview) return "Review CV";
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

function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

function LatestJobCard({
  job,
  awaitingReview,
  stagingRunId,
}: {
  job: BiomechanicsCaptureJobV1 | null;
  awaitingReview: boolean;
  stagingRunId: string | null;
}) {
  if (!job) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-gray-500">Ultimo job</p>
        <p className="mt-2 text-sm text-gray-300">Nessuna cattura Biomechanics ancora caricata.</p>
      </div>
    );
  }
  const Icon = job.status === "failed" ? AlertTriangle : awaitingReview || job.status === "completed" ? CheckCircle2 : Clock3;
  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-emerald-200" />
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-emerald-200">Ultimo job</p>
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{statusLabel(job, awaitingReview)}</p>
      <p className="mt-1 text-xs text-gray-400">
        {job.discipline} · {job.cameraPlane} · {formatDateTime(job.createdAt)}
      </p>
      {awaitingReview && stagingRunId ? (
        <Link href={`/biomechanics/staging/${stagingRunId}`} className="mt-3 inline-block text-xs font-semibold text-emerald-200 underline">
          Apri validazione CV →
        </Link>
      ) : null}
      {job.errorMessage ? <p className="mt-2 text-xs text-rose-200">{job.errorMessage}</p> : null}
    </div>
  );
}

function CaptureNextSteps({
  latestJob,
  awaitingReview,
  stagingRunId,
  processingJobId,
  onAnalyze,
  hasConfirmedReport,
  latestSessionId,
  actionError,
}: {
  latestJob: BiomechanicsCaptureJobV1 | null;
  awaitingReview: boolean;
  stagingRunId: string | null;
  processingJobId: string | null;
  onAnalyze: () => void;
  hasConfirmedReport: boolean;
  latestSessionId: string | null;
  actionError: string | null;
}) {
  if (awaitingReview && stagingRunId) {
    return (
      <div className="mt-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-amber-200">Prossimo passo</p>
        <p className="mt-2 text-sm text-amber-50">Proposta CV pronta. Valida per generare efficienza, simmetria e rischio nel twin.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Pro2Link href={`/biomechanics/staging/${stagingRunId}`} className="justify-center">
            Valida proposta CV
          </Pro2Link>
        </div>
      </div>
    );
  }

  if (latestJob?.status === "pending") {
    return (
      <div className="mt-4 rounded-2xl border border-fuchsia-500/35 bg-fuchsia-500/10 p-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-fuchsia-200">Prossimo passo</p>
        <p className="mt-2 text-sm text-fuchsia-50">
          Video in coda ({latestJob.id.slice(0, 8)}…). Avvia l&apos;analisi CV per ottenere angoli e rischi proposti.
        </p>
        {actionError ? <p className="mt-2 text-sm text-rose-200">{actionError}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <Pro2Button onClick={onAnalyze} disabled={processingJobId != null} className="justify-center">
            {processingJobId === latestJob.id ? "Analisi in corso..." : "Analizza video"}
          </Pro2Button>
        </div>
      </div>
    );
  }

  if (latestJob?.status === "processing" && !awaitingReview) {
    return (
      <div className="mt-4 rounded-2xl border border-cyan-500/35 bg-cyan-500/10 p-4">
        <p className="text-sm text-cyan-100">Analisi interrotta o in sospeso. Riprova l&apos;analisi CV.</p>
        <div className="mt-3">
          <Pro2Button onClick={onAnalyze} disabled={processingJobId != null} className="justify-center">
            {processingJobId ? "Analisi in corso..." : "Riprova analisi"}
          </Pro2Button>
        </div>
      </div>
    );
  }

  if (latestJob?.status === "failed") {
    return (
      <div className="mt-4 rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4">
        <p className="text-sm text-rose-100">
          Ultima analisi fallita{latestJob.errorMessage ? `: ${latestJob.errorMessage}` : "."} Carica di nuovo il video.
        </p>
      </div>
    );
  }

  if (hasConfirmedReport && latestSessionId) {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4">
        <p className="text-sm text-emerald-100">Report confermato con angoli, ROM e rischio per distretto.</p>
        <div className="mt-3">
          <Pro2Link href={`/biomechanics/sessions/${latestSessionId}`} variant="secondary" className="justify-center">
            Apri report PDF
          </Pro2Link>
        </div>
      </div>
    );
  }

  return null;
}

function SessionList({
  sessions,
  pendingStagingId,
}: {
  sessions: BiomechanicsSessionImportV1[];
  pendingStagingId: string | null;
}) {
  if (!sessions.length) {
    return (
      <p className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
        Nessun report confermato ancora. L&apos;analisi CV produce una <strong>proposta in review</strong> — il report
        (efficienza, simmetria, rischio) compare qui solo dopo conferma.
        {pendingStagingId ? (
          <>
            {" "}
            <Link href={`/biomechanics/staging/${pendingStagingId}`} className="font-semibold underline">
              Apri review in attesa →
            </Link>
          </>
        ) : null}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {sessions.slice(0, 5).map((session) => (
        <Link
          key={session.id}
          href={`/biomechanics/sessions/${session.id}`}
          className="block rounded-xl border border-white/10 bg-black/30 px-4 py-3 transition hover:border-violet-500/40 hover:bg-violet-500/[0.06]"
        >
          <p className="text-sm font-semibold text-white">{session.discipline}</p>
          <p className="mt-1 text-xs text-gray-400">
            {formatDateTime(session.recordedAt)} · {session.source}
          </p>
          {session.efficiencyScores ? (
            <p className="nutrition-muted mt-2 mb-0 text-[0.72rem]">
              Efficienza {Math.round(session.efficiencyScores.biomechanicalEfficiency01 * 100)}% · simmetria{" "}
              {Math.round(session.efficiencyScores.symmetry01 * 100)}% · rischio{" "}
              {Math.round(session.efficiencyScores.injuryRisk01 * 100)}%
            </p>
          ) : null}
          <p className="mt-2 text-xs font-semibold text-violet-200">Apri report completo →</p>
        </Link>
      ))}
    </div>
  );
}

export default function BiomechanicsPageView() {
  const { athleteId, loading: athleteLoading } = useActiveAthlete();
  const [discipline, setDiscipline] = useState<BiomechanicsDiscipline>("cycling");
  const [cameraPlane, setCameraPlane] = useState<BiomechanicsCameraPlane>("side");
  const [file, setFile] = useState<File | null>(null);
  const [sessions, setSessions] = useState<BiomechanicsSessionImportV1[]>([]);
  const [captureJobs, setCaptureJobs] = useState<BiomechanicsCaptureJobV1[]>([]);
  const [pendingStaging, setPendingStaging] = useState<Array<{ id: string; jobId: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [openCapSessionId, setOpenCapSessionId] = useState("");
  const [importingOpenCap, setImportingOpenCap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewStagingRunId, setReviewStagingRunId] = useState<string | null>(null);
  const [lastCreatedJob, setLastCreatedJob] = useState<BiomechanicsCaptureJobV1 | null>(null);

  const serverLatestJob = captureJobs[0] ?? null;
  const latestJob =
    serverLatestJob && lastCreatedJob?.id === serverLatestJob.id ? serverLatestJob : serverLatestJob ?? lastCreatedJob;
  const activeStagingId = reviewStagingRunId ?? pendingStaging[0]?.id ?? null;
  const latestJobStaging = pendingStaging.find((row) => row.jobId === latestJob?.id) ?? pendingStaging[0] ?? null;
  const latestJobAwaitingReview = pendingStaging.length > 0;
  const source: BiomechanicsCaptureSource = file?.type.startsWith("image/") ? "image" : "smartphone_video";

  const refresh = useCallback(async (opts?: { preserveError?: boolean }) => {
    if (!athleteId) return;
    setLoading(true);
    if (!opts?.preserveError) setError(null);
    try {
      const result = await fetchBiomechanicsSessions(athleteId);
      setSessions(result.sessions);
      setCaptureJobs(result.captureJobs);
      setPendingStaging(result.pendingStaging.map((row) => ({ id: row.id, jobId: row.jobId })));
      setLastCreatedJob(null);
      if (result.pendingStaging[0]?.id) {
        setReviewStagingRunId(result.pendingStaging[0].id);
      }
      if (result.error) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Biomechanics non disponibile.");
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    if (athleteLoading || !athleteId) return;
    void refresh();
  }, [athleteId, athleteLoading, refresh]);

  const captureCountLabel = useMemo(() => {
    const pending = captureJobs.filter((job) => job.status === "pending" || job.status === "processing").length;
    return `${captureJobs.length} job · ${pending} attivi`;
  }, [captureJobs]);

  const latestEfficiency = sessions[0]?.efficiencyScores ?? null;

  async function onProcessJob(jobId: string): Promise<string | null> {
    if (!athleteId || processingJobId) return null;
    setProcessingJobId(jobId);
    setError(null);
    setMessage(null);
    try {
      const out = await processBiomechanicsCaptureJob({ athleteId, jobId });
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
      const out = await uploadBiomechanicsCapture({
        athleteId,
        file,
        discipline,
        cameraPlane,
        source,
      });
      setLastCreatedJob(out.job);
      setCaptureJobs((prev) => [out.job, ...prev.filter((job) => job.id !== out.job.id)]);
      setMessage("Upload completato — elaborazione CV...");
      setFile(null);
      const stagingRunId = await onProcessJob(out.job.id);
      if (stagingRunId) {
        await refresh();
        setReviewStagingRunId(stagingRunId);
        setMessage("Proposta CV pronta — conferma in review per alimentare il twin.");
      } else {
        await refresh({ preserveError: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload Biomechanics fallito.");
    } finally {
      setUploading(false);
    }
  }

  async function onImportOpenCap() {
    if (!athleteId || !openCapSessionId.trim() || importingOpenCap) return;
    setImportingOpenCap(true);
    setError(null);
    setMessage(null);
    try {
      const out = await importBiomechanicsOpenCapSession({
        athleteId,
        externalSessionId: openCapSessionId.trim(),
        discipline,
      });
      if (!out.ok) {
        setError(out.message || out.error || "Import OpenCap fallito.");
        return;
      }
      setMessage("Sessione OpenCap in review — conferma per promuovere al twin.");
      setOpenCapSessionId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import OpenCap fallito.");
    } finally {
      setImportingOpenCap(false);
    }
  }

  async function runAnalyzeLatestJob() {
    if (!latestJob) return;
    setMessage("Analisi CV in corso...");
    const stagingRunId = await onProcessJob(latestJob.id);
    if (stagingRunId) {
      await refresh();
      setReviewStagingRunId(stagingRunId);
      setMessage("Proposta CV pronta — valida per generare il report.");
    } else {
      await refresh({ preserveError: true });
      setMessage(null);
    }
  }

  return (
    <Pro2AthleteRequiredGate enabled>
      <Pro2ModulePageShell
        eyebrow="Biomechanics Engine · Capture"
        eyebrowClassName="text-emerald-300"
        title="Biomechanics"
        description="Cattura media → CV esterno → review atleta/coach → motore deterministico → twin biomeccanico."
        headerActions={
          <>
            <Pro2Link href="/training" variant="secondary" className="justify-center border border-sky-500/35 bg-sky-500/10">
              Training
            </Pro2Link>
            <Pro2Link href="/physiology" variant="ghost" className="justify-center border border-emerald-500/35 bg-emerald-500/10">
              Physiology
            </Pro2Link>
          </>
        }
      >
        <div className="scroll-mt-28">
          <GenerativeModuleSubnav />
        </div>

        {pendingStaging.length ? (
          <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/15 px-4 py-4 text-sm text-amber-50">
            <strong className="font-semibold">Proposta CV pronta — non è ancora un report.</strong> Conferma in review per
            generare efficienza/simmetria/rischio.{" "}
            <Link href={`/biomechanics/staging/${activeStagingId}`} className="font-semibold underline">
              Valida proposta CV →
            </Link>
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
            <strong className="font-semibold">Biomechanics non disponibile:</strong> {error}
          </div>
        ) : null}

        <section id="gen-body" className="scroll-mt-28">
          <Pro2SectionCard
            accent="cyan"
            icon={UploadCloud}
            title="Nuova cattura"
            subtitle="Carica il video → analisi CV → validazione → report efficienza nel twin."
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-2 text-sm text-gray-300">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Disciplina</span>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.currentTarget.value as BiomechanicsDiscipline)}
                  className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-white"
                >
                  {DISCIPLINE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-300">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Camera</span>
                <select
                  value={cameraPlane}
                  onChange={(e) => setCameraPlane(e.currentTarget.value as BiomechanicsCameraPlane)}
                  className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-white"
                >
                  {CAMERA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-300 lg:min-w-72">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Media</span>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
                  className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500/20 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-emerald-100"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Pro2Button onClick={onUpload} disabled={!file || uploading || processingJobId != null || !athleteId} className="justify-center">
                {uploading || processingJobId ? "Upload ed elaborazione..." : "Carica ed elabora"}
              </Pro2Button>
              {file ? <p className="text-xs text-gray-400">{file.name} · {(file.size / 1_000_000).toFixed(1)} MB</p> : null}
            </div>
            <CaptureNextSteps
              latestJob={latestJob}
              awaitingReview={latestJobAwaitingReview}
              stagingRunId={activeStagingId}
              processingJobId={processingJobId}
              onAnalyze={() => void runAnalyzeLatestJob()}
              hasConfirmedReport={sessions.length > 0}
              latestSessionId={sessions[0]?.id ?? null}
              actionError={error}
            />
            {message ? (
              <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {message}
                {activeStagingId ? (
                  <>
                    {" "}
                    <Link href={`/biomechanics/staging/${activeStagingId}`} className="font-semibold underline">
                      Apri review →
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}
            {error ? <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
          </Pro2SectionCard>
        </section>

        <section id="gen-domain" className="scroll-mt-28">
          <Pro2SectionCard
            accent="emerald"
            icon={Camera}
            title="Stato capture"
            subtitle="Job, review in attesa e ultimo report confermato."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <LatestJobCard
                job={latestJob}
                awaitingReview={latestJobAwaitingReview}
                stagingRunId={latestJobStaging?.id ?? null}
              />
              <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-cyan-200">Archivio capture</p>
                <p className="mt-2 text-lg font-semibold text-white">{captureCountLabel}</p>
                <p className="mt-1 text-xs text-gray-400">Job più recenti, scoped su atleta attivo.</p>
              </div>
              <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.06] p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-fuchsia-200">Report confermato</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {latestEfficiency ? `${Math.round(latestEfficiency.biomechanicalEfficiency01 * 100)}%` : "—"}
                </p>
                <p className="mt-1 text-xs text-gray-400">Efficienza biomeccanica (domain engine).</p>
                {sessions[0] ? (
                  <Link
                    href={`/biomechanics/sessions/${sessions[0].id}`}
                    className="mt-2 inline-block text-xs font-semibold text-fuchsia-200 underline"
                  >
                    Report completo →
                  </Link>
                ) : null}
              </div>
            </div>
            {pendingStaging.length ? (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {pendingStaging.length} review CV in attesa —{" "}
                <Link href={`/biomechanics/staging/${pendingStaging[0]!.id}`} className="underline">
                  apri validazione
                </Link>
              </div>
            ) : null}
          </Pro2SectionCard>
        </section>

        <section className="scroll-mt-28">
          <Pro2SectionCard
            accent="fuchsia"
            icon={Camera}
            title="Import OpenCap"
            subtitle="Session UUID da app.opencap.ai → sidecar OPENCAP_API_BASE_URL → stesso staging/review."
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[16rem] flex-1 space-y-2 text-sm text-gray-300">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Session ID</span>
                <input
                  value={openCapSessionId}
                  onChange={(e) => setOpenCapSessionId(e.currentTarget.value)}
                  placeholder="7272a71a-e70a-4794-a253-39e11cb7542c"
                  className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-white"
                />
              </label>
              <Pro2Button
                variant="secondary"
                onClick={onImportOpenCap}
                disabled={!openCapSessionId.trim() || importingOpenCap || !athleteId}
                className="justify-center"
              >
                {importingOpenCap ? "Import..." : "Importa OpenCap"}
              </Pro2Button>
            </div>
          </Pro2SectionCard>
        </section>

        <section id="biomech-report" className="scroll-mt-28">
          <Pro2SectionCard
            accent="violet"
            icon={Activity}
            title="Report sessioni"
            subtitle="Efficienza, simmetria e rischio dopo validazione CV."
          >
            {loading ? (
              <p className="text-sm text-gray-400">Caricamento archivio Biomechanics...</p>
            ) : (
              <SessionList sessions={sessions} pendingStagingId={activeStagingId} />
            )}
          </Pro2SectionCard>
        </section>

        <section id="gen-focus" className="scroll-mt-28">
          <Pro2SectionCard
            accent="amber"
            icon={AlertTriangle}
            title="Guardrail generativo"
            subtitle="La pagina non calcola angoli, rischi o score: quelli arrivano solo dal domain engine dopo validazione."
          >
            <p className="text-sm leading-relaxed text-gray-300">
              I numeri canonici (efficienza, simmetria, rischio) provengono solo da{" "}
              <code className="text-gray-100">@empathy/domain-biomechanics</code> dopo conferma staging. Il CV esterno
              propone landmark/angoli; atleta e coach validano prima della promozione a twin.
            </p>
          </Pro2SectionCard>
        </section>
      </Pro2ModulePageShell>
    </Pro2AthleteRequiredGate>
  );
}
